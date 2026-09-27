/**
 * Campus calendars + Kyle's CHS visit breaks for When to go / Itinerary.
 * Kyle's off weeks come from Columbia HS 2026–27 (see chs-schedule.ts).
 * Academic year covered: September 2026 through August 2027.
 */

import {
  CHS_SCHEDULE_SOURCE,
  CHS_SCHEDULE_YEAR,
  kyleBreakLabelForWeek,
  kyleBreakWeekIndexes,
} from "./chs-schedule";
import {
  getCampusDayStatus,
  campusCalendarForSchoolName,
  type CampusDayKind,
  type CampusDayStatus,
} from "./campus-calendars";

export type CampusWeekState = "session" | "break" | "finals";

export type CampusWeekdayDetail = {
  iso: string;
  /** Mon–Fri short label used in tooltips, e.g. "Mon Mar 22". */
  dayLabel: string;
  status: CampusDayKind | null;
  label: string;
};

export type CampusWeekInfo = {
  state: CampusWeekState;
  weekdays: CampusWeekdayDetail[];
  /** e.g. "Mon Mar 22: Spring break · Tue Mar 23: Spring break · …" */
  tooltip: string;
};

export { CHS_SCHEDULE, CHS_SCHEDULE_SOURCE, CHS_SCHEDULE_YEAR, chsVisitBreaks, chsTripWindows } from "./chs-schedule";
export {
  CAMPUS_CALENDARS,
  calendarSystemLabel,
  campusCalendarForSchoolName,
  getCampusDayStatus,
  listCampusCalendarCoverage,
  springBreakRangeLabel,
  type CampusCalendarRecord,
  type CampusCalendarSystem,
  type CampusDayKind,
  type CampusDayStatus,
} from "./campus-calendars";

/**
 * Nine Mondays around CHS Spring Break 2027 (Apr 12–16).
 * Week 0 = Mon Mar 1, 2027. Spring Break week = Apr 12 (index 6).
 */
export const TRIP_WEEK_LABELS = [
  "Mar 1",
  "Mar 8",
  "Mar 15",
  "Mar 22",
  "Mar 29",
  "Apr 5",
  "Apr 12",
  "Apr 19",
  "Apr 26",
] as const;

/** Monday of TRIP_WEEK_LABELS[0] (Mar 1, 2027). */
export const TRIP_WEEK0 = new Date(2027, 2, 1);

const KYLE_BREAK_INDEXES = kyleBreakWeekIndexes(
  TRIP_WEEK0,
  TRIP_WEEK_LABELS.length,
);

/** Default selected week = CHS Spring Break week (Apr 12, 2027). */
export const DEFAULT_TRIP_WEEK_INDEX = KYLE_BREAK_INDEXES.includes(6)
  ? 6
  : (KYLE_BREAK_INDEXES[0] ?? 6);

export const KYLE_STUDENT = {
  name: "Kyle",
  school: "Columbia HS",
  scheduleYear: CHS_SCHEDULE_YEAR,
  scheduleSource: CHS_SCHEDULE_SOURCE,
  /** Week indexes when Kyle is on a visit-relevant break (red in CHS PDF). */
  breaks: KYLE_BREAK_INDEXES,
  homeAirport: "EWR",
  homeName: "Maplewood, NJ",
  homeLat: 40.7312,
  homeLng: -74.2735,
};

export function kyleBreakCellLabel(weekIndex: number): string {
  if (!KYLE_STUDENT.breaks.includes(weekIndex)) return "School";
  return kyleBreakLabelForWeek(TRIP_WEEK0, weekIndex);
}

/** Stub weekly weather for the destination area (indexed like weeks). */
export const TRIP_WEEK_WEATHER: [string, string][] = [
  ["55°", "some rain"],
  ["56°", "some rain"],
  ["58°", "light rain"],
  ["60°", "dry"],
  ["62°", "dry"],
  ["64°", "dry"],
  ["66°", "dry"],
  ["68°", "dry"],
  ["70°", "dry"],
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function summarizeWeekdays(statuses: CampusDayStatus[]): CampusWeekState {
  let classes = 0;
  let finalsOrReading = 0;
  for (const day of statuses) {
    if (day.status === "classes") classes += 1;
    else if (day.status === "finals" || day.status === "reading") finalsOrReading += 1;
  }
  if (classes >= 3) return "session";
  if (finalsOrReading >= 3) return "finals";
  return "break";
}

function buildWeekInfo(schoolName: string, weekIndex: number): CampusWeekInfo {
  const weekdays: CampusWeekdayDetail[] = [];
  const dayStatuses: CampusDayStatus[] = [];
  for (let offset = 0; offset < 5; offset++) {
    const date = weekDate(weekIndex, offset);
    const iso = isoDate(date);
    const day = getCampusDayStatus(schoolName, iso);
    dayStatuses.push(day);
    const dayLabel = `${WEEKDAY_NAMES[date.getDay()]} ${formatWeekDate(date)}`;
    weekdays.push({
      iso,
      dayLabel,
      status: day.status,
      label: day.label,
    });
  }
  return {
    state: summarizeWeekdays(dayStatuses),
    weekdays,
    tooltip: weekdays.map((d) => `${d.dayLabel}: ${d.label}`).join(" · "),
  };
}

/**
 * Build the Mar–Apr trip-week calendar for a school from its official 2026–27 periods.
 * Keys are week indexes into TRIP_WEEK_LABELS. Missing weeks default to session.
 */
export function buildCampusCalendar(
  schoolName: string,
): Record<number, CampusWeekInfo> {
  const out: Record<number, CampusWeekInfo> = {};
  if (!campusCalendarForSchoolName(schoolName)) return out;
  for (let i = 0; i < TRIP_WEEK_LABELS.length; i++) {
    out[i] = buildWeekInfo(schoolName, i);
  }
  return out;
}

export function campusWeekState(
  calendar: Record<number, CampusWeekInfo | CampusWeekState>,
  weekIndex: number,
): CampusWeekState {
  const entry = calendar[weekIndex];
  if (!entry) return "session";
  if (typeof entry === "string") return entry;
  return entry.state;
}

export function campusWeekTooltip(
  calendar: Record<number, CampusWeekInfo | CampusWeekState>,
  weekIndex: number,
): string | undefined {
  const entry = calendar[weekIndex];
  if (!entry || typeof entry === "string") return undefined;
  return entry.tooltip;
}

export function weekDate(weekIndex: number, dayOffset = 0): Date {
  const d = new Date(TRIP_WEEK0);
  d.setDate(d.getDate() + weekIndex * 7 + dayOffset);
  return d;
}

export function formatWeekDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return date.toLocaleDateString("en-US", options);
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Best fit = Kyle on break and every trip school in session. */
export function isBestFitWeek(
  weekIndex: number,
  kyleBreaks: number[],
  schoolStates: CampusWeekState[],
): boolean {
  if (!kyleBreaks.includes(weekIndex)) return false;
  return schoolStates.every((state) => state === "session");
}
