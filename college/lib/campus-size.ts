import stateRegionsFile from "@/data/state-regions.json";
import type { KyleResidency, SchoolControl, SelectivityTier } from "./types";
import { normalizeStateCode } from "./trip-planning/regions";

/** Campus setting (where the campus sits). */
export const CAMPUS_SETTINGS = [
  "Urban",
  "Suburban",
  "Small city",
  "College town",
  "Small town",
] as const;

/** Kyle's home state for residency calculations. */
export const HOME_STATE = "NJ";

const stateRegions = stateRegionsFile as Record<string, string>;

/**
 * Public + HOME_STATE → In-state; other Public → Out-of-state;
 * Private → Not applicable.
 */
export function getKyleResidency(
  control: SchoolControl | string,
  state: string,
): KyleResidency {
  if (control === "Private") return "Not applicable";
  if (control !== "Public") return "";
  const code = normalizeStateCode(state);
  if (!code) return "";
  return code === HOME_STATE ? "In-state" : "Out-of-state";
}

/** Admit rate that applies to Kyle given residency. */
export function getRateThatAppliesToKyle(record: {
  kyleResidency?: KyleResidency | string | null;
  inStateAdmitRate?: number | null;
  outOfStateAdmitRate?: number | null;
}): number | null {
  const residency = record.kyleResidency ?? "";
  if (residency === "In-state") {
    const rate = record.inStateAdmitRate;
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
  }
  if (residency === "Out-of-state") {
    const rate = record.outOfStateAdmitRate;
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
  }
  return null;
}

/**
 * Trip-planning region for a state code. Returns "Unassigned" when the
 * state is missing from data/state-regions.json.
 */
export function getRegion(state: string): string {
  const code = normalizeStateCode(state);
  if (!code) return "Unassigned";
  return stateRegions[code] ?? "Unassigned";
}

export type CampusSetting = (typeof CAMPUS_SETTINGS)[number];

/** School size label derived from undergrad enrollment. */
export const SCHOOL_SIZES = ["Small", "Medium", "Large", "Very large"] as const;
export type SchoolSize = (typeof SCHOOL_SIZES)[number];

/** Metro size label derived from Census metro population. */
export const METRO_TIERS = [
  "Major metro",
  "Large metro",
  "Mid-size metro",
  "Small metro",
] as const;
export type MetroTier = (typeof METRO_TIERS)[number];

/** Setting × metro pairs for the college-list Setting filter. */
export type SettingMetroCombo = {
  id: string;
  setting: CampusSetting;
  metro: MetroTier;
  label: string;
};

export const SETTING_METRO_COMBOS: SettingMetroCombo[] = CAMPUS_SETTINGS.flatMap((setting) =>
  METRO_TIERS.map((metro) => ({
    id: `${setting}::${metro}`,
    setting,
    metro,
    label: `${setting} · ${metro}`,
  })),
);

/** @deprecated Prefer SchoolSize — kept for size-gauge band typing. */
export type CampusSizeBand = SchoolSize;

/** Small under 8k · Medium 8k–19,999 · Large 20k–34,999 · Very large 35k+. */
export const SIZE_BANDS = [
  ["Small", 0, 8000],
  ["Medium", 8000, 20000],
  ["Large", 20000, 35000],
  ["Very large", 35000, Number.POSITIVE_INFINITY],
] as const;

export function isCampusSetting(value: string): value is CampusSetting {
  return (CAMPUS_SETTINGS as readonly string[]).includes(value);
}

export function getSchoolSize(
  undergradEnrollment: number | null | undefined,
): SchoolSize | null {
  if (undergradEnrollment == null || !Number.isFinite(undergradEnrollment)) return null;
  if (undergradEnrollment < 8000) return "Small";
  if (undergradEnrollment < 20000) return "Medium";
  if (undergradEnrollment < 35000) return "Large";
  return "Very large";
}

/** Alias used by the list-relative size gauge. */
export function sizeOf(n: number): SchoolSize {
  return getSchoolSize(n) ?? "Small";
}

export function getMetroTier(
  metroPopulation: number | null | undefined,
): MetroTier | null {
  if (metroPopulation == null || !Number.isFinite(metroPopulation)) return null;
  if (metroPopulation >= 4_000_000) return "Major metro";
  if (metroPopulation >= 1_500_000) return "Large metro";
  if (metroPopulation >= 500_000) return "Mid-size metro";
  return "Small metro";
}

/** Filled bars for the signal-style metro indicator (Major=4 … Small=1). */
export function metroTierBars(tier: MetroTier | null): number {
  if (tier === "Major metro") return 4;
  if (tier === "Large metro") return 3;
  if (tier === "Mid-size metro") return 2;
  if (tier === "Small metro") return 1;
  return 0;
}

export function formatUndergrads(n: number): string {
  return n.toLocaleString("en-US");
}

/** Glanceable undergrad count: nearest thousand at 10k+, nearest hundred below. */
export function formatUndergradsRounded(n: number): string {
  if (!Number.isFinite(n) || n < 0) return formatUndergrads(n);
  const step = n >= 10_000 ? 1000 : 100;
  const rounded = Math.round(n / step) * step;
  return formatUndergrads(rounded);
}

export function formatMetroPopulation(n: number): string {
  return n.toLocaleString("en-US");
}

/** Compact population for tooltips, e.g. "12.8 million people". */
export function formatMetroPopulationShort(n: number): string {
  if (n >= 1_000_000) {
    const millions = Math.round((n / 1_000_000) * 10) / 10;
    const label = Number.isInteger(millions) ? String(millions) : millions.toFixed(1);
    return `${label} million people`;
  }
  if (n >= 1000) {
    return `${Math.round(n / 1000).toLocaleString("en-US")} thousand people`;
  }
  return `${formatMetroPopulation(n)} people`;
}

export function formatSchoolSizeLabel(
  undergradEnrollment: number | null | undefined,
): string {
  if (undergradEnrollment == null || !Number.isFinite(undergradEnrollment)) return "";
  const size = getSchoolSize(undergradEnrollment);
  return size ? `${formatUndergrads(undergradEnrollment)} (${size})` : formatUndergrads(undergradEnrollment);
}

/** Sort order for campus setting type (Urban first → Small town last). */
export function campusSettingRank(setting: string): number {
  const index = (CAMPUS_SETTINGS as readonly string[]).indexOf(setting);
  return index >= 0 ? index : 99;
}

/**
 * CSS var for the Admissions headline. Matches the dashboard selectivity pie
 * (Less=1 … Extremely=4).
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
  bands: { name: SchoolSize; widthPct: number; on: boolean }[];
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
