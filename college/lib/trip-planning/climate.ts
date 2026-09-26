/**
 * Climate normals stubs for Trip planning Climate sub-tab.
 * Arrays are Jan→Dec. Display order in the UI is Aug→Jul.
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
  summary: string;
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

export const HOME_CLIMATE: ClimateNormals = {
  id: "home",
  name: "Home",
  label: "Home · Maplewood",
  city: "Maplewood, NJ",
  hi: [40, 43, 51, 63, 73, 82, 87, 85, 78, 66, 55, 44],
  lo: [26, 28, 34, 44, 54, 64, 70, 68, 61, 49, 39, 31],
  precip: [3.5, 3.0, 4.2, 3.9, 4.0, 4.2, 4.6, 4.0, 4.0, 3.6, 3.5, 4.1],
  snow: [9, 9, 5, 0.5, 0, 0, 0, 0, 0, 0, 0.5, 5],
  summary:
    "Winter highs near 40°F and about 28 in. of snow a year. Campus visits farther south or west feel warmer in January.",
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
  summary:
    "Colder than home, with about 46 in. of snow from December to March. That covers most of the spring semester.",
};

/** Mild coastal / SoCal-style stub used when we lack a city match. */
const MILD_COASTAL: Omit<ClimateNormals, "id" | "name" | "label" | "city"> = {
  hi: [68, 67, 68, 70, 71, 74, 78, 80, 79, 76, 72, 67],
  lo: [50, 51, 52, 54, 57, 60, 63, 64, 63, 59, 53, 49],
  precip: [3.3, 3.8, 2.4, 0.8, 0.3, 0.1, 0, 0, 0.2, 0.6, 1.1, 2.3],
  snow: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  summary:
    "Mild all year. Highs stay between 67° and 80°F, rain falls mostly December to March, and it never snows.",
};

const CITY_CLIMATE: Record<string, Omit<ClimateNormals, "id" | "name" | "label" | "city">> = {
  "maplewood|nj": {
    hi: HOME_CLIMATE.hi,
    lo: HOME_CLIMATE.lo,
    precip: HOME_CLIMATE.precip,
    snow: HOME_CLIMATE.snow,
    summary: HOME_CLIMATE.summary,
  },
  "boston|ma": {
    hi: BOSTON_CLIMATE.hi,
    lo: BOSTON_CLIMATE.lo,
    precip: BOSTON_CLIMATE.precip,
    snow: BOSTON_CLIMATE.snow,
    summary: BOSTON_CLIMATE.summary,
  },
  "los angeles|ca": MILD_COASTAL,
  "westwood|ca": MILD_COASTAL,
  "pasadena|ca": MILD_COASTAL,
  "claremont|ca": MILD_COASTAL,
  "irvine|ca": MILD_COASTAL,
  "san diego|ca": {
    ...MILD_COASTAL,
    hi: [65, 65, 66, 68, 69, 71, 75, 77, 76, 73, 69, 65],
    lo: [49, 50, 53, 56, 59, 62, 65, 67, 65, 60, 53, 48],
    summary:
      "Cool coastal highs year-round. Rain is light and mostly winter; snow never falls on campus.",
  },
  "santa barbara|ca": MILD_COASTAL,
  "atlanta|ga": {
    hi: [52, 57, 64, 72, 79, 86, 89, 88, 82, 73, 63, 54],
    lo: [34, 37, 44, 51, 60, 68, 71, 70, 64, 53, 43, 36],
    precip: [4.2, 4.7, 4.8, 3.4, 3.7, 3.9, 5.2, 3.9, 3.6, 3.1, 3.8, 3.9],
    snow: [1, 0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0.5],
    summary:
      "Warm summers near 90°F and mild winters. Light snow is rare; rain is steady most months.",
  },
  "chicago|il": {
    hi: [32, 36, 47, 59, 70, 80, 84, 82, 75, 62, 48, 36],
    lo: [18, 22, 31, 41, 51, 61, 66, 65, 57, 45, 34, 23],
    precip: [2.1, 1.9, 2.5, 3.4, 3.7, 3.5, 3.5, 3.9, 3.2, 3.1, 2.8, 2.3],
    snow: [11, 9, 6, 1, 0, 0, 0, 0, 0, 0.5, 2, 8],
    summary:
      "Cold winters with about 37 in. of snow and humid summers near 84°F. Spring warms quickly after March.",
  },
  "austin|tx": {
    hi: [62, 66, 73, 80, 86, 92, 96, 97, 90, 82, 71, 64],
    lo: [42, 45, 52, 59, 67, 72, 74, 74, 69, 60, 50, 43],
    precip: [2.2, 2.0, 2.7, 2.1, 4.3, 4.3, 1.9, 2.2, 3.0, 3.9, 2.9, 2.4],
    snow: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    summary:
      "Hot summers near 97°F and mild winters. Rain peaks in spring; it almost never snows.",
  },
  "boulder|co": {
    hi: [46, 48, 56, 63, 72, 82, 88, 86, 78, 66, 53, 45],
    lo: [22, 23, 29, 35, 44, 51, 57, 55, 47, 36, 27, 21],
    precip: [0.7, 0.8, 1.8, 2.5, 2.8, 2.0, 1.8, 1.6, 1.5, 1.3, 1.0, 0.8],
    snow: [9, 8, 12, 9, 1, 0, 0, 0, 1, 4, 8, 9],
    summary:
      "Sunny and dry with big day–night swings. Winters bring about 50 in. of snow; summers are warm and clear.",
  },
  "seattle|wa": {
    hi: [47, 50, 54, 58, 65, 70, 76, 76, 70, 60, 51, 46],
    lo: [37, 37, 39, 42, 48, 52, 56, 56, 52, 46, 40, 36],
    precip: [5.6, 3.5, 3.8, 2.8, 2.0, 1.5, 0.8, 1.0, 1.6, 3.5, 6.0, 5.4],
    snow: [1, 1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0.5, 1],
    summary:
      "Cool and rainy October–March. Summers stay mild near 76°F with little snow on campus.",
  },
};

