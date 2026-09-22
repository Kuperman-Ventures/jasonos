/** Dense month-resolution ledger for the college process runway. */

export type RoadmapKind = "bar" | "milestone";

export type RoadmapTrack = {
  id: string;
  label: string;
  /** Inclusive start: calendar year + month (0–11). */
  start: { year: number; month: number };
  /** Inclusive end for bars; milestones use the same month. */
  end: { year: number; month: number };
  kind: RoadmapKind;
  itemIds: string[];
};

/** First month column = Sep 2026. Widening the window is a token / MONTHS change. */
export const ROADMAP_ORIGIN = { year: 2026, month: 8 } as const;
export const ROADMAP_MONTHS = 17;

export const ROADMAP_TRACKS: RoadmapTrack[] = [
  {
    id: "college-list",
    label: "Develop college list",
    start: { year: 2026, month: 8 },
    end: { year: 2027, month: 2 },
    kind: "bar",
    itemIds: ["p1-5", "p2-3", "p2-4", "p3-2", "p4-1"],
  },
  {
    id: "visits",
    label: "Visit colleges, in person & virtually",
    start: { year: 2026, month: 8 },
    end: { year: 2027, month: 2 },
    kind: "bar",
    itemIds: ["p2-2", "p4-2"],
  },
  {
    id: "testing",
    label: "Testing · PSAT → SAT / ACT",
    start: { year: 2026, month: 8 },
    end: { year: 2027, month: 5 },
    kind: "bar",
    itemIds: ["p1-1", "p2-1", "p3-3", "p5-1"],
  },
  {
    id: "recs",
    label: "Bio for GC, brag sheet & teacher recs",
    start: { year: 2027, month: 0 },
    end: { year: 2027, month: 5 },
    kind: "bar",
    itemIds: ["p1-3", "p2-5", "p3-1", "p3-4", "p5-3"],
  },
  {
    id: "passion",
    label: "Community service / passion project",
    start: { year: 2026, month: 8 },
    end: { year: 2027, month: 2 },
    kind: "bar",
    itemIds: ["p1-6"],
  },
  {
    id: "essays",
    label: "Rising seniors: write your essays",
    start: { year: 2027, month: 6 },
    end: { year: 2027, month: 6 },
    kind: "milestone",
    itemIds: ["p3-5", "p4-3", "p4-5"],
  },
  {
    id: "applications",
    label: "Submit applications",
    start: { year: 2027, month: 9 },
    end: { year: 2028, month: 0 },
    kind: "bar",
    itemIds: ["p4-4", "p5-2", "p5-4"],
  },
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthCell = {
  index: number;
  year: number;
  month: number;
  label: string;
  /** Quarter-opening months stay heavier when the scale compresses. */
  quarter: boolean;
};

export function absoluteMonth(year: number, month: number): number {
  return year * 12 + month;
}

export function monthIndex(year: number, month: number): number {
  return absoluteMonth(year, month) - absoluteMonth(ROADMAP_ORIGIN.year, ROADMAP_ORIGIN.month);
}

export function monthCells(count = ROADMAP_MONTHS): MonthCell[] {
  const cells: MonthCell[] = [];
  for (let index = 0; index < count; index++) {
    const absolute = absoluteMonth(ROADMAP_ORIGIN.year, ROADMAP_ORIGIN.month) + index;
    const year = Math.floor(absolute / 12);
    const month = absolute % 12;
    cells.push({
      index,
      year,
      month,
      label: MONTH_SHORT[month],
      quarter: month % 3 === 0,
    });
  }
  return cells;
}

export function yearBands(cells: MonthCell[]): { year: number; start: number; span: number }[] {
  const bands: { year: number; start: number; span: number }[] = [];
  for (const cell of cells) {
    const last = bands[bands.length - 1];
    if (last && last.year === cell.year) last.span += 1;
    else bands.push({ year: cell.year, start: cell.index, span: 1 });
  }
  return bands;
}

/** Inclusive month span length for grid `span L`. */
export function spanLength(start: { year: number; month: number }, end: { year: number; month: number }): number {
  return Math.max(1, monthIndex(end.year, end.month) - monthIndex(start.year, start.month) + 1);
}

/** CSS grid column for month index S: months start at column 2 → `2 + S`. */
export function gridColumnStart(startIndex: number): number {
  return 2 + startIndex;
}

export function formatSpan(track: RoadmapTrack): string {
  const startLabel = MONTH_SHORT[track.start.month];
  const endLabel = MONTH_SHORT[track.end.month];
  if (track.kind === "milestone") {
    return `${startLabel} ${track.start.year}`;
  }
  if (track.start.year === track.end.year) {
    return `${startLabel} – ${endLabel}`;
  }
  const wrapped = track.end.month < track.start.month;
  const endYearShort = String(track.end.year).slice(2);
  // Match the dense-ledger labels: "Sep – Mar", "Sep – Dec 27", "Oct – Jan 28".
  if (wrapped && track.end.month > 0) {
    return `${startLabel} – ${endLabel}`;
  }
  return `${startLabel} – ${endLabel} ${endYearShort}`;
}

export function formatRange(track: RoadmapTrack): string {
  const start = `${MONTH_SHORT[track.start.month]} ${track.start.year}`;
  const end = `${MONTH_SHORT[track.end.month]} ${track.end.year}`;
  return track.kind === "milestone" ? start : `${start} – ${end}`;
}

export function currentMonthIndex(now = new Date()): number {
  const idx = monthIndex(now.getFullYear(), now.getMonth());
  return Math.min(Math.max(idx, 0), ROADMAP_MONTHS - 1);
}

/**
 * How far through the current calendar month we are (0 at day 1, ~1 at month end).
 * Used to slide the “you are here” line across the month column day by day.
 */
export function dayProgressInMonth(now = new Date()): number {
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (daysInMonth <= 1) return 0;
  return Math.min(1, Math.max(0, (day - 1) / daysInMonth));
}

/** Short label for the live “you are here” badge, e.g. "Sep 20". */
export function formatNowDay(now = new Date()): string {
  return `${MONTH_SHORT[now.getMonth()]} ${now.getDate()}`;
}

/** Full today label for the Dashboard header, e.g. "Sunday, Sep 20, 2026". */
export function formatTodayLong(now = new Date()): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type TrackState = "active" | "future" | "done";

export function trackState(
  track: RoadmapTrack,
  checklist: Record<string, boolean>,
  now = new Date(),
): TrackState {
  const progress = trackProgress(track, checklist);
  if (progress.total > 0 && progress.done === progress.total) return "done";
  const startIdx = monthIndex(track.start.year, track.start.month);
  if (startIdx > currentMonthIndex(now)) return "future";
  return "active";
}

export function trackProgress(
  track: RoadmapTrack,
  checklist: Record<string, boolean>,
): { done: number; total: number; percent: number } {
  const total = track.itemIds.length;
  const done = track.itemIds.filter((id) => checklist[id]).length;
  return {
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

export function accessibleTrackName(track: RoadmapTrack, state: TrackState): string {
  const status =
    state === "done" ? "complete" : state === "future" ? "not started" : "in progress";
  if (track.kind === "milestone") {
    return `Milestone · ${track.label} · ${formatRange(track)} · ${status}`;
  }
  return `${track.label} · ${formatRange(track)} · ${status}`;
}
