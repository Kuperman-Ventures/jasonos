/** America/New_York weekend window for the Family Meeting agenda. */

export const FAMILY_MEETING_TIMEZONE = "America/New_York";

export interface WeekendWindow {
  /** Inclusive start (Friday 5pm local). */
  start: Date;
  /** Exclusive end (Monday 00:00 local). */
  end: Date;
  /** Friday date of this weekend, YYYY-MM-DD in local tz. */
  fridayKey: string;
  label: string;
}

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
  timeZone: string,
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

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Upcoming family weekend: Friday 5pm → Monday midnight (America/New_York).
 * Before Friday 5pm, this is the coming weekend. From Friday 5pm through
 * Sunday, it is the current weekend.
 */
export function upcomingWeekendWindow(
  now: Date = new Date(),
  timeZone: string = FAMILY_MEETING_TIMEZONE
): WeekendWindow {
  const local = partsInTz(now, timeZone);
  const dow = WEEKDAY_INDEX[local.weekday] ?? 0;

  let fridayOffset: number;
  if (dow === 5) {
    // Friday: before 5pm → this Friday; after → this weekend (offset 0).
    fridayOffset = local.hour < 17 ? 0 : 0;
  } else if (dow === 6) {
    fridayOffset = -1;
  } else if (dow === 0) {
    fridayOffset = -2;
  } else {
    // Mon–Thu → upcoming Friday
    fridayOffset = 5 - dow;
  }

  const friday = addLocalDays(
    timeZone,
    local.year,
    local.month,
    local.day,
    fridayOffset
  );
  const monday = addLocalDays(timeZone, friday.year, friday.month, friday.day, 3);

  const start = zonedLocalDate(
    timeZone,
    friday.year,
    friday.month,
    friday.day,
    17,
    0
  );
  const end = zonedLocalDate(
    timeZone,
    monday.year,
    monday.month,
    monday.day,
    0,
    0
  );

  const fridayKey = `${friday.year}-${String(friday.month).padStart(2, "0")}-${String(friday.day).padStart(2, "0")}`;
  const sat = addLocalDays(timeZone, friday.year, friday.month, friday.day, 1);
  const sun = addLocalDays(timeZone, friday.year, friday.month, friday.day, 2);

  const monthDay = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  });
  const satLabel = monthDay.format(
    zonedLocalDate(timeZone, sat.year, sat.month, sat.day, 12, 0)
  );
  const sunLabel = monthDay.format(
    zonedLocalDate(timeZone, sun.year, sun.month, sun.day, 12, 0)
  );

  return {
    start,
    end,
    fridayKey,
    label: `${satLabel} – ${sunLabel}`,
  };
}
