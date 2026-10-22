import "server-only";

import {
  fetchICloudCalendarEvents,
  listICloudCalendars,
} from "@/lib/integrations/icloud-caldav";
import {
  FAMILY_CALENDAR_GROUPS,
  pickBestCalendarForGroup,
  scoreCalendarGroupMatch,
} from "./groups";
import { maskAppleId, resolveICloudCalendarConnection } from "./icloud";
import type {
  FamilyMeetingAgenda,
  FamilyMeetingEvent,
  FamilyMeetingGroupAgenda,
} from "./types";
import {
  FAMILY_MEETING_TIMEZONE,
  upcomingAgendaWindow,
} from "./weekend";

function emptyAgenda(partial: {
  connected: boolean;
  appleIdMasked: string | null;
  error: string | null;
  warnings?: string[];
  window: ReturnType<typeof upcomingAgendaWindow>;
}): FamilyMeetingAgenda {
  const groups: FamilyMeetingGroupAgenda[] = FAMILY_CALENDAR_GROUPS.map(
    (group) => ({
      group,
      calendarName: null,
      events: [],
      missingCalendar: true,
    })
  );
  return {
    generatedAt: new Date().toISOString(),
    weekendLabel: partial.window.label,
    rangeStart: partial.window.start.toISOString(),
    rangeEnd: partial.window.end.toISOString(),
    timezone: FAMILY_MEETING_TIMEZONE,
    connected: partial.connected,
    appleIdMasked: partial.appleIdMasked,
    error: partial.error,
    warnings: partial.warnings ?? [],
    groups,
    totalEvents: 0,
  };
}

export async function loadFamilyMeetingAgenda(
  now: Date = new Date()
): Promise<FamilyMeetingAgenda> {
  const window = upcomingAgendaWindow(now);
  const creds = await resolveICloudCalendarConnection();

  if (!creds) {
    return emptyAgenda({
      connected: false,
      appleIdMasked: null,
      error: null,
      window,
    });
  }

  const listed = await listICloudCalendars(creds);
  if (listed.error) {
    return emptyAgenda({
      connected: true,
      appleIdMasked: maskAppleId(creds.appleId),
      error: listed.error,
      window,
    });
  }

  const warnings: string[] = [];
  const byGroup = new Map<
    string,
    { calendarName: string; calendarHref: string; events: FamilyMeetingEvent[] }
  >();

  for (const group of FAMILY_CALENDAR_GROUPS) {
    const candidates = listed.calendars.filter(
      (cal) => scoreCalendarGroupMatch(cal.name, group) > 0
    );
    const picked = pickBestCalendarForGroup(group, candidates);
    if (!picked) continue;

    const skipped = candidates
      .filter((cal) => cal.href !== picked.href)
      .map((cal) => cal.name);
    if (skipped.length) {
      warnings.push(
        `Multiple calendars matched “${group.label}” — using “${picked.name}” (also saw ${skipped.join(", ")}).`
      );
    }

    const fetched = await fetchICloudCalendarEvents({
      creds,
      calendarHref: picked.href,
      timeMin: window.start,
      timeMax: window.end,
    });
    if (fetched.error) {
      warnings.push(`${picked.name}: ${fetched.error}`);
    }

    const events: FamilyMeetingEvent[] = fetched.events
      .map((ev) => ({
        id: ev.uid || ev.href || `${picked.name}-${ev.startsAt}`,
        uid: ev.uid,
        title: ev.summary,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        allDay: ev.allDay,
        location: ev.location,
        notes: ev.description,
        calendarName: picked.name,
        calendarHref: picked.href,
        groupId: group.id,
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    byGroup.set(group.id, {
      calendarName: picked.name,
      calendarHref: picked.href,
      events,
    });
  }

  const groups: FamilyMeetingGroupAgenda[] = FAMILY_CALENDAR_GROUPS.map(
    (group) => {
      const hit = byGroup.get(group.id);
      return {
        group,
        calendarName: hit?.calendarName ?? null,
        events: hit?.events ?? [],
        missingCalendar: !hit,
      };
    }
  );

  const missing = groups.filter((g) => g.missingCalendar).map((g) => g.group.label);
  if (missing.length) {
    warnings.push(
      `No iCloud calendar matched: ${missing.join(", ")}. Names should include Family / Kat & Jason / Kyle / Wyatt.`
    );
  }

  const totalEvents = groups.reduce((n, g) => n + g.events.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    weekendLabel: window.label,
    rangeStart: window.start.toISOString(),
    rangeEnd: window.end.toISOString(),
    timezone: FAMILY_MEETING_TIMEZONE,
    connected: true,
    appleIdMasked: maskAppleId(creds.appleId),
    error: null,
    warnings,
    groups,
    totalEvents,
  };
}
