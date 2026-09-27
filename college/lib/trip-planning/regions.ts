/** State → Trip planning region. Assign by state, not map position. */

export type TripRegionId =
  | "Northeast"
  | "Mid-Atlantic"
  | "South"
  | "Midwest"
  | "Mountain"
  | "Texas"
  | "West Coast";

export type RegionLabelSide = "top" | "bottom" | "left" | "right";

export type TripRegionMeta = {
  id: TripRegionId;
  note: string;
  at: RegionLabelSide;
};

/** Region panel notes and hull label placement (from the trip-planning reference). */
export const TRIP_REGIONS: TripRegionMeta[] = [
  { id: "Northeast", note: "Drive from home", at: "top" },
  { id: "Mid-Atlantic", note: "Drive · 3 to 5 hr", at: "left" },
  { id: "South", note: "Drive ≤8 hr (UNC / NC State) · farther = Fly", at: "left" },
  { id: "Midwest", note: "Fly to Chicago or Detroit", at: "top" },
  { id: "Mountain", note: "Fly · Denver, Salt Lake City", at: "top" },
  { id: "Texas", note: "Fly to Austin · Houston is 2.5 hr away", at: "bottom" },
  { id: "West Coast", note: "Fly · LA and Seattle trips", at: "right" },
];

/** Exported for data/state-regions.json and add-school region helpers. */
export const STATE_TO_REGION: Record<string, TripRegionId> = {
  ME: "Northeast",
  NH: "Northeast",
  VT: "Northeast",
  MA: "Northeast",
  RI: "Northeast",
  CT: "Northeast",
  NY: "Northeast",
  NJ: "Northeast",
  PA: "Mid-Atlantic",
  DE: "Mid-Atlantic",
  MD: "Mid-Atlantic",
  DC: "Mid-Atlantic",
  VA: "Mid-Atlantic",
  WV: "Mid-Atlantic",
  NC: "South",
  SC: "South",
  GA: "South",
  FL: "South",
  AL: "South",
  MS: "South",
  TN: "South",
  KY: "South",
  LA: "South",
  AR: "South",
  OH: "Midwest",
  IN: "Midwest",
  IL: "Midwest",
  MI: "Midwest",
  WI: "Midwest",
  MN: "Midwest",
  IA: "Midwest",
  MO: "Midwest",
  ND: "Midwest",
  SD: "Midwest",
  NE: "Midwest",
  KS: "Midwest",
  MT: "Mountain",
  WY: "Mountain",
  CO: "Mountain",
  NM: "Mountain",
  ID: "Mountain",
  UT: "Mountain",
  AZ: "Mountain",
  NV: "Mountain",
  TX: "Texas",
  CA: "West Coast",
  OR: "West Coast",
  WA: "West Coast",
  AK: "West Coast",
  HI: "West Coast",
};

/** Normalize "NJ", "N.J.", "New Jersey" → two-letter code when possible. */
export function normalizeStateCode(state: string): string {
  const trimmed = state.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase().replace(/\./g, "");
  if (upper.length === 2) return upper;
  const NAME_TO_CODE: Record<string, string> = {
    MAINE: "ME",
    "NEW HAMPSHIRE": "NH",
    VERMONT: "VT",
    MASSACHUSETTS: "MA",
    "RHODE ISLAND": "RI",
    CONNECTICUT: "CT",
    "NEW YORK": "NY",
    "NEW JERSEY": "NJ",
    PENNSYLVANIA: "PA",
    DELAWARE: "DE",
    MARYLAND: "MD",
    "DISTRICT OF COLUMBIA": "DC",
    VIRGINIA: "VA",
    "WEST VIRGINIA": "WV",
    "NORTH CAROLINA": "NC",
    "SOUTH CAROLINA": "SC",
    GEORGIA: "GA",
    FLORIDA: "FL",
    ALABAMA: "AL",
    MISSISSIPPI: "MS",
    TENNESSEE: "TN",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    ARKANSAS: "AR",
    OHIO: "OH",
    INDIANA: "IN",
    ILLINOIS: "IL",
    MICHIGAN: "MI",
    WISCONSIN: "WI",
    MINNESOTA: "MN",
    IOWA: "IA",
    MISSOURI: "MO",
    "NORTH DAKOTA": "ND",
    "SOUTH DAKOTA": "SD",
    NEBRASKA: "NE",
    KANSAS: "KS",
    MONTANA: "MT",
    WYOMING: "WY",
    COLORADO: "CO",
    "NEW MEXICO": "NM",
    IDAHO: "ID",
    UTAH: "UT",
    ARIZONA: "AZ",
    NEVADA: "NV",
    TEXAS: "TX",
    CALIFORNIA: "CA",
    OREGON: "OR",
    WASHINGTON: "WA",
    ALASKA: "AK",
    HAWAII: "HI",
    OKLAHOMA: "OK",
  };
  return NAME_TO_CODE[upper] ?? upper.slice(0, 2);
}

export function regionForState(state: string): TripRegionId | null {
  const code = normalizeStateCode(state);
  return STATE_TO_REGION[code] ?? null;
}

export function regionForLocation(location: string): TripRegionId | null {
  const trimmed = location.trim();
  const comma = trimmed.lastIndexOf(",");
  if (comma === -1) return regionForState(trimmed);
  return regionForState(trimmed.slice(comma + 1).trim());
}
