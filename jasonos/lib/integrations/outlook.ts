import "server-only";

import type { CalendarApiEvent } from "@/lib/integrations/google-calendar";
import { getOutlookAccountAccess } from "@/lib/integrations/outlook-tokens";
import { OUTLOOK_WRAP_EMAIL } from "@/lib/integrations/unwrap-forwarded-mail";
import type { SentRecipientTouch } from "@/lib/outreach/meeting-followups";
import {
  latestHitPerThread,
  qualifySentMessage,
  type SentMailHit,
} from "@/lib/outreach/sent-followups";
import {
  OUTLOOK_MAX_PAGES,
  OUTLOOK_PAGE_SIZE,
  dedupeOutlookMessages,
  formatGraphAddress,
  graphSinceTimestamp,
  inferOutlookWellKnownName,
  joinGraphAddresses,
  mapGraphMessage,
  outlookTouchExternalId,
  rankOutlookFolders,
  type GraphMessage,
  type OutlookFolderRef,
  type OutlookMessage,
} from "@/lib/integrations/outlook-mail";

export interface OutlookMailFetch {
  messages: OutlookMessage[];
  warnings: string[];
}

const FALLBACK_FOLDERS: OutlookFolderRef[] = [
  { id: "sentitems", displayName: "Sent Items", wellKnownName: "sentitems" },
  { id: "inbox", displayName: "Inbox", wellKnownName: "inbox" },
  { id: "archive", displayName: "Archive", wellKnownName: "archive" },
];

interface GraphList<T> {
  value?: T[];
  "@odata.nextLink"?: string;
  error?: { code?: string; message?: string };
}

function graphErrorMessage(status: number, body: GraphList<unknown> | null): string {
  const detail = body?.error?.message ?? body?.error?.code ?? "";
  return `Outlook Graph ${status}${detail ? `: ${detail.slice(0, 180)}` : ""}`;
}

async function graphGet(
  token: string,
  url: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; body: GraphList<never> | null }> {
  const full = url.startsWith("http") ? url : `https://graph.microsoft.com/v1.0${url}`;
  const res = await fetch(full, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...extraHeaders,
    },
  });
  const text = await res.text();
  let body: GraphList<never> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as GraphList<never>;
    } catch {
      body = { error: { message: text.slice(0, 180) } };
    }
  }
  if (res.status === 401) {
    throw new Error(
      `${OUTLOOK_WRAP_EMAIL}: sign-in expired. Reconnect Outlook in Settings.`
    );
  }
  return { status: res.status, body };
}

async function graphPost(
  token: string,
  url: string,
  payload: unknown
): Promise<{ status: number; body: unknown }> {
  const full = url.startsWith("http") ? url : `https://graph.microsoft.com/v1.0${url}`;
  const res = await fetch(full, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: { message: text.slice(0, 180) } };
    }
  }
  if (res.status === 401) {
    throw new Error(
      `${OUTLOOK_WRAP_EMAIL}: sign-in expired. Reconnect Outlook in Settings.`
    );
  }
  return { status: res.status, body };
}

async function listChildFolders(
  token: string,
  parentId: string
): Promise<OutlookFolderRef[]> {
  const { status, body } = await graphGet(
    token,
    `/me/mailFolders/${encodeURIComponent(parentId)}/childFolders?$top=40&$select=id,displayName`
  );
  if (status === 404) return [];
  if (status < 200 || status >= 300) {
    throw new Error(graphErrorMessage(status, body));
  }
  return ((body?.value ?? []) as Array<{ id?: string; displayName?: string }>)
    .filter((folder) => folder.id)
    .map((folder) => ({
      id: folder.id as string,
      displayName: folder.displayName?.trim() || "Folder",
    }));
}

