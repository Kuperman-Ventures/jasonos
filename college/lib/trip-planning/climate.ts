/**
 * Climate normals for Trip planning Climate sub-tab.
 *
 * Arrays are Jan→Dec. Display order in the UI is Aug→Jul.
 * City keys use NOAA 1991–2020 anchors (Jan/Jul high·low, annual precip/snow)
 * from the college-list climate update, expanded to monthly curves.
 *
 * Important: unknown cities must NOT fall through to a SoCal stub — that made
 * Cornell (Ithaca) look warmer than Maplewood in winter.
 */

export type ClimateNormals = {
  id: string;
  name: string;
  label: string;
  city: string;
  /** Monthly average high °F, Jan–Dec. */
  hi: number[];
  /** Monthly average low °F, Jan–Dec. */
  lo: number[];
  /** Monthly precip inches, Jan–Dec. */
  precip: number[];
  /** Monthly snow inches, Jan–Dec. */
  snow: number[];
};

/** Display months Aug → Jul (school year first). Index into Jan–Dec arrays. */
export const CLIMATE_DISPLAY_MONTHS = [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6] as const;

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const OFF_SEASON = new Set([5, 6, 7]); // Jun, Jul, Aug

export function isOffSeasonMonth(monthIndex: number): boolean {
  return OFF_SEASON.has(monthIndex);
}

type CityNormals = Omit<ClimateNormals, "id" | "name" | "label" | "city">;

type Anchors = {
  janHi: number;
  janLo: number;
  julHi: number;
  julLo: number;
  precipIn: number;
  snowIn: number | null;
};

