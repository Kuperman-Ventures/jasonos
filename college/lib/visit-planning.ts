/**
 * Visit planning: cluster list schools around the school being viewed.
 * Trip membership is per-school; drive legs and order come from the stored
 * Google Routes matrix (data/drive-matrix.json) via Held-Karp.
 */

import { interestRank, type InterestLevel, type School } from "@/lib/types";
import { listPhaseById, type ListPhaseId } from "@/lib/list-phases";
import {
  airportsForRegion,
  buildRouteFromOrder,
  defaultTripStartId,
  driveLeg,
  formatDriveDuration,
  schoolTravelPointId,
  shortestSchoolOrder,
  travelPointById,
  type PlannedRoute,
  type RouteLeg,
} from "@/lib/drive-matrix";
import { regionForLocation } from "@/lib/trip-planning/regions";
import type { DriveEstimate } from "@/lib/visit-geo";

export type VisitInterestKey = "top" | "high" | "moderate" | "safety" | "none";

export const VISIT_FILTER_LEVELS: VisitInterestKey[] = [
  "top",
  "high",
  "moderate",
  "safety",
  "none",
];

export type VisitInterestFilter = Record<VisitInterestKey, boolean>;

export type VisitStop = {
  schoolId: string;
  /** Label between this stop and the previous one (e.g. "25 min"). */
  driveFromPrev: string | null;
  /** True when the leg into this stop is over 5 hours. */
  longDrive?: boolean;
};

export type VisitLongDriveWarning = {
  fromName: string;
  toName: string;
  minutes: number;
};

export type VisitTripPlan = {
  /** Selected schools in visiting order (Held-Karp). */
  orderedIds: string[];
  /** Chain legs for the full trip (same order as orderedIds). */
  stops: VisitStop[];
  /** Day columns for the draft itinerary. */
  days: VisitSlot[][];
  /** Total estimated drive minutes across the full route (start→schools→end). */
  totalDriveMinutes: number;
  totalMiles: number | null;
  longDriveLegs: VisitLongDriveWarning[];
  tooMany: boolean;
  incomplete: boolean;
  startId: string;
  endId: string;
  /** Full matrix route including start/end travel points. */
  route: PlannedRoute | null;
};

export type VisitSlot = {
  time: string;
  schoolId: string | null;
  title: string;
  sub?: string;
  icon?: "car" | "meal";
  longDrive?: boolean;
};

export type VisitCluster = {
  id: "same" | "plus1" | "long";
  name: string;
  sub: string;
  days: number;
  stops: VisitStop[];
  note: string;
  plan: VisitSlot[][];
};

export type VisitTripMeta = {
  name: string;
  window: string;
  /** YYYY-MM-DD suggested start */
  start: string;
};

export type ParsedLocation = {
  city: string;
  state: string;
  label: string;
};

export type MapRoutePart = {
  label: string;
  googleUrl: string;
  appleUrl: string;
};

const INTEREST_CHIP_LABEL: Record<VisitInterestKey, string> = {
  top: "Top choice",
  high: "High interest",
  moderate: "Moderate interest",
  safety: "Safety / backup",
  none: "Not on list",
};

export const VISIT_FILTER_STORAGE_KEY = "track-visit-interest-filter";

export function defaultVisitInterestFilter(): VisitInterestFilter {
  return {
    top: true,
    high: true,
    moderate: true,
    safety: true,
    none: true,
  };
}

export function visitInterestKey(level: InterestLevel | undefined): VisitInterestKey {
  if (!level) return "none";
  return level;
}

export function visitInterestLabel(level: InterestLevel | undefined): string {
  return INTEREST_CHIP_LABEL[visitInterestKey(level)];
}

export function parseSchoolLocation(location: string): ParsedLocation {
  const trimmed = location.trim();
  const comma = trimmed.lastIndexOf(",");
  if (comma === -1) {
    return { city: trimmed, state: "", label: trimmed || "Campus area" };
  }
  const city = trimmed.slice(0, comma).trim();
  const state = trimmed.slice(comma + 1).trim();
  return {
    city,
    state,
    label: state ? `${city}, ${state}` : city || trimmed,
  };
}

export function shortSchoolName(name: string): string {
  const paren = name.match(/\(([^)]+)\)/);
  if (paren?.[1]) return paren[1].trim();
  const dash = name.split(/[–—]/)[0]?.trim();
  if (dash && dash.length > 0 && dash.length < name.length) return dash;
  return name.replace(/\s+University$/i, "").trim() || name;
}

