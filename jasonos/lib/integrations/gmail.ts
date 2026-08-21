// Gmail adapter — overnight reply intake for the Morning Brief.
// Uses the OAuth2 refresh token stored in jasonos.user_integrations
// (provider='google'). Falls back to empty + configured:false if no token.

import "server-only";
import { emptyResult, type IntegrationResult } from "./_base";
import { isFromMe } from "@/lib/outreach/email-matching";
import { gmailThreadUrl } from "@/lib/integrations/gmail-links";
import { pickJobListingUrl } from "@/lib/integrations/job-listing-urls";
import {
  getGoogleAccessToken,
  listGoogleAccessTokens,
} from "@/lib/integrations/google-tokens";
import {
  isCalendarInviteSubject,
  isCalendarProxyAddress,
} from "@/lib/outreach/mail-noise";

export interface GmailReply {
  id: string;
  threadId: string;
  fromEmail: string;
  fromName?: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  summary?: string;        // optional Sonnet 1-liner, populated downstream
  labelIds?: string[];
}

export interface GmailThread {
  id: string;
  snippet?: string;
  historyId?: string;
}

export interface GmailThreadMessage {
  id: string;
  threadId: string;
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  date?: string;
  snippet?: string;
  plaintextBody?: string;
  htmlBody?: string;
  /** RFC 822 Message-ID header (for Apple Mail message:// links). */
  rfc822MessageId?: string;
}

export interface ResolvedJobAlertLink {
  /** Id from the brief URL (message or thread). */
  sourceId: string;
  threadId: string | null;
  /** Permalink that opens the conversation in the right mailbox. */
  gmailUrl: string | null;
  /** Best job-listing URL extracted from the alert email, when found. */
  jobUrl: string | null;
}

export interface GmailThreadFull {
  id: string;
  messages: GmailThreadMessage[];
}

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

/** True when Advisors Google or personal Gmail has a usable token. */
export async function isGmailConnected(): Promise<boolean> {
  return (await listGoogleAccessTokens()).length > 0;
}

async function getAccessToken(explicit?: string): Promise<string | null> {
  if (explicit) return explicit;
  const advisors = await getGoogleAccessToken();
  if (advisors) return advisors;
  const tokens = await listGoogleAccessTokens();
  return tokens[0]?.token ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gmailFetch<T>(path: string, accessToken: string): Promise<T> {
  // Gmail rate-limits concurrent + per-user requests; retry 429/5xx with
  // exponential backoff + jitter instead of failing the whole scan.
  const maxAttempts = 5;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${GMAIL_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.ok) return (await res.json()) as T;

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= maxAttempts) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Gmail ${res.status} ${path} :: ${txt.slice(0, 200)}`);
    }
    const backoff = Math.min(2000, 250 * 2 ** (attempt - 1));
    await sleep(backoff + Math.floor(Math.random() * 200));
  }
}

/**
 * Map over items with bounded concurrency (Gmail rejects too many concurrent
 * requests per user). Preserves input order in the output array.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

interface GmailListResp {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
}
interface GmailThreadsListResp {
  threads?: GmailThread[];
}
interface GmailMsgResp {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPayload;
}

interface GmailThreadResp {
  id: string;
  messages?: GmailMsgResp[];
}

interface GmailPayload {
  headers?: { name: string; value: string }[];
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
}

function parseFrom(value: string | undefined): { email: string; name?: string } {
  if (!value) return { email: "" };
  const m = value.match(/^(.*?)<([^>]+)>$/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, "") || undefined, email: m[2].trim() };
  return { email: value.trim() };
}

async function fetchOvernightRepliesForToken(
  access: string,
  afterEpoch: number,
  max: number
): Promise<GmailReply[]> {
  const q = encodeURIComponent(`is:inbox after:${afterEpoch} -from:me`);
  const list = await gmailFetch<GmailListResp>(
    `/users/me/messages?maxResults=${max}&q=${q}`,
    access
  );
  const messages = list.messages ?? [];
  const detailed = await mapWithConcurrency(messages, 5, (m) =>
    gmailFetch<GmailMsgResp>(
      `/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      access
    )
  );
  return detailed.map((d) => {
    const headers = d.payload?.headers ?? [];
    const get = (n: string) => headers.find((h) => h.name === n)?.value;
    const from = parseFrom(get("From"));
    const ts = d.internalDate ? Number(d.internalDate) : Date.now();
    return {
      id: d.id,
      threadId: d.threadId,
      fromEmail: from.email,
      fromName: from.name,
      subject: get("Subject") ?? "(no subject)",
      snippet: d.snippet ?? "",
      receivedAt: new Date(ts).toISOString(),
      labelIds: d.labelIds,
    };
  });
}

