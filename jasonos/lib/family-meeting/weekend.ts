/** America/New_York lookahead window for the Family Meeting agenda. */

export const FAMILY_MEETING_TIMEZONE = "America/New_York";

/** How far the weekend meeting looks ahead (weekdays + weekends). */
export const FAMILY_MEETING_LOOKAHEAD_DAYS = 14;

export interface AgendaWindow {
  /** Inclusive start (local midnight today). */
  start: Date;
  /** Exclusive end (local midnight after the last day). */
  end: Date;
  /** Start date YYYY-MM-DD in local tz. */
  startKey: string;
  label: string;
}

/** @deprecated Use AgendaWindow — kept for older call sites. */
export type WeekendWindow = AgendaWindow;

function partsInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    weekday: bag.weekday ?? "",
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

/** Instant for local Y-M-D H:M in a named timezone. */
export function zonedLocalDate(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = partsInTz(guess, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0
  );
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(guess.getTime() + (wanted - asUtc));
}

function addLocalDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function ymdKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Coming two weeks for the Family Meeting agenda (America/New_York).
 * The meeting happens on the weekend; the board looks forward across
 * weekdays and weekends from local midnight today through 14 days.
 */
export function upcomingAgendaWindow(
  now: Date = new Date(),
  timeZone: string = FAMILY_MEETING_TIMEZONE,
  days: number = FAMILY_MEETING_LOOKAHEAD_DAYS
): AgendaWindow {
  const local = partsInTz(now, timeZone);
  const start = zonedLocalDate(
    timeZone,
    local.year,
    local.month,
    local.day,
    0,
    0
  );
  const endDay = addLocalDays(local.year, local.month, local.day, days);
  const end = zonedLocalDate(
    timeZone,
    endDay.year,
    endDay.month,
    endDay.day,
    0,
    0
  );

  const lastInclusive = addLocalDays(local.year, local.month, local.day, days - 1);
  const monthDay = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  });
  const startLabel = monthDay.format(start);
  const endLabel = monthDay.format(
    zonedLocalDate(
      timeZone,
      lastInclusive.year,
      lastInclusive.month,
      lastInclusive.day,
      12,
      0
    )
  );

  return {
    start,
    end,
    startKey: ymdKey(local.year, local.month, local.day),
    label: `${startLabel} – ${endLabel}`,
  };
}

/** @deprecated Use upcomingAgendaWindow. */
export function upcomingWeekendWindow(
  now: Date = new Date(),
  timeZone: string = FAMILY_MEETING_TIMEZONE
): AgendaWindow {
  return upcomingAgendaWindow(now, timeZone);
}
