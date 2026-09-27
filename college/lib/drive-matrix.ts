/**
 * Drive-time matrix between home, schools, and arrival airports.
 * Source: data/drive-matrix.json (one-time Google Routes pull).
 */

import matrixFile from "@/data/drive-matrix.json";
import travelPointsFile from "@/data/travel-points.json";

export type TravelPointType = "home" | "school" | "airport";

export type TravelPoint = {
  id: string;
  type: TravelPointType;
  name: string;
  address: string;
  regions?: string[];
};

export type DriveLeg = {
  minutes: number;
  miles: number;
};

export type DriveMatrixFile = {
  calculatedDate: string;
  origin: string;
  pairs: Record<string, DriveLeg | null>;
};

export type TravelMode = "Drive" | "Fly";

/** One-way home → school: Drive if at or under 8 hours. */
export const DRIVE_ONE_WAY_MAX_MINUTES = 8 * 60;

/**
 * Outer edge of a 3-day road-trip loop from home (Maplewood).
 * Schools farther than this one-way are always Fly.
 */
export const ROAD_TRIP_ONE_WAY_MAX_MINUTES = 10 * 60;

/** Total driving budget for home → schools → home over a 3-day weekend (~6 hr/day). */
export const ROAD_TRIP_LOOP_MAX_MINUTES = 18 * 60;

const matrix = matrixFile as DriveMatrixFile;
const baseTravelPoints = (travelPointsFile as { points: TravelPoint[] }).points;

/** Runtime overlay for schools added after the base JSON matrix. */
let extraTravelPoints: TravelPoint[] = [];
let extraPairs: Record<string, DriveLeg | null> = {};

/** Replace the runtime drive overlay (loaded from college.drive_pairs_extra). */
export function setDriveExtras(
  points: TravelPoint[],
  pairs: Record<string, DriveLeg | null>,
): void {
  extraTravelPoints = points;
  extraPairs = pairs;
}

export function getTravelPoints(): TravelPoint[] {
  if (!extraTravelPoints.length) return baseTravelPoints;
  const byId = new Map<string, TravelPoint>();
  for (const point of baseTravelPoints) byId.set(point.id, point);
  for (const point of extraTravelPoints) byId.set(point.id, point);
  return [...byId.values()];
}

export function travelPointById(id: string): TravelPoint | undefined {
  return getTravelPoints().find((p) => p.id === id);
}

export function schoolTravelPointId(schoolId: string): string {
  return `school:${schoolId}`;
}

export function drivePairKey(fromId: string, toId: string): string {
  return `${fromId}|${toId}`;
}

/** Directed drive leg, or null if missing / unavailable. */
export function driveLeg(fromId: string, toId: string): DriveLeg | null {
  if (fromId === toId) return { minutes: 0, miles: 0 };
  const key = drivePairKey(fromId, toId);
  if (Object.prototype.hasOwnProperty.call(extraPairs, key)) {
    return extraPairs[key] ?? null;
  }
  const cell = matrix.pairs[key];
  return cell ?? null;
}

export function driveMatrixMeta(): { calculatedDate: string; origin: string } {
  return { calculatedDate: matrix.calculatedDate, origin: matrix.origin };
}

export function travelModeForMinutes(minutes: number | null): TravelMode | "" {
  if (minutes == null || !Number.isFinite(minutes)) return "";
  return minutes <= DRIVE_ONE_WAY_MAX_MINUTES ? "Drive" : "Fly";
}

/**
 * True when the school is within an 8-hour drive, or still reachable as a
 * 3-day road-trip loop from home (solo round-trip or with nearby peers).
 */
export function fitsThreeDayRoadTripLoop(
  schoolId: string,
  peerSchoolIds: { id: string; name: string }[] = [],
): boolean {
  const toId = schoolTravelPointId(schoolId);
  const out = driveLeg("home", toId);
  if (!out) return false;
  if (out.minutes <= DRIVE_ONE_WAY_MAX_MINUTES) return true;
  if (out.minutes > ROAD_TRIP_ONE_WAY_MAX_MINUTES) return false;

  const back = driveLeg(toId, "home");
  const soloRound = out.minutes + (back?.minutes ?? out.minutes);
  if (soloRound <= ROAD_TRIP_LOOP_MAX_MINUTES) return true;

  const peers = nearestSchoolsFrom(
    schoolId,
    peerSchoolIds.filter((row) => row.id !== schoolId),
    2,
  ).filter((hit) => hit.minutes <= 4 * 60);

  for (let n = 0; n <= peers.length; n++) {
    const schoolIds = [schoolId, ...peers.slice(0, n).map((hit) => hit.schoolId)];
    const route = shortestSchoolOrder({
      startId: "home",
      endId: "home",
      schoolIds,
    });
    if (
      route &&
      !route.incomplete &&
      route.totalMinutes != null &&
      route.totalMinutes <= ROAD_TRIP_LOOP_MAX_MINUTES
    ) {
      return true;
    }
  }
  return false;
}

