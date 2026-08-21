"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { appendSyncLog } from "@/lib/outreach/sync-log";
import { listRecentCounterparties } from "@/lib/integrations/gmail";
import {
  buildContactLookup,
  canonicalEmail,
} from "@/lib/outreach/email-matching";
import {
  nameFromEmail,
  normalizePersonName,
  upsertCandidateSightings,
} from "@/lib/outreach/candidate-capture";

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
// captureEmailCandidates — scan recent mail, stage unknown counterparties.
// Err toward Suggested. Jason Accepts or Dismisses. Only robots are skipped.
// ---------------------------------------------------------------------------

export async function captureEmailCandidates(opts?: {
  days?: number;
  max?: number;
  runId?: string;
}): Promise<
  | { ok: true; scanned: number; created: number; updated: number; skipped: number }
  | { ok: false; error: string }
> {
  const result = await captureEmailCandidatesInner(opts);
  if (result.ok) {
    if (result.accounts.length) {
      for (const account of result.accounts) {
        await appendSyncLog(
          "suggested",
          {
            ok: true,
            accountEmail: account.accountEmail,
            scanned: account.scanned,
            created: account.created,
            updated: account.updated,
            skipped: account.skipped,
            unmatchedNames: account.newNames,
          },
          opts?.runId
        );
      }
    } else {
      await appendSyncLog(
        "suggested",
        {
          ok: true,
          scanned: result.scanned,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
        },
        opts?.runId
      );
    }
  } else if (result.error !== "Not configured") {
    await appendSyncLog(
      "suggested",
      { ok: false, error: result.error },
      opts?.runId
    );
  }
  return result.ok
    ? {
        ok: true,
        scanned: result.scanned,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
      }
    : result;
}

async function captureEmailCandidatesInner(opts?: {
  days?: number;
  max?: number;
}): Promise<
  | {
      ok: true;
      scanned: number;
      created: number;
      updated: number;
      skipped: number;
      accounts: {
        accountEmail: string;
        scanned: number;
        created: number;
        updated: number;
        skipped: number;
        newNames: string[];
      }[];
    }
  | { ok: false; error: string }
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const days = opts?.days ?? 30;
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();
  const scan = await listRecentCounterparties({
    sinceIso,
    max: opts?.max ?? 250,
  });
  if (!scan.configured) {
    return { ok: false, error: "Gmail is not connected." };
  }
  if (scan.error) return { ok: false, error: scan.error };

  const lookup = await buildContactLookup();
  const byAccount = new Map<string, typeof scan.data>();
  for (const cp of scan.data) {
    const key = cp.accountEmail || "unknown";
    const list = byAccount.get(key) ?? [];
    list.push(cp);
    byAccount.set(key, list);
  }

  const accounts: {
    accountEmail: string;
    scanned: number;
    created: number;
    updated: number;
    skipped: number;
    newNames: string[];
  }[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [accountEmail, cps] of byAccount) {
    const staged = await upsertCandidateSightings(
      cps.map((cp) => ({
        email: cp.email,
        name: cp.name ?? null,
        dateIso: cp.dateIso,
        subject: cp.subject ?? null,
        direction: cp.direction,
      })),
      lookup
    );
    created += staged.created;
    updated += staged.updated;
    skipped += staged.skipped;
    accounts.push({
      accountEmail,
      scanned: cps.length,
      created: staged.created,
      updated: staged.updated,
      skipped: staged.skipped,
      newNames: staged.newNames,
    });
  }

  revalidatePath("/outreach/suggested");
  revalidatePath("/settings/sync-log");
  return {
    ok: true,
    scanned: scan.data.length,
    created,
    updated,
    skipped,
    accounts,
  };
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
