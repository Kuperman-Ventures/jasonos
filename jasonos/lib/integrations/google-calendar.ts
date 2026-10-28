// Google Calendar adapter — today's events for the Morning Brief + CoSA WeekPlanner.
// Uses the Google OAuth tokens stored in jasonos.user_integrations.

import "server-only";
import { emptyResult, type IntegrationResult } from "./_base";
import type { GCalEvent } from "@/lib/calendar/health-model";
import {
  GMAIL_ACCOUNT_EMAIL,
  GOOGLE_ADVISORS,
  GOOGLE_GMAIL,
  getGoogleAccessToken,
  listGoogleAccessTokens,
} from "@/lib/integrations/google-tokens";
import { isMyOwnAddress, normalizeName } from "@/lib/outreach/email-matching";
import { isCalendarProxyAddress } from "@/lib/outreach/mail-noise";

export { type GCalEvent };

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  attendees: { email: string; name?: string; isOrganizer?: boolean; isMe?: boolean }[];
  conferenceUrl?: string;
  location?: string;
  notes?: string;
}

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

const COSA_CALENDAR_ID =
  "c_f733c89ebd8fa8294dfb9b29147e64acc78eae845b47ea1271ddb7844e191716@group.calendar.google.com";

/**
 * Personal calendars Sync and the week view treat as Jason's schedule.
 * Advisors primary comes from the Advisors Google token.
 * Gmail primary comes from the personal Gmail token when connected;
 * otherwise we still try the shared calendar id on the Advisors token.
 */
export const PERSONAL_CALENDAR_IDS = ["primary", GMAIL_ACCOUNT_EMAIL] as const;

export interface CalendarApiEvent {
  id?: string;
  iCalUID?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: {
    email?: string;
    displayName?: string;
    self?: boolean;
    organizer?: boolean;
    responseStatus?: string;
  }[];
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendeesOmitted?: boolean;
  htmlLink?: string;
  status?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
  location?: string;
  description?: string;
  extendedProperties?: { private?: Record<string, string> };
}

interface CalendarListPage {
  items?: CalendarApiEvent[];
  nextPageToken?: string;
}

function calendarErrorMessage(calendarId: string, status: number, body: string): string {
  if (status === 401) {
    return "sign-in expired. Reconnect this Google account in Settings.";
  }
  if ((status === 404 || status === 403) && calendarId !== "primary") {
    return `${calendarId} is not readable from Advisors Google. Connect personal Gmail in Settings, or share that calendar with jason@kupermanadvisors.com (See all event details).`;
  }
  return `GCal ${status} :: ${body.slice(0, 200)}`;
}

function eventDedupeKey(ev: CalendarApiEvent): string | null {
  return ev.iCalUID || ev.id || null;
}

