// Google Calendar adapter — today's events for the Morning Brief + CoSA WeekPlanner.
// Uses the Google OAuth tokens stored in jasonos.user_integrations.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { emptyResult, envConfigured, type IntegrationResult } from "./_base";
import type { GCalEvent } from "@/lib/calendar/health-model";

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

const TRACK_COLOR_IDS: Record<string, string> = {
  advisors:    "10",
  jobSearch:   "9",
  ventures:    "3",
  networking:  "6",
  development: "1",
  cosaAdmin:   "7",
};

// ─── Token retrieval (with refresh) ──────────────────────────────────────────

async function loadAccessToken(): Promise<string | null> {
  if (!envConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    return null;
  }
  try {
    const sb = createServiceRoleClient();
    const { data } = await sb
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("provider", "google")
      .maybeSingle();
    if (!data) return null;
    // Use existing token if not expiring in the next 60 seconds
    if (
      data.access_token &&
      data.expires_at &&
      Date.parse(data.expires_at) - Date.now() > 60_000
    )
      return data.access_token;
    // Attempt refresh
    if (data.refresh_token) {
      const cid = process.env.GOOGLE_CLIENT_ID;
      const cs = process.env.GOOGLE_CLIENT_SECRET;
      if (!cid || !cs) return data.access_token;
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: cid,
          client_secret: cs,
          refresh_token: data.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      if (!res.ok) return data.access_token;
      const j = (await res.json()) as { access_token?: string; expires_in?: number };
      if (j.access_token) {
        const expiresAt = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();
        await sb.from("user_integrations").update({ access_token: j.access_token, expires_at: expiresAt }).eq("provider", "google");
        return j.access_token;
      }
      return data.access_token;
    }
    return data.access_token;
  } catch {
    return null;
  }
}

export async function getGoogleAccessToken(): Promise<string | null> {
  return loadAccessToken();
}

// ─── Morning Brief: today's calendar ─────────────────────────────────────────

interface RawGCalEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; organizer?: boolean; self?: boolean }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
  location?: string;
  description?: string;
  extendedProperties?: { private?: Record<string, string> };
}

export async function getTodaysCalendar(opts?: {
  tz?: string;
  calendarId?: string;
}): Promise<IntegrationResult<CalendarEvent[]>> {
  const token = await loadAccessToken();
  if (!token) return emptyResult([], false);

  try {
    const tz = opts?.tz ?? "America/New_York";
    const calendarId = opts?.calendarId ?? "primary";
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const ymd = fmt.format(now);
    const dayStart = new Date(`${ymd}T00:00:00`);
    const dayEnd = new Date(`${ymd}T23:59:59`);
    const params = new URLSearchParams({
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    const res = await fetch(
      `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GCal ${res.status} :: ${txt.slice(0, 200)}`);
    }
    const j = (await res.json()) as { items?: RawGCalEvent[] };
    const events: CalendarEvent[] = (j.items ?? []).map((e) => ({
      id: e.id,
      title: e.summary ?? "(untitled)",
      startsAt: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
      endsAt: e.end?.dateTime ?? `${e.end?.date}T23:59:59`,
      attendees: (e.attendees ?? []).map((a) => ({
        email: a.email,
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
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", maxResults: "250", orderBy: "startTime" });
  const data = (await gcalFetch("primary", `?${params}`, "GET", token)) as { items?: GCalEvent[] } | null;
  const items = data?.items ?? [];
  return items.filter((ev) => ev.start?.dateTime != null && ev.extendedProperties?.private?.cosaTag !== "cosa-event");
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
