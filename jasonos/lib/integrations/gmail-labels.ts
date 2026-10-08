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

/** True when Gmail has the message queued to send later, not yet sent. */
export function isGmailScheduledMessage(msg: {
  labelIds?: string[] | null;
}): boolean {
  return gmailLabelSet(msg.labelIds).has("SCHEDULED");
}

/**
 * Whether this message should count as a completed mail touch.
 * Drafts and scheduled sends do not. Outbound mail counts only with SENT,
 * including when Gmail omitted labels — a draft reply in a Sent thread must
 * not look like a send.
 */
export function shouldCountGmailMessageForTouch(msg: {
  labelIds?: string[] | null;
  fromMe: boolean;
}): boolean {
  if (isGmailDraftMessage(msg)) return false;
  if (isGmailScheduledMessage(msg) && !isGmailSentMessage(msg)) return false;
  if (msg.fromMe && !isGmailSentMessage(msg)) return false;
  return true;
}

/** True when a stored Gmail touch id belongs to this message. */
export function gmailTouchExternalIdMatches(
  externalId: string | null | undefined,
  messageId: string
): boolean {
  const id = messageId.trim();
  const external = (externalId ?? "").trim();
  if (!id || !external || !/^[a-zA-Z0-9]+$/.test(id)) return false;
  return (
    external === id ||
    external.startsWith(`${id}::`) ||
    external === `gmail:${id}` ||
    external.startsWith(`gmail:${id}::`)
  );
}

/** Appended to Gmail search queries so draft threads are not preferred hits. */
export const GMAIL_EXCLUDE_DRAFTS_QUERY = "-in:drafts";
