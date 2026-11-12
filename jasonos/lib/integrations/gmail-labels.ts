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
 * Gmail stamps INBOX or SENT on real mail. No labels, a DRAFT label, or a
 * scheduled send that has not landed in Sent means the message was not sent.
 * Outbound mail counts only with SENT. A draft reply sitting in a Sent
 * thread must not look like a send, even when Gmail omitted the labels.
 */
export function shouldCountGmailMessageForTouch(msg: {
  labelIds?: string[] | null;
  fromMe: boolean;
}): boolean {
  if (!msg.labelIds?.length) return false;
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

/**
 * Pull the Gmail message id out of a contact_touches / rr_touches external_id.
 * Advisors rows are bare ids; personal Gmail uses `gmail:` prefixes.
 */
export function parseGmailTouchMessageId(
  externalId: string | null | undefined
): string | null {
  const external = (externalId ?? "").trim();
  if (!external) return null;
  const bare = external.startsWith("gmail:")
    ? external.slice("gmail:".length)
    : external;
  const messageId = bare.split("::")[0]?.trim() ?? "";
  if (!messageId || !/^[a-zA-Z0-9]+$/.test(messageId)) return null;
  return messageId;
}

/**
 * Which Google mailbox owns this touch id encoding.
 * Bare ids → Advisors (`google`). Prefixed → personal (`google_gmail`).
 */
export function gmailTouchMailboxKind(
  externalId: string | null | undefined
): "advisors" | "personal" {
  const external = (externalId ?? "").trim();
  return external.startsWith("gmail:") ? "personal" : "advisors";
}

/** Appended to Gmail search queries so draft threads are not preferred hits. */
export const GMAIL_EXCLUDE_DRAFTS_QUERY = "-in:drafts";