function cityKey(city: string, state: string): string {
  return `${city.trim().toLowerCase()}|${state.trim().toLowerCase()}`;
}

export function summarizeClimate(
  name: string,
  hi: number[],
  precip: number[],
  snow: number[],
): string {
  const warmest = Math.max(...hi);
  const coldest = Math.min(...hi);
  const snowTotal = snow.reduce((a, b) => a + b, 0);
  const rainyMonths = precip
    .map((inches, i) => ({ inches, i }))
    .filter((row) => row.inches >= 3.5)
    .map((row) => MONTH_LABELS[row.i]);
  const rainBit =
    rainyMonths.length > 0
      ? ` Rain is heaviest ${rainyMonths.slice(0, 3).join(", ")}.`
      : "";
  const snowBit =
    snowTotal >= 1
      ? ` About ${Math.round(snowTotal)} in. of snow a year.`
      : " It rarely snows.";
  return `${name}: highs range from ${coldest}° to ${warmest}°F.${rainBit}${snowBit}`;
}

export function climateForCityState(
  id: string,
  name: string,
  city: string,
  state: string,
): ClimateNormals {
  const hit = CITY_CLIMATE[cityKey(city, state)];
  const base = hit ?? MILD_COASTAL;
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
    summary: hit?.summary ?? summarizeClimate(name, base.hi, base.precip, base.snow),
  };
}

export function climateCompareOptions(campus: ClimateNormals): {
  id: string;
  label: string;
}[] {
  return [
    { id: "none", label: "None" },
    { id: "home", label: HOME_CLIMATE.label },
    { id: "boston", label: BOSTON_CLIMATE.label },
  ];
}

export function resolveCompareClimate(cmpId: string): ClimateNormals | null {
  if (cmpId === "home") return HOME_CLIMATE;
  if (cmpId === "boston") return BOSTON_CLIMATE;
  return null;
}
