import type { PassStanding } from "@/config/christmas";

export const SNOW_YEAR_BAR_IN = 6;

export type SeasonSnow = {
  year: number;
  snowIn: number;
  meanHighF: number | null;
};

export type HistorySummary = {
  seasons: number;
  medianSnowIn: number | null;
  seasonsAtLeast6In: number;
  meanHighF: number | null;
};

export type ProjectionSummary = {
  snowIn: number;
  meanHighF: number | null;
};

export function formatInches(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const left = sorted[mid - 1];
  const right = sorted[mid];
  if (left == null || right == null) return null;
  return (left + right) / 2;
}

export function seasonFromDaily(
  year: number,
  dates: string[],
  byDate: ReadonlyMap<string, { snowIn: number | null; highF: number | null }>
): SeasonSnow | null {
  let snow = 0;
  const highs: number[] = [];
  for (const date of dates) {
    const point = byDate.get(date);
    if (!point || point.snowIn == null) return null;
    snow += point.snowIn;
    if (point.highF != null) highs.push(point.highF);
  }
  const meanHighF = highs.length === 0 ? null : highs.reduce((sum, value) => sum + value, 0) / highs.length;
  return { year, snowIn: snow, meanHighF };
}

export function summarizeHistory(seasons: SeasonSnow[]): HistorySummary {
  const snow = seasons.map((season) => season.snowIn);
  const highs = seasons.map((season) => season.meanHighF).filter((value): value is number => value != null);
  return {
    seasons: seasons.length,
    medianSnowIn: median(snow),
    seasonsAtLeast6In: snow.filter((value) => value >= SNOW_YEAR_BAR_IN).length,
    meanHighF: highs.length === 0 ? null : highs.reduce((sum, value) => sum + value, 0) / highs.length,
  };
}

export function planHeadline(
  rows: { name: string; standing: PassStanding; medianSnowIn: number | null }[]
): string | null {
  const open = rows
    .filter((row) => row.standing === "open" && row.medianSnowIn != null)
    .sort((a, b) => (b.medianSnowIn ?? 0) - (a.medianSnowIn ?? 0) || a.name.localeCompare(b.name));
  const best = open[0];
  if (!best || best.medianSnowIn == null) return null;
  const blocked = rows
    .filter((row) => row.standing === "blackout" && row.medianSnowIn != null)
    .sort((a, b) => (b.medianSnowIn ?? 0) - (a.medianSnowIn ?? 0));
  let text = `Among mountains Epic Local covers all break, ${best.name} has the highest median snowfall, ${formatInches(best.medianSnowIn)} in.`;
  const higher = blocked.find((row) => (row.medianSnowIn ?? 0) > (best.medianSnowIn ?? 0));
  if (higher && higher.medianSnowIn != null) {
    text += ` ${higher.name} is higher at ${formatInches(higher.medianSnowIn)} in, and the pass is blocked there Dec 26-31.`;
  }
  return text;
}