async function listFolders(token: string): Promise<{
  folders: OutlookFolderRef[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  // Personal Outlook.com rejects $select=wellKnownName (Graph 400).
  // Rank / skip using displayName via inferOutlookWellKnownName instead.
  const { status, body } = await graphGet(
    token,
    "/me/mailFolders?$top=50&$select=id,displayName"
  );
  if (status < 200 || status >= 300) {
    warnings.push(
      `Could not list Outlook folders (${graphErrorMessage(status, body)}). Scanned Sent, Inbox, and Archive only.`
    );
    return { folders: FALLBACK_FOLDERS, warnings };
  }

  const top = ((body?.value ?? []) as Array<{
    id?: string;
    displayName?: string;
  }>)
    .filter((folder) => folder.id)
    .map((folder) => {
      const displayName = folder.displayName?.trim() || "Folder";
      return {
        id: folder.id as string,
        displayName,
        wellKnownName: inferOutlookWellKnownName(displayName),
      };
    });

  const parents = top.filter((folder) => {
    const well = (folder.wellKnownName ?? "").toLowerCase();
    return well === "inbox" || well === "archive";
  });

  const children: OutlookFolderRef[] = [];
  for (const parent of parents) {
    try {
      children.push(...(await listChildFolders(token, parent.id)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`${parent.displayName} subfolders: ${msg}`);
    }
  }

  return { folders: [...top, ...children], warnings };
}

function messagesPath(folderId: string, sinceIso: string, useFilter: boolean): string {
  const params = new URLSearchParams({
    $top: String(OUTLOOK_PAGE_SIZE),
    $select:
      "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,webLink,isDraft,conversationId,internetMessageId",
    $orderby: "receivedDateTime desc",
  });
  if (useFilter) {
    params.set("$filter", `receivedDateTime ge ${graphSinceTimestamp(sinceIso)}`);
  }
  return `/me/mailFolders/${encodeURIComponent(folderId)}/messages?${params}`;
}

async function listFolderMessages(
  token: string,
  folder: OutlookFolderRef,
  sinceIso: string,
  maxPages = OUTLOOK_MAX_PAGES
): Promise<GraphMessage[]> {
  const sinceMs = new Date(sinceIso).getTime();
  let url = messagesPath(folder.id, sinceIso, true);
  let allowFilterRetry = true;
  const out: GraphMessage[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const { status, body } = await graphGet(token, url);
    if ((status === 400 || status === 404) && allowFilterRetry) {
      allowFilterRetry = false;
      if (status === 404) return [];
      url = messagesPath(folder.id, sinceIso, false);
      page -= 1;
      continue;
    }
    if (status === 404) return out;
    if (status < 200 || status >= 300) {
      throw new Error(graphErrorMessage(status, body));
    }
    const batch = (body?.value ?? []) as GraphMessage[];
    out.push(...batch);
    const oldest = batch.reduce((min, message) => {
      const raw = message.receivedDateTime || message.sentDateTime;
      const ms = raw ? new Date(raw).getTime() : Number.NaN;
      return Number.isFinite(ms) ? Math.min(min, ms) : min;
    }, Number.POSITIVE_INFINITY);
    const next = body?.["@odata.nextLink"];
    if (!next || batch.length === 0) break;
    if (Number.isFinite(oldest) && oldest < sinceMs) break;
    url = next;
  }

  return out;
}

/**
 * Recent mail from Sent, Inbox, Archive, and other non-junk folders.
 * Calendar scope is requested at consent; this pass is mail only.
 */
export async function listOutlookMessages(
  accessToken: string,
  sinceIso: string
): Promise<OutlookMailFetch> {
  const listed = await listFolders(accessToken);
  const folders = rankOutlookFolders(listed.folders);
  const warnings = [...listed.warnings];
  const collected: OutlookMessage[] = [];
  const sinceMs = new Date(sinceIso).getTime();

  for (const folder of folders) {
    try {
      const raw = await listFolderMessages(accessToken, folder, sinceIso);
      for (const message of raw) {
        const mapped = mapGraphMessage(message);
        if (!mapped) continue;
        if (new Date(mapped.date).getTime() < sinceMs) continue;
        collected.push(mapped);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/sign-in expired/i.test(msg)) throw err;
      warnings.push(`${folder.displayName}: ${msg}`);
    }
  }

  return { messages: dedupeOutlookMessages(collected), warnings };
}

export interface OutlookSearchedMessage {
  id: string;
  from: string;
  to: string;
  cc: string;
  subject: string | null;
  receivedAt: string;
  body: string;
  conversationId: string | null;
  internetMessageId: string | null;
}

interface GraphSearchedMessage extends GraphMessage {
  body?: { content?: string | null } | null;
  conversationId?: string | null;
  internetMessageId?: string | null;
}

/**
 * Find recent messages whose text matches any of the queries.
 * Graph $search looks across the mailbox, not only the inbox.
 */
export async function searchOutlookMessages(
  accessToken: string,
  queries: string[],
  sinceIso: string,
  maxPages = 4
): Promise<OutlookSearchedMessage[]> {
  const sinceMs = new Date(sinceIso).getTime();
  const byId = new Map<string, OutlookSearchedMessage>();

  for (const query of queries) {
    const params = new URLSearchParams({
      $search: query,
      $top: "25",
      $select:
        "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,conversationId,internetMessageId,isDraft",
    });
    let url: string | null = `/me/messages?${params}`;
    for (let page = 0; page < maxPages && url; page += 1) {
      const { status, body } = await graphGet(accessToken, url, {
        ConsistencyLevel: "eventual",
        Prefer: 'outlook.body-content-type="text"',
      });
      if (status < 200 || status >= 300) {
        throw new Error(graphErrorMessage(status, body));
      }
      for (const raw of (body?.value ?? []) as GraphSearchedMessage[]) {
        if (!raw.id || raw.isDraft || byId.has(raw.id)) continue;
        const received = raw.receivedDateTime || raw.sentDateTime;
        if (!received) continue;
        const receivedMs = new Date(received).getTime();
        if (!Number.isFinite(receivedMs) || receivedMs < sinceMs) continue;
        const from = formatGraphAddress(raw.from);
        if (!from) continue;
        byId.set(raw.id, {
          id: raw.id,
          from,
          to: joinGraphAddresses(raw.toRecipients),
          cc: joinGraphAddresses(raw.ccRecipients),
          subject: raw.subject?.trim() || null,
          receivedAt: new Date(received).toISOString(),
          body: raw.body?.content ?? raw.bodyPreview ?? "",
          conversationId: raw.conversationId ?? null,
          internetMessageId: raw.internetMessageId ?? null,
        });
      }
      url = body?.["@odata.nextLink"] ?? null;
    }
  }

  return [...byId.values()];
}

/**
 * Sent-mail follow-up hits from Outlook Sent Items (one per conversation).
 */
export async function listOutlookSentMailHits(opts?: {
  daysBack?: number;
  max?: number;
}): Promise<{
  configured: boolean;
  data: SentMailHit[];
  error?: string;
}> {
  const account = await getOutlookAccountAccess();
  if (!account.configured || !account.token) {
    return { configured: false, data: [], error: account.error };
  }

  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 90));
  const max = opts?.max ?? 200;
  const sinceIso = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const hits: SentMailHit[] = [];

  try {
    const folder: OutlookFolderRef = {
      id: "sentitems",
      displayName: "Sent Items",
      wellKnownName: "sentitems",
    };
    // Deeper page than the default mail sync — 9/18-style sends still need
    // to land in Follow Up after a busy couple of weeks.
    const messages = await listFolderMessages(
      account.token,
      folder,
      sinceIso,
      10
    );
    for (const message of messages.slice(0, max)) {
      if (message.isDraft) continue;
      const mapped = mapGraphMessage(message);
      if (!mapped) continue;
      const qualified = qualifySentMessage({
        subject: mapped.subject,
        to: mapped.to,
        cc: mapped.cc,
      });
      if (!qualified.ok) continue;
      const threadId =
        mapped.conversationId || outlookTouchExternalId(mapped.id);
      hits.push({
        threadId,
        messageId: outlookTouchExternalId(mapped.id),
        subject: (mapped.subject ?? "").trim() || "(no subject)",
        sentAt: mapped.date,
        snippet: mapped.snippet.slice(0, 240),
        toLine: qualified.toLine,
        recipients: qualified.recipients,
        accountEmail: account.accountEmail,
        webLink: mapped.webLink,
        rfc822MessageId: mapped.internetMessageId,
      });
    }
    return { configured: true, data: latestHitPerThread(hits) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[outlook] sent follow-up scan failed:", err);
    return { configured: true, data: [], error: msg };
  }
}

/**
 * Lightweight conversation scan for inbound replies after an Outlook send.
 * Returns message from/date pairs for threadHasInboundReply.
 */
export async function listOutlookConversationMessages(
  conversationId: string
): Promise<{ id: string; from: string; date: string }[]> {
  const account = await getOutlookAccountAccess();
  if (!account.configured || !account.token || !conversationId.trim()) {
    return [];
  }
  const escaped = conversationId.replace(/'/g, "''");
  const select =
    "id,from,sentDateTime,receivedDateTime,isDraft,conversationId";
  const filter = encodeURIComponent(
    `conversationId eq '${escaped}' and isDraft eq false`
  );
  const url =
    `/me/messages?$select=${select}&$filter=${filter}&$top=50` +
    `&$orderby=receivedDateTime desc`;
  try {
    const { status, body } = await graphGet(account.token, url);
    if (status >= 400 || !body || !Array.isArray(body.value)) return [];
    const out: { id: string; from: string; date: string }[] = [];
    for (const raw of body.value as Array<{
      id?: string;
      from?: { emailAddress?: { address?: string; name?: string } };
      sentDateTime?: string;
      receivedDateTime?: string;
    }>) {
      const addr = raw.from?.emailAddress?.address?.trim() || "";
      const name = raw.from?.emailAddress?.name?.trim() || "";
      const from = name && addr ? `${name} <${addr}>` : addr || name;
      const date = raw.sentDateTime || raw.receivedDateTime || "";
      if (!raw.id || !from || !date) continue;
      out.push({ id: raw.id, from, date });
    }
    return out;
  } catch (err) {
    console.error("[outlook] conversation scan failed:", err);
    return [];
  }
}

/**
 * Outbound recipient touches from Outlook Sent Items — used with Gmail sent
 * scans so meeting Follow Ups clear when Jason emailed an attendee from
 * jason.kuperman@outlook.com.
 */
export async function listOutlookSentRecipientTouches(opts?: {
  daysBack?: number;
  max?: number;
}): Promise<{
  configured: boolean;
  data: SentRecipientTouch[];
  error?: string;
}> {
  const account = await getOutlookAccountAccess();
  if (!account.configured || !account.token) {
    return {
      configured: false,
      data: [],
      error: account.error,
    };
  }

  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 30));
  const max = opts?.max ?? 400;
  const sinceIso = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const touches: SentRecipientTouch[] = [];

  try {
    const folder: OutlookFolderRef = {
      id: "sentitems",
      displayName: "Sent Items",
      wellKnownName: "sentitems",
    };
    const messages = await listFolderMessages(account.token, folder, sinceIso);
    for (const message of messages.slice(0, max)) {
      if (message.isDraft) continue;
      const mapped = mapGraphMessage(message);
      if (!mapped) continue;
      const qualified = qualifySentMessage({
        subject: mapped.subject,
        to: mapped.to,
        cc: mapped.cc,
      });
      if (!qualified.ok) continue;
      const sentAt = mapped.date;
      for (const recipient of qualified.recipients) {
        touches.push({ email: recipient.email, sentAt });
      }
    }
    return { configured: true, data: touches };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[outlook] sent recipient scan failed:", err);
    return { configured: true, data: [], error: msg };
  }
}