/** Drive vs Fly for a school, including 3-day loop upgrades past the 8-hour line. */
export function travelModeForSchool(
  schoolId: string,
  peerSchoolIds: { id: string; name: string }[] = [],
): TravelMode | "" {
  const leg = driveLeg("home", schoolTravelPointId(schoolId));
  if (!leg) return "";
  if (leg.minutes <= DRIVE_ONE_WAY_MAX_MINUTES) return "Drive";
  return fitsThreeDayRoadTripLoop(schoolId, peerSchoolIds) ? "Drive" : "Fly";
}

export function formatDriveDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/** List Travel cell / detail line. */
export function formatTravelLabel(
  minutes: number | null,
  miles: number | null,
  mode: TravelMode | "",
): string {
  if (minutes == null || miles == null || !mode) return "—";
  const drive = `${formatDriveDuration(minutes)} (${miles} mi)`;
  if (mode === "Drive") return drive;
  return `Fly (${formatDriveDuration(minutes)} drive)`;
}

export type SchoolDriveFields = {
  driveMinutes: number | null;
  driveMiles: number | null;
  travelMode: TravelMode | "";
  driveOrigin: string;
  driveCalculatedDate: string;
};

/** Fill home→school drive fields from the matrix (sole source). */
export function driveFieldsForSchool(
  schoolId: string,
  peerSchoolIds: { id: string; name: string }[] = [],
): SchoolDriveFields {
  const meta = driveMatrixMeta();
  const leg = driveLeg("home", schoolTravelPointId(schoolId));
  return {
    driveMinutes: leg?.minutes ?? null,
    driveMiles: leg?.miles ?? null,
    travelMode: travelModeForSchool(schoolId, peerSchoolIds),
    driveOrigin: meta.origin,
    driveCalculatedDate: meta.calculatedDate,
  };
}

export type NearestSchoolHit = {
  schoolId: string;
  name: string;
  minutes: number;
  miles: number;
};

/** Three closest other list schools by drive minutes from this school. */
export function nearestSchoolsFrom(
  schoolId: string,
  candidates: { id: string; name: string }[],
  limit = 3,
): NearestSchoolHit[] {
  const fromId = schoolTravelPointId(schoolId);
  const hits: NearestSchoolHit[] = [];
  for (const row of candidates) {
    if (row.id === schoolId) continue;
    const leg = driveLeg(fromId, schoolTravelPointId(row.id));
    if (!leg) continue;
    hits.push({
      schoolId: row.id,
      name: row.name,
      minutes: leg.minutes,
      miles: leg.miles,
    });
  }
  hits.sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name));
  return hits.slice(0, limit);
}

export function airportsForRegion(regionId: string): TravelPoint[] {
  return travelPoints.filter(
    (p) => p.type === "airport" && (p.regions ?? []).includes(regionId),
  );
}

export type RouteLeg = {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  minutes: number | null;
  miles: number | null;
  missing: boolean;
  longDrive: boolean;
};

export type PlannedRoute = {
  order: string[];
  legs: RouteLeg[];
  totalMinutes: number | null;
  totalMiles: number | null;
  schoolCount: number;
  incomplete: boolean;
};

function pointName(id: string, fallbackById: Map<string, string>): string {
  return travelPointById(id)?.name ?? fallbackById.get(id) ?? id;
}

/**
 * Held-Karp shortest path visiting every school once, fixed start and end.
 * `schoolIds` are school record ids (without the `school:` prefix).
 * Length must be ≤ 12. Returns null if more than 12.
 */