function sortByInterestThenName(a: School, b: School): number {
  const rank = interestRank(a.interestLevel) - interestRank(b.interestLevel);
  if (rank !== 0) return rank;
  return a.name.localeCompare(b.name);
}

export type LegEstimator = (from: School, to: School) => DriveEstimate;

/** Drive estimate from the stored Routes matrix (sole source for Visit legs). */
export function matrixDriveEstimate(fromId: string, toId: string): DriveEstimate {
  const leg = driveLeg(schoolTravelPointId(fromId), schoolTravelPointId(toId));
  if (!leg) return { label: "—", minutes: 0, miles: 0 };
  return {
    label: formatDriveDuration(leg.minutes),
    minutes: leg.minutes,
    miles: leg.miles,
  };
}

/** Sync estimator used by cluster chains and day plans. */
export function matrixLegEstimator(): LegEstimator {
  return (from, to) => matrixDriveEstimate(from.id, to.id);
}

/** Alias kept for older call sites / tests. */
export function defaultLegEstimator(from: School, to: School): DriveEstimate {
  return matrixDriveEstimate(from.id, to.id);
}

export function buildDayPlan(
  base: School,
  ordered: School[],
  estimateLeg: LegEstimator = matrixLegEstimator(),
): VisitSlot[] {
  const slots: VisitSlot[] = [];
  let hour = 9;
  ordered.forEach((school, index) => {
    if (index > 0) {
      const prev = ordered[index - 1]!;
      const leg = estimateLeg(prev, school);
      const longDrive = leg.minutes > 300;
      slots.push({
        time: `${hour}:00`,
        schoolId: null,
        title: `Drive · ${leg.label}`,
        sub: `${shortSchoolName(prev.name)} → ${shortSchoolName(school.name)} · ${leg.miles} mi`,
        icon: "car",
        longDrive,
      });
      hour += Math.max(1, Math.min(3, Math.round(leg.minutes / 60) || 1));
    }
    if (index === 1 && ordered.length > 2) {
      slots.push({
        time: "12:30",
        schoolId: null,
        title: "Lunch",
        sub: "Between campuses",
        icon: "meal",
      });
      hour = Math.max(hour, 14);
    }
    const isHere = school.id === base.id;
    slots.push({
      time: `${String(Math.min(hour, 16)).padStart(2, "0")}:00`,
      schoolId: school.id,
      title: isHere
        ? `${shortSchoolName(school.name)} campus visit`
        : `${shortSchoolName(school.name)} tour`,
      sub: isHere ? "This school" : "Placeholder until booked",
    });
    hour += 2;
  });
  return slots;
}

function stopsFromOrdered(
  ordered: School[],
  estimateLeg: LegEstimator = matrixLegEstimator(),
): VisitStop[] {
  return ordered.map((school, index) => {
    if (index === 0) return { schoolId: school.id, driveFromPrev: null };
    const prev = ordered[index - 1]!;
    const leg = estimateLeg(prev, school);
    return {
      schoolId: school.id,
      driveFromPrev: leg.label === "—" ? null : leg.label,
      longDrive: leg.minutes > 300,
    };
  });
}

function emptyTripPlan(startId: string, endId: string): VisitTripPlan {
  return {
    orderedIds: [],
    stops: [],
    days: [],
    totalDriveMinutes: 0,
    totalMiles: 0,
    longDriveLegs: [],
    tooMany: false,
    incomplete: false,
    startId,
    endId,
    route: null,
  };
}

function longDriveWarnings(legs: RouteLeg[]): VisitLongDriveWarning[] {
  return legs
    .filter((leg) => leg.longDrive && !leg.missing && leg.minutes != null)
    .map((leg) => ({
      fromName: leg.fromName,
      toName: leg.toName,
      minutes: leg.minutes!,
    }));
}

/**
 * Build the live trip from individually selected schools.
 * Order is Held-Karp shortest path on the stored drive matrix (≤ 12 schools).
 */
