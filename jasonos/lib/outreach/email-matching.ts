// Shared helpers for matching email-flavored data to jasonos.contacts rows.
// Used by the Gmail / Calendar sync flows in Phase 4. Communications.ts uses
// its own inline versions for now; converge in a later cleanup pass.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** Known outbound email addresses (v1 hardcode — keep in sync if these change). */
export const MY_EMAILS = [
  "jason@kupermanadvisors.com",
  "jskuperman@gmail.com",
];

/** Extract the bare email from a header like `"Name" <email@x.com>`. */
export function extractEmail(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m?.[1] ?? value).trim().toLowerCase();
}

/** Strip plus-addressing so `jason+jobs@…` canonicalises to `jason@…`. */
export function canonicalEmail(raw: string): string {
  const e = extractEmail(raw);
  return e.replace(/\+[^@]*@/, "@");
}

/** Returns the display name part of a "Name <email>" header, lower-cased. */
export function extractDisplayName(value: string): string {
  const m = value.match(/^([^<]+)<[^>]+>/);
  return (m?.[1] ?? "").trim().replace(/^"|"$/g, "").toLowerCase();
}

export function normalizeName(name: string): string {
  // Strip apostrophes/punctuation so "Rena O'Brien" matches "Rena OBrien"
  // (common calendar vs CRM spelling drift).
  return name
    .toLowerCase()
    .replace(/['’ʼ]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isFromMe(fromHeader: string): boolean {
  const lower = fromHeader.toLowerCase();
  return MY_EMAILS.some((e) => lower.includes(e));
}

export function isMyOwnAddress(addr: string): boolean {
  const canon = canonicalEmail(addr);
  return MY_EMAILS.some((me) => canonicalEmail(me) === canon);
}

// ---------------------------------------------------------------------------
// Contact lookup map — built once per sync run so we can resolve email →
// jasonos.contacts.id without N+1 round-trips.
// ---------------------------------------------------------------------------

export interface ContactLookupRow {
  id: string;
  name: string;
  emails: string[];
}

export interface ContactLookup {
  rows: ContactLookupRow[];
  byEmail: Map<string, ContactLookupRow>;
  byName: Map<string, ContactLookupRow>;
  /** Resolve a "Name <email>" header to a contact row, or undefined. */
  resolve(header: string): ContactLookupRow | undefined;
}

export async function buildContactLookup(): Promise<ContactLookup> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select("id,name,emails");

  if (error) {
    console.error("[outreach.buildContactLookup]", error);
    return emptyLookup();
  }

  const rows: ContactLookupRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    emails: (row.emails as string[] | null) ?? [],
  }));

  const byEmail = new Map<string, ContactLookupRow>();
  const byName = new Map<string, ContactLookupRow>();

  for (const row of rows) {
    for (const email of row.emails) {
      if (!email) continue;
      byEmail.set(canonicalEmail(email), row);
    }
    byName.set(normalizeName(row.name), row);
  }

  return {
    rows,
    byEmail,
    byName,
    resolve(header: string) {
      const email = extractEmail(header);
      if (!email) return undefined;
      if (isMyOwnAddress(email)) return undefined;

      // 1. Direct email match
      const byMail = byEmail.get(canonicalEmail(email));
      if (byMail) return byMail;

      // 2. Display name match
      const display = extractDisplayName(header);
      if (display) {
        const byDisp = byName.get(display);
        if (byDisp) return byDisp;
      }

      // 3. Derive name from local-part: "jane.doe@…" → "jane doe"
      const local = email.split("@")[0] ?? "";
      const guessed = local
        .replace(/[._\-+]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (guessed) return byName.get(guessed);

      return undefined;
    },
  };
}

function emptyLookup(): ContactLookup {
  return {
    rows: [],
    byEmail: new Map(),
    byName: new Map(),
    resolve: () => undefined,
  };
}
