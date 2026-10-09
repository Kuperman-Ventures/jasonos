// Today's meetings for prep. One row per calendar event, not per contact.

import "server-only";
import { easternDayBounds, etToday } from "@/lib/dates";
import {
  calendarEventGuests,
  fetchAllPersonalCalendarEvents,
  mergeCalendarEvents,
  type CalendarApiEvent,
} from "@/lib/integrations/google-calendar";
import { listOutlookCalendarEvents } from "@/lib/integrations/outlook";
import { isMyOwnAddress } from "@/lib/outreach/contact-lookup";
import { buildContactLookup } from "@/lib/outreach/email-matching";
import {
  meetingEndIso,
  meetingStartIso,
  qualifyMeetingAttendees,
} from "@/lib/outreach/meeting-followups";

export interface TodaysMeetingAttendee {
  email: string;
  name: string | null;
  contactId: string | null;
}

export interface TodaysMeeting {
  gcalEventId: string;
  icalUid: string | null;
  calendarSource: "google" | "outlook";
  title: string;
  startsAt: string;
  endsAt: string;
  calendarUrl: string | null;
  conferenceUrl: string | null;
  location: string | null;
  description: string | null;
  attendees: TodaysMeetingAttendee[];
}

export interface TodaysMeetingsLoad {
  meetings: TodaysMeeting[];
  warnings: string[];
}

function pushWarning(warnings: string[], message: string | undefined) {
  const text = message?.trim();
  if (!text || warnings.includes(text)) return;
  warnings.push(text);
}

function kupeDeclined(ev: CalendarApiEvent): boolean {
  for (const attendee of ev.attendees ?? []) {
    if (attendee.responseStatus !== "declined") continue;
    if (attendee.self) return true;
    if (attendee.email && isMyOwnAddress(attendee.email)) return true;
  }
  return false;
}

function conferenceUrlOf(ev: CalendarApiEvent): string | null {
  const hangout = ev.hangoutLink?.trim();
  if (hangout) return hangout;
  const points = ev.conferenceData?.entryPoints ?? [];
  const video = points.find((point) => point.entryPointType === "video" && point.uri?.trim());
  if (video?.uri) return video.uri.trim();
  const any = points.find((point) => point.uri?.trim());
  return any?.uri?.trim() || null;
}

export async function loadTodaysMeetings(): Promise<TodaysMeetingsLoad> {
  const warnings: string[] = [];
  const { start, end } = easternDayBounds(etToday());
  const timeMin = start.toISOString();
  const timeMax = end.toISOString();

  const [google, outlook, lookup] = await Promise.all([
    fetchAllPersonalCalendarEvents({ timeMin, timeMax }).catch((err: unknown) => ({
      events: [] as CalendarApiEvent[],
      warnings: [] as string[],
      error: err instanceof Error ? err.message : String(err),
    })),
    listOutlookCalendarEvents({ timeMin, timeMax }).catch((err: unknown) => ({
      events: [] as CalendarApiEvent[],
      configured: true,
      error: err instanceof Error ? err.message : String(err),
    })),
    buildContactLookup(),
  ]);

  if (google.error) {
    pushWarning(warnings, `Google Calendar could not be read. ${google.error}`);
  }
  for (const warning of google.warnings ?? []) pushWarning(warnings, warning);
  if (outlook.configured && outlook.error) {
    pushWarning(warnings, `Outlook calendar could not be read. ${outlook.error}`);
  }

  const outlookIds = new Set(
    outlook.events.flatMap((ev) => (ev.id ? [ev.id] : []))
  );
  const events = mergeCalendarEvents([google.events, outlook.events]);
  const meetings: TodaysMeeting[] = [];

  for (const ev of events) {
    if (!ev.id) continue;
    if (ev.status === "cancelled") continue;
    if (!ev.start?.dateTime) continue;
    if (kupeDeclined(ev)) continue;

    const startsAt = meetingStartIso(ev);
    const endsAt = meetingEndIso(ev);
    if (!startsAt || !endsAt) continue;

    const attendees = qualifyMeetingAttendees(calendarEventGuests(ev)).map((guest) => ({
      email: guest.email,
      name: guest.name,
      contactId: lookup.resolveEmail(guest.email)?.id ?? null,
    }));
    if (!attendees.length) continue;

    meetings.push({
      gcalEventId: ev.id,
      icalUid: ev.iCalUID?.trim() || null,
      calendarSource: outlookIds.has(ev.id) ? "outlook" : "google",
      title: ev.summary?.trim() || "Meeting",
      startsAt,
      endsAt,
      calendarUrl: ev.htmlLink?.trim() || null,
      conferenceUrl: conferenceUrlOf(ev),
      location: ev.location?.trim() || null,
      description: ev.description?.trim() || null,
      attendees,
    });
  }

  meetings.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return { meetings, warnings };
}
