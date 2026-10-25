import type { Resort } from "@/config/resorts";
import {
  ADJUSTMENTS,
  HOLIDAY_DATES_2026_27,
  RECENT_SNOW_CURVE_IN,
  SKY_SCORES,
  SURFACE_SCORES,
  TEMP_CURVE_F,
  WEIGHTS,
  WIND_CURVE_MPH,
} from "@/config/scoring";
import type { DayWeather, NwsAlert, ResortReport } from "@/lib/weather/types";
import { isSaturday } from "./calendar";
import { interpolate } from "./curves";
import { checkGates, type GateResult } from "./gates";

export type FactorScore = {
  key: keyof typeof WEIGHTS;
  label: string;
  raw: string;
  score: number;
  weight: number;
  weighted: number;
};

export type Adjustment = { label: string; points: number };

export type ScoredResort = {
  resort: Resort;
  date: string;
  gate: GateResult;
  factors: FactorScore[];
  rawScore: number;
  adjustments: Adjustment[];
  finalScore: number;
  weather: DayWeather;
  report: ResortReport;
  alerts: NwsAlert[];
};

export type RankPayload = {
  date: string;
  generatedAt: string;
  home: { label: string; lat: number; lon: number };
  results: ScoredResort[];
  errors: { resortId: string; message: string }[];
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function oneDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatDriveCompact(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h${mins}m`;
}

export function formatDriveSpaced(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function factor(
  key: FactorScore["key"],
  label: string,
  raw: string,
  score: number,
  weight: number
): FactorScore {
  return { key, label, raw, score, weight, weighted: (score * weight) / 100 };
}

export function scoreResort(
  resort: Resort,
  date: string,
  weather: DayWeather,
  report: ResortReport,
  alerts: NwsAlert[] = []
): ScoredResort {
  const factors: FactorScore[] = [
    factor("surface", "Surface", report.surface, SURFACE_SCORES[report.surface], WEIGHTS.surface),
    factor(
      "terrainOpen",
      "Terrain open",
      `${oneDecimal(report.trailsOpenPct)}% of trails`,
      clamp(report.trailsOpenPct, 0, 100),
      WEIGHTS.terrainOpen
    ),
    factor(
      "temperature",
      "Temperature",
      `High ${Math.round(weather.highF)}°F`,
      interpolate(TEMP_CURVE_F, weather.highF),
      WEIGHTS.temperature
    ),
    factor(
      "recentSnow",
      "Recent snow",
      `${oneDecimal(weather.snowfallLast72hIn)} in / 72h`,
      interpolate(RECENT_SNOW_CURVE_IN, weather.snowfallLast72hIn),
      WEIGHTS.recentSnow
    ),
    factor(
      "wind",
      "Wind",
      `${Math.round(weather.windSustainedMph)} mph`,
      interpolate(WIND_CURVE_MPH, weather.windSustainedMph),
      WEIGHTS.wind
    ),
    factor("sky", "Sky", weather.sky, SKY_SCORES[weather.sky], WEIGHTS.sky),
  ];

  const rawScore = factors.reduce((sum, item) => sum + item.weighted, 0);
  const adjustments: Adjustment[] = [];
  const driveBlocks = Math.max(0, Math.ceil((resort.driveMinutesFromHome - 60) / 15));
  adjustments.push({
    label: `Drive ${formatDriveCompact(resort.driveMinutesFromHome)}`,
    points: -ADJUSTMENTS.drivePenaltyPer15MinOver60 * driveBlocks,
  });

  const holiday = HOLIDAY_DATES_2026_27.includes(date);
  if (holiday) {
    adjustments.push({ label: "Holiday crowd", points: -ADJUSTMENTS.holidayPenalty });
  } else if (isSaturday(date)) {
    adjustments.push({ label: "Saturday crowd", points: -ADJUSTMENTS.saturdayPenalty });
  }

  if (weather.lowF < ADJUSTMENTS.snowmakingTempThresholdF && report.snowmakingActive) {
    adjustments.push({ label: "Snowmaking overnight", points: ADJUSTMENTS.snowmakingBonus });
  }

  const adjustmentSum = adjustments.reduce((sum, item) => sum + item.points, 0);
  return {
    resort,
    date,
    gate: checkGates(resort, date, weather, report),
    factors,
    rawScore,
    adjustments,
    finalScore: clamp(rawScore + adjustmentSum, 0, 100),
    weather,
    report,
    alerts,
  };
}

export function rankResorts(scored: ScoredResort[]): ScoredResort[] {
  const open = scored.filter((item) => !item.gate.gated);
  const gated = scored.filter((item) => item.gate.gated);
  open.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
    return a.resort.driveMinutesFromHome - b.resort.driveMinutesFromHome;
  });
  gated.sort((a, b) => a.resort.name.localeCompare(b.resort.name));
  return [...open, ...gated];
}
