import type { FamilyCalendarGroupId, FamilyMeetingEvent } from "./types";
import { FAMILY_MEETING_TIMEZONE } from "./weekend";

/** Stable key for one occurrence (recurring series share a UID). */
export function occurrenceKey(uid: string, startsAt: string): string {
  return `${uid.trim().toLowerCase()}|${startsAt}`;
}

function localYmd(iso: string, timeZone: string = FAMILY_MEETING_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Keep only occurrences that start inside [rangeStart, rangeEnd).
 * All-day events are judged by local calendar date.
 */
export function filterEventsToWindow<T extends { startsAt: string; allDay: boolean }>(
  events: T[],
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string = FAMILY_MEETING_TIMEZONE
): T[] {
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  const startDay = localYmd(rangeStart.toISOString(), timeZone);
  const endDay = localYmd(rangeEnd.toISOString(), timeZone);

  return events.filter((ev) => {
    if (ev.allDay) {
      const day = localYmd(ev.startsAt, timeZone);
      return day >= startDay && day < endDay;
    }
    const t = Date.parse(ev.startsAt);
    if (!Number.isFinite(t)) return false;
    return t >= startMs && t < endMs;
  });
}

/** Drop duplicate occurrences inside one lane (same UID + start). */
export function dedupeOccurrences(events: FamilyMeetingEvent[]): FamilyMeetingEvent[] {
  const seen = new Set<string>();
  const out: FamilyMeetingEvent[] = [];
  for (const ev of events) {
    const key = occurrenceKey(ev.uid || ev.id, ev.startsAt);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out;
}

/** More specific people calendars win when the same occurrence is shared. */
const LANE_PRIORITY: Record<FamilyCalendarGroupId, number> = {
  kyle_kat_jason: 40,
  wyatt_kat_jason: 40,
  kat_jason: 20,
  family: 10,
};

/**
 * If the same occurrence appears on multiple people calendars, keep it only
 * on the most specific lane (Kyle/Wyatt → Kat & Jason → Family).
 */
export function dedupeAcrossLanes(
  groups: { groupId: FamilyCalendarGroupId; events: FamilyMeetingEvent[] }[]
): Map<FamilyCalendarGroupId, FamilyMeetingEvent[]> {
  const winners = new Map<
    string,
    { groupId: FamilyCalendarGroupId; event: FamilyMeetingEvent; priority: number }
  >();

  for (const lane of groups) {
    const priority = LANE_PRIORITY[lane.groupId] ?? 0;
    for (const ev of lane.events) {
      const key = occurrenceKey(ev.uid || ev.id, ev.startsAt);
      const prev = winners.get(key);
      if (!prev || priority > prev.priority) {
        winners.set(key, { groupId: lane.groupId, event: ev, priority });
      }
    }
  }

  const byLane = new Map<FamilyCalendarGroupId, FamilyMeetingEvent[]>();
  for (const lane of groups) byLane.set(lane.groupId, []);
  for (const { groupId, event } of winners.values()) {
    const list = byLane.get(groupId) ?? [];
    list.push(event);
    byLane.set(groupId, list);
  }
  for (const [id, list] of byLane) {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    byLane.set(id, list);
  }
  return byLane;
}
