import { FAMILY_MEETING_TIMEZONE, zonedLocalDate } from "./weekend";
import { todayKeyEt } from "./keys";

function ymdParts(dayKey: string): { year: number; month: number; day: number } {
  const [ys, ms, ds] = dayKey.split("-").map(Number);
  return { year: ys!, month: ms!, day: ds! };
}

export function addDaysKey(dayKey: string, delta: number): string {
  const { year, month, day } = ymdParts(dayKey);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

function weekdayShort(dayKey: string): string {
  const { year, month, day } = ymdParts(dayKey);
  const noon = zonedLocalDate(FAMILY_MEETING_TIMEZONE, year, month, day, 12, 0);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_MEETING_TIMEZONE,
    weekday: "short",
  }).format(noon);
}

/**
 * Print covers Saturday → following Sunday (immediate weekend, the week,
 * and the following weekend) after a Friday night freeze.
 */
export function printWeekFromFreezeFriday(freezeFridayKey: string): {
  rangeStartKey: string;
  /** Inclusive end (next Sunday). */
  rangeEndKey: string;
  /** Exclusive end for filters. */
  rangeEndExclusiveKey: string;
  label: string;
} {
  const rangeStartKey = addDaysKey(freezeFridayKey, 1); // Saturday
  const rangeEndKey = addDaysKey(freezeFridayKey, 9); // next Sunday
  const rangeEndExclusiveKey = addDaysKey(freezeFridayKey, 10);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_MEETING_TIMEZONE,
    month: "short",
    day: "numeric",
  });
  const startParts = ymdParts(rangeStartKey);
  const endParts = ymdParts(rangeEndKey);
  const startLabel = fmt.format(
    zonedLocalDate(
      FAMILY_MEETING_TIMEZONE,
      startParts.year,
      startParts.month,
      startParts.day,
      12,
      0
    )
  );
  const endLabel = fmt.format(
    zonedLocalDate(
      FAMILY_MEETING_TIMEZONE,
      endParts.year,
      endParts.month,
      endParts.day,
      12,
      0
    )
  );
  return {
    rangeStartKey,
    rangeEndKey,
    rangeEndExclusiveKey,
    label: `${startLabel} – ${endLabel}`,
  };
}

/** Friday key for the freeze that should run “tonight” / just ran. */
export function freezeFridayKeyFor(now: Date = new Date()): string {
  const today = todayKeyEt(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = map[weekdayShort(today)] ?? 0;
  if (dow === 5) return today;
  if (dow === 6) return addDaysKey(today, -1); // Saturday morning → last night’s Friday
  // Earlier in the week: upcoming Friday
  return addDaysKey(today, 5 - dow);
}

/** True when ET local time is Friday at/after 23:55 (cron window). */
export function isFridayFreezeWindow(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_MEETING_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const bag: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") bag[p.type] = p.value;
  if (bag.weekday !== "Fri") return false;
  const hour = Number(bag.hour);
  const minute = Number(bag.minute);
  return hour === 23 && minute >= 55;
}
