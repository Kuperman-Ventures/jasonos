"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { listRecentCounterparties } from "@/lib/integrations/gmail";
import {
  buildContactLookup,
  canonicalEmail,
  isMyOwnAddress,
} from "@/lib/outreach/email-matching";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContactCandidate {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  first_seen: string;
  last_seen: string;
  last_subject: string | null;
  inbound_count: number;
  outbound_count: number;
  status: "new" | "added" | "dismissed";
}

type ActionResult = { ok: true } | { ok: false; error: string };
type AddCandidateResult =
  | { ok: true; contactId: string }
  | { ok: false; error: string };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ---------------------------------------------------------------------------
// Noise filtering — keep real people, drop automated / role / bulk senders.
// ---------------------------------------------------------------------------

const AUTOMATED_LOCAL_RE =
  /^(no-?reply|noreply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce[s]?|notif(y|ication|ications)?|automated|auto-?confirm|calendar-notification|invitation|invites?|team|updates?|newsletter|mailer|email|via)([._+-]|$)/i;

const AUTOMATED_DOMAIN_RE =
  /(^|\.)(bounce|bounces|mailer|notifications?|reply|em|sendgrid|mailchimp|mcsv|substack|mailgun|amazonses|sparkpostmail|sendinblue|hubspotemail|mktomail)\./i;

function isNoiseEmail(email: string): boolean {
  const [local, domain] = email.split("@");
  if (!local || !domain) return true;
  if (AUTOMATED_LOCAL_RE.test(local)) return true;
  if (AUTOMATED_DOMAIN_RE.test(domain)) return true;
  return false;
}

