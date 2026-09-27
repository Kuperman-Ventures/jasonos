/**
 * Official 2026–27 campus academic calendars (imported from campus-calendars.json).
 */

import campusCalendarsFile from "@/data/campus-calendars.json";

export type CampusDayKind =
  | "classes"
  | "reading"
  | "finals"
  | "break"
  | "no_classes"
  | "between_terms";

export type CampusCalendarSystem = "semester" | "quarter" | "other";

export type CampusCalendarPeriod = {
  start: string;
  end: string;
  kind: Exclude<CampusDayKind, "between_terms">;
  label: string;
};

export type CampusCalendarRecord = {
  school: string;
  calendarSystem: CampusCalendarSystem;
  published: boolean;
  status: "final" | "tentative";
  sourceUrl: string;
  periods: CampusCalendarPeriod[];
  notes: string | null;
};

export type CampusDayStatus = {
  status: CampusDayKind | null;
  label: string;
};

const KIND_RANK: Record<Exclude<CampusDayKind, "between_terms">, number> = {
  no_classes: 0,
  break: 0,
  finals: 1,
  reading: 2,
  classes: 3,
};

const CALENDAR_END = "2027-08-01";

export const CAMPUS_CALENDARS: CampusCalendarRecord[] =
  campusCalendarsFile as CampusCalendarRecord[];

const BY_SCHOOL = new Map(
  CAMPUS_CALENDARS.map((row) => [row.school, row] as const),
);

export function campusCalendarForSchoolName(
  schoolName: string,
): CampusCalendarRecord | null {
  return BY_SCHOOL.get(schoolName) ?? null;
}

export function listCampusCalendarCoverage(schoolNames: string[]): {
  matched: string[];
  schoolsMissingCalendar: string[];
  calendarsMissingSchool: string[];
} {
  const nameSet = new Set(schoolNames);
  const matched = schoolNames.filter((name) => BY_SCHOOL.has(name));
  const schoolsMissingCalendar = schoolNames.filter((name) => !BY_SCHOOL.has(name));
  const calendarsMissingSchool = CAMPUS_CALENDARS.map((row) => row.school).filter(
    (name) => !nameSet.has(name),
  );
  return { matched, schoolsMissingCalendar, calendarsMissingSchool };
}

function isoParts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

/** Compare YYYY-MM-DD strings lexicographically (safe for zero-padded ISO). */
function isoCmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function lastPeriodEnd(record: CampusCalendarRecord): string | null {
  let last: string | null = null;
  for (const period of record.periods) {
    if (!last || isoCmp(period.end, last) > 0) last = period.end;
  }
  return last;
}

/**
 * Day status for one campus calendar date.
 * Precedence when periods overlap: no_classes/break → finals → reading → classes.
 */
export function getCampusDayStatus(
  school: CampusCalendarRecord | string,
  date: Date | string,
): CampusDayStatus {
  const record =
    typeof school === "string" ? campusCalendarForSchoolName(school) : school;
  const iso = typeof date === "string" ? date : dateToIso(date);

  if (!record) {
    return { status: null, label: "Calendar not yet loaded" };
  }

  if (isoCmp(iso, CALENDAR_END) >= 0) {
    return { status: null, label: "Calendar not yet loaded" };
  }

  const covering = record.periods.filter(
    (period) => isoCmp(iso, period.start) >= 0 && isoCmp(iso, period.end) <= 0,
  );

  if (covering.length) {
    covering.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);
    const win = covering[0]!;
    const { y, m, d } = isoParts(iso);
    const weekday = new Date(y, m - 1, d).getDay(); // local
    if (win.kind === "classes" && (weekday === 0 || weekday === 6)) {
      return { status: "classes", label: "Weekend" };
    }
    return { status: win.kind, label: win.label };
  }

  const lastEnd = lastPeriodEnd(record);
  if (lastEnd && isoCmp(iso, lastEnd) > 0 && isoCmp(iso, CALENDAR_END) < 0) {
    return {
      status: "between_terms",
      label: "Summer (no regular classes)",
    };
  }

  return {
    status: "between_terms",
    label: "No classes (between terms)",
  };
}

function formatMd(iso: string): string {
  const { y, m, d } = isoParts(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRange(start: string, end: string): string {
  if (start === end) return formatMd(start);
  return `${formatMd(start)} - ${formatMd(end)}`;
}

const SPRING_BREAK_RE = /spring\s+(break|recess|term break)/i;

/** Named spring break, or gap after winter finals before spring classes. */
export function springBreakRangeLabel(
  record: CampusCalendarRecord,
): string | null {
  const named = record.periods.find((period) =>
    SPRING_BREAK_RE.test(period.label),
  );
  if (named) return formatRange(named.start, named.end);

  const winterFinals = record.periods
    .filter(
      (period) =>
        period.kind === "finals" &&
        /winter/i.test(period.label) &&
        isoCmp(period.end, "2027-01-01") >= 0 &&
        isoCmp(period.end, "2027-04-01") < 0,
    )
    .sort((a, b) => isoCmp(b.end, a.end));
  const springClasses = record.periods
    .filter(
      (period) =>
        period.kind === "classes" &&
        /spring/i.test(period.label) &&
        isoCmp(period.start, "2027-02-01") >= 0,
    )
    .sort((a, b) => isoCmp(a.start, b.start));

  const winterEnd = winterFinals[0]?.end;
  const springStart = springClasses[0]?.start;
  if (!winterEnd || !springStart) return null;
  if (isoCmp(winterEnd, springStart) >= 0) return null;

  // Gap starts the day after winter finals end.
  const { y, m, d } = isoParts(winterEnd);
  const gapStartDate = new Date(y, m - 1, d + 1);
  const gapStart = dateToIso(gapStartDate);
  const { y: sy, m: sm, d: sd } = isoParts(springStart);
  const gapEndDate = new Date(sy, sm - 1, sd - 1);
  const gapEnd = dateToIso(gapEndDate);
  if (isoCmp(gapStart, gapEnd) > 0) return null;
  return formatRange(gapStart, gapEnd);
}

export function calendarSystemLabel(
  system: CampusCalendarSystem,
): string {
  if (system === "semester") return "Semester";
  if (system === "quarter") return "Quarter";
  return "Four 7-week terms";
}
