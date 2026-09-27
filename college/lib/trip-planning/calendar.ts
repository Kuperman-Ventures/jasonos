/**
 * Campus calendars + Kyle's CHS visit breaks for When to go / Itinerary.
 * Kyle's off weeks come from Columbia HS 2026–27 (see chs-schedule.ts).
 * Academic year covered: September 2026 through August 2027.
 *
 * Drive-range schools prefer the Fall 2026 grid (NJEA / Thanksgiving).
 * Fly-range schools keep the Spring 2027 grid (Spring Break week).
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

export type TripSeasonId = "fall" | "spring";

export type TripWeekGrid = {
  id: TripSeasonId;
  /** Short season title shown in When to go. */
  label: string;
  /** Monday of week index 0. */
  week0: Date;
  weekLabels: readonly string[];
  kyleBreaks: number[];
  defaultWeekIndex: number;
  weather: readonly [string, string][];
  /** Shown when this season is auto-picked for drive schools. */
  priorityNote: string;
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

function buildGrid(opts: {
  id: TripSeasonId;
  label: string;
  week0: Date;
  weekLabels: readonly string[];
  preferredBreakIndex: number;
  weather: readonly [string, string][];
  priorityNote: string;
}): TripWeekGrid {
  const kyleBreaks = kyleBreakWeekIndexes(opts.week0, opts.weekLabels.length);
  const defaultWeekIndex = kyleBreaks.includes(opts.preferredBreakIndex)
    ? opts.preferredBreakIndex
    : (kyleBreaks[0] ?? opts.preferredBreakIndex);
  return {
    id: opts.id,
    label: opts.label,
    week0: opts.week0,
    weekLabels: opts.weekLabels,
    kyleBreaks,
    defaultWeekIndex,
    weather: opts.weather,
    priorityNote: opts.priorityNote,
  };
}

/**
 * Nine Mondays around CHS fall visit windows (NJEA Nov 5–6, Thanksgiving Nov 26–27).
 * Week 0 = Mon Oct 26, 2026. NJEA week = Nov 2 (index 1).
 */
export const FALL_TRIP_GRID: TripWeekGrid = buildGrid({
  id: "fall",
  label: "Fall 2026",
  week0: new Date(2026, 9, 26),
  weekLabels: [
    "Oct 26",
    "Nov 2",
    "Nov 9",
    "Nov 16",
    "Nov 23",
    "Nov 30",
    "Dec 7",
    "Dec 14",
    "Dec 21",
  ],
  preferredBreakIndex: 1,
  weather: [
    ["58°", "some rain"],
    ["55°", "light rain"],
    ["52°", "dry"],
    ["50°", "dry"],
    ["48°", "some rain"],
    ["45°", "dry"],
    ["42°", "dry"],
    ["40°", "dry"],
    ["38°", "some rain"],
  ],
  priorityNote:
    "Drive-range schools first: use this fall (NJEA weekend / Thanksgiving) while campuses are in session.",
});

/**
 * Nine Mondays around CHS Spring Break 2027 (Apr 12–16).
 * Week 0 = Mon Mar 1, 2027. Spring Break week = Apr 12 (index 6).
 */
export const SPRING_TRIP_GRID: TripWeekGrid = buildGrid({
  id: "spring",
  label: "Spring 2027",
  week0: new Date(2027, 2, 1),
  weekLabels: [
    "Mar 1",
    "Mar 8",
    "Mar 15",
    "Mar 22",
    "Mar 29",
    "Apr 5",
    "Apr 12",
    "Apr 19",
    "Apr 26",
  ],
  preferredBreakIndex: 6,
  weather: [
    ["55°", "some rain"],
    ["56°", "some rain"],
    ["58°", "light rain"],
    ["60°", "dry"],
    ["62°", "dry"],
    ["64°", "dry"],
    ["66°", "dry"],
    ["68°", "dry"],
    ["70°", "dry"],
  ],
  priorityNote: "Fly-range trips: Spring Break week is the main multi-day window.",
});

/** @deprecated Prefer FALL_TRIP_GRID / SPRING_TRIP_GRID; kept as spring aliases. */
export const TRIP_WEEK_LABELS = SPRING_TRIP_GRID.weekLabels;
/** @deprecated Prefer grid.week0 */
export const TRIP_WEEK0 = SPRING_TRIP_GRID.week0;
/** @deprecated Prefer grid.defaultWeekIndex */
export const DEFAULT_TRIP_WEEK_INDEX = SPRING_TRIP_GRID.defaultWeekIndex;
/** @deprecated Prefer grid.weather */
export const TRIP_WEEK_WEATHER = SPRING_TRIP_GRID.weather;

export const KYLE_STUDENT = {
  name: "Kyle",
  school: "Columbia HS",
  scheduleYear: CHS_SCHEDULE_YEAR,
  scheduleSource: CHS_SCHEDULE_SOURCE,
  /** Spring-grid break indexes (legacy). Prefer grid.kyleBreaks. */
  breaks: SPRING_TRIP_GRID.kyleBreaks,
  homeAirport: "EWR",
  homeName: "Maplewood, NJ",
  homeLat: 40.7312,
  homeLng: -74.2735,
};

export function tripWeekGridForSeason(season: TripSeasonId): TripWeekGrid {
  return season === "fall" ? FALL_TRIP_GRID : SPRING_TRIP_GRID;
}

/**
 * Drive-range trips prioritize fall 2026; any Fly school keeps spring 2027.
 */
export function preferredTripSeason(
  travelModes: Array<"Drive" | "Fly" | "">,
): TripSeasonId {
  if (!travelModes.length) return "fall";
  const known = travelModes.filter((mode): mode is "Drive" | "Fly" => mode === "Drive" || mode === "Fly");
  if (!known.length) return "fall";
  return known.every((mode) => mode === "Drive") ? "fall" : "spring";
}

export function kyleBreakCellLabel(
  weekIndex: number,
  grid: TripWeekGrid = SPRING_TRIP_GRID,
): string {
  if (!grid.kyleBreaks.includes(weekIndex)) return "School";
  return kyleBreakLabelForWeek(grid.week0, weekIndex);
}

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

function buildWeekInfo(
  schoolName: string,
  weekIndex: number,
  grid: TripWeekGrid,
): CampusWeekInfo {
  const weekdays: CampusWeekdayDetail[] = [];
  const dayStatuses: CampusDayStatus[] = [];
  for (let offset = 0; offset < 5; offset++) {
    const date = weekDate(weekIndex, offset, grid);
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
 * Build the trip-week calendar for a school from its official 2026–27 periods.
 * Keys are week indexes into the season grid. Missing weeks default to session.
 */
export function buildCampusCalendar(
  schoolName: string,
  grid: TripWeekGrid = SPRING_TRIP_GRID,
): Record<number, CampusWeekInfo> {
  const out: Record<number, CampusWeekInfo> = {};
  if (!campusCalendarForSchoolName(schoolName)) return out;
  for (let i = 0; i < grid.weekLabels.length; i++) {
    out[i] = buildWeekInfo(schoolName, i, grid);
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

export function weekDate(
  weekIndex: number,
  dayOffset = 0,
  grid: TripWeekGrid = SPRING_TRIP_GRID,
): Date {
  const d = new Date(grid.week0);
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
