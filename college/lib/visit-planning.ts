/**
 * Visit planning: cluster list schools around the school being viewed.
 * Drive times are not available yet (no maps API) — legs use place labels only.
 */

import { interestRank, type InterestLevel, type School } from "@/lib/types";
import { listPhaseById, type ListPhaseId } from "@/lib/list-phases";

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
  /** Label between this stop and the previous one (no invented minutes). */
  driveFromPrev: string | null;
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

function driveLabel(mode: "same" | "plus1" | "long"): string {
  if (mode === "same") return "nearby";
  if (mode === "plus1") return "same state";
  return "regional";
}

export function buildDayPlan(
  base: School,
  ordered: School[],
  mode: "same" | "plus1" | "long",
): VisitSlot[] {
  const slots: VisitSlot[] = [];
  let hour = 9;
  ordered.forEach((school, index) => {
    if (index > 0) {
      const prev = ordered[index - 1]!;
      const leg = driveLabel(mode);
      slots.push({
        time: `${hour}:00`,
        schoolId: null,
        title: `Drive · ${leg.charAt(0).toUpperCase()}${leg.slice(1)}`,
        sub: `${shortSchoolName(prev.name)} → ${shortSchoolName(school.name)}`,
        icon: "car",
      });
      hour += 1;
    }
    if (index === 1 && ordered.length > 2) {
      slots.push({
        time: "12:30",
        schoolId: null,
        title: "Lunch",
        sub: "Between campuses",
        icon: "meal",
      });
      hour = 14;
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
  mode: "same" | "plus1" | "long",
): VisitStop[] {
  return ordered.map((school, index) => ({
    schoolId: school.id,
    driveFromPrev: index === 0 ? null : driveLabel(mode),
  }));
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
    stops: stopsFromOrdered(sameDayOrdered, "same"),
    note:
      sameCity.length > 0
        ? `Other list schools in ${here.city || "this city"}. Drive times TBD until a maps source is wired.`
        : `Start with ${shortSchoolName(base.name)}. No other list schools share this city yet.`,
    plan: [buildDayPlan(base, sameDayOrdered, "same")],
  });

  if (sameState.length > 0) {
    const plusOrdered = [base, ...sameState.slice(0, 4)];
    clusters.push({
      id: "plus1",
      name: "+1 day",
      sub: here.state ? `${here.state} campuses` : "Nearby state",
      days: 1,
      stops: stopsFromOrdered(plusOrdered, "plus1"),
      note: `Same-state list schools. Order is by interest; drive times are placeholders.`,
      plan: [buildDayPlan(base, plusOrdered, "plus1")],
    });
  }

  if (farther.length > 0) {
    const longOrdered = [base, ...farther];
    const days = farther.length > 2 ? 2 : 1;
    const plan: VisitSlot[][] =
      days === 2
        ? [
            buildDayPlan(base, [base, farther[0]!], "long"),
            buildDayPlan(base, farther.slice(1), "long"),
          ]
        : [buildDayPlan(base, longOrdered, "long")];
    clusters.push({
      id: "long",
      name: "Longer trip",
      sub: "Beyond this state",
      days,
      stops: stopsFromOrdered(longOrdered, "long"),
      note: "Higher-interest schools farther out. Compare on one trip once drive times are available.",
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
      buildDayPlan(base, [base, rest[0]!], mode),
      buildDayPlan(base, rest.slice(1), mode),
    ];
  } else {
    plan = [buildDayPlan(base, ordered, mode)];
  }

  return {
    ...cluster,
    stops: stopsFromOrdered(ordered, mode),
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