export function buildTripFromSelection(
  base: School,
  _clusters: VisitCluster[],
  selectedIds: string[],
  byId: Map<string, School>,
  opts: {
    startId: string;
    endId: string;
    estimateLeg?: LegEstimator;
  } = { startId: "home", endId: "home" },
): VisitTripPlan {
  const startId = opts.startId;
  const endId = opts.endId;
  const estimateLeg = opts.estimateLeg ?? matrixLegEstimator();
  const selected = [...new Set(selectedIds)].filter((id) => byId.has(id));

  if (selected.length === 0) return emptyTripPlan(startId, endId);

  if (selected.length > 12) {
    return {
      ...emptyTripPlan(startId, endId),
      orderedIds: selected,
      tooMany: true,
    };
  }

  const nameById = new Map<string, string>();
  nameById.set("home", "Home");
  for (const id of selected) {
    const row = byId.get(id)!;
    nameById.set(id, row.name);
    nameById.set(schoolTravelPointId(id), row.name);
  }
  for (const point of [travelPointById(startId), travelPointById(endId)]) {
    if (point) nameById.set(point.id, point.name);
  }

  const route =
    shortestSchoolOrder({
      startId,
      endId,
      schoolIds: selected,
      nameById,
    }) ??
    buildRouteFromOrder({
      startId,
      endId,
      schoolIds: selected,
      nameById,
    });

  const ordered: School[] = [];
  for (const pointId of route.order) {
    if (!pointId.startsWith("school:")) continue;
    const row = byId.get(pointId.slice("school:".length));
    if (row) ordered.push(row);
  }
  if (ordered.length === 0) {
    for (const id of selected) {
      const row = byId.get(id);
      if (row) ordered.push(row);
    }
  }

  const days: VisitSlot[][] = [];
  if (ordered.length > 3) {
    const mid = Math.ceil(ordered.length / 2);
    days.push(buildDayPlan(base, ordered.slice(0, mid), estimateLeg));
    days.push(buildDayPlan(base, ordered.slice(mid), estimateLeg));
  } else if (ordered.length > 0) {
    days.push(buildDayPlan(base, ordered, estimateLeg));
  }

  return {
    orderedIds: ordered.map((row) => row.id),
    stops: stopsFromOrdered(ordered, estimateLeg),
    days,
    totalDriveMinutes: route.totalMinutes ?? 0,
    totalMiles: route.totalMiles,
    longDriveLegs: longDriveWarnings(route.legs),
    tooMany: false,
    incomplete: route.incomplete,
    startId,
    endId,
    route,
  };
}

/** Rebuild a suggestion chain so legs only connect consecutive visible stops. */
export function withDynamicClusterLegs(
  cluster: VisitCluster,
  byId: Map<string, School>,
  estimateLeg: LegEstimator = matrixLegEstimator(),
): VisitCluster {
  const ordered = cluster.stops
    .map((stop) => byId.get(stop.schoolId))
    .filter((row): row is School => Boolean(row));
  return {
    ...cluster,
    stops: stopsFromOrdered(ordered, estimateLeg),
  };
}

/** Start/end choices for Visit Planning: Home plus the school's region airports. */
export function visitEndpointOptions(school: School): { id: string; label: string }[] {
  const region = regionForLocation(school.location);
  const airports = region ? airportsForRegion(region) : [];
  return [
    { id: "home", label: "Home (Maplewood, NJ)" },
    ...airports.map((a) => ({ id: a.id, label: a.name })),
  ];
}

export function defaultVisitStartId(school: School): string {
  const region = regionForLocation(school.location);
  return region ? defaultTripStartId(region) : "home";
}

export function travelPointMapLabel(pointId: string): string | null {
  return travelPointById(pointId)?.address ?? null;
}

/** Suggest visit clusters around `base` using list schools' City, ST locations. */
export function buildVisitClusters(base: School, listSchools: School[]): VisitCluster[] {
  const live = listSchools.filter((school) => !school.archived);
  const here = parseSchoolLocation(base.location);
  const others = live.filter((school) => school.id !== base.id);
  const estimateLeg = matrixLegEstimator();

  const sameCity = others
    .filter((school) => {
      const loc = parseSchoolLocation(school.location);
      return (
        loc.state &&
        loc.state === here.state &&
        loc.city.toLowerCase() === here.city.toLowerCase()
      );
    })
    .sort(sortByInterestThenName);

  const sameState = others
    .filter((school) => {
      const loc = parseSchoolLocation(school.location);
      if (!here.state || loc.state !== here.state) return false;
      return loc.city.toLowerCase() !== here.city.toLowerCase();
    })
    .sort(sortByInterestThenName);

  const used = new Set([base.id, ...sameCity.map((s) => s.id), ...sameState.map((s) => s.id)]);
  const farther = others
    .filter((school) => !used.has(school.id))
    .sort(sortByInterestThenName)
    .slice(0, 4);

  const clusters: VisitCluster[] = [];

  const sameDayOrdered = [base, ...sameCity];
  clusters.push({
    id: "same",
    name: "Same day",
    sub: here.city ? `${here.city} area` : "Local campus",
    days: 1,
    stops: stopsFromOrdered(sameDayOrdered, estimateLeg),
    note:
      sameCity.length > 0
        ? `Other list schools in ${here.city || "this city"}. Tap schools to add them to the trip.`
        : `Start with ${shortSchoolName(base.name)}. No other list schools share this city yet.`,
    plan: [buildDayPlan(base, sameDayOrdered, estimateLeg)],
  });

  if (sameState.length > 0) {
    const plusOrdered = [base, ...sameState.slice(0, 4)];
    clusters.push({
      id: "plus1",
      name: "+1 day",
      sub: here.state ? `${here.state} campuses` : "Nearby state",
      days: 1,
      stops: stopsFromOrdered(plusOrdered, estimateLeg),
      note: `Same-state list schools. Drive times update as you add or remove stops.`,
      plan: [buildDayPlan(base, plusOrdered, estimateLeg)],
    });
  }

  if (farther.length > 0) {
    const longOrdered = [base, ...farther];
    const days = farther.length > 2 ? 2 : 1;
    const plan: VisitSlot[][] =
      days === 2
        ? [
            buildDayPlan(base, [base, farther[0]!], estimateLeg),
            buildDayPlan(base, farther.slice(1), estimateLeg),
          ]
        : [buildDayPlan(base, longOrdered, estimateLeg)];
    clusters.push({
      id: "long",
      name: "Longer trip",
      sub: "Beyond this state",
      days,
      stops: stopsFromOrdered(longOrdered, estimateLeg),
      note: "Higher-interest schools farther out. Drive times come from the stored matrix.",
      plan,
    });
  }

  return clusters;
}