type GraphCalendarAttendee = {
  emailAddress?: { address?: string | null; name?: string | null } | null;
  status?: { response?: string | null } | null;
  type?: string | null;
};

type GraphCalendarEvent = {
  id?: string;
  iCalUId?: string | null;
  subject?: string | null;
  start?: { dateTime?: string | null; timeZone?: string | null } | null;
  end?: { dateTime?: string | null; timeZone?: string | null } | null;
  isCancelled?: boolean | null;
  isAllDay?: boolean | null;
  webLink?: string | null;
  organizer?: {
    emailAddress?: { address?: string | null; name?: string | null } | null;
  } | null;
  attendees?: GraphCalendarAttendee[] | null;
};

function outlookDateParts(
  value: { dateTime?: string | null; timeZone?: string | null } | null | undefined,
  allDay: boolean
): { dateTime?: string; date?: string } | undefined {
  const raw = value?.dateTime?.trim();
  if (!raw) return undefined;
  if (allDay) {
    return { date: raw.slice(0, 10) };
  }
  // Graph returns local wall time without Z; append Z when no offset so Date.parse works.
  const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const iso = hasZone ? raw : `${raw}Z`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return { dateTime: raw };
  return { dateTime: new Date(ms).toISOString() };
}

function mapOutlookCalendarEvent(raw: GraphCalendarEvent): CalendarApiEvent | null {
  if (!raw.id) return null;
  const allDay = Boolean(raw.isAllDay);
  const start = outlookDateParts(raw.start, allDay);
  const end = outlookDateParts(raw.end, allDay);
  if (!start) return null;
  const attendees = (raw.attendees ?? []).map((a) => {
    const email = a.emailAddress?.address?.trim().toLowerCase() || undefined;
    const displayName = a.emailAddress?.name?.trim() || undefined;
    const response = (a.status?.response ?? "").toLowerCase();
    return {
      email,
      displayName,
      responseStatus:
        response === "declined"
          ? "declined"
          : response === "accepted"
            ? "accepted"
            : response === "tentativelyaccepted"
              ? "tentative"
              : "needsAction",
    };
  });
  const orgEmail = raw.organizer?.emailAddress?.address?.trim().toLowerCase();
  return {
    id: `outlook:${raw.id}`,
    iCalUID: raw.iCalUId?.trim() || undefined,
    summary: raw.subject?.trim() || "Meeting",
    start,
    end,
    htmlLink: raw.webLink ?? undefined,
    status: raw.isCancelled ? "cancelled" : "confirmed",
    organizer: orgEmail
      ? {
          email: orgEmail,
          displayName: raw.organizer?.emailAddress?.name?.trim() || undefined,
        }
      : undefined,
    attendees,
  };
}