export function shortestSchoolOrder(opts: {
  startId: string;
  endId: string;
  schoolIds: string[];
  nameById?: Map<string, string>;
}): PlannedRoute | null {
  const schools = [...new Set(opts.schoolIds)].map((id) =>
    id.startsWith("school:") ? id : schoolTravelPointId(id),
  );
  if (schools.length === 0) {
    const leg = driveLeg(opts.startId, opts.endId);
    const names = opts.nameById ?? new Map();
    const missing = !leg && opts.startId !== opts.endId;
    return {
      order: opts.startId === opts.endId ? [opts.startId] : [opts.startId, opts.endId],
      legs:
        opts.startId === opts.endId
          ? []
          : [
              {
                fromId: opts.startId,
                toId: opts.endId,
                fromName: pointName(opts.startId, names),
                toName: pointName(opts.endId, names),
                minutes: leg?.minutes ?? null,
                miles: leg?.miles ?? null,
                missing,
                longDrive: (leg?.minutes ?? 0) > 300,
              },
            ],
      totalMinutes: missing ? null : (leg?.minutes ?? 0),
      totalMiles: missing ? null : (leg?.miles ?? 0),
      schoolCount: 0,
      incomplete: missing,
    };
  }
  if (schools.length > 12) return null;

  const n = schools.length;
  const INF = Number.POSITIVE_INFINITY;
  const cost = (a: string, b: string): number => {
    const leg = driveLeg(a, b);
    return leg ? leg.minutes : INF;
  };

  const size = 1 << n;
  const dp: number[][] = Array.from({ length: size }, () => Array(n).fill(INF));
  const parent: Array<Array<{ mask: number; j: number } | null>> = Array.from(
    { length: size },
    () => Array(n).fill(null),
  );

  for (let j = 0; j < n; j++) {
    dp[1 << j]![j] = cost(opts.startId, schools[j]!);
  }

  for (let mask = 1; mask < size; mask++) {
    for (let j = 0; j < n; j++) {
      if (!(mask & (1 << j))) continue;
      const prevMask = mask ^ (1 << j);
      if (prevMask === 0) continue;
      let best = INF;
      let bestI = -1;
      for (let i = 0; i < n; i++) {
        if (!(prevMask & (1 << i))) continue;
        const cand = dp[prevMask]![i]! + cost(schools[i]!, schools[j]!);
        if (cand < best) {
          best = cand;
          bestI = i;
        }
      }
      if (bestI >= 0) {
        dp[mask]![j] = best;
        parent[mask]![j] = { mask: prevMask, j: bestI };
      }
    }
  }

  const full = size - 1;
  let bestEnd = INF;
  let bestJ = -1;
  for (let j = 0; j < n; j++) {
    const cand = dp[full]![j]! + cost(schools[j]!, opts.endId);
    if (cand < bestEnd) {
      bestEnd = cand;
      bestJ = j;
    }
  }

  const schoolRecordIds = schools.map((id) =>
    id.startsWith("school:") ? id.slice("school:".length) : id,
  );

  if (bestJ < 0 || !Number.isFinite(bestEnd)) {
    return buildRouteFromOrder({
      startId: opts.startId,
      endId: opts.endId,
      schoolIds: schoolRecordIds,
      nameById: opts.nameById,
    });
  }

  const orderedPointIds: string[] = [];
  let mask = full;
  let j = bestJ;
  while (true) {
    orderedPointIds.push(schools[j]!);
    const p = parent[mask]![j];
    if (!p) break;
    mask = p.mask;
    j = p.j;
  }
  orderedPointIds.reverse();

  return buildRouteFromOrder({
    startId: opts.startId,
    endId: opts.endId,
    schoolIds: orderedPointIds.map((id) =>
      id.startsWith("school:") ? id.slice("school:".length) : id,
    ),
    nameById: opts.nameById,
  });
}

/** Build legs/totals for an explicit stop order (manual drag). School ids are record ids. */
export function buildRouteFromOrder(opts: {
  startId: string;
  endId: string;
  schoolIds: string[];
  nameById?: Map<string, string>;
}): PlannedRoute {
  const names = opts.nameById ?? new Map();
  const schoolPointIds = opts.schoolIds.map((id) =>
    id.startsWith("school:") ? id : schoolTravelPointId(id),
  );
  const order = [opts.startId, ...schoolPointIds];
  if (opts.endId !== order[order.length - 1]) order.push(opts.endId);

  const legs: RouteLeg[] = [];
  let totalMinutes = 0;
  let totalMiles = 0;
  let incomplete = false;

  for (let i = 0; i < order.length - 1; i++) {
    const fromId = order[i]!;
    const toId = order[i + 1]!;
    if (fromId === toId) continue;
    const leg = driveLeg(fromId, toId);
    const missing = !leg;
    if (missing) incomplete = true;
    else {
      totalMinutes += leg.minutes;
      totalMiles += leg.miles;
    }
    legs.push({
      fromId,
      toId,
      fromName: pointName(fromId, names),
      toName: pointName(toId, names),
      minutes: leg?.minutes ?? null,
      miles: leg?.miles ?? null,
      missing,
      longDrive: (leg?.minutes ?? 0) > 300,
    });
  }

  return {
    order,
    legs,
    totalMinutes: incomplete ? null : totalMinutes,
    totalMiles: incomplete ? null : totalMiles,
    schoolCount: opts.schoolIds.length,
    incomplete,
  };
}

/** Default start point id for a region plan. */
export function defaultTripStartId(regionId: string): string {
  if (regionId === "Northeast" || regionId === "Mid-Atlantic") return "home";
  const airports = airportsForRegion(regionId);
  return airports[0]?.id ?? "home";
}
