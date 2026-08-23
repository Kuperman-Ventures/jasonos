// Collapse duplicate job alert rows: same posting id or same role + company.

import type { JobOpportunity } from "@/lib/data/job-alerts-types";
import { canonicalJobListingKey } from "@/lib/integrations/job-listing-urls";

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const WEAK_TITLE_RE =
  /^(view|apply|see (all )?jobs?|read more|click here|linkedin|indeed|ladders|job alert|open|vice president of marketing)$/i;

/** Key used to treat two harvested or displayed rows as the same opportunity. */
export function opportunityDedupKey(
  title: string,
  company: string | null | undefined,
  jobUrl: string | null | undefined
): string {
  const titleKey = normKey(title);
  const companyKey = normKey(company ?? "");
  if (
    titleKey.length >= 4 &&
    companyKey.length >= 2 &&
    !WEAK_TITLE_RE.test(title.trim())
  ) {
    return `role:${titleKey}|${companyKey}`;
  }

  const canonical = canonicalJobListingKey(jobUrl);
  if (canonical) return canonical;

  if (titleKey.length >= 8 && !WEAK_TITLE_RE.test(title.trim())) {
    return `title:${titleKey}`;
  }
  if (jobUrl) return `url:${jobUrl.toLowerCase()}`;
  return `misc:${titleKey}|${companyKey}`;
}

export function opportunityRichness(row: JobOpportunity): number {
  let score = 0;
  if (row.compensation) score += 4;
  if (row.company) score += 2;
  if (row.jobUrl) score += 2;
  if (row.gmailUrl) score += 1;
  return score;
}

export function pickRicherOpportunity(
  a: JobOpportunity,
  b: JobOpportunity
): JobOpportunity {
  const sa = opportunityRichness(a);
  const sb = opportunityRichness(b);
  if (sa !== sb) return sa > sb ? a : b;
  if (a.briefDate !== b.briefDate) return a.briefDate > b.briefDate ? a : b;
  return a.title.length >= b.title.length ? a : b;
}

/** Keep one row per posting / role+company (most complete, newest). */
export function dedupeOpportunities(rows: JobOpportunity[]): JobOpportunity[] {
  const byKey = new Map<string, JobOpportunity>();
  for (const row of rows) {
    const key = opportunityDedupKey(row.title, row.company, row.jobUrl);
    const prev = byKey.get(key);
    byKey.set(key, prev ? pickRicherOpportunity(prev, row) : row);
  }
  return [...byKey.values()];
}

export interface ListingDraft {
  title: string;
  jobUrl: string | null;
  compensation: string | null;
  company: string | null;
}

export function dedupeListingDrafts(rows: ListingDraft[]): ListingDraft[] {
  const byKey = new Map<string, ListingDraft>();
  for (const row of rows) {
    const key = opportunityDedupKey(row.title, row.company, row.jobUrl);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, {
      title:
        row.title.length > prev.title.length ? row.title : prev.title,
      jobUrl: row.jobUrl ?? prev.jobUrl,
      compensation: row.compensation ?? prev.compensation,
      company: row.company ?? prev.company,
    });
  }
  return [...byKey.values()];
}

/** Fingerprint for upsert — same role+company collapses repeat alert emails. */
export function opportunityFingerprint(
  jobUrl: string | null,
  threadId: string,
  title: string,
  company: string | null
): string {
  const key = opportunityDedupKey(title, company, jobUrl);
  if (
    key.startsWith("role:") ||
    key.startsWith("title:") ||
    key.startsWith("linkedin:") ||
    key.startsWith("indeed:")
  ) {
    return `dedup:${key}`;
  }
  if (jobUrl) return `url:${jobUrl.toLowerCase()}`;
  const titleKey = normKey(title);
  return `thread:${threadId}:${titleKey}`;
}
