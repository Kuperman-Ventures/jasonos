// Open 30-minute times, no sooner than 3 business days out.
// Eastern Time. Existing calendar events block a slot.

import { etYmd } from "@/lib/dates";
import { parseAvailabilityWindow } from "./parse";
import {
  BUSINESS_DAY_BUFFER,
  LOOKAHEAD_BUSINESS_DAYS,
  SLOT_MINUTES,
  type HandoffSlot,
} from "./types";

export type BusyInterval = {
  start: string;
  end: string;
  allDay?: boolean;
};

const PREFERRED_STARTS = [10 * 60, 11 * 60, 14 * 60, 15 * 60];

export function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function weekdayIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

export function isWeekday(ymd: string): boolean {
  const day = weekdayIndex(ymd);
  return day !== 0 && day !== 6;
}

/** First calendar day a call may start. `days` business days after `ymd`. */
export function addBusinessDays(ymd: string, days: number): string {
  let left = days;
  let cursor = ymd;
  while (left > 0) {
    cursor = addCalendarDays(cursor, 1);
    if (isWeekday(cursor)) left -= 1;
  }
  return cursor;
}

export function firstEligibleYmd(now: Date): string {
  return addBusinessDays(etYmd(now), BUSINESS_DAY_BUFFER);
}

export function lastEligibleYmd(now: Date): string {
  return addBusinessDays(firstEligibleYmd(now), LOOKAHEAD_BUSINESS_DAYS - 1);
}

export function proposeSlots(input: {
  now: Date;
  busy?: BusyInterval[];
  availabilityNote?: string | null;
  count?: number;
}): HandoffSlot[] {
  const count = input.count ?? 3;
  const window = parseAvailabilityWindow(input.availabilityNote);
  const preferred =
    window.earliestStartMin >= 17 * 60
      ? [17 * 60, 17 * 60 + 30, 18 * 60]
      : PREFERRED_STARTS.filter(
          (min) => min >= window.earliestStartMin && min <= window.latestStartMin
        );
  const starts = preferred.length
    ? preferred
    : [window.earliestStartMin];

  const first = firstEligibleYmd(input.now);
  const days: string[] = [];
  let cursor = first;
  while (days.length < LOOKAHEAD_BUSINESS_DAYS) {
    if (
      isWeekday(cursor) &&
      (!window.weekdays || window.weekdays.includes(weekdayIndex(cursor)))
    ) {
      days.push(cursor);
    }
    cursor = addCalendarDays(cursor, 1);
    if (days.length === 0 && cursor > addCalendarDays(first, 21)) break;
  }

  const chosen: HandoffSlot[] = [];
  const usedDays = new Set<string>();

  const tryDay = (ymd: string, allowSameDay: boolean) => {
    if (!allowSameDay && usedDays.has(ymd)) return;
    for (const startMin of starts) {
      if (startMin < window.earliestStartMin || startMin > window.latestStartMin) {
        continue;
      }
      const start = wallToUtc(ymd, startMin);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
      if (overlapsBusy(start, end, input.busy ?? [], ymd)) continue;
      const slot = {
        id: `slot-${start.toISOString()}`,
        start: start.toISOString(),
        end: end.toISOString(),
      };
      if (chosen.some((existing) => existing.start === slot.start)) continue;
      chosen.push(slot);
      usedDays.add(ymd);
      return;
    }
  };

  for (const ymd of days) {
    if (chosen.length >= count) break;
    tryDay(ymd, false);
  }
  if (chosen.length < count) {
    for (const ymd of days) {
      if (chosen.length >= count) break;
      tryDay(ymd, true);
    }
  }
  return chosen;
}

export function slotOverlaps(
  startIso: string,
  endIso: string,
  slots: HandoffSlot[]
): boolean {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  return slots.some((slot) => {
    const otherStart = Date.parse(slot.start);
    const otherEnd = Date.parse(slot.end);
    return start < otherEnd && end > otherStart;
  });
}

function overlapsBusy(
  start: Date,
  end: Date,
  busy: BusyInterval[],
  ymd: string
): boolean {
  for (const block of busy) {
    if (block.allDay && etYmd(block.start) === ymd) return true;
    const blockStart = Date.parse(block.start);
    const blockEnd = Date.parse(block.end);
    if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd)) continue;
    if (start.getTime() < blockEnd && end.getTime() > blockStart) return true;
  }
  return false;
}

/** Wall-clock Eastern minutes on a calendar day, as a UTC instant. */
export function wallToUtc(ymd: string, minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hours, mins, 0));
  const offset = tzOffsetMinutes("America/New_York", guess);
  const corrected = new Date(guess.getTime() - offset * 60_000);
  const check = tzOffsetMinutes("America/New_York", corrected);
  if (check !== offset) {
    return new Date(guess.getTime() - check * 60_000);
  }
  return corrected;
}

function tzOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(map.hour) % 24;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}
