/**
 * Columbia High School (Maplewood / SOMSD) 2025–26 calendar.
 * Source: CHS Schedule Update PDF (SchoolMessenger).
 *
 * Entries marked `forVisits` were highlighted in red in that PDF — those are
 * the no-school / half-day windows useful for college visits. Spring Break was
 * not red in the export but is a multi-day NO SCHOOL week, so it is included.
 */

export type ChsScheduleKind =
  | "no_school"
  | "half_day"
  | "delayed_opening"
  | "district_closed"
  | "event"
  | "note";

export type ChsScheduleEntry = {
  /** Inclusive start YYYY-MM-DD. */
  start: string;
  /** Inclusive end YYYY-MM-DD (same as start for single days). */
  end: string;
  label: string;
  kind: ChsScheduleKind;
  /** Red in the source PDF — visit-relevant time off. */
  forVisits: boolean;
};

export const CHS_SCHEDULE_YEAR = "2025-2026";
export const CHS_SCHEDULE_SOURCE =
  "CHS Schedule Update PDF (South Orange & Maplewood School District)";

/** Full district schedule kept as data for Kyle / Trip planning. */
export const CHS_SCHEDULE: ChsScheduleEntry[] = [
  {
    start: "2025-08-18",
    end: "2025-08-18",
    label: "Freshmen Orientation (B Day)",
    kind: "event",
    forVisits: false,
  },
  {
    start: "2025-09-01",
    end: "2025-09-01",
    label: "First day of school for students",
    kind: "event",
    forVisits: false,
  },
  {
    start: "2025-09-07",
    end: "2025-09-07",
    label: "Labor Day",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2025-09-21",
    end: "2025-09-21",
    label: "Yom Kippur",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2025-10-01",
    end: "2025-10-01",
    label: "Half day (Back to School Night)",
    kind: "half_day",
    forVisits: true,
  },
  {
    start: "2025-10-12",
    end: "2025-10-12",
    label: "Teacher PD / Indigenous Peoples’ Day",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2025-10-26",
    end: "2025-10-26",
    label: "PSATs (delayed opening for 9th & 12th)",
    kind: "delayed_opening",
    forVisits: true,
  },
  {
    start: "2025-11-03",
    end: "2025-11-03",
    label: "Election Day / Teacher PD",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2025-11-05",
    end: "2025-11-06",
    label: "NJEA Teachers Convention",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2025-11-25",
    end: "2025-11-25",
    label: "Half day (before Thanksgiving)",
    kind: "half_day",
    forVisits: true,
  },
  {
    start: "2025-11-26",
    end: "2025-11-27",
    label: "Thanksgiving Break",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2025-12-23",
    end: "2025-12-23",
    label: "District half day (before Winter Break)",
    kind: "half_day",
    forVisits: true,
  },
  {
    start: "2025-12-24",
    end: "2026-01-03",
    label: "Winter Break",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2026-01-04",
    end: "2026-01-04",
    label: "Return to school",
    kind: "event",
    forVisits: false,
  },
  {
    start: "2026-01-18",
    end: "2026-01-18",
    label: "Dr. Martin Luther King, Jr. Day",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2026-02-15",
    end: "2026-02-15",
    label: "Presidents’ Day",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2026-03-10",
    end: "2026-03-10",
    label: "Eid al-Fitr",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2026-03-26",
    end: "2026-03-26",
    label: "Good Friday",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2026-04-12",
    end: "2026-04-16",
    label: "Spring Break",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2026-05-31",
    end: "2026-05-31",
    label: "Memorial Day",
    kind: "no_school",
    forVisits: true,
  },
  {
    start: "2026-06-01",
    end: "2026-06-01",
    label: "Half day (Primary Election Day)",
    kind: "half_day",
    forVisits: true,
  },
  {
    start: "2026-06-17",
    end: "2026-06-17",
    label: "Last day of school (half day)",
    kind: "half_day",
    forVisits: true,
  },
  {
    start: "2026-06-18",
    end: "2026-06-18",
    label: "Juneteenth (district closed)",
    kind: "district_closed",
    forVisits: true,
  },
];

export function chsVisitBreaks(): ChsScheduleEntry[] {
  return CHS_SCHEDULE.filter((entry) => entry.forVisits);
}

/** Multi-day no-school windows (best for overnight college trips). */
export function chsTripWindows(): ChsScheduleEntry[] {
  return chsVisitBreaks().filter(
    (entry) =>
      entry.kind === "no_school" &&
      entry.start !== entry.end,
  );
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekdayCount(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Week indexes (relative to week0 Monday) where Kyle has enough time off
 * for a visit — multi-day no-school, or 2+ weekdays off in that week.
 */
export function kyleBreakWeekIndexes(
  week0: Date,
  weekCount: number,
): number[] {
  const visitNoSchool = chsVisitBreaks().filter(
    (e) => e.kind === "no_school" || e.kind === "district_closed",
  );
  const indexes: number[] = [];

  for (let i = 0; i < weekCount; i++) {
    const weekStart = new Date(week0);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    let offWeekdays = 0;
    let multiDayHit = false;

    for (const entry of visitNoSchool) {
      const a = parseIso(entry.start);
      const b = parseIso(entry.end);
      const overlapStart = a > weekStart ? a : weekStart;
      const overlapEnd = b < weekEnd ? b : weekEnd;
      if (overlapStart > overlapEnd) continue;

      const days = weekdayCount(overlapStart, overlapEnd);
      offWeekdays += days;
      if (entry.start !== entry.end && days >= 2) multiDayHit = true;
    }

    if (multiDayHit || offWeekdays >= 2) indexes.push(i);
  }

  return indexes;
}

/** Short label for Kyle's break cell when a visit window overlaps the week. */
export function kyleBreakLabelForWeek(week0: Date, weekIndex: number): string {
  const weekStart = new Date(week0);
  weekStart.setDate(weekStart.getDate() + weekIndex * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const hits = chsVisitBreaks().filter((entry) => {
    if (entry.kind !== "no_school" && entry.kind !== "district_closed") {
      return false;
    }
    const a = parseIso(entry.start);
    const b = parseIso(entry.end);
    return a <= weekEnd && b >= weekStart;
  });

  if (!hits.length) return "Break";
  const multi = hits.find((h) => h.start !== h.end);
  return multi?.label ?? hits[0]?.label ?? "Break";
}