/**
 * Past/upcoming events from the Outlook.com calendar (Calendars.Read already
 * on the OAuth consent). Mapped into CalendarApiEvent so Follow Up capture
 * can merge with Google calendars.
 */
export async function listOutlookCalendarEvents(opts: {
  timeMin: string;
  timeMax: string;
  maxPages?: number;
}): Promise<{ events: CalendarApiEvent[]; configured: boolean; error?: string }> {
  const account = await getOutlookAccountAccess();
  if (!account.configured || !account.token) {
    return { events: [], configured: false, error: account.error };
  }

  const maxPages = opts.maxPages ?? 10;
  const events: CalendarApiEvent[] = [];
  const params = new URLSearchParams({
    startDateTime: opts.timeMin,
    endDateTime: opts.timeMax,
    $top: "50",
    $select:
      "id,iCalUId,subject,start,end,isCancelled,isAllDay,webLink,organizer,attendees",
    $orderby: "start/dateTime",
  });
  let url: string | null = `/me/calendarView?${params}`;

  try {
    for (let page = 0; page < maxPages && url; page += 1) {
      const { status, body } = await graphGet(account.token, url, {
        Prefer: 'outlook.timezone="UTC"',
      });
      if (status < 200 || status >= 300) {
        return {
          events,
          configured: true,
          error: graphErrorMessage(status, body),
        };
      }
      for (const raw of (body?.value ?? []) as GraphCalendarEvent[]) {
        const mapped = mapOutlookCalendarEvent(raw);
        if (mapped) events.push(mapped);
      }
      url = body?.["@odata.nextLink"] ?? null;
    }
    return { events, configured: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[outlook] calendar scan failed:", err);
    return { events, configured: true, error: msg };
  }
}

export async function latestOutlookSentTo(
  accessToken: string,
  email: string,
  sinceIso: string
): Promise<{ subject: string | null; sentAt: string } | null> {
  const want = email.trim().toLowerCase();
  if (!want) return null;
  const sinceMs = new Date(sinceIso).getTime();
  const params = new URLSearchParams({
    $search: `"${want}"`,
    $top: "15",
    $select: "subject,sentDateTime,toRecipients,ccRecipients,isDraft",
  });
  const { status, body } = await graphGet(
    accessToken,
    `/me/mailFolders/sentitems/messages?${params}`,
    { ConsistencyLevel: "eventual" }
  );
  if (status < 200 || status >= 300) return null;
  let best: { subject: string | null; sentAt: string } | null = null;
  for (const raw of (body?.value ?? []) as GraphSearchedMessage[]) {
    if (raw.isDraft) continue;
    const sent = raw.sentDateTime;
    if (!sent) continue;
    const sentMs = new Date(sent).getTime();
    if (!Number.isFinite(sentMs) || sentMs < sinceMs) continue;
    const recipients = `${joinGraphAddresses(raw.toRecipients)} ${joinGraphAddresses(raw.ccRecipients)}`.toLowerCase();
    if (!recipients.includes(want)) continue;
    if (!best || sentMs > Date.parse(best.sentAt)) {
      best = { subject: raw.subject?.trim() || null, sentAt: new Date(sent).toISOString() };
    }
  }
  return best;
}

const TRACY_FROM = "traceys@executivejobsearch.net";
const TRACY_TEXT_PHRASES = [
  "Thank you for your reply and interest in Executive Networking",
  "Attached please find the resume for",
];

/**
 * Tracy's notes for the lookback window.
 * A mailbox-wide keyword search only returns the newest hits, so a year
 * check was missing everyone except the last two. This asks Outlook's
 * search for her address and pages through the results, then reads each note.
 */
export async function listOutlookTracyMessages(
  accessToken: string,
  sinceIso: string
): Promise<OutlookSearchedMessage[]> {
  const sinceMs = new Date(sinceIso).getTime();
  const ids = await searchTracyMessageIds(accessToken, sinceIso).catch(rethrowAuth);
  if (ids.length) {
    const hydrated = await hydrateOutlookMessages(accessToken, ids).catch(rethrowAuth);
    const kept = hydrated.filter((message) => Date.parse(message.receivedAt) >= sinceMs);
    if (kept.length) return kept;
  }
  const bySender = await listTracyBySender(accessToken, sinceIso).catch(rethrowAuth);
  if (bySender.length) return bySender;
  return searchOutlookMessages(
    accessToken,
    [`"${TRACY_FROM}"`, ...TRACY_TEXT_PHRASES.map((phrase) => `"${phrase}"`)],
    sinceIso,
    6
  ).catch(rethrowAuth);
}

function rethrowAuth(err: unknown): never[] {
  const message = err instanceof Error ? err.message : String(err);
  if (/sign-in expired/i.test(message)) throw err;
  return [];
}

async function searchTracyMessageIds(accessToken: string, sinceIso: string): Promise<string[]> {
  const day = new Date(sinceIso).toISOString().slice(0, 10);
  const fromHits = await pageMessageSearch(
    accessToken,
    `from:${TRACY_FROM} AND received>=${day}`
  );
  if (fromHits.length) return fromHits;
  const quoted = await pageMessageSearch(
    accessToken,
    `from:"${TRACY_FROM}" AND received>=${day}`
  );
  if (quoted.length) return quoted;
  const ids = new Set<string>();
  for (const phrase of TRACY_TEXT_PHRASES) {
    for (const id of await pageMessageSearch(accessToken, `"${phrase}" AND received>=${day}`)) {
      ids.add(id);
    }
  }
  return [...ids];
}

async function pageMessageSearch(accessToken: string, queryString: string): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  let allowTopFlag = true;
  while (from < 150 && ids.length < 120) {
    const request: Record<string, unknown> = {
      entityTypes: ["message"],
      query: { queryString },
      from,
      size: 25,
    };
    if (allowTopFlag) request.enableTopResults = false;
    const { status, body } = await graphPost(accessToken, "/search/query", {
      requests: [request],
    });
    if (status === 400 && allowTopFlag && from === 0) {
      allowTopFlag = false;
      continue;
    }
    if (status < 200 || status >= 300) return ids;
    const container = searchHits(body);
    if (!container) return ids;
    for (const id of container.ids) {
      if (!ids.includes(id)) ids.push(id);
    }
    if (!container.more || container.ids.length === 0) break;
    from += 25;
  }
  return ids;
}

