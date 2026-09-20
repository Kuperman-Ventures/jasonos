/** Seasonal Gantt for the college process. Bars pull from the reference roadmap and the checklist. */

export type SeasonId =
  | "fall-2026"
  | "winter-2027"
  | "spring-2027"
  | "summer-2027"
  | "fall-2027"
  | "winter-2028";

export type RoadmapKind = "bar" | "milestone";

export type RoadmapTrack = {
  id: string;
  label: string;
  start: SeasonId;
  /** Inclusive end season for bars; milestones sit on this season. */
  end: SeasonId;
  kind: RoadmapKind;
  /** Checklist item ids that feed this track's progress. */
  itemIds: string[];
};

export const ROADMAP_SEASONS: { id: SeasonId; label: string }[] = [
  { id: "fall-2026", label: "Fall 2026" },
  { id: "winter-2027", label: "Winter 2027" },
  { id: "spring-2027", label: "Spring 2027" },
  { id: "summer-2027", label: "Summer 2027" },
  { id: "fall-2027", label: "Fall 2027" },
  { id: "winter-2028", label: "Winter 2028" },
];

export const ROADMAP_TRACKS: RoadmapTrack[] = [
  {
    id: "college-list",
    label: "Develop College List",
    start: "fall-2026",
    end: "summer-2027",
    kind: "bar",
    itemIds: ["p1-5", "p2-3", "p2-4", "p3-2", "p4-1"],
  },
  {
    id: "visits",
    label: "Visit Colleges In Person & Virtually",
    start: "fall-2026",
    end: "summer-2027",
    kind: "bar",
    itemIds: ["p2-2", "p4-2"],
  },
  {
    id: "testing",
    label: "Testing · PSAT → SAT / ACT",
    start: "fall-2026",
    end: "fall-2027",
    kind: "bar",
    itemIds: ["p1-1", "p2-1", "p3-3", "p5-1"],
  },
  {
    id: "recs",
    label: "Bio for GC, Brag Sheet & Teacher Recommendations",
    start: "winter-2027",
    end: "fall-2027",
    kind: "bar",
    itemIds: ["p1-3", "p2-5", "p3-1", "p3-4", "p5-3"],
  },
  {
    id: "passion",
    label: "Community Service / Passion Project",
    start: "fall-2026",
    end: "summer-2027",
    kind: "bar",
    itemIds: ["p1-6"],
  },
  {
    id: "money",
    label: "Budget → FAFSA / CSS / Aid",
    start: "fall-2026",
    end: "winter-2028",
    kind: "bar",
    itemIds: ["p1-4", "p2-3", "p5-5", "p6-1", "p6-2", "p6-3", "p6-4"],
  },
  {
    id: "essays",
    label: "Rising Seniors: Write Your College Application Essays",
    start: "summer-2027",
    end: "summer-2027",
    kind: "milestone",
    itemIds: ["p3-5", "p4-3", "p4-5"],
  },
  {
    id: "applications",
    label: "Submit Applications",
    start: "fall-2027",
    end: "winter-2028",
    kind: "bar",
    itemIds: ["p4-4", "p5-2", "p5-4"],
  },
];

const SEASON_INDEX = Object.fromEntries(
  ROADMAP_SEASONS.map((season, index) => [season.id, index]),
) as Record<SeasonId, number>;

export function seasonIndex(id: SeasonId): number {
  return SEASON_INDEX[id];
}

/** Left edge and width as percentages of the season axis (markers at equal spacing). */
export function barPlacement(start: SeasonId, end: SeasonId): { left: number; width: number } {
  const last = ROADMAP_SEASONS.length - 1;
  const startIdx = seasonIndex(start);
  const endIdx = Math.max(startIdx, seasonIndex(end));
  const left = (startIdx / last) * 100;
  const width = Math.max(((endIdx - startIdx) / last) * 100, 8);
  return { left, width: Math.min(width, 100 - left) };
}

export function milestonePlacement(season: SeasonId): number {
  const last = ROADMAP_SEASONS.length - 1;
  return (seasonIndex(season) / last) * 100;
}

/** Calendar “you are here” for the junior/senior runway. */
export function currentSeasonId(now = new Date()): SeasonId {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0–11
  if (y < 2026 || (y === 2026 && m < 8)) return "fall-2026";
  if (y === 2026) return "fall-2026"; // Sep–Dec 2026
  if (y === 2027 && m <= 1) return "winter-2027"; // Jan–Feb
  if (y === 2027 && m <= 4) return "spring-2027"; // Mar–May
  if (y === 2027 && m <= 7) return "summer-2027"; // Jun–Aug
  if (y === 2027) return "fall-2027"; // Sep–Dec 2027
  return "winter-2028";
}

export function herePlacement(now = new Date()): number {
  return milestonePlacement(currentSeasonId(now));
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
