import {
  CHRISTMAS_MOUNTAINS,
  OTHER_EPIC_LOCAL_LIMITS,
  type ChristmasMountain,
  type PassStanding,
} from "@/config/christmas";
import { blackoutDatesInBreak, christmasBreakDates, passLabel, plainDate } from "./dates";
import { planHeadline, type HistorySummary, type ProjectionSummary } from "./summarize";
import { getHistory, getProjection } from "./weather";

export type ChristmasRow = {
  mountain: ChristmasMountain;
  standing: PassStanding;
  pass: string;
  history: HistorySummary | null;
  projection: ProjectionSummary | null;
  historyError: string | null;
  projectionError: string | null;
};

export type ChristmasPlan = {
  generatedAt: string;
  days: { date: string; label: string; blackout: boolean }[];
  headline: string | null;
  groups: { id: PassStanding; title: string; rows: ChristmasRow[] }[];
  otherLimits: { name: string; limit: string }[];
};

const GROUP_TITLES: Record<PassStanding, string> = {
  open: "Pass works every day of this break",
  blackout: "Epic Local blocked Dec 26-31",
  "off-pass": "Not on Epic Local",
};

function byMedian(a: ChristmasRow, b: ChristmasRow): number {
  const left = a.history?.medianSnowIn ?? -1;
  const right = b.history?.medianSnowIn ?? -1;
  if (right !== left) return right - left;
  return a.mountain.name.localeCompare(b.mountain.name);
}

async function loadRow(mountain: ChristmasMountain): Promise<ChristmasRow> {
  const [history, projection] = await Promise.allSettled([
    getHistory(mountain.lat, mountain.lon),
    getProjection(mountain.lat, mountain.lon),
  ]);
  return {
    mountain,
    standing: mountain.standing,
    pass: passLabel(mountain.standing),
    history: history.status === "fulfilled" ? history.value : null,
    projection: projection.status === "fulfilled" ? projection.value : null,
    historyError: history.status === "rejected" ? errorMessage(history.reason) : null,
    projectionError: projection.status === "rejected" ? errorMessage(projection.reason) : null,
  };
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Weather did not load";
}

export async function loadChristmasPlan(): Promise<ChristmasPlan> {
  const blocked = new Set(blackoutDatesInBreak());
  const rows = await Promise.all(CHRISTMAS_MOUNTAINS.map(loadRow));
  const groups = (["open", "blackout", "off-pass"] as const).map((id) => ({
    id,
    title: GROUP_TITLES[id],
    rows: rows.filter((row) => row.standing === id).sort(byMedian),
  }));
  return {
    generatedAt: new Date().toISOString(),
    days: christmasBreakDates().map((date) => ({
      date,
      label: plainDate(date),
      blackout: blocked.has(date),
    })),
    headline: planHeadline(
      rows.map((row) => ({
        name: row.mountain.name,
        standing: row.standing,
        medianSnowIn: row.history?.medianSnowIn ?? null,
      }))
    ),
    groups,
    otherLimits: OTHER_EPIC_LOCAL_LIMITS,
  };
}
