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
import { isMyOwnAddress } from "@/lib/outreach/email-matching";
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
    if (!email || opts?.self || opts?.declined) return;
    const lower = email.toLowerCase();
    if (seen.has(lower)) return;
    if (isMyOwnAddress(email) || isCalendarProxyAddress(email)) return;
    seen.add(lower);
    out.push({ email: lower, name: name?.trim() || undefined });
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
      fetchCalendarEvents({
        token: advisors,
        calendarId: "primary",
        timeMin: opts.timeMin,
        timeMax: opts.timeMax,
      })
    );
  }
  if (gmail) {
    fetches.push(
      fetchCalendarEvents({
        token: gmail,
        calendarId: "primary",
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

export async function deleteGCalEvent(token: string, eventId: string): Promise<boolean> {
  const result = await gcalFetch(COSA_CALENDAR_ID, `/${eventId}`, "DELETE", token);
  return result === true;
}
