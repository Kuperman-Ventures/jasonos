/**
 * Nearby = campus radar: what else is around the school being viewed.
 */

import type { School } from "@/lib/types";
import {
  NEARBY_DRIVE_MAX_MINUTES,
  driveLeg,
  formatDriveDuration,
  getTravelPoints,
  schoolTravelPointId,
  schoolsWithinDriveMinutes,
  type NearestSchoolHit,
} from "@/lib/drive-matrix";
import { shortSchoolName } from "@/lib/visit-planning";
import {
  US_VISIT_AIRPORTS,
  type VisitAirport,
} from "@/lib/visit-airports";
import { haversineMiles, type GeoPoint } from "@/lib/visit-geo";

export type NearbyDriveBand = "here" | "under1h" | "1to2h" | "2to3h";

export type NearbySchoolRow = {
  schoolId: string;
  name: string;
  /** Null for the school being viewed. */
  minutes: number | null;
  miles: number | null;
  isBase: boolean;
  driveLabel: string;
  band: NearbyDriveBand;
  /** e.g. "Fits with Drexel the same day (~3 min)". */
  sameDayHint: string | null;
  /** In the travel matrix but not on the family list. */
  offList: boolean;
};

export type NearbyAirportRow = {
  iata: string;
  name: string;
  city: string;
  state: string;
  miles: number;
  lat: number;
  lng: number;
};

export type NearbyBandSection = {
  id: Exclude<NearbyDriveBand, "here">;
  label: string;
  maxMinutes: number;
  rows: NearbySchoolRow[];
};

/** Same-day pairing: peers within this drive of each other (or the hub). */
export const SAME_DAY_MAX_MINUTES = 75;

/** Local airports shown as campus context (not home → fly). */
export const NEARBY_AIRPORT_MAX_MILES = 75;
export const NEARBY_AIRPORT_LIMIT = 2;

export const NEARBY_BAND_DEFS: Array<{
  id: Exclude<NearbyDriveBand, "here">;
  label: string;
  maxMinutes: number;
}> = [
  { id: "under1h", label: "Under 1 hour", maxMinutes: 60 },
  { id: "1to2h", label: "1–2 hours", maxMinutes: 120 },
  { id: "2to3h", label: "2–3 hours", maxMinutes: 180 },
];

export function nearbyDriveBand(
  minutes: number | null,
  isBase: boolean,
): NearbyDriveBand {
  if (isBase || minutes == null) return "here";
  if (minutes <= 60) return "under1h";
  if (minutes <= 120) return "1to2h";
  return "2to3h";
}

export function buildNearbyDriveSchools(
  base: School,
  listSchools: School[],
  maxMinutes: number = NEARBY_DRIVE_MAX_MINUTES,
): NearbySchoolRow[] {
  const live = listSchools.filter((row) => !row.archived);
  const listIds = new Set(live.map((row) => row.id));
  const candidates = live.map((row) => ({ id: row.id, name: row.name }));
  const peers = schoolsWithinDriveMinutes(base.id, candidates, maxMinutes);
  const offList = offListMatrixPeers(base.id, listIds, maxMinutes);
  const rows: NearbySchoolRow[] = [
    {
      schoolId: base.id,
      name: base.name,
      minutes: null,
      miles: null,
      isBase: true,
      driveLabel: "Here",
      band: "here",
      sameDayHint: null,
      offList: false,
    },
    ...peers.map((hit) => nearbyRowFromHit(hit, false)),
    ...offList,
  ];
  rows.sort((a, b) => {
    if (a.isBase) return -1;
    if (b.isBase) return 1;
    const am = a.minutes ?? Number.POSITIVE_INFINITY;
    const bm = b.minutes ?? Number.POSITIVE_INFINITY;
    return am - bm || a.name.localeCompare(b.name);
  });
  return attachSameDayHints(rows);
}

function nearbyRowFromHit(hit: NearestSchoolHit, offList: boolean): NearbySchoolRow {
  return {
    schoolId: hit.schoolId,
    name: hit.name,
    minutes: hit.minutes,
    miles: hit.miles,
    isBase: false,
    driveLabel: formatDriveDuration(hit.minutes),
    band: nearbyDriveBand(hit.minutes, false),
    sameDayHint: null,
    offList,
  };
}