/** Filter a cluster's stops by interest. Current school always stays. Rebuild legs + plan. */
export function filterVisitCluster(
  cluster: VisitCluster,
  base: School,
  byId: Map<string, School>,
  filter: VisitInterestFilter,
): VisitCluster {
  const mode = cluster.id;
  const kept = cluster.stops
    .map((stop) => byId.get(stop.schoolId))
    .filter((school): school is School => Boolean(school))
    .filter((school) => {
      if (school.id === base.id) return true;
      return filter[visitInterestKey(school.interestLevel)];
    })
    .sort((a, b) => {
      if (a.id === base.id) return -1;
      if (b.id === base.id) return 1;
      return sortByInterestThenName(a, b);
    });

  // Keep base first for same/plus1; for long, keep original relative order among filtered
  const ordered =
    mode === "long"
      ? [
          ...cluster.stops
            .map((stop) => byId.get(stop.schoolId))
            .filter((school): school is School => Boolean(school))
            .filter(
              (school) =>
                school.id === base.id || filter[visitInterestKey(school.interestLevel)],
            ),
        ]
      : kept;

  const peers = ordered.filter((school) => school.id !== base.id);
  const emptyPeers = peers.length === 0;

  let plan: VisitSlot[][];
  if (ordered.length === 0) {
    plan = [];
  } else if (mode === "long" && peers.length > 2) {
    const withBase = ordered.some((s) => s.id === base.id) ? ordered : [base, ...ordered];
    const rest = withBase.filter((s) => s.id !== base.id);
    plan = [
      buildDayPlan(base, [base, rest[0]!]),
      buildDayPlan(base, rest.slice(1)),
    ];
  } else {
    plan = [buildDayPlan(base, ordered)];
  }

  return {
    ...cluster,
    stops: stopsFromOrdered(ordered),
    plan,
    note: emptyPeers ? "" : cluster.note,
  };
}

export function filterVisitClusters(
  clusters: VisitCluster[],
  base: School,
  byId: Map<string, School>,
  filter: VisitInterestFilter,
): VisitCluster[] {
  return clusters.map((cluster) => filterVisitCluster(cluster, base, byId, filter));
}

/** Nearby schools across clusters, excluding the current school. */
export function nearbySchoolStats(
  clusters: VisitCluster[],
  filtered: VisitCluster[],
  baseId: string,
): { total: number; showing: number } {
  const totalIds = new Set<string>();
  for (const cluster of clusters) {
    for (const stop of cluster.stops) {
      if (stop.schoolId !== baseId) totalIds.add(stop.schoolId);
    }
  }
  const showingIds = new Set<string>();
  for (const cluster of filtered) {
    for (const stop of cluster.stops) {
      if (stop.schoolId !== baseId) showingIds.add(stop.schoolId);
    }
  }
  return { total: totalIds.size, showing: showingIds.size };
}

export function anyFilterLevelOn(filter: VisitInterestFilter): boolean {
  return VISIT_FILTER_LEVELS.some((key) => filter[key]);
}

