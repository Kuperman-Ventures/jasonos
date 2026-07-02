// Gmail adapter — overnight reply intake for the Morning Brief.
// Uses the OAuth2 refresh token stored in jasonos.user_integrations
// (provider='google'). Falls back to empty + configured:false if no token.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isFromMe } from "@/lib/outreach/email-matching";
import { emptyResult, envConfigured, type IntegrationResult } from "./_base";

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
  subject?: string;
  date?: string;
  snippet?: string;
  plaintextBody?: string;
}

export interface GmailThreadFull {
  id: string;
  messages: GmailThreadMessage[];
}

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

interface GoogleTokenRow {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
}

async function loadGoogleToken(): Promise<GoogleTokenRow | null> {
  if (!envConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    return null;
  }
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("provider", "google")
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as GoogleTokenRow;
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

/** Returns true when a valid (or refreshable) Google token is stored. */
export async function isGmailConnected(): Promise<boolean> {
  const row = await loadGoogleToken();
  if (!row) return false;
  // Has a live access token
  if (row.access_token && row.expires_at && Date.parse(row.expires_at) - Date.now() > 60_000) return true;
  // Has a refresh token we can use
  if (row.refresh_token) return true;
  return false;
}

async function getAccessToken(): Promise<string | null> {
  const row = await loadGoogleToken();
  if (!row) return null;
  if (row.access_token && row.expires_at && Date.parse(row.expires_at) - Date.now() > 60_000) {
    return row.access_token;
  }
  if (row.refresh_token) return refreshAccessToken(row.refresh_token);
  return row.access_token ?? null;
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

export async function getOvernightReplies(opts?: {
  sinceIso?: string;
  max?: number;
}): Promise<IntegrationResult<GmailReply[]>> {
  const access = await getAccessToken();
  if (!access) return emptyResult([], false);

  try {
    const since = opts?.sinceIso ? new Date(opts.sinceIso) : new Date(Date.now() - 14 * 3600_000);
    const afterEpoch = Math.floor(since.getTime() / 1000);
    const max = opts?.max ?? 25;
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
    const replies: GmailReply[] = detailed.map((d) => {
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
}

/** Split a To/Cc header ("A <a@x>, b@y") into individual address tokens. */
function splitAddresses(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Scan recent mail (both directions) and return the counterparties — the
 * non-me addresses on each message — with direction, subject, timestamp, and
 * a `bulk` flag derived from list/precedence headers. Feeds the Suggested
 * Contacts capture flow. Uses the same read scope as getOvernightReplies.
 */
export async function listRecentCounterparties(opts?: {
  sinceIso?: string;
  max?: number;
}): Promise<IntegrationResult<EmailCounterparty[]>> {
  const access = await getAccessToken();
  if (!access) return emptyResult([], false);

  try {
    const since = opts?.sinceIso
      ? new Date(opts.sinceIso)
      : new Date(Date.now() - 30 * 86_400_000);
    const afterEpoch = Math.floor(since.getTime() / 1000);
    const max = opts?.max ?? 80;
    const q = encodeURIComponent(`-in:chats after:${afterEpoch}`);
    const list = await gmailFetch<GmailListResp>(
      `/users/me/messages?maxResults=${max}&q=${q}`,
      access
    );
    const messages = list.messages ?? [];
    const detailed = await mapWithConcurrency(messages, 5, (m) =>
      gmailFetch<GmailMsgResp>(
        `/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=Precedence`,
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
      const bulk =
        Boolean(get("List-Unsubscribe")) ||
        /\b(bulk|list|auto_reply|junk)\b/i.test(get("Precedence") ?? "");

      if (isFromMe(fromHeader)) {
        // Outbound — counterparties are the recipients.
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
          });
        }
      } else {
        // Inbound — counterparty is the sender.
        const p = parseFrom(fromHeader);
        if (p.email) {
          out.push({
            email: p.email.toLowerCase(),
            name: p.name,
            direction: "inbound",
            subject,
            dateIso,
            bulk,
          });
        }
      }
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
}: {
  query: string;
  pageSize?: number;
}): Promise<GmailThread[]> {
  const access = await getAccessToken();
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

export async function getGmailThread(threadId: string): Promise<GmailThreadFull | null> {
  const access = await getAccessToken();
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

function mapGmailMessage(message: GmailMsgResp): GmailThreadMessage {
  const headers = message.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value;

  return {
    id: message.id,
    threadId: message.threadId,
    from: get("From"),
    to: get("To"),
    subject: get("Subject"),
    date: get("Date"),
    snippet: message.snippet,
    plaintextBody: extractPlainText(message.payload),
  };
}

function extractPlainText(payload: GmailPayload | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  return "";
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