/** Matrix schools near the hub that are not on the live family list. */
function offListMatrixPeers(
  baseId: string,
  listIds: Set<string>,
  maxMinutes: number,
): NearbySchoolRow[] {
  const fromId = schoolTravelPointId(baseId);
  const hits: NearestSchoolHit[] = [];
  for (const point of getTravelPoints()) {
    if (point.type !== "school") continue;
    const schoolId = point.id.replace(/^school:/, "");
    if (!schoolId || schoolId === baseId || listIds.has(schoolId)) continue;
    const leg = driveLeg(fromId, point.id);
    if (!leg || leg.minutes > maxMinutes) continue;
    hits.push({
      schoolId,
      name: point.name,
      minutes: leg.minutes,
      miles: leg.miles,
    });
  }
  hits.sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name));
  return hits.map((hit) => nearbyRowFromHit(hit, true));
}

/**
 * For each peer, hint the closest other stop (hub or peer) within SAME_DAY_MAX.
 * Prefers another peer when both are near; otherwise pairs with the hub.
 */
export function attachSameDayHints(rows: NearbySchoolRow[]): NearbySchoolRow[] {
  const base = rows.find((row) => row.isBase);
  const peers = rows.filter((row) => !row.isBase);
  if (!base || !peers.length) return rows;

  return rows.map((row) => {
    if (row.isBase) return row;
    let bestId: string | null = null;
    let bestName: string | null = null;
    let bestMinutes = Number.POSITIVE_INFINITY;

    // Prefer another peer in the nearby set.
    for (const other of peers) {
      if (other.schoolId === row.schoolId) continue;
      const leg = driveLeg(
        schoolTravelPointId(row.schoolId),
        schoolTravelPointId(other.schoolId),
      );
      if (!leg || leg.minutes > SAME_DAY_MAX_MINUTES) continue;
      if (leg.minutes < bestMinutes) {
        bestMinutes = leg.minutes;
        bestId = other.schoolId;
        bestName = other.name;
      }
    }

    // Fall back to the hub when no peer is close enough.
    if (bestId == null) {
      const toHub = driveLeg(
        schoolTravelPointId(row.schoolId),
        schoolTravelPointId(base.schoolId),
      );
      if (toHub && toHub.minutes <= SAME_DAY_MAX_MINUTES) {
        bestMinutes = toHub.minutes;
        bestId = base.schoolId;
        bestName = base.name;
      }
    }

    if (bestId == null || bestName == null) {
      return { ...row, sameDayHint: null };
    }
    return {
      ...row,
      sameDayHint: `Fits with ${shortSchoolName(bestName)} the same day (~${formatDriveDuration(bestMinutes)})`,
    };
  });
}

export function groupNearbyByBand(rows: NearbySchoolRow[]): NearbyBandSection[] {
  return NEARBY_BAND_DEFS.map((def) => ({
    ...def,
    rows: rows.filter((row) => !row.isBase && row.band === def.id),
  })).filter((section) => section.rows.length > 0);
}

export function filterNearbyByMaxMinutes(
  rows: NearbySchoolRow[],
  maxMinutes: number,
): NearbySchoolRow[] {
  return rows.filter(
    (row) => row.isBase || (row.minutes != null && row.minutes <= maxMinutes),
  );
}

/** Closest passenger airports to the campus point (great-circle miles). */
export function nearbyAirportsForPoint(
  point: GeoPoint | null,
  opts: {
    maxMiles?: number;
    limit?: number;
    airports?: VisitAirport[];
  } = {},
): NearbyAirportRow[] {
  if (!point) return [];
  const maxMiles = opts.maxMiles ?? NEARBY_AIRPORT_MAX_MILES;
  const limit = opts.limit ?? NEARBY_AIRPORT_LIMIT;
  const airports = opts.airports ?? US_VISIT_AIRPORTS;
  return airports
    .map((airport) => ({
      iata: airport.iata,
      name: airport.name,
      city: airport.city,
      state: airport.state,
      miles: Math.max(1, Math.round(haversineMiles(point, airport))),
      lat: airport.lat,
      lng: airport.lng,
    }))
    .filter((row) => row.miles <= maxMiles)
    .sort((a, b) => a.miles - b.miles || a.iata.localeCompare(b.iata))
    .slice(0, limit);
}

export function nearbyPeerCount(rows: NearbySchoolRow[]): number {
  return rows.filter((row) => !row.isBase && !row.offList).length;
}

export function nearbyOffListCount(rows: NearbySchoolRow[]): number {
  return rows.filter((row) => row.offList).length;
}

export { NEARBY_DRIVE_MAX_MINUTES };
