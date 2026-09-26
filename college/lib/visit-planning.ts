/**
 * Visit planning: cluster list schools around the school being viewed.
 * Trip membership is per-school; drive legs recalculate as the selection changes.
 */

import { interestRank, type InterestLevel, type School } from "@/lib/types";
import { listPhaseById, type ListPhaseId } from "@/lib/list-phases";
import {
  estimateDriveByLocation,
  estimateDriveBetweenPoints,
  type DriveEstimate,
  type GeoPoint,
} from "@/lib/visit-geo";

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
  /** Label between this stop and the previous one (e.g. "~25 min"). */
  driveFromPrev: string | null;
};

export type VisitTripPlan = {
  /** Selected schools in visiting order. */
  orderedIds: string[];
  /** Chain legs for the full trip (same order as orderedIds). */
  stops: VisitStop[];
  /** Day columns for the draft itinerary. */
  days: VisitSlot[][];
  /** Total estimated drive minutes across consecutive legs. */
  totalDriveMinutes: number;
};

export type VisitSlot = {
  time: string;
  schoolId: string | null;
  title: string;
  sub?: string;
  icon?: "car" | "meal";
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

/** Sync estimate from school location strings (used until coords resolve). */
export function defaultLegEstimator(from: School, to: School): DriveEstimate {
  return estimateDriveByLocation(from.location, to.location);
}

/** Build an estimator from a map of schoolId → coords. Falls back to location heuristic. */
export function legEstimatorFromCoords(
  coordsById: Map<string, GeoPoint | null>,
): LegEstimator {
  return (from, to) => {
    const a = coordsById.get(from.id);
    const b = coordsById.get(to.id);
    if (a && b) return estimateDriveBetweenPoints(a, b);
    return defaultLegEstimator(from, to);
  };
}

export function buildDayPlan(
  base: School,
  ordered: School[],
  estimateLeg: LegEstimator = defaultLegEstimator,
): VisitSlot[] {
  const slots: VisitSlot[] = [];
  let hour = 9;
  ordered.forEach((school, index) => {
    if (index > 0) {
      const prev = ordered[index - 1]!;
      const leg = estimateLeg(prev, school);
      slots.push({
        time: `${hour}:00`,
        schoolId: null,
        title: `Drive · ${leg.label}`,
        sub: `${shortSchoolName(prev.name)} → ${shortSchoolName(school.name)} · ~${leg.miles} mi`,
        icon: "car",
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
  estimateLeg: LegEstimator = defaultLegEstimator,
): VisitStop[] {
  return ordered.map((school, index) => {
    if (index === 0) return { schoolId: school.id, driveFromPrev: null };
    const prev = ordered[index - 1]!;
    return {
      schoolId: school.id,
      driveFromPrev: estimateLeg(prev, school).label,
    };
  });
}

/** Nearest-neighbor order starting at `start` (or first school). */
export function optimizeStopOrder(
  schools: School[],
  start: School | null,
  estimateLeg: LegEstimator = defaultLegEstimator,
): School[] {
  if (schools.length <= 2) return [...schools];
  const remaining = [...schools];
  const ordered: School[] = [];
  let current: School;
  if (start && remaining.some((row) => row.id === start.id)) {
    current = remaining.find((row) => row.id === start.id)!;
  } else {
    current = remaining[0]!;
  }
  ordered.push(current);
  remaining.splice(
    remaining.findIndex((row) => row.id === current.id),
    1,
  );
  while (remaining.length) {
    let bestIndex = 0;
    let bestMinutes = Number.POSITIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const minutes = estimateLeg(current, candidate).minutes;
      if (minutes < bestMinutes) {
        bestMinutes = minutes;
        bestIndex = index;
      }
    });
    current = remaining.splice(bestIndex, 1)[0]!;
    ordered.push(current);
  }
  return ordered;
}

/**
 * Build the live trip from individually selected schools.
 * Order follows cluster rings, then nearest-neighbor within each day group.
 */
export function buildTripFromSelection(
  base: School,
  clusters: VisitCluster[],
  selectedIds: string[],
  byId: Map<string, School>,
  estimateLeg: LegEstimator = defaultLegEstimator,
): VisitTripPlan {
  const selected = new Set(selectedIds);
  if (selected.size === 0) {
    return { orderedIds: [], stops: [], days: [], totalDriveMinutes: 0 };
  }

  // Collect selected schools per cluster (first membership wins), preserving ring order.
  const perCluster: School[][] = [];
  const seen = new Set<string>();
  for (const cluster of clusters) {
    const group: School[] = [];
    for (const stop of cluster.stops) {
      if (!selected.has(stop.schoolId) || seen.has(stop.schoolId)) continue;
      const row = byId.get(stop.schoolId);
      if (!row) continue;
      seen.add(row.id);
      group.push(row);
    }
    if (group.length) perCluster.push(group);
  }

  // Any selected id not in a cluster (shouldn't happen) appends at the end.
  for (const id of selectedIds) {
    if (seen.has(id)) continue;
    const row = byId.get(id);
    if (!row) continue;
    perCluster.push([row]);
    seen.add(id);
  }

  const days: VisitSlot[][] = [];
  const ordered: School[] = [];
  for (const group of perCluster) {
    const start = group.some((row) => row.id === base.id) ? base : group[0]!;
    const optimized = optimizeStopOrder(group, start, estimateLeg);
    for (const row of optimized) {
      if (!ordered.some((existing) => existing.id === row.id)) ordered.push(row);
    }
    // Longer groups split across two days when more than 3 stops.
    if (optimized.length > 3) {
      const mid = Math.ceil(optimized.length / 2);
      days.push(buildDayPlan(base, optimized.slice(0, mid), estimateLeg));
      days.push(buildDayPlan(base, optimized.slice(mid), estimateLeg));
    } else {
      days.push(buildDayPlan(base, optimized, estimateLeg));
    }
  }

  const stops = stopsFromOrdered(ordered, estimateLeg);
  let totalDriveMinutes = 0;
  for (let i = 1; i < ordered.length; i++) {
    totalDriveMinutes += estimateLeg(ordered[i - 1]!, ordered[i]!).minutes;
  }

  return {
    orderedIds: ordered.map((row) => row.id),
    stops,
    days,
    totalDriveMinutes,
  };
}

/** Rebuild a suggestion chain so legs only connect consecutive visible stops. */
export function withDynamicClusterLegs(
  cluster: VisitCluster,
  byId: Map<string, School>,
  estimateLeg: LegEstimator = defaultLegEstimator,
): VisitCluster {
  const ordered = cluster.stops
    .map((stop) => byId.get(stop.schoolId))
    .filter((row): row is School => Boolean(row));
  return {
    ...cluster,
    stops: stopsFromOrdered(ordered, estimateLeg),
  };
}

/** Suggest visit clusters around `base` using list schools' City, ST locations. */
export function buildVisitClusters(base: School, listSchools: School[]): VisitCluster[] {
  const live = listSchools.filter((school) => !school.archived);
  const here = parseSchoolLocation(base.location);
  const others = live.filter((school) => school.id !== base.id);

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
    stops: stopsFromOrdered(sameDayOrdered),
    note:
      sameCity.length > 0
        ? `Other list schools in ${here.city || "this city"}. Tap schools to add them to the trip.`
        : `Start with ${shortSchoolName(base.name)}. No other list schools share this city yet.`,
    plan: [buildDayPlan(base, sameDayOrdered)],
  });

  if (sameState.length > 0) {
    const plusOrdered = [base, ...sameState.slice(0, 4)];
    clusters.push({
      id: "plus1",
      name: "+1 day",
      sub: here.state ? `${here.state} campuses` : "Nearby state",
      days: 1,
      stops: stopsFromOrdered(plusOrdered),
      note: `Same-state list schools. Drive times update as you add or remove stops.`,
      plan: [buildDayPlan(base, plusOrdered)],
    });
  }

  if (farther.length > 0) {
    const longOrdered = [base, ...farther];
    const days = farther.length > 2 ? 2 : 1;
    const plan: VisitSlot[][] =
      days === 2
        ? [
            buildDayPlan(base, [base, farther[0]!]),
            buildDayPlan(base, farther.slice(1)),
          ]
        : [buildDayPlan(base, longOrdered)];
    clusters.push({
      id: "long",
      name: "Longer trip",
      sub: "Beyond this state",
      days,
      stops: stopsFromOrdered(longOrdered),
      note: "Higher-interest schools farther out. Pick the ones worth the drive.",
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

const MAX_PLACES_PER_LINK = 5; // start + 3 waypoints + destination

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
 */
export function buildMapRouteParts(
  stopLocations: string[],
  origin: string | null,
): MapRoutePart[] {
  if (stopLocations.length === 0) return [];

  // Capacity for school stops per part: with origin → 4 schools (3 wp + dest); without → 5 (first as origin-like)
  const schoolCapacity = origin ? 4 : 5;
  if (stopLocations.length <= schoolCapacity) {
    return [
      {
        label: "Full route",
        googleUrl: googleDirUrl(origin, stopLocations),
        appleUrl: appleDirUrl(origin, stopLocations),
      },
    ];
  }

  const parts: MapRoutePart[] = [];
  let index = 0;
  let partOrigin = origin;
  let partNum = 1;
  while (index < stopLocations.length) {
    const remaining = stopLocations.length - index;
    const take = Math.min(schoolCapacity, remaining);
    // When continuing a split, overlap: first stop of this part is last stop of previous
    const chunk = stopLocations.slice(index, index + take);
    parts.push({
      label: `Part ${partNum}`,
      googleUrl: googleDirUrl(partOrigin, chunk),
      appleUrl: appleDirUrl(partOrigin, chunk),
    });
    if (index + take >= stopLocations.length) break;
    // Next part starts at last school of this chunk
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