function searchHits(body: unknown): { ids: string[]; more: boolean } | null {
  const value = (body as { value?: unknown[] } | null)?.value?.[0] as
    | { error?: { message?: string }; hitsContainers?: Array<{
        moreResultsAvailable?: boolean;
        hits?: Array<{ hitId?: string }>;
      }> }
    | undefined;
  if (!value || value.error) return null;
  const container = value.hitsContainers?.[0];
  if (!container) return { ids: [], more: false };
  const ids = (container.hits ?? [])
    .map((hit) => hit.hitId)
    .filter((id): id is string => Boolean(id));
  return { ids, more: container.moreResultsAvailable === true };
}

async function hydrateOutlookMessages(
  accessToken: string,
  ids: string[]
): Promise<OutlookSearchedMessage[]> {
  const unique = [...new Set(ids)].slice(0, 120);
  const out: OutlookSearchedMessage[] = [];
  for (let i = 0; i < unique.length; i += 15) {
    const slice = unique.slice(i, i + 15);
    const { status, body } = await graphPost(accessToken, "/$batch", {
      requests: slice.map((id, index) => ({
        id: String(index),
        method: "GET",
        url: `/me/messages/${encodeURIComponent(id)}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,conversationId,internetMessageId,isDraft`,
        headers: { Prefer: 'outlook.body-content-type="text"' },
      })),
    });
    const responses = (body as { responses?: Array<{ status?: number; body?: GraphSearchedMessage }> } | null)
      ?.responses;
    if (status < 200 || status >= 300 || !responses) {
      for (const id of slice) {
        const one = await readOutlookMessage(accessToken, id);
        if (one) out.push(one);
      }
      continue;
    }
    for (const response of responses) {
      if ((response.status ?? 500) >= 300) continue;
      const mapped = mapSearchedMessage(response.body);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

async function readOutlookMessage(
  accessToken: string,
  messageId: string
): Promise<OutlookSearchedMessage | null> {
  const { status, body } = await graphGet(
    accessToken,
    `/me/messages/${encodeURIComponent(messageId)}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,conversationId,internetMessageId,isDraft`,
    { Prefer: 'outlook.body-content-type="text"' }
  );
  if (status < 200 || status >= 300) return null;
  return mapSearchedMessage(body as GraphSearchedMessage | null);
}

async function listTracyBySender(
  accessToken: string,
  sinceIso: string
): Promise<OutlookSearchedMessage[]> {
  const sinceMs = new Date(sinceIso).getTime();
  const select =
    "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,conversationId,internetMessageId,isDraft";
  let url: string | null = `/me/messages?${new URLSearchParams({
    $filter: `from/emailAddress/address eq '${TRACY_FROM}'`,
    $top: "50",
    $select: select,
  })}`;
  const headers = {
    ConsistencyLevel: "eventual",
    Prefer: 'outlook.body-content-type="text"',
  };
  const out: OutlookSearchedMessage[] = [];
  for (let page = 0; page < 8 && url; page += 1) {
    const { status, body } = await graphGet(accessToken, url, headers);
    if (status < 200 || status >= 300) return out;
    for (const raw of (body?.value ?? []) as GraphSearchedMessage[]) {
      const mapped = mapSearchedMessage(raw);
      if (!mapped || Date.parse(mapped.receivedAt) < sinceMs) continue;
      if (!mapped.from.toLowerCase().includes(TRACY_FROM)) continue;
      out.push(mapped);
    }
    url = body?.["@odata.nextLink"] ?? null;
  }
  return out;
}

function mapSearchedMessage(raw: GraphSearchedMessage | null | undefined): OutlookSearchedMessage | null {
  if (!raw?.id || raw.isDraft) return null;
  const received = raw.receivedDateTime || raw.sentDateTime;
  if (!received) return null;
  const from = formatGraphAddress(raw.from);
  if (!from) return null;
  return {
    id: raw.id,
    from,
    to: joinGraphAddresses(raw.toRecipients),
    cc: joinGraphAddresses(raw.ccRecipients),
    subject: raw.subject?.trim() || null,
    receivedAt: new Date(received).toISOString(),
    body: raw.body?.content ?? raw.bodyPreview ?? "",
    conversationId: raw.conversationId ?? null,
    internetMessageId: raw.internetMessageId ?? null,
  };
}

export async function downloadOutlookResume(
  accessToken: string,
  messageId: string
): Promise<{ filename: string; bytes: Buffer } | null> {
  const { status, body } = await graphGet(
    accessToken,
    `/me/messages/${encodeURIComponent(messageId)}/attachments?$top=20`
  );
  if (status < 200 || status >= 300) return null;
  const files = (body?.value ?? []) as {
    id?: string;
    name?: string;
    contentType?: string;
    contentBytes?: string;
  }[];
  const resumes = files.filter((item) => isResumeFile(item.name, item.contentType));
  const file =
    resumes.find((item) => `${item.name ?? ""} ${item.contentType ?? ""}`.toLowerCase().includes("word")) ??
    resumes[0];
  if (!file) return null;
  if (file.contentBytes) {
    return { filename: file.name || "resume.docx", bytes: Buffer.from(file.contentBytes, "base64") };
  }
  if (!file.id) return null;
  const one = await graphGet(
    accessToken,
    `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(file.id)}`
  );
  const full = one.body as { contentBytes?: string } | null;
  if (!full?.contentBytes) return null;
  return { filename: file.name || "resume.docx", bytes: Buffer.from(full.contentBytes, "base64") };
}

function isResumeFile(name?: string, contentType?: string): boolean {
  const label = `${name ?? ""} ${contentType ?? ""}`.toLowerCase();
  return label.includes(".docx") || label.includes(".pdf") || label.includes("wordprocessingml") || label.includes("pdf");
}