/** Cosine seasonal blend: Jan = 0 (cold), Jul = 1 (warm). */
function seasonFactor(monthIndex: number): number {
  return (1 - Math.cos((monthIndex * Math.PI) / 6)) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Build 12 monthly series from Jan/Jul temps + annual precip/snow.
 * Snow is concentrated Nov–Mar; precip is nearly even with a slight cool-season bump.
 */
export function monthlyFromAnchors(a: Anchors): CityNormals {
  const hi: number[] = [];
  const lo: number[] = [];
  for (let m = 0; m < 12; m++) {
    const f = seasonFactor(m);
    hi.push(Math.round(a.janHi + (a.julHi - a.janHi) * f));
    lo.push(Math.round(a.janLo + (a.julLo - a.janLo) * f));
  }

  // Cool-season bump for precip (weights sum ≈ 12).
  const precipW = [1.05, 0.95, 1.1, 1.0, 1.05, 1.0, 1.05, 0.95, 1.0, 0.95, 0.95, 1.0];
  const pSum = precipW.reduce((x, y) => x + y, 0);
  const precip = precipW.map((w) => round1((a.precipIn * w) / pSum));

  let snow: number[];
  if (a.snowIn == null || a.snowIn <= 0) {
    snow = Array(12).fill(0);
  } else {
    // Typical Northeast / Midwest snow season weights.
    const snowW = [0.2, 0.2, 0.14, 0.03, 0, 0, 0, 0, 0, 0.02, 0.1, 0.16];
    const sSum = snowW.reduce((x, y) => x + y, 0);
    snow = snowW.map((w) => round1((a.snowIn! * w) / sSum));
  }

  return { hi, lo, precip, snow };
}

export const HOME_CLIMATE: ClimateNormals = {
  id: "home",
  name: "Home",
  label: "Home",
  city: "Maplewood, NJ",
  hi: [40, 43, 51, 63, 73, 82, 87, 85, 78, 66, 55, 44],
  lo: [26, 28, 34, 44, 54, 64, 70, 68, 61, 49, 39, 31],
  precip: [3.5, 3.0, 4.2, 3.9, 4.0, 4.2, 4.6, 4.0, 4.0, 3.6, 3.5, 4.1],
  snow: [9, 9, 5, 0.5, 0, 0, 0, 0, 0, 0, 0.5, 5],
};

export const MAPLEWOOD_CLIMATE: ClimateNormals = {
  ...HOME_CLIMATE,
  id: "maplewood",
  name: "Maplewood",
  label: "Maplewood",
};

export const BOSTON_CLIMATE: ClimateNormals = {
  id: "boston",
  name: "Boston",
  label: "Boston",
  city: "Boston, MA",
  hi: [37, 39, 46, 57, 67, 77, 82, 81, 73, 62, 52, 42],
  lo: [23, 25, 31, 41, 50, 60, 66, 65, 58, 47, 38, 29],
  precip: [3.4, 3.3, 4.3, 3.7, 3.5, 3.9, 3.4, 3.4, 3.4, 3.9, 3.9, 4.0],
  snow: [13, 13, 8, 2, 0, 0, 0, 0, 0, 0, 1, 9],
};

/** NOAA 1991–2020 anchors by city|state (from college-list climate update). */
const CITY_ANCHORS: Record<string, Anchors> = {
  "ames|ia": { janHi: 29, janLo: 11, julHi: 84, julLo: 63, precipIn: 35.9, snowIn: 32.7 },
  "ann arbor|mi": { janHi: 32, janLo: 16, julHi: 84, julLo: 60, precipIn: 38.3, snowIn: 61.4 },
  "atlanta|ga": { janHi: 54, janLo: 34, julHi: 90, julLo: 70, precipIn: 48.1, snowIn: 0.5 },
  "austin|tx": { janHi: 62, janLo: 42, julHi: 97, julLo: 75, precipIn: 36.2, snowIn: 0.2 },
  "baltimore|md": { janHi: 44, janLo: 30, julHi: 90, julLo: 73, precipIn: 43.7, snowIn: 19.3 },
  "berkeley|ca": { janHi: 59, janLo: 43, julHi: 74, julLo: 53, precipIn: 26.1, snowIn: 0 },
  "bethlehem|pa": { janHi: 38, janLo: 22, julHi: 86, julLo: 65, precipIn: 47.4, snowIn: 33.1 },
  "blacksburg|va": { janHi: 42, janLo: 22, julHi: 82, julLo: 61, precipIn: 42.6, snowIn: 24.7 },
  "cambridge|ma": { janHi: 37, janLo: 19, julHi: 85, julLo: 64, precipIn: 49.4, snowIn: 49.2 },
  "champaign-urbana|il": { janHi: 34, janLo: 18, julHi: 85, julLo: 65, precipIn: 40.9, snowIn: 20.8 },
  "charlottesville|va": { janHi: 45, janLo: 28, julHi: 87, julLo: 68, precipIn: 48.5, snowIn: 17 },
  "clemson|sc": { janHi: 53, janLo: 32, julHi: 91, julLo: 68, precipIn: 52.4, snowIn: 2.2 },
  "cleveland|oh": { janHi: 35, janLo: 24, julHi: 81, julLo: 68, precipIn: 33.3, snowIn: 63.8 },
  "college park|md": { janHi: 43, janLo: 25, julHi: 87, julLo: 68, precipIn: 44, snowIn: 15.8 },
  "college station|tx": { janHi: 62, janLo: 41, julHi: 95, julLo: 75, precipIn: 41.8, snowIn: 0 },
  "columbus|oh": { janHi: 36, janLo: 21, julHi: 85, julLo: 65, precipIn: 44.7, snowIn: 28.2 },
  "davis|ca": { janHi: 56, janLo: 38, julHi: 93, julLo: 57, precipIn: 19.2, snowIn: 0 },
  "evanston|il": { janHi: 32, janLo: 16, julHi: 84, julLo: 63, precipIn: 39.5, snowIn: 33.6 },
  "gainesville|fl": { janHi: 67, janLo: 43, julHi: 91, julLo: 72, precipIn: 48.3, snowIn: 0 },
  "golden|co": { janHi: 45, janLo: 23, julHi: 87, julLo: 61, precipIn: 18.7, snowIn: 62.5 },
  "hoboken|nj": { janHi: 40, janLo: 26, julHi: 85, julLo: 68, precipIn: 46, snowIn: 25 },
  "houghton|mi": { janHi: 24, janLo: 9, julHi: 77, julLo: 51, precipIn: 31.6, snowIn: 180 },
  "irvine|ca": { janHi: 67, janLo: 49, julHi: 79, julLo: 66, precipIn: 11.2, snowIn: 0 },
  // Cornell — Ithaca Cornell Univ station (USC00304174)
  "ithaca|ny": { janHi: 31, janLo: 15, julHi: 80, julLo: 58, precipIn: 38.3, snowIn: 62.9 },
  "knoxville|tn": { janHi: 48, janLo: 26, julHi: 88, julLo: 66, precipIn: 55.8, snowIn: 4.6 },
  "los angeles|ca": { janHi: 68, janLo: 52, julHi: 77, julLo: 62, precipIn: 17.7, snowIn: 0 },
  "madison|wi": { janHi: 28, janLo: 11, julHi: 82, julLo: 61, precipIn: 40.2, snowIn: 38.5 },
  "minneapolis|mn": { janHi: 22, janLo: 8, julHi: 83, julLo: 64, precipIn: 34.4, snowIn: 40.4 },
  "new brunswick|nj": { janHi: 40, janLo: 23, julHi: 86, julLo: 66, precipIn: 49.5, snowIn: 29 },
  "newark|de": { janHi: 42, janLo: 25, julHi: 89, julLo: 66, precipIn: 47, snowIn: 20.2 },
  "newark|nj": { janHi: 40, janLo: 24, julHi: 86, julLo: 68, precipIn: 46, snowIn: 28 },
  "philadelphia|pa": { janHi: 42, janLo: 28, julHi: 89, julLo: 71, precipIn: 50.7, snowIn: 16.1 },
  "pittsburgh|pa": { janHi: 38, janLo: 22, julHi: 84, julLo: 64, precipIn: 40.6, snowIn: 25 },
  "poughkeepsie|ny": { janHi: 35, janLo: 17, julHi: 84, julLo: 63, precipIn: 44, snowIn: 40 },
  "raleigh|nc": { janHi: 52, janLo: 32, julHi: 91, julLo: 70, precipIn: 49.4, snowIn: 4.5 },
  "seattle|wa": { janHi: 47, janLo: 37, julHi: 76, julLo: 56, precipIn: 37.8, snowIn: 3.8 },
  "stanford|ca": { janHi: 58, janLo: 39, julHi: 79, julLo: 56, precipIn: 15.1, snowIn: 0 },
  "storrs|ct": { janHi: 35, janLo: 19, julHi: 80, julLo: 63, precipIn: 49.3, snowIn: 39 },
  "terre haute|in": { janHi: 36, janLo: 19, julHi: 86, julLo: 65, precipIn: 42, snowIn: 18 },
  "troy|ny": { janHi: 34, janLo: 17, julHi: 86, julLo: 64, precipIn: 42.1, snowIn: 59.2 },
  "university park|pa": { janHi: 34, janLo: 20, julHi: 81, julLo: 63, precipIn: 41.5, snowIn: 43.8 },
  "west lafayette|in": { janHi: 33, janLo: 18, julHi: 84, julLo: 63, precipIn: 37, snowIn: 18.9 },
  "worcester|ma": { janHi: 33, janLo: 17, julHi: 80, julLo: 61, precipIn: 48, snowIn: 72.9 },
  "maplewood|nj": { janHi: 40, janLo: 26, julHi: 87, julLo: 70, precipIn: 46.6, snowIn: 28 },
  "boston|ma": { janHi: 37, janLo: 23, julHi: 82, julLo: 66, precipIn: 43.8, snowIn: 46 },
};

const CITY_CLIMATE: Record<string, CityNormals> = Object.fromEntries(
  Object.entries(CITY_ANCHORS).map(([key, anchors]) => [key, monthlyFromAnchors(anchors)]),
);

// Prefer the hand-tuned Maplewood / Boston series for compare controls.
CITY_CLIMATE["maplewood|nj"] = {
  hi: HOME_CLIMATE.hi,
  lo: HOME_CLIMATE.lo,
  precip: HOME_CLIMATE.precip,
  snow: HOME_CLIMATE.snow,
};
CITY_CLIMATE["boston|ma"] = {
  hi: BOSTON_CLIMATE.hi,
  lo: BOSTON_CLIMATE.lo,
  precip: BOSTON_CLIMATE.precip,
  snow: BOSTON_CLIMATE.snow,
};

function cityKey(city: string, state: string): string {
  return `${city.trim().toLowerCase()}|${state.trim().toLowerCase()}`;
}

function monthOfExtreme(hi: number[], pick: "min" | "max"): { value: number; month: string } {
  let idx = 0;
  let value = hi[0]!;
  for (let i = 1; i < hi.length; i++) {
    const v = hi[i]!;
    if (pick === "min" ? v < value : v > value) {
      value = v;
      idx = i;
    }
  }
  return { value, month: MONTH_LABELS[idx]! };
}

export function annualPrecip(c: Pick<ClimateNormals, "precip">): number {
  return Math.round(c.precip.reduce((a, b) => a + b, 0));
}

export function annualSnow(c: Pick<ClimateNormals, "snow">): number {
  return Math.round(c.snow.reduce((a, b) => a + b, 0));
}

/** Body text after "{Name}:" — do not include the name (UI prints it once). */
export function climateSchoolSummaryBody(c: ClimateNormals): string {
  const cold = monthOfExtreme(c.hi, "min");
  const warm = monthOfExtreme(c.hi, "max");
  const rain = annualPrecip(c);
  const snow = annualSnow(c);
  const snowBit = snow < 1 ? "no snow" : `${snow} in. of snow`;
  return `Highs run from ${cold.value}° in ${cold.month} to ${warm.value}° in ${warm.month}. About ${rain} in. of rain and ${snowBit} a year.`;
}

export function climateCompareSummaryBody(
  compare: ClimateNormals,
  campus: ClimateNormals,
  campusShort: string,
): string {
  const cold = monthOfExtreme(compare.hi, "min");
  const warm = monthOfExtreme(compare.hi, "max");
  const snow = annualSnow(compare);
  const campusSnow = annualSnow(campus);
  const delta = snow - campusSnow;
  const vs =
    delta === 0
      ? `the same as ${campusShort}`
      : `${Math.abs(delta)} in. ${delta > 0 ? "more" : "less"} than ${campusShort}`;
  return `Highs from ${cold.value}° to ${warm.value}°. About ${snow} in. of snow a year, ${vs}.`;
}

/** @deprecated Prefer climateSchoolSummaryBody */
export function summarizeClimate(
  name: string,
  hi: number[],
  precip: number[],
  snow: number[],
): string {
  const stub: ClimateNormals = {
    id: "x",
    name,
    label: name,
    city: name,
    hi,
    lo: hi.map((h) => h - 15),
    precip,
    snow,
  };
  return `${name}: ${climateSchoolSummaryBody(stub)}`;
}

export function climateForCityState(
  id: string,
  name: string,
  city: string,
  state: string,
): ClimateNormals {
  const key = cityKey(city, state);
  const hit = CITY_CLIMATE[key];
  // Fallback: Maplewood-like mid-Atlantic, never SoCal mild coastal.
  const base =
    hit ??
    monthlyFromAnchors({
      janHi: 40,
      janLo: 24,
      julHi: 86,
      julLo: 66,
      precipIn: 44,
      snowIn: 22,
    });
  const label = city && state ? `${city}, ${state}` : name;
  return {
    id,
    name,
    label,
    city: label,
    hi: [...base.hi],
    lo: [...base.lo],
    precip: [...base.precip],
    snow: [...base.snow],
  };
}

export function climateCompareOptions(): { id: string; label: string }[] {
  return [
    { id: "none", label: "None" },
    { id: "home", label: "Home" },
    { id: "maplewood", label: "Maplewood" },
    { id: "boston", label: "Boston" },
  ];
}

export function resolveCompareClimate(cmpId: string): ClimateNormals | null {
  if (cmpId === "home") return HOME_CLIMATE;
  if (cmpId === "maplewood") return MAPLEWOOD_CLIMATE;
  if (cmpId === "boston") return BOSTON_CLIMATE;
  return null;
}

/** True when we have a dedicated city key (not the generic fallback). */
export function hasCityClimate(city: string, state: string): boolean {
  return cityKey(city, state) in CITY_CLIMATE;
}