function companyFromEmail(email: string): string | null {
  const domain = email.split("@")[1] ?? "";
  const base = domain.split(".").slice(0, -1).join(".");
  const free = new Set([
    "gmail",
    "yahoo",
    "hotmail",
    "outlook",
    "icloud",
    "aol",
    "me",
    "proton",
    "protonmail",
    "msn",
    "live",
  ]);
  if (!base || free.has(base.toLowerCase())) return null;
  return base
    .split(/[.-]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function nameFromEmail(email: string): string {
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

// Capitalize the first letter of each alphabetic run so hyphenated and
// apostrophed names read correctly ("o'brien" -> "O'Brien").
function titleCaseToken(w: string): string {
  return w.replace(
    /[a-zA-Z]+/g,
    (m) => m[0].toUpperCase() + m.slice(1).toLowerCase()
  );
}

// Normalize a display name captured from an email header into a consistent
// "First Last" order with sane casing. Best-effort — ambiguous names are left
// alone:
//   "Smith, John"     -> "John Smith"
//   "JOHN SMITH"      -> "John Smith"
//   "john smith"      -> "John Smith"
//   "McDonald, Fiona" -> "Fiona McDonald"  (deliberate internal caps kept)
function normalizePersonName(raw: string | null | undefined): string {
  let s = (raw ?? "").trim().replace(/\s+/g, " ");
  // Strip surrounding quotes some mail clients wrap display names in.
  s = s.replace(/^['"]+|['"]+$/g, "").trim();
  if (!s) return "";
  // Drop an email address if it leaked into the display name.
  if (/\S+@\S+\.\S+/.test(s)) {
    s = s.replace(/\S+@\S+\.\S+/g, "").trim();
    if (!s) return "";
  }
  // "Last, First [Middle]" -> "First [Middle] Last" (a single comma only).
  const commaParts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length === 2) {
    s = `${commaParts[1]} ${commaParts[0]}`;
  }
  // Title-case ALL-CAPS or all-lowercase tokens; keep deliberate mixed casing.
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

// ---------------------------------------------------------------------------
// captureEmailCandidates — scan recent mail, stage unknown counterparties.
// ---------------------------------------------------------------------------

interface Agg {
  email: string;
  name: string | null;
  company: string | null;
  inbound: number;
  outbound: number;
  lastSeen: string;
  lastSubject: string | null;
}

export async function captureEmailCandidates(opts?: {
  days?: number;
  max?: number;
}): Promise<
  | { ok: true; scanned: number; created: number; updated: number; skipped: number }
  | { ok: false; error: string }
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const days = opts?.days ?? 30;
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();
  const scan = await listRecentCounterparties({ sinceIso, max: opts?.max ?? 60 });
  if (!scan.configured) {
    return { ok: false, error: "Gmail is not connected." };
  }
  if (scan.error) return { ok: false, error: scan.error };

  const lookup = await buildContactLookup();

  // Aggregate scan rows per canonical email.
  const agg = new Map<string, Agg>();
  let skipped = 0;
  for (const cp of scan.data) {
    if (!cp.email || isMyOwnAddress(cp.email)) continue;
    if (cp.bulk || isNoiseEmail(cp.email)) {
      skipped += 1;
      continue;
    }
    const canon = canonicalEmail(cp.email);
    // Already a known contact → not a candidate. Match by email AND name
    // (resolve() tries email, then display name, then a name guessed from the
    // local-part) so imported contacts without an email on file still dedupe.
    const header = cp.name ? `${cp.name} <${cp.email}>` : cp.email;
    if (lookup.resolve(header)) continue;

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

  if (!agg.size) {
    return { ok: true, scanned: scan.data.length, created: 0, updated: 0, skipped };
  }

  const sb = createServiceRoleClient();
  const emails = Array.from(agg.keys());
  const { data: existingRows, error: readErr } = await sb
    .from("contact_candidates")
    .select("id,email,status,name,first_seen")
    .in("email", emails);
  if (readErr) return { ok: false, error: readErr.message };

  const existingByEmail = new Map<string, { id: string; status: string; name: string | null }>();
  for (const r of existingRows ?? []) {
    existingByEmail.set(r.email as string, {
      id: r.id as string,
      status: r.status as string,
      name: (r.name as string | null) ?? null,
    });
  }

  const toInsert: Record<string, unknown>[] = [];
  const updates: Promise<unknown>[] = [];
  let created = 0;
  let updated = 0;

  for (const a of agg.values()) {
    const existing = existingByEmail.get(a.email);
    if (existing) {
      // Respect prior decisions — never resurrect an added/dismissed row.
      if (existing.status !== "new") continue;
      updated += 1;
      updates.push(
        (async () => {
          await sb
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
            .eq("id", existing.id);
        })()
      );
    } else {
      created += 1;
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
    const { error: insErr } = await sb.from("contact_candidates").insert(toInsert);
    if (insErr) return { ok: false, error: insErr.message };
  }
  await Promise.all(updates);

  revalidatePath("/outreach/suggested");
  return { ok: true, scanned: scan.data.length, created, updated, skipped };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getContactCandidates(): Promise<ContactCandidate[]> {
  if (!hasConfig()) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contact_candidates")
    .select("*")
    .eq("status", "new");
  if (error) {
    console.error("[contact-candidates.getContactCandidates]", error);
    return [];
  }
  // Hide any suggestion that now matches a contact in the DB (by email or
  // name) — covers people added manually after they were first suggested.
  const lookup = await buildContactLookup();
  const rows = ((data ?? []) as ContactCandidate[]).filter((r) => {
    const header = r.name ? `${r.name} <${r.email}>` : r.email;
    return !lookup.resolve(header);
  });
  // Rank: two-way exchanges first, then total volume, then most recent.
  return rows.sort((a, b) => {
    const twoWayA = a.inbound_count > 0 && a.outbound_count > 0 ? 1 : 0;
    const twoWayB = b.inbound_count > 0 && b.outbound_count > 0 ? 1 : 0;
    if (twoWayA !== twoWayB) return twoWayB - twoWayA;
    const totalA = a.inbound_count + a.outbound_count;
    const totalB = b.inbound_count + b.outbound_count;
    if (totalA !== totalB) return totalB - totalA;
    return (b.last_seen ?? "").localeCompare(a.last_seen ?? "");
  });
}

export async function getNewCandidateCount(): Promise<number> {
  if (!hasConfig()) return 0;
  // Count the same filtered set the Suggested list shows (excludes any that
  // already match a contact) so the tab badge never overcounts.
  return (await getContactCandidates()).length;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function addCandidateAsContact(
  id: string
): Promise<AddCandidateResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!id) return { ok: false, error: "id is required." };

  const sb = createServiceRoleClient();
  const { data: cand, error: readErr } = await sb
    .from("contact_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!cand) return { ok: false, error: "Candidate not found." };

  const email = cand.email as string;
  const canon = canonicalEmail(email);
  const lookup = await buildContactLookup();
  const header = (cand.name as string | null)
    ? `${cand.name} <${email}>`
    : email;

  // Already added earlier — still return the contact so the caller can open
  // the modal for setup.
  if (cand.status === "added") {
    const existing = lookup.resolve(header);
    if (existing) return { ok: true, contactId: existing.id };
    return { ok: false, error: "Contact was marked added but could not be found." };
  }

  // Dedupe by email OR name. If a matching contact already exists, enrich it
  // with this email (so future scans match by email) instead of creating a
  // duplicate. Only create a new contact when there's no match at all.
  let contactId: string;
  const existingContact = lookup.resolve(header);
  if (existingContact) {
    contactId = existingContact.id;
    const hasEmail = existingContact.emails.some(
      (e) => canonicalEmail(e) === canon
    );
    if (!hasEmail) {
      const { error: enrichErr } = await sb
        .from("contacts")
        .update({ emails: [...existingContact.emails, email] })
        .eq("id", existingContact.id);
      if (enrichErr) return { ok: false, error: enrichErr.message };
    }
  } else {
    const name =
      normalizePersonName(cand.name as string | null) || nameFromEmail(email);
    const { data: inserted, error: insErr } = await sb
      .from("contacts")
      .insert({
        name,
        emails: [email],
        tags: ["source:email"],
      })
      .select("id")
      .single();
    if (insErr) return { ok: false, error: insErr.message };
    contactId = inserted.id as string;
  }

  const { error: updErr } = await sb
    .from("contact_candidates")
    .update({ status: "added", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/outreach/suggested");
  revalidatePath("/outreach/people");
  revalidatePath("/outreach/queue");
  return { ok: true, contactId };
}

export async function dismissCandidate(id: string): Promise<ActionResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!id) return { ok: false, error: "id is required." };
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("contact_candidates")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/outreach/suggested");
  return { ok: true };
}
