// Pure Outlook / Microsoft Graph mail helpers. No network, no server-only,
// so sync and unit tests can share folder rules and address formatting.

import { createHash } from "node:crypto";

export const OUTLOOK_FOLDER_CAP = 12;
export const OUTLOOK_PAGE_SIZE = 40;
export const OUTLOOK_MAX_PAGES = 2;

const SKIP_WELL_KNOWN = new Set([
  "drafts",
  "deleteditems",
  "junkemail",
  "outbox",
  "clutter",
  "recoverableitemsdeletions",
  "recoverableitemspurges",
  "recoverableitemsversions",
  "recoverableitemsdiscoveryholds",
  "syncissues",
  "conflicts",
  "localfailures",
  "serverfailures",
  "scheduled",
  "conversationhistory",
]);

const SKIP_NAME =
  /^(drafts?|junk( e-?mail)?|spam|deleted( items)?|trash|outbox|clutter|conversation history|sync issues)$/i;

export interface OutlookFolderRef {
  id: string;
  displayName: string;
  wellKnownName?: string | null;
}

export interface GraphEmailAddress {
  name?: string | null;
  address?: string | null;
}

export interface GraphRecipient {
  emailAddress?: GraphEmailAddress | null;
}

export interface GraphMessage {
  id?: string;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  sentDateTime?: string | null;
  webLink?: string | null;
  isDraft?: boolean | null;
  from?: GraphRecipient | null;
  toRecipients?: GraphRecipient[] | null;
  ccRecipients?: GraphRecipient[] | null;
}

export interface OutlookMessage {
  id: string;
  from: string;
  to: string;
  cc: string;
  subject: string | null;
  date: string;
  snippet: string;
  webLink: string | null;
}

/**
 * Personal Outlook.com Graph does not expose mailFolder.wellKnownName.
 * Infer the common well-known keys from the folder label instead.
 */
export function inferOutlookWellKnownName(
  displayName: string | null | undefined
): string | null {
  const name = (displayName ?? "").trim().toLowerCase();
  if (!name) return null;
  if (name === "inbox") return "inbox";
  if (name === "sent items" || name === "sent") return "sentitems";
  if (name === "deleted items" || name === "trash") return "deleteditems";
  if (name === "junk email" || name === "junk e-mail" || name === "junk" || name === "spam") {
    return "junkemail";
  }
  if (name === "drafts" || name === "draft") return "drafts";
  if (name === "archive") return "archive";
  if (name === "outbox") return "outbox";
  if (name === "clutter") return "clutter";
  if (name === "conversation history") return "conversationhistory";
  if (name === "sync issues") return "syncissues";
  return null;
}

export function shouldSkipOutlookFolder(folder: {
  displayName?: string | null;
  wellKnownName?: string | null;
}): boolean {
  const well =
    (folder.wellKnownName ?? "").trim().toLowerCase() ||
    inferOutlookWellKnownName(folder.displayName) ||
    "";
  if (well && SKIP_WELL_KNOWN.has(well)) return true;
  const name = (folder.displayName ?? "").trim();
  return SKIP_NAME.test(name);
}

/**
 * Graph message ids are huge base64 blobs. Storing them raw makes the
 * contact_touches pre-check `.in(external_id, …)` URL hit Bad Request.
 */
export function outlookTouchExternalId(
  messageId: string,
  contactId?: string | null
): string {
  const digest = createHash("sha256")
    .update(messageId)
    .digest("hex")
    .slice(0, 32);
  return contactId ? `outlook:${digest}::${contactId}` : `outlook:${digest}`;
}

function priorityIndex(folder: {
  displayName?: string | null;
  wellKnownName?: string | null;
}): number {
  const well = (folder.wellKnownName ?? "").trim().toLowerCase();
  if (well === "sentitems") return 0;
  if (well === "inbox") return 1;
  if (well === "archive") return 2;
  const name = (folder.displayName ?? "").trim().toLowerCase();
  if (name === "sent items" || name === "sent") return 0;
  if (name === "inbox") return 1;
  if (name === "archive") return 2;
  return 10;
}

/** Sent, Inbox, Archive first, then other folders. Junk/drafts/deleted dropped. */
export function rankOutlookFolders<T extends OutlookFolderRef>(
  folders: T[],
  limit = OUTLOOK_FOLDER_CAP
): T[] {
  const kept = folders.filter((folder) => folder.id && !shouldSkipOutlookFolder(folder));
  kept.sort((a, b) => {
    const byPriority = priorityIndex(a) - priorityIndex(b);
    if (byPriority !== 0) return byPriority;
    return (a.displayName || "").localeCompare(b.displayName || "");
  });
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const folder of kept) {
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    unique.push(folder);
  }
  return unique.slice(0, Math.max(0, limit));
}

export function formatGraphAddress(
  recipient: GraphRecipient | null | undefined
): string {
  const address = recipient?.emailAddress?.address?.trim() ?? "";
  const name = recipient?.emailAddress?.name?.trim() ?? "";
  if (!address && !name) return "";
  if (!address) return name;
  if (!name || name.toLowerCase() === address.toLowerCase()) return address;
  return `${name} <${address}>`;
}

export function joinGraphAddresses(
  recipients: GraphRecipient[] | null | undefined
): string {
  return (recipients ?? []).map(formatGraphAddress).filter(Boolean).join(", ");
}

export function mapGraphMessage(raw: GraphMessage): OutlookMessage | null {
  if (!raw.id || raw.isDraft) return null;
  const rawDate = raw.sentDateTime || raw.receivedDateTime;
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const from = formatGraphAddress(raw.from);
  if (!from) return null;
  return {
    id: raw.id,
    from,
    to: joinGraphAddresses(raw.toRecipients),
    cc: joinGraphAddresses(raw.ccRecipients),
    subject: raw.subject?.trim() || null,
    date: parsed.toISOString(),
    snippet: (raw.bodyPreview ?? "").replace(/\s+/g, " ").trim(),
    webLink: raw.webLink?.trim() || null,
  };
}

export function dedupeOutlookMessages(messages: OutlookMessage[]): OutlookMessage[] {
  const seen = new Set<string>();
  const out: OutlookMessage[] = [];
  for (const message of messages) {
    if (!message.id || seen.has(message.id)) continue;
    seen.add(message.id);
    out.push(message);
  }
  return out;
}

/** Graph $filter wants `2026-01-01T00:00:00Z`, not milliseconds. */
export function graphSinceTimestamp(sinceIso: string): string {
  const parsed = new Date(sinceIso);
  if (Number.isNaN(parsed.getTime())) return sinceIso;
  return parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
}
