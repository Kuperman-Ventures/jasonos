"use server";

import { revalidatePath } from "next/cache";
import {
  searchGmailThreads,
  getGmailThread,
  isGmailConnected,
} from "@/lib/integrations/gmail";
import { gmailThreadUrl } from "@/lib/integrations/gmail-links";
import { getGoogleAccessToken } from "@/lib/integrations/google-calendar";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildContactLookup,
  canonicalEmail,
  extractEmail,
  isFromMe,
  isMyOwnAddress,
  type ContactLookupRow,
} from "@/lib/outreach/email-matching";
import {
  insertContactTouches,
  recordSyncState,
  type ContactTouchInput,
  type InsertTouchesResult,
} from "@/lib/outreach/touch-capture";

// ---------------------------------------------------------------------------
// Email write-back — when a sync matches a contact (typically by NAME, e.g. a
// spreadsheet-imported contact with no email on file) using an address that
// isn't yet on the contact, record it so we can attach it. This binds future
// email/calendar activity to that same canonical contact instead of drifting
// onto a duplicate, and stops the Suggested-Contacts scan from re-suggesting.
// ---------------------------------------------------------------------------

type EnrichMap = Map<string, { existing: string[]; adds: string[] }>;

function recordEnrich(
  enrich: EnrichMap,
  contact: ContactLookupRow,
  rawEmail: string
): void {
  const email = extractEmail(rawEmail);
  if (!email || isMyOwnAddress(email)) return;
  const canon = canonicalEmail(email);
  if (contact.emails.some((e) => canonicalEmail(e) === canon)) return;
  const cur = enrich.get(contact.id) ?? { existing: contact.emails, adds: [] };
  if (!cur.adds.some((a) => canonicalEmail(a) === canon)) cur.adds.push(email);
  enrich.set(contact.id, cur);
}

