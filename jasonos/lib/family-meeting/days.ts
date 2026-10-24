import type { FamilyMeetingEvent } from "./types";
import { FAMILY_MEETING_TIMEZONE } from "./weekend";

export interface DayGroup {
  /** YYYY-MM-DD in local tz — stable sort/key. */
  key: string;
  weekday: string;
  date: string;
  events: FamilyMeetingEvent[];
}

function dayParts(
  iso: string,
  timeZone: string = FAMILY_MEETING_TIMEZONE
): { key: string; weekday: string; date: string } {
  const start = new Date(iso);
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(start);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(start);
  return { key, weekday, date };
}

/** Group events by local calendar day (America/New_York by default). */
export function groupEventsByDay(
  events: FamilyMeetingEvent[],
  timeZone: string = FAMILY_MEETING_TIMEZONE
): DayGroup[] {
  const buckets = new Map<string, DayGroup>();
  for (const ev of events) {
    const { key, weekday, date } = dayParts(ev.startsAt, timeZone);
    const group = buckets.get(key);
    if (group) {
      group.events.push(ev);
    } else {
      buckets.set(key, { key, weekday, date, events: [ev] });
    }
  }
  return [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((g) => ({
      ...g,
      events: [...g.events].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    }));
}