/** Other people on an event: organizer + guests, minus Jason, rooms, and declined. */
export function calendarEventGuests(
  ev: CalendarApiEvent
): { email: string; name?: string }[] {
  const seen = new Set<string>();
  const out: { email: string; name?: string }[] = [];
  const add = (
    email?: string,
    name?: string,
    opts?: { self?: boolean; declined?: boolean }
  ) => {
    if (opts?.self || opts?.declined) return;
    const trimmedName = name?.trim() || undefined;
    const lower = email?.trim().toLowerCase() ?? "";
    if (lower && (isMyOwnAddress(email!) || isCalendarProxyAddress(email!))) return;
    if (!lower && !trimmedName) return;
    const key = lower || `name:${normalizeName(trimmedName!)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ email: lower, name: trimmedName });
  };

  add(ev.organizer?.email, ev.organizer?.displayName, {
    self: ev.organizer?.self,
  });
  for (const a of ev.attendees ?? []) {
    add(a.email, a.displayName, {
      self: a.self,
      declined: a.responseStatus === "declined",
    });
  }
  return out;
}

export function mergeCalendarEvents(lists: CalendarApiEvent[][]): CalendarApiEvent[] {
  const seen = new Set<string>();
  const out: CalendarApiEvent[] = [];
  for (const list of lists) {
    for (const ev of list) {
      const key = eventDedupeKey(ev);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(ev);
    }
  }
  return out;
}

interface CalendarListEntry {
  id?: string;
  summary?: string;
  selected?: boolean;
  accessRole?: string;
  primary?: boolean;
}

function isHolidayOrBirthdayCalendar(cal: CalendarListEntry): boolean {
  const id = (cal.id ?? "").toLowerCase();
  const summary = (cal.summary ?? "").toLowerCase();
  if (id.includes("#holiday@") || id.includes("#contacts@")) return true;
  if (id.includes("group.v.calendar.google.com") && /holiday|birthday/.test(summary)) {
    return true;
  }
  if (/^holidays in /.test(summary)) return true;
  return false;
}

/** Calendars this account actually uses. Primary first. Cap keeps Sync under time. */
export async function listReadableCalendarIds(
  token: string,
  maxCalendars = 10
): Promise<{ calendarIds: string[]; error?: string }> {
  try {
    const res = await fetch(
      `${CAL_BASE}/users/me/calendarList?minAccessRole=reader&maxResults=250`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        calendarIds: ["primary"],
        error: calendarErrorMessage("calendarList", res.status, txt),
      };
    }
    const body = (await res.json()) as { items?: CalendarListEntry[] };
    const selected = (body.items ?? []).filter((cal) => {
      if (!cal.id) return false;
      if (cal.selected === false) return false;
      if (cal.accessRole === "freeBusyReader") return false;
      if (isHolidayOrBirthdayCalendar(cal)) return false;
      return true;
    });
    selected.sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)));
    const ids = selected.map((cal) => cal.id!).slice(0, maxCalendars);
    if (!ids.includes("primary")) ids.unshift("primary");
    return { calendarIds: ids.slice(0, maxCalendars) };
  } catch (err) {
    return {
      calendarIds: ["primary"],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchAccountCalendarEvents(opts: {
  token: string;
  timeMin: string;
  timeMax: string;
}): Promise<{ events: CalendarApiEvent[]; calendarIds: string[]; error?: string }> {
  const listed = await listReadableCalendarIds(opts.token);
  const lists: CalendarApiEvent[][] = [];
  const errors: string[] = [];
  for (const calendarId of listed.calendarIds) {
    const fetched = await fetchCalendarEvents({
      token: opts.token,
      calendarId,
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
    });
    lists.push(fetched.events);
    if (fetched.error && !fetched.events.length) {
      errors.push(`${calendarId}: ${fetched.error}`);
    }
  }
  return {
    events: mergeCalendarEvents(lists),
    calendarIds: listed.calendarIds,
    error: errors[0] ?? listed.error,
  };
}

/** Page through one calendar. Hard cap 250/page × 20 = 5,000 events. */
export async function fetchCalendarEvents(opts: {
  token: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
  maxPages?: number;
}): Promise<{ calendarId: string; events: CalendarApiEvent[]; error?: string }> {
  const events: CalendarApiEvent[] = [];
  const maxPages = opts.maxPages ?? 20;
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      timeMin: opts.timeMin,
      timeMax: opts.timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    let raw: CalendarListPage;
    try {
      const res = await fetch(
        `${CAL_BASE}/calendars/${encodeURIComponent(opts.calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${opts.token}` }, cache: "no-store" }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return {
          calendarId: opts.calendarId,
          events,
          error: calendarErrorMessage(opts.calendarId, res.status, txt),
        };
      }
      raw = (await res.json()) as CalendarListPage;
    } catch (err) {
      return {
        calendarId: opts.calendarId,
        events,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (raw.items?.length) events.push(...raw.items);
    pageToken = raw.nextPageToken;
    if (!pageToken) break;
  }
  return { calendarId: opts.calendarId, events };
}

/**
 * Advisors primary + personal Gmail primary (own token), with a share fallback
 * on the Advisors token when personal Gmail is not connected.
 * A missing extra calendar is a warning, not a hard fail — other calendars still sync.
 */
export async function fetchAllPersonalCalendarEvents(opts: {
  token?: string;
  timeMin: string;
  timeMax: string;
}): Promise<{ events: CalendarApiEvent[]; error?: string; warnings: string[] }> {
  const tokens = await listGoogleAccessTokens();
  const advisors =
    tokens.find((t) => t.provider === GOOGLE_ADVISORS)?.token ?? opts.token ?? null;
  const gmail = tokens.find((t) => t.provider === GOOGLE_GMAIL)?.token ?? null;

  if (!advisors && !gmail) {
    return { events: [], error: "Google Calendar is not connected.", warnings: [] };
  }

  const fetches: Promise<{
    calendarId: string;
    events: CalendarApiEvent[];
    error?: string;
  }>[] = [];

  if (advisors) {
    fetches.push(
      fetchAccountCalendarEvents({
        token: advisors,
        timeMin: opts.timeMin,
        timeMax: opts.timeMax,
      }).then((r) => ({ ...r, calendarId: "primary" }))
    );
  }
  if (gmail) {
    fetches.push(
      fetchAccountCalendarEvents({
        token: gmail,
        timeMin: opts.timeMin,
        timeMax: opts.timeMax,
      }).then((r) => ({ ...r, calendarId: GMAIL_ACCOUNT_EMAIL }))
    );
  } else if (advisors) {
    fetches.push(
      fetchCalendarEvents({
        token: advisors,
        calendarId: GMAIL_ACCOUNT_EMAIL,
        timeMin: opts.timeMin,
        timeMax: opts.timeMax,
      })
    );
  }

  const results = await Promise.all(fetches);
  const warnings: string[] = [];
  const lists: CalendarApiEvent[][] = [];
  let primaryError: string | undefined;

  for (const r of results) {
    lists.push(r.events);
    if (!r.error) continue;
    if (r.calendarId === "primary") {
      primaryError = r.error;
    } else if (r.calendarId === GMAIL_ACCOUNT_EMAIL && !gmail) {
      warnings.push(
        `${GMAIL_ACCOUNT_EMAIL} is not connected. In Settings, click Connect personal Gmail and sign in as that account.`
      );
    } else {
      warnings.push(r.error);
    }
  }

  const events = mergeCalendarEvents(lists);
  if (primaryError && events.length === 0) {
    return { events, error: primaryError, warnings };
  }
  if (primaryError) warnings.unshift(primaryError);
  return { events, warnings };
}

const TRACK_COLOR_IDS: Record<string, string> = {
  advisors:    "10",
  jobSearch:   "9",
  ventures:    "3",
  networking:  "6",
  development: "1",
  cosaAdmin:   "7",
};

export { getGoogleAccessToken };

// ─── Morning Brief: today's calendar ─────────────────────────────────────────

export async function getTodaysCalendar(opts?: {
  tz?: string;
  calendarId?: string;
}): Promise<IntegrationResult<CalendarEvent[]>> {
  const tokens = await listGoogleAccessTokens();
  const token = tokens[0]?.token ?? null;
  if (!token) return emptyResult([], false);

  try {
    const tz = opts?.tz ?? "America/New_York";
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const ymd = fmt.format(now);
    const dayStart = new Date(`${ymd}T00:00:00`);
    const dayEnd = new Date(`${ymd}T23:59:59`);
    const fetched = opts?.calendarId
      ? await fetchCalendarEvents({
          token,
          calendarId: opts.calendarId,
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
        })
      : await fetchAllPersonalCalendarEvents({
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
        });
    if (fetched.error && fetched.events.length === 0) {
      throw new Error(fetched.error);
    }
    const events: CalendarEvent[] = fetched.events.map((e) => ({
      id: e.id ?? "",
      title: e.summary ?? "(untitled)",
      startsAt: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
      endsAt: e.end?.dateTime ?? `${e.end?.date}T23:59:59`,
      attendees: (e.attendees ?? []).map((a) => ({
        email: a.email ?? "",
        name: a.displayName,
        isOrganizer: a.organizer,
        isMe: a.self,
      })),
      conferenceUrl:
        e.hangoutLink ??
        e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri,
      location: e.location,
      notes: e.description,
    }));
    return emptyResult(events, true);
  } catch (err) {
    console.error("[gcal] fetch failed:", err);
    return emptyResult([], true, err instanceof Error ? err.message : String(err));
  }
}

// ─── CoSA WeekPlanner: event fetch ───────────────────────────────────────────

async function gcalFetch(calendarId: string, path: string, method: string, token: string, body?: object): Promise<unknown> {
  const url = `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[google-calendar ${method} ${path}]`, res.status, text);
    return null;
  }
  return method === "DELETE" ? true : res.json();
}

export async function fetchAllCosaCalendarEvents(token: string, timeMin: string, timeMax: string): Promise<GCalEvent[]> {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", maxResults: "250" });
  const data = (await gcalFetch(COSA_CALENDAR_ID, `?${params}`, "GET", token)) as { items?: GCalEvent[] } | null;
  return data?.items ?? [];
}

export async function fetchPersonalCalendarEvents(token: string, timeMin: string, timeMax: string): Promise<GCalEvent[]> {
  const { events } = await fetchAllPersonalCalendarEvents({ token, timeMin, timeMax });
  return events.filter(
    (ev) =>
      Boolean(ev.id) &&
      ev.start?.dateTime != null &&
      ev.extendedProperties?.private?.cosaTag !== "cosa-event"
  ) as GCalEvent[];
}

export async function createGCalEvent(input: { token: string; name: string; track: string; subTrack?: string | null; templateId?: string | null; startISO: string; endISO: string; userTz: string }): Promise<GCalEvent | null> {
  const body = {
    summary: input.name,
    colorId: TRACK_COLOR_IDS[input.track] ?? "1",
    start: { dateTime: input.startISO, timeZone: input.userTz },
    end: { dateTime: input.endISO, timeZone: input.userTz },
    extendedProperties: { private: { cosaTag: "cosa-event", cosaTrack: input.track, cosaSubTrack: input.subTrack ?? "", ...(input.templateId ? { cosaTemplateId: input.templateId } : {}) } },
  };
  const data = await gcalFetch(COSA_CALENDAR_ID, "", "POST", input.token, body);
  return (data as GCalEvent | null) ?? null;
}

export async function updateGCalEvent(input: { token: string; eventId: string; name: string; track: string; subTrack?: string | null; startISO: string; endISO: string; userTz: string }): Promise<GCalEvent | null> {
  const body = {
    summary: input.name,
    colorId: TRACK_COLOR_IDS[input.track] ?? "1",
    start: { dateTime: input.startISO, timeZone: input.userTz },
    end: { dateTime: input.endISO, timeZone: input.userTz },
    extendedProperties: { private: { cosaTag: "cosa-event", cosaTrack: input.track, cosaSubTrack: input.subTrack ?? "" } },
  };
  const data = await gcalFetch(COSA_CALENDAR_ID, `/${input.eventId}`, "PATCH", input.token, body);
  return (data as GCalEvent | null) ?? null;
}

export async function createGoogleMeetInvite(input: {
  token: string;
  summary: string;
  startIso: string;
  endIso: string;
  attendeeEmail: string;
}): Promise<
  | { ok: true; eventId: string; meetUrl: string | null }
  | { ok: false; error: string; needsReconnect: boolean }
> {
  const requestId = `browning-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const params = new URLSearchParams({
    conferenceDataVersion: "1",
    sendUpdates: "all",
  });
  const res = await fetch(`${CAL_BASE}/calendars/primary/events?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: "Job networking call.",
      start: { dateTime: input.startIso, timeZone: "America/New_York" },
      end: { dateTime: input.endIso, timeZone: "America/New_York" },
      attendees: [{ email: input.attendeeEmail }],
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    const needsReconnect = res.status === 403 || /insufficient/i.test(text);
    return {
      ok: false,
      needsReconnect,
      error: needsReconnect
        ? "Reconnect Advisors Google in Settings and allow adding events. This connection can only read the calendar."
        : `Google Calendar could not create the invite (${res.status}).`,
    };
  }
  let json: { id?: string; hangoutLink?: string; conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] } } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    return { ok: false, needsReconnect: false, error: "Google Calendar returned an unreadable invite." };
  }
  if (!json.id) {
    return { ok: false, needsReconnect: false, error: "Google Calendar did not return the new event." };
  }
  const meetUrl =
    json.hangoutLink ??
    json.conferenceData?.entryPoints?.find((point) => point.entryPointType === "video")?.uri ??
    null;
  return { ok: true, eventId: json.id, meetUrl };
}

const HOLD_COLOR_ID = "8";

function tentativeHoldBody(
  input: {
    summary: string;
    startIso: string;
    endIso: string;
    handoffId: string;
    slotId: string;
    organizerEmail: string;
  },
  withAttendee: boolean
) {
  return {
    summary: input.summary,
    description:
      "Tentative hold for a time offered in a Browning networking reply. It stays on the calendar until a meeting is set.",
    status: "tentative",
    transparency: "opaque",
    colorId: HOLD_COLOR_ID,
    start: { dateTime: input.startIso, timeZone: "America/New_York" },
    end: { dateTime: input.endIso, timeZone: "America/New_York" },
    ...(withAttendee
      ? { attendees: [{ email: input.organizerEmail, responseStatus: "tentative" }] }
      : {}),
    reminders: { useDefault: false },
    extendedProperties: {
      private: {
        browningHold: "1",
        handoffId: input.handoffId,
        slotId: input.slotId,
      },
    },
  };
}

function holdWriteError(status: number, text: string): { error: string; needsReconnect: boolean } {
  const needsReconnect = status === 403 || /insufficient/i.test(text);
  return {
    needsReconnect,
    error: needsReconnect
      ? "Reconnect Advisors Google in Settings and allow adding events. This connection can only read the calendar."
      : `Google Calendar could not save a tentative hold (${status}).`,
  };
}

type HoldWriteResult = { ok: true; eventId?: string } | { ok: false; error: string; needsReconnect: boolean };

async function writeTentativeHold(
  input: {
    token: string;
    summary: string;
    startIso: string;
    endIso: string;
    handoffId: string;
    slotId: string;
    organizerEmail: string;
  },
  method: "POST" | "PATCH",
  eventId?: string
): Promise<HoldWriteResult> {
  const params = new URLSearchParams({ sendUpdates: "none" });
  const path = eventId ? `/${encodeURIComponent(eventId)}` : "";
  const attempts = [true, false];
  let last: HoldWriteResult = {
    ok: false,
    needsReconnect: false,
    error: "Google Calendar could not save a tentative hold.",
  };
  for (const withAttendee of attempts) {
    const body = tentativeHoldBody(input, withAttendee);
    const res = await fetch(`${CAL_BASE}/calendars/primary/events${path}?${params}`, {
      method,
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (res.ok) {
      if (method === "PATCH") return { ok: true };
      try {
        const json = JSON.parse(text) as { id?: string };
        if (!json.id) {
          return { ok: false, needsReconnect: false, error: "Google Calendar did not return the hold." };
        }
        return { ok: true, eventId: json.id };
      } catch {
        return { ok: false, needsReconnect: false, error: "Google Calendar returned an unreadable hold." };
      }
    }
    console.error(`[google-calendar hold ${method}]`, res.status, text.slice(0, 300));
    last = { ok: false, ...holdWriteError(res.status, text) };
    if (last.needsReconnect) return last;
  }
  return last;
}

/**
 * Personal work block on the Advisors primary calendar. No guest, no Meet.
 * Used for Commitment Check "schedule time to do this" blocks.
 */
export async function createPrimaryCalendarEvent(input: {
  token: string;
  summary: string;
  description?: string | null;
  startIso: string;
  endIso: string;
}): Promise<
  | { ok: true; eventId: string; htmlLink: string | null }
  | { ok: false; error: string; needsReconnect: boolean }
> {
  const params = new URLSearchParams({ sendUpdates: "none" });
  const res = await fetch(`${CAL_BASE}/calendars/primary/events?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description?.trim() || undefined,
      start: { dateTime: input.startIso, timeZone: "America/New_York" },
      end: { dateTime: input.endIso, timeZone: "America/New_York" },
      transparency: "opaque",
      reminders: { useDefault: true },
      extendedProperties: {
        private: { jasonosCommitment: "1" },
      },
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    const needsReconnect = res.status === 403 || /insufficient/i.test(text);
    return {
      ok: false,
      needsReconnect,
      error: needsReconnect
        ? "Reconnect Advisors Google in Settings and allow adding events. This connection can only read the calendar."
        : `Google Calendar could not create the event (${res.status}).`,
    };
  }
  let json: { id?: string; htmlLink?: string } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    return {
      ok: false,
      needsReconnect: false,
      error: "Google Calendar returned an unreadable event.",
    };
  }
  if (!json.id) {
    return {
      ok: false,
      needsReconnect: false,
      error: "Google Calendar did not return the new event.",
    };
  }
  return { ok: true, eventId: json.id, htmlLink: json.htmlLink?.trim() || null };
}

/** Grey tentative block on the Advisors calendar. No guest is invited. */
export async function createTentativeHold(input: {
  token: string;
  summary: string;
  startIso: string;
  endIso: string;
  handoffId: string;
  slotId: string;
  organizerEmail: string;
}): Promise<{ ok: true; eventId: string } | { ok: false; error: string; needsReconnect: boolean }> {
  const result = await writeTentativeHold(input, "POST");
  if (!result.ok) return result;
  if (!result.eventId) {
    return { ok: false, needsReconnect: false, error: "Google Calendar did not return the hold." };
  }
  return { ok: true, eventId: result.eventId };
}

export async function updateTentativeHold(input: {
  token: string;
  eventId: string;
  summary: string;
  startIso: string;
  endIso: string;
  handoffId: string;
  slotId: string;
  organizerEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string; needsReconnect: boolean }> {
  const result = await writeTentativeHold(input, "PATCH", input.eventId);
  if (!result.ok) return result;
  return { ok: true };
}

export async function getPrimaryCalendarEvent(
  token: string,
  eventId: string
): Promise<
  | { ok: true; event: CalendarApiEvent }
  | { ok: false; error: string; needsReconnect: boolean }
> {
  const res = await fetch(
    `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  const text = await res.text();
  if (!res.ok) {
    const needsReconnect = res.status === 401 || res.status === 403;
    return {
      ok: false,
      needsReconnect,
      error: needsReconnect
        ? "Reconnect Advisors Google in Settings."
        : `Google Calendar could not load the event (${res.status}).`,
    };
  }
  try {
    const event = JSON.parse(text) as CalendarApiEvent;
    return { ok: true, event };
  } catch {
    return {
      ok: false,
      needsReconnect: false,
      error: "Google Calendar returned an unreadable event.",
    };
  }
}

/**
 * Deliver a review copy by calendar invite email (works with calendar.events
 * when gmail.send is not granted yet). Creates a short event, emails the
 * guest, then deletes the event so the calendar stays clean.
 */
export async function deliverEmailViaCalendarInvite(input: {
  token: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string; needsReconnect: boolean }> {
  const start = new Date(Date.now() + 2 * 60 * 60_000);
  const end = new Date(start.getTime() + 15 * 60_000);
  const params = new URLSearchParams({ sendUpdates: "all" });
  const createRes = await fetch(`${CAL_BASE}/calendars/primary/events?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.subject.slice(0, 1024),
      description: input.body,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: [{ email: input.to }],
      reminders: { useDefault: false },
      transparency: "transparent",
      status: "tentative",
    }),
    cache: "no-store",
  });
  const createText = await createRes.text();
  if (!createRes.ok) {
    const needsReconnect = createRes.status === 401 || createRes.status === 403;
    return {
      ok: false,
      needsReconnect,
      error: needsReconnect
        ? "Reconnect Advisors Google in Settings."
        : `Could not deliver review email via Calendar (${createRes.status}).`,
    };
  }
  let eventId = "";
  try {
    eventId = String((JSON.parse(createText) as { id?: string }).id ?? "");
  } catch {
    eventId = "";
  }
  if (eventId) {
    await deletePrimaryCalendarEvent(input.token, eventId);
  }
  return { ok: true };
}