export function buildVisitTripMeta(
  base: School,
  listPhaseId: ListPhaseId,
  processPhaseLabel: string | null,
): VisitTripMeta {
  const loc = parseSchoolLocation(base.location);
  const listPhase = listPhaseById(listPhaseId);
  const windowParts = [
    processPhaseLabel || listPhase.season,
    listPhase.window.split("–")[0]?.trim() || "",
  ].filter(Boolean);
  const name = loc.state
    ? `${loc.state} visit · ${shortSchoolName(base.name)}`
    : `${shortSchoolName(base.name)} visit`;
  return {
    name,
    window: windowParts.join(" · "),
    start: listPhase.startsOn,
  };
}

export function schoolMapById(schools: School[]): Map<string, School> {
  return new Map(schools.map((school) => [school.id, school]));
}

/** Map stop location: visitAddress → lat,lng → "Name, City, ST". */
export function schoolMapLocation(school: School): string {
  const address = school.visitAddress?.trim();
  if (address) return address;
  const withCoords = school as School & { latitude?: number | null; longitude?: number | null };
  const lat = withCoords.latitude;
  const lng = withCoords.longitude;
  if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${lat},${lng}`;
  }
  const loc = parseSchoolLocation(school.location);
  const parts = [school.name, loc.city, loc.state].filter(Boolean);
  return parts.join(", ");
}

function googleDirUrl(origin: string | null, stops: string[]): string {
  if (stops.length === 0) return "https://www.google.com/maps/dir/?api=1&travelmode=driving";
  const destination = stops[stops.length - 1]!;
  const middle = stops.slice(0, -1);
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("travelmode", "driving");
  if (origin) params.set("origin", origin);
  params.set("destination", destination);
  if (middle.length) params.set("waypoints", middle.join("|"));
  // URLSearchParams encodes | as %7C automatically
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function appleDirUrl(origin: string | null, stops: string[]): string {
  if (stops.length === 0) return "https://maps.apple.com/directions?mode=driving";
  const destination = stops[stops.length - 1]!;
  const middle = stops.slice(0, -1);
  const params = new URLSearchParams();
  params.set("mode", "driving");
  if (origin) params.set("source", origin);
  params.set("destination", destination);
  for (const point of middle) params.append("waypoint", point);
  return `https://maps.apple.com/directions?${params.toString()}`;
}

/**
 * Build Google/Apple multi-stop links. At most 5 places per part (start + 3 mid + end).
 * When origin is null, the first school is the start of the route for splitting.
 * When endLocation is set, it is appended as the final destination (return to home/airport).
 */
export function buildMapRouteParts(
  stopLocations: string[],
  origin: string | null,
  endLocation: string | null = null,
): MapRoutePart[] {
  if (stopLocations.length === 0 && !endLocation) return [];

  const routeStops =
    endLocation && (!stopLocations.length || stopLocations[stopLocations.length - 1] !== endLocation)
      ? [...stopLocations, endLocation]
      : [...stopLocations];
  if (routeStops.length === 0) return [];

  // Capacity for stops per part: with origin → 4 (3 wp + dest); without → 5
  const schoolCapacity = origin ? 4 : 5;
  if (routeStops.length <= schoolCapacity) {
    return [
      {
        label: "Full route",
        googleUrl: googleDirUrl(origin, routeStops),
        appleUrl: appleDirUrl(origin, routeStops),
      },
    ];
  }

  const parts: MapRoutePart[] = [];
  let index = 0;
  let partOrigin = origin;
  let partNum = 1;
  while (index < routeStops.length) {
    const remaining = routeStops.length - index;
    const take = Math.min(schoolCapacity, remaining);
    const chunk = routeStops.slice(index, index + take);
    parts.push({
      label: `Part ${partNum}`,
      googleUrl: googleDirUrl(partOrigin, chunk),
      appleUrl: appleDirUrl(partOrigin, chunk),
    });
    if (index + take >= routeStops.length) break;
    const last = chunk[chunk.length - 1]!;
    partOrigin = last;
    index = index + take - 1; // overlap last stop
    partNum += 1;
  }
  return parts;
}

export function readStoredVisitFilter(): VisitInterestFilter {
  const defaults = defaultVisitInterestFilter();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(VISIT_FILTER_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<VisitInterestFilter>;
    const next = { ...defaults };
    for (const key of VISIT_FILTER_LEVELS) {
      if (typeof parsed[key] === "boolean") next[key] = parsed[key]!;
    }
    return next;
  } catch {
    return defaults;
  }
}

export function writeStoredVisitFilter(filter: VisitInterestFilter): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VISIT_FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {
    /* private mode */
  }
}
