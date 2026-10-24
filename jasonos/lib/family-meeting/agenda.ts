import "server-only";

import {
  fetchICloudCalendarEvents,
  listICloudCalendars,
} from "@/lib/integrations/icloud-caldav";
import {
  dedupeAcrossLanes,
  dedupeOccurrences,
  filterEventsToWindow,
} from "./dedupe";
import {
  FAMILY_CALENDAR_GROUPS,
  pickBestCalendarForGroup,
  scoreCalendarGroupMatch,
} from "./groups";
import { applyFamilyMeetingEdits, withEventKeys } from "./edits";
import { maskAppleId, resolveICloudCalendarConnection } from "./icloud";
import { markRoutineEvents } from "./routine";
import {
  loadFamilyMeetingEdits,
  printFreezeLabel,
  syncFamilyMeetingDayBlocks,
} from "./store";
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
  openDayKeys?: string[];
  loggedDayCount?: number;
  printFreezeLabel?: string;
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
    openDayKeys: partial.openDayKeys ?? [],
    loggedDayCount: partial.loggedDayCount ?? 0,
    printFreezeLabel: partial.printFreezeLabel ?? printFreezeLabel().freezeAtLabel,
  };
}

export async function loadFamilyMeetingAgenda(
  now: Date = new Date()
): Promise<FamilyMeetingAgenda> {
  const window = upcomingAgendaWindow(now);
  const freeze = printFreezeLabel(now);

  let openDayKeys: string[] = [];
  let loggedDayCount = 0;
  let edits = { occurrences: [], series: [] } as Awaited<
    ReturnType<typeof loadFamilyMeetingEdits>
  >;
  try {
    const synced = await syncFamilyMeetingDayBlocks(now);
    openDayKeys = synced.openDays;
    loggedDayCount = synced.loggedCount;
    edits = await loadFamilyMeetingEdits();
  } catch (error) {
    console.error("[family-meeting.edits]", error);
  }

  const creds = await resolveICloudCalendarConnection();

  if (!creds) {
    return emptyAgenda({
      connected: false,
      appleIdMasked: null,
      error: null,
      window,
      openDayKeys,
      loggedDayCount,
      printFreezeLabel: freeze.freezeAtLabel,
    });
  }

  const listed = await listICloudCalendars(creds);
  if (listed.error) {
    return emptyAgenda({
      connected: true,
      appleIdMasked: maskAppleId(creds.appleId),
      error: listed.error,
      window,
      openDayKeys,
      loggedDayCount,
      printFreezeLabel: freeze.freezeAtLabel,
    });
  }

  const warnings: string[] = [];
  const rawLanes: {
    groupId: (typeof FAMILY_CALENDAR_GROUPS)[number]["id"];
    calendarName: string;
    events: FamilyMeetingEvent[];
  }[] = [];

  for (const group of FAMILY_CALENDAR_GROUPS) {
    const candidates = listed.calendars.filter(
      (cal) => scoreCalendarGroupMatch(cal.name, group) > 0
    );
    const picked = pickBestCalendarForGroup(group, candidates);
    if (!picked) continue;

    const fetched = await fetchICloudCalendarEvents({
      creds,
      calendarHref: picked.href,
      timeMin: window.start,
      timeMax: window.end,
    });
    if (fetched.error) {
      warnings.push(`${picked.name}: ${fetched.error}`);
    }

    const mapped: FamilyMeetingEvent[] = fetched.events.map((ev) => ({
      id: `${ev.uid || ev.href || picked.name}-${ev.startsAt}`,
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
    }));

    const inWindow = filterEventsToWindow(
      mapped,
      window.start,
      window.end,
      FAMILY_MEETING_TIMEZONE
    );
    const unique = dedupeOccurrences(inWindow).sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt)
    );

    rawLanes.push({
      groupId: group.id,
      calendarName: picked.name,
      events: unique,
    });
  }

  const deduped = dedupeAcrossLanes(
    rawLanes.map((lane) => ({ groupId: lane.groupId, events: lane.events }))
  );

  const groups: FamilyMeetingGroupAgenda[] = FAMILY_CALENDAR_GROUPS.map(
    (group) => {
      const lane = rawLanes.find((l) => l.groupId === group.id);
      const marked = markRoutineEvents(deduped.get(group.id) ?? []).map(
        withEventKeys
      );
      const events = applyFamilyMeetingEdits(marked, edits);
      return {
        group,
        calendarName: lane?.calendarName ?? null,
        events,
        missingCalendar: !lane,
      };
    }
  );

  const missing = groups.filter((g) => g.missingCalendar).map((g) => g.group.label);
  if (missing.length) {
    warnings.push(
      `No iCloud calendar matched: ${missing.join(", ")}. Names should include Kuperman Family / Kat & Jason / Kyle / Wyatt.`
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
    openDayKeys,
    loggedDayCount,
    printFreezeLabel: freeze.freezeAtLabel,
  };
}