export async function deletePrimaryCalendarEvent(
  token: string,
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string; needsReconnect: boolean }> {
  const res = await fetch(
    `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  if (res.ok || res.status === 404 || res.status === 410) return { ok: true };
  const text = await res.text();
  console.error("[google-calendar hold delete]", res.status, text.slice(0, 300));
  return { ok: false, ...holdWriteError(res.status, text) };
}

export async function listHandoffHoldEvents(input: {
  token: string;
  handoffId: string;
}): Promise<
  { ok: true; events: CalendarApiEvent[] } | { ok: false; error: string; needsReconnect: boolean }
> {
  const now = Date.now();
  const params = new URLSearchParams({
    singleEvents: "true",
    maxResults: "50",
    timeMin: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(now + 80 * 24 * 60 * 60 * 1000).toISOString(),
    orderBy: "startTime",
  });
  params.append("privateExtendedProperty", "browningHold=1");
  params.append("privateExtendedProperty", `handoffId=${input.handoffId}`);
  const res = await fetch(`${CAL_BASE}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${input.token}` },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[google-calendar hold list]", res.status, text.slice(0, 300));
    return { ok: false, ...holdWriteError(res.status, text) };
  }
  try {
    const json = JSON.parse(text) as { items?: CalendarApiEvent[] };
    return { ok: true, events: json.items ?? [] };
  } catch {
    return { ok: false, needsReconnect: false, error: "Google Calendar returned an unreadable hold list." };
  }
}

export async function renameGoogleCalendarEvent(input: {
  token: string;
  eventId: string;
  summary: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const params = new URLSearchParams({ sendUpdates: "all" });
  const res = await fetch(
    `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(input.eventId)}?${params}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ summary: input.summary }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    return { ok: false, error: `Google Calendar could not rename the invite (${res.status}).` };
  }
  return { ok: true };
}

export async function deleteGCalEvent(token: string, eventId: string): Promise<boolean> {
  const result = await gcalFetch(COSA_CALENDAR_ID, `/${eventId}`, "DELETE", token);
  return result === true;
}
