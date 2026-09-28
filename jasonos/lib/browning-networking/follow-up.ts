import { canonicalEmail } from "@/lib/outreach/contact-lookup";
import { sameCandidate } from "./parse";

export const FOLLOW_UP_LOOKBACK_DAYS = 365;

export function shouldQueueFollowUp(input: {
  alreadyTracked: boolean;
  hasMeeting: boolean;
  hasOutreach: boolean;
}): boolean {
  return !input.alreadyTracked && !input.hasMeeting && input.hasOutreach;
}

export function isAlreadyTracked(
  existing: { email: string | null; name: string | null }[],
  candidate: { email: string | null; name: string | null }
): boolean {
  const want = candidate.email ? canonicalEmail(candidate.email) : "";
  return existing.some((row) => {
    if (want && row.email && canonicalEmail(row.email) === want) return true;
    if (candidate.name && row.name && sameCandidate(candidate.name, row.name)) return true;
    return false;
  });
}
