/**
 * Gmail system label checks for sync / intake.
 * Pure — no API calls. Gmail returns system labels as uppercase ids
 * (`DRAFT`, `SENT`, `INBOX`, …).
 */

export function gmailLabelSet(
  labelIds: string[] | null | undefined
): Set<string> {
  return new Set((labelIds ?? []).map((id) => id.toUpperCase()));
}

/** True when Gmail tagged the message as a draft. */
export function isGmailDraftMessage(msg: {
  labelIds?: string[] | null;
}): boolean {
  return gmailLabelSet(msg.labelIds).has("DRAFT");
}

/** True when Gmail tagged the message as sent. */
export function isGmailSentMessage(msg: {
  labelIds?: string[] | null;
}): boolean {
  return gmailLabelSet(msg.labelIds).has("SENT");
}

/**
 * Whether this message should count as a real mail touch in Outreach Sync.
 * Skips drafts. When Gmail returned labels, outbound (from me) also requires
 * SENT — otherwise a draft reply sitting in a Sent thread looks like a send.
 */
export function shouldCountGmailMessageForTouch(msg: {
  labelIds?: string[] | null;
  fromMe: boolean;
}): boolean {
  if (isGmailDraftMessage(msg)) return false;
  if (!msg.labelIds?.length) return true;
  if (msg.fromMe && !isGmailSentMessage(msg)) return false;
  return true;
}

/** Appended to Gmail search queries so draft threads are not preferred hits. */
export const GMAIL_EXCLUDE_DRAFTS_QUERY = "-in:drafts";
