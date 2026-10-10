// Shared helpers for matching email-flavored data to jasonos.contacts rows.
// Used by the Gmail / Calendar sync flows in Phase 4. Communications.ts uses
// its own inline versions for now; converge in a later cleanup pass.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  createContactLookup,
  emptyLookup,
  type ContactLookup,
  type ContactLookupRow,
} from "@/lib/outreach/contact-lookup";

export {
  BEEPER_PLACEHOLDER_DOMAIN,
  MY_EMAILS,
  beeperCandidateIdentity,
  beeperSightingEmail,
  canonicalEmail,
  looksLikePersonName,
  createContactLookup,
  emptyLookup,
  extractDisplayName,
  extractEmail,
  findNameMatch,
  hasExactEmailMatch,
  isAlreadyAContact,
  isBeeperPlaceholderEmail,
  isFromMe,
  isMyOwnAddress,
  namesLookLikeSamePerson,
  normalizeName,
  normalizePhone,
} from "@/lib/outreach/contact-lookup";
export type {
  ContactLookup,
  ContactLookupRow,
  SuggestedNameMatch,
} from "@/lib/outreach/contact-lookup";

export async function buildContactLookup(): Promise<ContactLookup> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select("id,name,emails,phone,company_id");

  if (error) {
    console.error("[outreach.buildContactLookup]", error);
    return emptyLookup();
  }

  const companyIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.company_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const companyName = new Map<string, string>();
  if (companyIds.length) {
    const { data: companies, error: companyErr } = await sb
      .from("companies")
      .select("id,name")
      .in("id", companyIds);
    if (companyErr) {
      console.error("[outreach.buildContactLookup.companies]", companyErr);
    } else {
      for (const company of companies ?? []) {
        companyName.set(company.id as string, company.name as string);
      }
    }
  }

  const rows: ContactLookupRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    emails: (row.emails as string[] | null) ?? [],
    phone: (row.phone as string | null) ?? null,
    company: companyName.get(row.company_id as string) ?? null,
  }));

  return createContactLookup(rows);
}
