// Resolve click-through targets for Job Alerts rows: job listing first, Gmail fallback.

import { sanitizeGmailThreadUrl } from "@/lib/integrations/gmail-links";
import { sanitizeJobListingUrl } from "@/lib/integrations/job-listing-urls";

export interface ResolvedOpportunityLinks {
  /** Best click target: listing when valid, else Gmail conversation. */
  url: string | null;
  jobUrl: string | null;
  gmailUrl: string | null;
}

/**
 * Only return URLs we trust to open a job posting or the alert email.
 * Junk / partial Gmail hashes are dropped so the UI does not show dead links.
 */
export function resolveOpportunityLinks(
  jobUrl: string | null | undefined,
  gmailUrl: string | null | undefined,
  threadId?: string | null,
  accountEmail?: string | null
): ResolvedOpportunityLinks {
  const validJob = sanitizeJobListingUrl(jobUrl);
  const validGmail = sanitizeGmailThreadUrl(
    gmailUrl,
    threadId,
    accountEmail
  );
  return {
    url: validJob ?? validGmail,
    jobUrl: validJob,
    gmailUrl: validGmail,
  };
}
