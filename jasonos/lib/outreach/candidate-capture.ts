import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildContactLookup,
  canonicalEmail,
  isMyOwnAddress,
  type ContactLookup,
} from "@/lib/outreach/email-matching";
import { companyFromEmail, isNoiseEmail } from "@/lib/outreach/mail-noise";

export interface CandidateSighting {
  email: string;
  name?: string | null;
  dateIso: string;
  subject?: string | null;
  direction: "inbound" | "outbound";
}

export interface CandidateUpsertResult {
  created: number;
  updated: number;
  skipped: number;
  scanned: number;
  newNames: string[];
}

interface Agg {
  email: string;
  name: string | null;
  company: string | null;
  inbound: number;
  outbound: number;
  lastSeen: string;
  lastSubject: string | null;
}

function titleCaseToken(w: string): string {
  return w.replace(
    /[a-zA-Z]+/g,
    (m) => m[0].toUpperCase() + m.slice(1).toLowerCase()
  );
}

export function normalizePersonName(raw: string | null | undefined): string {
  let s = (raw ?? "").trim().replace(/\s+/g, " ");
  s = s.replace(/^['"]+|['"]+$/g, "").trim();
  if (!s) return "";
  if (/\S+@\S+\.\S+/.test(s)) {
    s = s.replace(/\S+@\S+\.\S+/g, "").trim();
    if (!s) return "";
  }
  const commaParts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length === 2) {
    s = `${commaParts[1]} ${commaParts[0]}`;
  }
  return s
    .split(" ")
    .map((w) => {
      if (!w) return w;
      const isAllUpper = w === w.toUpperCase();
      const isAllLower = w === w.toLowerCase();
      return isAllUpper || isAllLower ? titleCaseToken(w) : w;
    })
    .join(" ")
    .trim();
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._\-+]+/g, " ")
    .replace(/\d+/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}

function displayName(name: string | null, email: string): string {
  return name || nameFromEmail(email) || email;
}

/**
 * Stage unknown people onto Suggested. Dismissed / already-added stay put.
 * Only obvious robots are skipped — Jason reviews the rest.
 */
export async function upsertCandidateSightings(
  sightings: CandidateSighting[],
  lookup?: ContactLookup
): Promise<CandidateUpsertResult> {
  const result: CandidateUpsertResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    scanned: sightings.length,
    newNames: [],
  };
  if (!sightings.length) return result;
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return result;
  }

  const contacts = lookup ?? (await buildContactLookup());
  const agg = new Map<string, Agg>();

  for (const cp of sightings) {
    if (!cp.email || isMyOwnAddress(cp.email)) continue;
    if (isNoiseEmail(cp.email)) {
      result.skipped += 1;
      continue;
    }
    const canon = canonicalEmail(cp.email);
    const header = cp.name ? `${cp.name} <${cp.email}>` : cp.email;
    if (contacts.resolve(header)) continue;

    const prev = agg.get(canon);
    if (prev) {
      if (cp.direction === "inbound") prev.inbound += 1;
      else prev.outbound += 1;
      if (cp.dateIso > prev.lastSeen) {
        prev.lastSeen = cp.dateIso;
        prev.lastSubject = cp.subject ?? prev.lastSubject;
      }
      if (!prev.name && cp.name) prev.name = normalizePersonName(cp.name);
    } else {
      agg.set(canon, {
        email: canon,
        name: cp.name ? normalizePersonName(cp.name) : null,
        company: companyFromEmail(canon),
        inbound: cp.direction === "inbound" ? 1 : 0,
        outbound: cp.direction === "outbound" ? 1 : 0,
        lastSeen: cp.dateIso,
        lastSubject: cp.subject ?? null,
      });
    }
  }

  if (!agg.size) return result;

  const sb = createServiceRoleClient();
  const emails = Array.from(agg.keys());
  const { data: existingRows, error: readErr } = await sb
    .from("contact_candidates")
    .select("id,email,status,name,first_seen")
    .in("email", emails);
  if (readErr) {
    console.error("[candidate-capture] read failed", readErr);
    return result;
  }

  const existingByEmail = new Map<
    string,
    { id: string; status: string; name: string | null }
  >();
  for (const r of existingRows ?? []) {
    existingByEmail.set(r.email as string, {
      id: r.id as string,
      status: r.status as string,
      name: (r.name as string | null) ?? null,
    });
  }

  const toInsert: Record<string, unknown>[] = [];
  const updates: Promise<unknown>[] = [];

  for (const a of agg.values()) {
    const existing = existingByEmail.get(a.email);
    if (existing) {
      if (existing.status !== "new") continue;
      result.updated += 1;
      updates.push(
        Promise.resolve(
          sb
            .from("contact_candidates")
            .update({
              name: existing.name ?? a.name,
              company: a.company,
              inbound_count: a.inbound,
              outbound_count: a.outbound,
              last_seen: a.lastSeen,
              last_subject: a.lastSubject,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
        )
      );
    } else {
      result.created += 1;
      result.newNames.push(displayName(a.name, a.email));
      toInsert.push({
        email: a.email,
        name: a.name ?? nameFromEmail(a.email),
        company: a.company,
        inbound_count: a.inbound,
        outbound_count: a.outbound,
        first_seen: a.lastSeen,
        last_seen: a.lastSeen,
        last_subject: a.lastSubject,
        status: "new",
      });
    }
  }

  if (toInsert.length) {
    const { error: insErr } = await sb
      .from("contact_candidates")
      .upsert(toInsert, { onConflict: "email", ignoreDuplicates: true });
    if (insErr) {
      console.error("[candidate-capture] insert failed", insErr);
      result.created = 0;
      result.newNames = [];
    }
  }
  await Promise.all(updates);
  return result;
}
