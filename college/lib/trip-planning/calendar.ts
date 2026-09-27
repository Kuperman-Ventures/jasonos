/**
 * Campus calendar stubs + Kyle's CHS visit breaks for When to go / Itinerary.
 * Kyle's off weeks come from Columbia HS 2026–27 (see chs-schedule.ts).
 * Academic year covered: September 2026 through August 2027.
 */

import {
  CHS_SCHEDULE_SOURCE,
  CHS_SCHEDULE_YEAR,
  kyleBreakLabelForWeek,
  kyleBreakWeekIndexes,
} from "./chs-schedule";

export type CampusWeekState = "session" | "break" | "finals";

export { CHS_SCHEDULE, CHS_SCHEDULE_SOURCE, CHS_SCHEDULE_YEAR, chsVisitBreaks, chsTripWindows } from "./chs-schedule";

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

/**
 * Deterministic stub calendar per school id.
 * Week 2–3 often finals/break to match the reference sample pattern.
 */
export function stubCampusCalendar(schoolId: string): Record<number, CampusWeekState> {
  let hash = 0;
  for (let i = 0; i < schoolId.length; i++) {
    hash = (hash * 31 + schoolId.charCodeAt(i)) >>> 0;
  }
  const pattern = hash % 4;
  if (pattern === 0) return { 2: "finals", 3: "break" };
  if (pattern === 1) return { 2: "break" };
  if (pattern === 2) return { 1: "break", 2: "finals" };
  return { 2: "finals", 3: "break", 4: "break" };
}

export function campusWeekState(
  calendar: Record<number, CampusWeekState>,
  weekIndex: number,
): CampusWeekState {
  return calendar[weekIndex] ?? "session";
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
