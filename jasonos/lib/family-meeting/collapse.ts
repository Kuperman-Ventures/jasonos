import { normalizeRoutineTitle } from "./routine";
import type { FamilyMeetingEvent } from "./types";
import { FAMILY_MEETING_TIMEZONE } from "./weekend";

export interface CollapsedRoutine {
  key: string;
  title: string;
  allDay: boolean;
  /** e.g. "Fri" or "Wed · Fri" */
  weekdayLabel: string;
  /** e.g. "5:00 PM", or null when all-day / mixed times */
  timeLabel: string | null;
  /** e.g. ["Oct 23", "Oct 30"] */
  dateLabels: string[];
  occurrences: FamilyMeetingEvent[];
}

function parts(iso: string, timeZone: string = FAMILY_MEETING_TIMEZONE) {
  const start = new Date(iso);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(start);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  return { weekday, date, time };
}

function seriesKey(ev: FamilyMeetingEvent): string {
  const uid = (ev.uid || "").trim().toLowerCase();
  if (uid) return `uid:${uid}`;
  return `title:${normalizeRoutineTitle(ev.title)}`;
}

/**
 * Collapse marked routines into one row per series for quieter lists.
 * Spotlight (non-routine) events are returned separately, in order.
 */
export function splitAgendaLists(events: FamilyMeetingEvent[]): {
  spotlight: FamilyMeetingEvent[];
  routines: CollapsedRoutine[];
} {
  const spotlight: FamilyMeetingEvent[] = [];
  const buckets = new Map<string, FamilyMeetingEvent[]>();

  for (const ev of events) {
    if (!ev.routine) {
      spotlight.push(ev);
      continue;
    }
    const key = seriesKey(ev);
    const list = buckets.get(key) ?? [];
    list.push(ev);
    buckets.set(key, list);
  }

  const routines: CollapsedRoutine[] = [];
  for (const [key, occurrences] of buckets) {
    occurrences.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const first = occurrences[0]!;
    const weekdays = [
      ...new Set(occurrences.map((o) => parts(o.startsAt).weekday)),
    ];
    const dateLabels = [
      ...new Set(occurrences.map((o) => parts(o.startsAt).date)),
    ];
    const allDay = occurrences.every((o) => o.allDay);
    const times = allDay
      ? []
      : [...new Set(occurrences.filter((o) => !o.allDay).map((o) => parts(o.startsAt).time))];
    routines.push({
      key,
      title: first.title,
      allDay,
      weekdayLabel: weekdays.join(" · "),
      timeLabel: times.length === 1 ? times[0]! : null,
      dateLabels,
      occurrences,
    });
  }

  routines.sort(
    (a, b) =>
      a.occurrences[0]!.startsAt.localeCompare(b.occurrences[0]!.startsAt)
  );

  return { spotlight, routines };
}
