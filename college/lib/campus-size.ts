import type { SelectivityTier } from "./types";

/** Small under 5k · Medium 5k–15k · Large over 15k. */
export const SIZE_BANDS = [
  ["Small", 0, 5000],
  ["Medium", 5000, 15000],
  ["Large", 15000, Number.POSITIVE_INFINITY],
] as const;

export type CampusSetting = "Urban" | "Suburban" | "Rural";
export type CampusSizeBand = "Small" | "Medium" | "Large";

export function sizeOf(n: number): CampusSizeBand {
  if (n < 5000) return "Small";
  if (n <= 15000) return "Medium";
  return "Large";
}

export function formatUndergrads(n: number): string {
  return n.toLocaleString("en-US");
}

/** Map Scorecard / stored locale words onto the three Campus settings. */
export function normalizeCampusSetting(raw: string): CampusSetting | "" {
  const key = raw.trim().toLowerCase();
  if (!key) return "";
  if (key === "urban" || key === "city") return "Urban";
  if (key === "suburban" || key === "suburb" || key === "town" || key === "college town") {
    return "Suburban";
  }
  if (key === "rural") return "Rural";
  return "";
}

export function normalizeCampusSizeBand(raw: string): CampusSizeBand | "" {
  const key = raw.trim().toLowerCase();
  if (!key) return "";
  if (key === "small") return "Small";
  if (key === "medium") return "Medium";
  if (key === "large" || key === "very large") return "Large";
  return "";
}

/** Parse `Setting / Size` (or `Setting · Size`) from the campusSize record field. */
export function parseCampusSize(campusSize: string): {
  setting: CampusSetting | "";
  size: CampusSizeBand | "";
} {
  const trimmed = campusSize.trim();
  if (!trimmed) return { setting: "", size: "" };
  const parts = trimmed.split(/\s*[·/]\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    const asSetting = normalizeCampusSetting(parts[0]);
    if (asSetting) return { setting: asSetting, size: "" };
    return { setting: "", size: normalizeCampusSizeBand(parts[0]) };
  }
  return {
    setting: normalizeCampusSetting(parts[0]),
    size: normalizeCampusSizeBand(parts[1] ?? ""),
  };
}

/**
 * CSS var for the Admissions headline. Matches the dashboard selectivity pie
 * (Less=1 … Extremely=4), not the inverted sample table in the HTML prompt.
 */
export function tierHeadlineVar(tier: SelectivityTier): string {
  if (tier === "less_competitive") return "--tier-1";
  if (tier === "competitive") return "--tier-2";
  if (tier === "very_selective") return "--tier-3";
  if (tier === "extremely_selective") return "--tier-4";
  return "--color-text";
}

export type SizeGaugeModel = {
  lo: number;
  hi: number;
  pct: number;
  labelShift: string;
  bands: { name: CampusSizeBand; widthPct: number; on: boolean }[];
  ariaLabel: string;
};

/** Build the list-relative size gauge, or null when it should be hidden. */
export function sizeGaugeModel(
  undergrads: number | null | undefined,
  listUndergrads: number[],
): SizeGaugeModel | null {
  if (undergrads == null || !Number.isFinite(undergrads)) return null;
  const counts = listUndergrads.filter((n) => Number.isFinite(n) && n >= 0);
  if (counts.length < 2) return null;
  const lo = Math.min(...counts);
  const hi = Math.max(...counts);
  if (!(hi > lo)) return null;

  const pctOf = (v: number) => ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100;
  const pct = pctOf(undergrads);
  const band = sizeOf(undergrads);
  const labelShift = pct < 8 ? "0%" : pct > 92 ? "-100%" : "-50%";
  const bands = SIZE_BANDS.map(([name, a, b]) => {
    const left = pctOf(Math.max(a, lo));
    const right = pctOf(Math.min(b, hi));
    return { name, widthPct: Math.max(0, right - left), on: name === band };
  }).filter((row) => row.widthPct > 0);

  return {
    lo,
    hi,
    pct,
    labelShift,
    bands,
    ariaLabel: `${formatUndergrads(undergrads)} undergrads. Smallest on your list ${formatUndergrads(lo)}, largest ${formatUndergrads(hi)}.`,
  };
}