function mergeEmails(existing: string[], adds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...existing, ...adds]) {
    if (!e) continue;
    const key = canonicalEmail(e);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function applyEmailEnrichments(enrich: EnrichMap): Promise<void> {
  if (!enrich.size) return;
  const sb = createServiceRoleClient();
  for (const [contactId, { existing, adds }] of enrich) {
    if (!adds.length) continue;
    await sb
      .from("contacts")
      .update({ emails: mergeEmails(existing, adds) })
      .eq("id", contactId)
      .then(
        () => undefined,
        (err) => console.error("[outreach-sync.emailEnrich]", err)
      );
  }
}

export type SyncResultSource = "gmail" | "gcal";

export interface SyncResult {
  ok: boolean;
  source: SyncResultSource;
  matched: number;
  inserted: number;
  duplicates: number;
  cadenceUpdates: number;
  skipped: number;
  error?: string;
}

export interface SyncAllResult {
  ok: boolean;
  ranAt: string;
  gmail: SyncResult | null;
  gcal: SyncResult | null;
}

// ---------------------------------------------------------------------------
// Gmail sync — captures outbound emails from the last `daysBack` days.
// ---------------------------------------------------------------------------

export async function syncOutreachFromGmail(opts?: {
  daysBack?: number;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 7));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("gmail", "Supabase service role is not configured.");
  }
  const gmailReady = await isGmailConnected();
  if (!gmailReady) return errorResult("gmail", "Gmail is not connected.");

  const lookup = await buildContactLookup();
  if (!lookup.rows.length) {
    await recordSyncState("gmail", { written: 0, matched: 0, skipped: 0 });
    return okResult("gmail", emptyInsertResult(), 0, 0);
  }

  const afterEpoch = Math.floor((Date.now() - daysBack * 86_400_000) / 1000);
  const touches: ContactTouchInput[] = [];
  const enrich: EnrichMap = new Map();
  let skipped = 0;

  try {
    const threads = await searchGmailThreads({
      query: `in:sent after:${afterEpoch}`,
      pageSize: 100,
    });

    for (const t of threads) {
      const full = await getGmailThread(t.id);
      if (!full) continue;

      for (const m of full.messages) {
        if (!m.from || !isFromMe(m.from)) continue;
        if (!m.date) continue;
        if (new Date(m.date).getTime() < Date.now() - daysBack * 86_400_000) continue;
        if (!m.to) continue;
        if (isMyOwnAddress(m.to)) continue;

        const contact = lookup.resolve(m.to);
        if (!contact) {
          skipped += 1;
          continue;
        }
        recordEnrich(enrich, contact, m.to);

        touches.push({
          contact_id: contact.id,
          channel: "email",
          direction: "outbound",
          touched_at: new Date(m.date).toISOString(),
          source: "gmail",
          external_id: m.id,
          brief: oneLine(m.plaintextBody) || m.snippet || "Email sent",
          subject: m.subject ?? null,
          thread_url: gmailThreadUrl(t.id),
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordSyncState("gmail", { error: msg });
    return errorResult("gmail", msg);
  }

  const insertResult = await insertContactTouches(touches);
  await applyEmailEnrichments(enrich);
  await recordSyncState("gmail", {
    matched: touches.length,
    inserted: insertResult.inserted,
    duplicates: insertResult.duplicates,
    cadenceUpdates: insertResult.cadenceUpdates,
    skipped,
    errors: insertResult.errors,
  });
  revalidatePaths();
  return okResult("gmail", insertResult, touches.length, skipped);
}

// ---------------------------------------------------------------------------
// Calendar sync — captures meetings from the last `daysBack` days where any
// attendee resolves to a contact. Uses the primary calendar via the existing
// Google OAuth token.
// ---------------------------------------------------------------------------

interface RawGCalEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; displayName?: string; self?: boolean; responseStatus?: string }[];
  htmlLink?: string;
  status?: string;
}

interface GCalListPage {
  items?: RawGCalEvent[];
  nextPageToken?: string;
}

/**
 * Fetch every primary-calendar event in [timeMin, timeMax], following
 * nextPageToken. Sync used to request a single page of 250 with
 * orderBy=startTime — on a busy 90-day window that returns the *oldest*
 * 250 events and silently drops recent meetings (e.g. today's calls).
 */
async function fetchPrimaryCalendarEvents(opts: {
  token: string;
  timeMin: string;
  timeMax: string;
}): Promise<{ events: RawGCalEvent[]; error?: string }> {
  const events: RawGCalEvent[] = [];
  let pageToken: string | undefined;
  // Hard cap: 250/page × 20 = 5,000 events. Far above a normal 90-day load.
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    let raw: GCalListPage;
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${opts.token}` }, cache: "no-store" }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return {
          events,
          error: `GCal ${res.status} :: ${txt.slice(0, 200)}`,
        };
      }
      raw = (await res.json()) as GCalListPage;
    } catch (err) {
      return {
        events,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (raw.items?.length) events.push(...raw.items);
    pageToken = raw.nextPageToken;
    if (!pageToken) break;
  }
  return { events };
}

export async function syncOutreachFromCalendar(opts?: {
  daysBack?: number;
}): Promise<SyncResult> {
  const daysBack = Math.max(1, Math.min(90, opts?.daysBack ?? 30));

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResult("gcal", "Supabase service role is not configured.");
  }
  const token = await getGoogleAccessToken();
  if (!token) return errorResult("gcal", "Google Calendar is not connected.");

  const lookup = await buildContactLookup();
  if (!lookup.rows.length) {
    await recordSyncState("gcal", { matched: 0 });
    return okResult("gcal", emptyInsertResult(), 0, 0);
  }

  const timeMin = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const timeMax = new Date().toISOString();

  const { events, error } = await fetchPrimaryCalendarEvents({
    token,
    timeMin,
    timeMax,
  });
  if (error && events.length === 0) {
    await recordSyncState("gcal", { error });
    return errorResult("gcal", error);
  }
  if (error) {
    // Partial page load — still process what we have, but surface the error.
    console.warn("[outreach-sync.gcal] partial calendar fetch:", error);
  }

  const touches: ContactTouchInput[] = [];
  const enrich: EnrichMap = new Map();
  let skipped = 0;
  const now = Date.now();

  for (const ev of events) {
    if (ev.status === "cancelled") continue;
    const startISO = ev.start?.dateTime ?? null;
    if (!startISO) continue;
    // Capture once the meeting has started (in-progress counts as met).
    if (new Date(startISO).getTime() > now) continue;

    const attendees = ev.attendees ?? [];
    const otherAttendees = attendees.filter((a) => !a.self && a.email);
    if (!otherAttendees.length) continue;

    // Build a header-style string we can pass through the lookup resolver.
    let matchedAny = false;
    for (const a of otherAttendees) {
      const header = a.displayName ? `${a.displayName} <${a.email}>` : a.email!;
      const contact = lookup.resolve(header);
      if (!contact) continue;
      // Skip declined attendees — they didn't actually meet.
      if (a.responseStatus === "declined") continue;

      matchedAny = true;
      if (a.email) recordEnrich(enrich, contact, a.email);
      touches.push({
        contact_id: contact.id,
        channel: "calendar",
        direction: "outbound", // calendar meetings are mutual; we tag outbound for cadence advancement
        touched_at: new Date(startISO).toISOString(),
        source: "gcal",
        // Multiple contacts can share one event → make external_id unique per (event, contact)
        external_id: `${ev.id}::${contact.id}`,
        brief: ev.summary ?? "Meeting",
        subject: ev.summary ?? null,
        thread_url: ev.htmlLink ?? null,
      });
    }
    if (!matchedAny) skipped += 1;
  }

  const insertResult = await insertContactTouches(touches);
  await applyEmailEnrichments(enrich);
  await recordSyncState("gcal", {
    matched: touches.length,
    inserted: insertResult.inserted,
    duplicates: insertResult.duplicates,
    cadenceUpdates: insertResult.cadenceUpdates,
    skipped,
    pagesFetched: true,
    eventCount: events.length,
    errors: insertResult.errors,
    ...(error ? { fetchWarning: error } : {}),
  });
  revalidatePaths();
  return okResult("gcal", insertResult, touches.length, skipped);
}

// ---------------------------------------------------------------------------
// Upcoming meetings — read-only lookahead used by the networking report.
// Returns future Google Calendar events whose attendees resolve to a known
// contact. Does not write touches. Returns [] when Calendar isn't connected.
// ---------------------------------------------------------------------------

export interface UpcomingCalendarMeeting {
  contactId: string;
  startISO: string;
}

export async function getUpcomingCalendarMeetings(opts?: {
  daysAhead?: number;
}): Promise<UpcomingCalendarMeeting[]> {
  const daysAhead = Math.max(1, Math.min(120, opts?.daysAhead ?? 30));
  const token = await getGoogleAccessToken();
  if (!token) return [];

  const lookup = await buildContactLookup();
  if (!lookup.rows.length) return [];

  const now = Date.now();
  const { events } = await fetchPrimaryCalendarEvents({
    token,
    timeMin: new Date(now).toISOString(),
    timeMax: new Date(now + daysAhead * 86_400_000).toISOString(),
  });

  const out: UpcomingCalendarMeeting[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (ev.status === "cancelled") continue;
    const startISO = ev.start?.dateTime ?? null;
    if (!startISO) continue;
    if (new Date(startISO).getTime() < now) continue; // future only
    for (const a of ev.attendees ?? []) {
      if (a.self || !a.email) continue;
      if (a.responseStatus === "declined") continue;
      const header = a.displayName ? `${a.displayName} <${a.email}>` : a.email;
      const contact = lookup.resolve(header);
      if (!contact) continue;
      const key = `${contact.id}::${startISO}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ contactId: contact.id, startISO });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Orchestrator — run all configured syncs and aggregate results.
