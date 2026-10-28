import type { SkyType, SurfaceType } from "@/lib/weather/types";

export const WEIGHTS = {
  surface: 30,
  terrainOpen: 20,
  temperature: 15,
  recentSnow: 15,
  wind: 10,
  sky: 10,
} as const;

export const SURFACE_SCORES: Record<SurfaceType, number> = {
  powder: 100,
  "packed-powder": 85,
  "machine-groomed": 70,
  "frozen-granular": 45,
  "loose-granular": 40,
  "wet-snow": 30,
  icy: 15,
  unknown: 50,
};

export const TEMP_CURVE_F: [number, number][] = [
  [0, 0],
  [10, 60],
  [20, 100],
  [30, 100],
  [34, 60],
  [40, 0],
];

export const RECENT_SNOW_CURVE_IN: [number, number][] = [
  [0, 40],
  [2, 60],
  [6, 85],
  [12, 100],
];

export const WIND_CURVE_MPH: [number, number][] = [
  [0, 100],
  [10, 100],
  [20, 70],
  [30, 35],
  [40, 0],
];

export const SKY_SCORES: Record<SkyType, number> = {
  sunny: 100,
  "partly-cloudy": 85,
  overcast: 65,
  "light-snow": 70,
  "heavy-snow": 35,
  fog: 35,
  rain: 0,
};

export const GATES = {
  minTrailsOpenPct: 30,
  minLiftsOpen: 3,
  rainTempThresholdF: 36,
  rainMinHours: 3,
  maxSustainedWindMph: 40,
  minWindChillF: -25,
};

export const ADJUSTMENTS = {
  drivePenaltyPer15MinOver60: 2,
  saturdayPenalty: 8,
  holidayPenalty: 12,
  snowmakingBonus: 5,
  snowmakingTempThresholdF: 26,
};

export const HOLIDAY_DATES_2026_27 = [
  "2026-12-26",
  "2026-12-27",
  "2026-12-28",
  "2026-12-29",
  "2026-12-30",
  "2026-12-31",
  "2027-02-13",
  "2027-02-14",
  "2027-02-15",
];
