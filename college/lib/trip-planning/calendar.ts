/**
 * Campus calendar + Kyle break stubs for When to go / Itinerary.
 * Replace with real district + school calendars when available.
 */

export type CampusWeekState = "session" | "break" | "finals";

/** Nine Mondays around spring break (sample year 2027). */
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

/** Monday of TRIP_WEEK_LABELS[0]. */
export const TRIP_WEEK0 = new Date(2027, 2, 1);

export const KYLE_STUDENT = {
  name: "Kyle",
  school: "Columbia HS",
  /** Week indexes when Kyle is on break. */
  breaks: [5] as number[],
  homeAirport: "EWR",
  homeName: "Maplewood, NJ",
  homeLat: 40.7312,
  homeLng: -74.2735,
};

/** Stub weekly weather for the destination area (indexed like weeks). */
export const TRIP_WEEK_WEATHER: [string, string][] = [
  ["68°", "some rain"],
  ["68°", "some rain"],
  ["68°", "some rain"],
  ["69°", "light rain"],
  ["69°", "dry"],
  ["70°", "dry"],
  ["70°", "dry"],
  ["71°", "dry"],
  ["71°", "dry"],
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