export async function getOvernightReplies(opts?: {
  sinceIso?: string;
  max?: number;
}): Promise<IntegrationResult<GmailReply[]>> {
  const tokens = await listGoogleAccessTokens();
  if (!tokens.length) return emptyResult([], false);

  try {
    const since = opts?.sinceIso ? new Date(opts.sinceIso) : new Date(Date.now() - 14 * 3600_000);
    const afterEpoch = Math.floor(since.getTime() / 1000);
    const max = opts?.max ?? 25;
    const replies: GmailReply[] = [];
    const errors: string[] = [];
    for (const { token, accountEmail } of tokens) {
      try {
        replies.push(...(await fetchOvernightRepliesForToken(token, afterEpoch, max)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[gmail] overnight fetch failed (${accountEmail}):`, err);
        errors.push(`${accountEmail}: ${msg}`);
      }
    }
    if (!replies.length && errors.length) {
      return emptyResult([], true, errors.join(" · "));
    }
    return emptyResult(replies, true);
  } catch (err) {
    console.error("[gmail] overnight fetch failed:", err);
    return emptyResult([], true, err instanceof Error ? err.message : String(err));
  }
}

export interface EmailCounterparty {
  email: string;
  name?: string;
  direction: "inbound" | "outbound";
  subject?: string;
  dateIso: string;
  /** Message carried bulk/list headers (newsletter, marketing, automated). */
  bulk: boolean;
  accountEmail: string;
}

async function listMessageIds(
  access: string,
  query: string,
  max: number
): Promise<{ id: string; threadId: string }[]> {
  const out: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  const q = encodeURIComponent(query);
  while (out.length < max) {
    const pageSize = Math.min(100, max - out.length);
    let path = `/users/me/messages?maxResults=${pageSize}&q=${q}`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    const list = await gmailFetch<GmailListResp>(path, access);
    if (list.messages?.length) out.push(...list.messages);
    pageToken = list.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

function pickInboundPerson(
  fromHeader: string,
  replyToHeader: string | undefined,
  senderHeader: string | undefined,
  subject: string | undefined
): { email: string; name?: string } | null {
  const from = parseFrom(fromHeader);
  const replyTo = parseFrom(replyToHeader);
  const sender = parseFrom(senderHeader);
  const invite =
    isCalendarProxyAddress(from.email) || isCalendarInviteSubject(subject);

  const candidates = invite
    ? [replyTo, sender, from]
    : [from, replyTo, sender];

  for (const person of candidates) {
    if (!person.email) continue;
    if (isCalendarProxyAddress(person.email)) continue;
    return {
      email: person.email.toLowerCase(),
      name: person.name || from.name,
    };
  }
  return null;
}
function splitAddresses(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Scan recent mail (both directions) and return the counterparties — the
 * non-me addresses on each message. Calendar invites use Reply-To so the
 * organizer, not calendar-notification@google.com, is the person.
 */
async function listCounterpartiesForToken(
  access: string,
  afterEpoch: number,
  max: number,
  accountEmail: string
): Promise<EmailCounterparty[]> {
  const messages = await listMessageIds(
    access,
    `-in:chats after:${afterEpoch}`,
    max
  );
  const detailed = await mapWithConcurrency(messages, 5, (m) =>
    gmailFetch<GmailMsgResp>(
      `/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Reply-To&metadataHeaders=Sender&metadataHeaders=List-Unsubscribe&metadataHeaders=Precedence`,
      access
    )
  );

  const out: EmailCounterparty[] = [];
  for (const d of detailed) {
    const headers = d.payload?.headers ?? [];
    const get = (n: string) =>
      headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value;
    const fromHeader = get("From") ?? "";
    const subject = get("Subject") ?? undefined;
    const ts = d.internalDate ? Number(d.internalDate) : Date.now();
    const dateIso = new Date(ts).toISOString();
    const invite =
      isCalendarProxyAddress(parseFrom(fromHeader).email) ||
      isCalendarInviteSubject(subject);
    const bulk =
      !invite &&
      (Boolean(get("List-Unsubscribe")) ||
        /\b(bulk|list|auto_reply|junk)\b/i.test(get("Precedence") ?? ""));

    if (isFromMe(fromHeader)) {
      for (const raw of [
        ...splitAddresses(get("To")),
        ...splitAddresses(get("Cc")),
      ]) {
        const p = parseFrom(raw);
        if (!p.email) continue;
        out.push({
          email: p.email.toLowerCase(),
          name: p.name,
          direction: "outbound",
          subject,
          dateIso,
          bulk,
          accountEmail,
        });
      }
    } else {
      const person = pickInboundPerson(
        fromHeader,
        get("Reply-To"),
        get("Sender"),
        subject
      );
      if (person?.email) {
        out.push({
          email: person.email,
          name: person.name,
          direction: "inbound",
          subject,
          dateIso,
          bulk,
          accountEmail,
        });
      }
    }
  }
  return out;
}

export async function listRecentCounterparties(opts?: {
  sinceIso?: string;
  max?: number;
}): Promise<IntegrationResult<EmailCounterparty[]>> {
  const tokens = await listGoogleAccessTokens();
  if (!tokens.length) return emptyResult([], false);

  try {
    const since = opts?.sinceIso
      ? new Date(opts.sinceIso)
      : new Date(Date.now() - 30 * 86_400_000);
    const afterEpoch = Math.floor(since.getTime() / 1000);
    const max = opts?.max ?? 250;
    const out: EmailCounterparty[] = [];
    const errors: string[] = [];
    for (const { token, accountEmail } of tokens) {
      try {
        out.push(
          ...(await listCounterpartiesForToken(
            token,
            afterEpoch,
            max,
            accountEmail
          ))
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[gmail] counterparty scan failed (${accountEmail}):`, err);
        errors.push(`${accountEmail}: ${msg}`);
      }
    }
    if (!out.length && errors.length) {
      return emptyResult([], true, errors.join(" · "));
    }
    return emptyResult(out, true);
  } catch (err) {
    console.error("[gmail] counterparty scan failed:", err);
    return emptyResult([], true, err instanceof Error ? err.message : String(err));
  }
}

export async function searchGmailThreads({
  query,
  pageSize = 5,
  accessToken,
}: {
  query: string;
  pageSize?: number;
  accessToken?: string;
}): Promise<GmailThread[]> {
  const access = await getAccessToken(accessToken);
  if (!access) return [];

  try {
    const q = encodeURIComponent(query);
    const list = await gmailFetch<GmailThreadsListResp>(
      `/users/me/threads?maxResults=${pageSize}&q=${q}`,
      access
    );
    return list.threads ?? [];
  } catch (err) {
    console.error("[gmail] thread search failed:", err);
    return [];
  }
}

export async function getGmailThread(
  threadId: string,
  accessToken?: string
): Promise<GmailThreadFull | null> {
  const access = await getAccessToken(accessToken);
  if (!access) return null;

  try {
    const thread = await gmailFetch<GmailThreadResp>(
      `/users/me/threads/${threadId}?format=full`,
      access
    );
    return {
      id: thread.id,
      messages: (thread.messages ?? []).map(mapGmailMessage),
    };
  } catch (err) {
    console.error("[gmail] thread fetch failed:", err);
    return null;
  }
}

/**
 * Resolve a Gmail permalink id (thread *or* message) to a stable thread URL
 * plus, when possible, the actual job-listing URL inside the alert email.
 * Brief publishers often paste a message id into `#all/<id>`; that opens the
 * inbox instead of the conversation — we canonicalize to the thread id.
 */
export async function resolveJobAlertFromGmail(
  sourceId: string
): Promise<ResolvedJobAlertLink> {
  const empty: ResolvedJobAlertLink = {
    sourceId,
    threadId: null,
    gmailUrl: null,
    jobUrl: null,
  };
  const id = sourceId.trim();
  if (!id) return empty;

  let thread = await getGmailThread(id);
  if (!thread) {
    const tokens = await listGoogleAccessTokens();
    if (!tokens.length) return empty;
    try {
      let msg: GmailMsgResp | null = null;
      let tokenUsed: string | undefined;
      for (const { token } of tokens) {
        try {
          msg = await gmailFetch<GmailMsgResp>(
            `/users/me/messages/${id}?format=full`,
            token
          );
          tokenUsed = token;
          break;
        } catch {
          // Message id is mailbox-local — try the other account.
        }
      }
      if (msg?.threadId) {
        thread = await getGmailThread(msg.threadId, tokenUsed);
        if (!thread) {
          // Message exists but thread fetch failed — still use message body.
          const mapped = mapGmailMessage(msg);
          const jobUrl = pickJobListingUrl(
            mapped.plaintextBody,
            mapped.htmlBody,
            mapped.snippet
          );
          return {
            sourceId: id,
            threadId: msg.threadId,
            gmailUrl: gmailThreadUrl(msg.threadId),
            jobUrl,
          };
        }
      }
    } catch (err) {
      console.warn("[gmail] message resolve failed:", id, err);
      return empty;
    }
  }

  if (!thread) return empty;

  const bodies = thread.messages.flatMap((m) => [
    m.plaintextBody,
    m.htmlBody,
    m.snippet,
  ]);
  const jobUrl = pickJobListingUrl(...bodies);
  return {
    sourceId: id,
    threadId: thread.id,
    gmailUrl: gmailThreadUrl(thread.id),
    jobUrl,
  };
}

function mapGmailMessage(message: GmailMsgResp): GmailThreadMessage {
  const headers = message.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value;

  return {
    id: message.id,
    threadId: message.threadId,
    from: get("From"),
    to: get("To"),
    cc: get("Cc"),
    subject: get("Subject"),
    date: get("Date"),
    snippet: message.snippet,
    plaintextBody: extractMimePart(message.payload, "text/plain"),
    htmlBody: extractMimePart(message.payload, "text/html"),
    rfc822MessageId: get("Message-ID") ?? get("Message-Id") ?? undefined,
  };
}

function extractMimePart(
  payload: GmailPayload | undefined,
  mimeType: string
): string {
  if (!payload) return "";
  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractMimePart(part, mimeType);
    if (text) return text;
  }
  // Some alerts are a single HTML part with no multipart wrapper.
  if (
    mimeType === "text/html" &&
    payload.mimeType?.startsWith("text/") &&
    payload.body?.data &&
    !payload.parts?.length
  ) {
    return decodeBase64Url(payload.body.data);
  }
  return "";
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