// ---------------------------------------------------------------------------

export async function syncOutreachAll(opts?: {
  daysBack?: number;
}): Promise<SyncAllResult> {
  const ranAt = new Date().toISOString();
  const [gmail, gcal] = await Promise.allSettled([
    syncOutreachFromGmail(opts),
    syncOutreachFromCalendar(opts),
  ]);

  return {
    ok:
      (gmail.status === "fulfilled" && gmail.value.ok) ||
      (gcal.status === "fulfilled" && gcal.value.ok),
    ranAt,
    gmail: settled(gmail),
    gcal: settled(gcal),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyInsertResult(): InsertTouchesResult {
  return { inserted: 0, duplicates: 0, cadenceUpdates: 0, errors: [] };
}

function okResult(
  source: SyncResultSource,
  insert: InsertTouchesResult,
  matched: number,
  skipped: number
): SyncResult {
  return {
    ok: true,
    source,
    matched,
    inserted: insert.inserted,
    duplicates: insert.duplicates,
    cadenceUpdates: insert.cadenceUpdates,
    skipped,
    error: insert.errors.length ? insert.errors.join("; ") : undefined,
  };
}

function errorResult(source: SyncResultSource, error: string): SyncResult {
  return {
    ok: false,
    source,
    matched: 0,
    inserted: 0,
    duplicates: 0,
    cadenceUpdates: 0,
    skipped: 0,
    error,
  };
}

function settled<T extends SyncResult>(
  r: PromiseSettledResult<T>
): SyncResult | null {
  if (r.status === "fulfilled") return r.value;
  return null;
}

function oneLine(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function revalidatePaths() {
  revalidatePath("/outreach");
  revalidatePath("/outreach/queue");
  revalidatePath("/outreach/schedule");
  revalidatePath("/outreach/people");
}
