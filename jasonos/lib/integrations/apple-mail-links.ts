// Apple Mail deep links via the message:// URL scheme.
// Opens a specific message in Mail.app when that mailbox is synced on the Mac.
// Format: message://%3cMESSAGE-ID%3e  (angle brackets URL-encoded).

/**
 * Build an Apple Mail `message://` URL from an RFC 822 Message-ID header.
 * Returns null when the header is missing/empty.
 *
 * Apple Mail expects: message://%3cMESSAGE-ID%3e
 * (angle brackets encoded; the Message-ID body left as-is, e.g. foo@mail.gmail.com)
 */
export function appleMailMessageUrl(messageIdHeader: string | null | undefined): string | null {
  if (!messageIdHeader) return null;
  let id = messageIdHeader.trim();
  if (!id) return null;
  // Strip wrapping angle brackets if present — we re-encode them below.
  if (id.startsWith("<") && id.endsWith(">")) {
    id = id.slice(1, -1);
  }
  id = id.trim();
  if (!id) return null;
  // Message-IDs are nearly always safe ASCII (local@domain). Strip brackets
  // only; don't percent-encode @/. so Mail matches the local copy.
  id = id.replace(/[<>\s]/g, "");
  if (!id) return null;
  return `message://%3c${id}%3e`;
}
