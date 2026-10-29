/**
 * Visit Planning routes: optimize school order (Held-Karp) with optional
 * custom start/end points. School↔school legs prefer the drive matrix;
 * endpoint legs fall back to haversine road estimates.
 */

import {
  driveLeg,
  formatDriveDuration,
  schoolTravelPointId,
  type PlannedRoute,
  type RouteLeg,
} from "@/lib/drive-matrix";
import {
  estimateDriveBetweenPoints,
  type GeoPoint,
} from "@/lib/visit-geo";

export const VISIT_PLAN_START_ID = "visit-start";
export const VISIT_PLAN_END_ID = "visit-end";
export const VISIT_PLAN_MAX_SCHOOLS = 12;

export type VisitPlanEndpoint = {
  id: string;
  name: string;
  point: GeoPoint | null;
};

function matrixMinutes(fromId: string, toId: string): number | null {
  const leg = driveLeg(fromId, toId);
  return leg ? leg.minutes : null;
}

function estimatedMinutes(
  from: GeoPoint | null | undefined,
  to: GeoPoint | null | undefined,
): number | null {
  if (!from || !to) return null;
  return estimateDriveBetweenPoints(from, to).minutes;
}

function estimatedMiles(
  from: GeoPoint | null | undefined,
  to: GeoPoint | null | undefined,
): number | null {
  if (!from || !to) return null;
  return estimateDriveBetweenPoints(from, to).miles;
}

/**
 * Minutes between two travel-point ids. `coords` holds school record ids and
 * optional start/end virtual ids.
 */
export function visitPlanLegCost(
  fromId: string,
  toId: string,
  coords: Map<string, GeoPoint | null>,
): number {
  if (fromId === toId) return 0;

  const fromSchool =
    fromId.startsWith("school:") ? fromId.slice("school:".length) : null;
  const toSchool = toId.startsWith("school:") ? toId.slice("school:".length) : null;

  if (fromSchool && toSchool) {
    const matrix = matrixMinutes(fromId, toId);
    if (matrix != null) return matrix;
    const est = estimatedMinutes(coords.get(fromSchool), coords.get(toSchool));
    return est ?? Number.POSITIVE_INFINITY;
  }

  const fromPoint =
    fromId === VISIT_PLAN_START_ID || fromId === VISIT_PLAN_END_ID
      ? coords.get(fromId)
      : fromSchool
        ? coords.get(fromSchool)
        : null;
  const toPoint =
    toId === VISIT_PLAN_START_ID || toId === VISIT_PLAN_END_ID
      ? coords.get(toId)
      : toSchool
        ? coords.get(toSchool)
        : null;
  const est = estimatedMinutes(fromPoint, toPoint);
  return est ?? Number.POSITIVE_INFINITY;
}

function buildLeg(
  fromId: string,
  toId: string,
  fromName: string,
  toName: string,
  coords: Map<string, GeoPoint | null>,
): RouteLeg {
  const fromSchool =
    fromId.startsWith("school:") ? fromId.slice("school:".length) : null;
  const toSchool = toId.startsWith("school:") ? toId.slice("school:".length) : null;

  let minutes: number | null = null;
  let miles: number | null = null;

  if (fromSchool && toSchool) {
    const matrix = driveLeg(fromId, toId);
    if (matrix) {
      minutes = matrix.minutes;
      miles = matrix.miles;
    } else {
      minutes = estimatedMinutes(coords.get(fromSchool), coords.get(toSchool));
      miles = estimatedMiles(coords.get(fromSchool), coords.get(toSchool));
    }
  } else {
    const fromPoint =
      fromId === VISIT_PLAN_START_ID || fromId === VISIT_PLAN_END_ID
        ? coords.get(fromId)
        : fromSchool
          ? coords.get(fromSchool)
          : null;
    const toPoint =
      toId === VISIT_PLAN_START_ID || toId === VISIT_PLAN_END_ID
        ? coords.get(toId)
        : toSchool
          ? coords.get(toSchool)
          : null;
    minutes = estimatedMinutes(fromPoint, toPoint);
    miles = estimatedMiles(fromPoint, toPoint);
  }

  return {
    fromId,
    toId,
    fromName,
    toName,
    minutes,
    miles,
    missing: minutes == null,
    longDrive: (minutes ?? 0) > 300,
  };
}

/** Build route for an explicit school order (manual drag). */
export function buildVisitPlanFromOrder(opts: {
  schoolIds: string[];
  start: VisitPlanEndpoint;
  end: VisitPlanEndpoint;
  coords: Map<string, GeoPoint | null>;
  nameById: Map<string, string>;
}): PlannedRoute {
  const schoolPointIds = opts.schoolIds.map((id) => schoolTravelPointId(id));
  const order = [opts.start.id, ...schoolPointIds];
  if (opts.end.id !== order[order.length - 1]) order.push(opts.end.id);

  const names = new Map(opts.nameById);
  names.set(opts.start.id, opts.start.name);
  names.set(opts.end.id, opts.end.name);

  const coords = new Map(opts.coords);
  if (opts.start.point) coords.set(opts.start.id, opts.start.point);
  if (opts.end.point) coords.set(opts.end.id, opts.end.point);

  const legs: RouteLeg[] = [];
  let totalMinutes = 0;
  let totalMiles = 0;
  let incomplete = false;

  for (let i = 0; i < order.length - 1; i++) {
    const fromId = order[i]!;
    const toId = order[i + 1]!;
    if (fromId === toId) continue;
    const leg = buildLeg(
      fromId,
      toId,
      names.get(fromId) ?? fromId,
      names.get(toId) ?? toId,
      coords,
    );
    if (leg.missing) incomplete = true;
    else {
      totalMinutes += leg.minutes ?? 0;
      totalMiles += leg.miles ?? 0;
    }
    legs.push(leg);
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

/** Held-Karp optimize school order between start and end (≤ 12 schools). */
export function optimizeVisitPlanOrder(opts: {
  schoolIds: string[];
  start: VisitPlanEndpoint;
  end: VisitPlanEndpoint;
  coords: Map<string, GeoPoint | null>;
  nameById: Map<string, string>;
}): PlannedRoute {
  const unique = [...new Set(opts.schoolIds)];
  if (unique.length === 0) {
    return buildVisitPlanFromOrder({ ...opts, schoolIds: [] });
  }
  if (unique.length > VISIT_PLAN_MAX_SCHOOLS) {
    return {
      ...buildVisitPlanFromOrder({ ...opts, schoolIds: unique.slice(0, VISIT_PLAN_MAX_SCHOOLS) }),
      schoolCount: unique.length,
      incomplete: true,
    };
  }

  const coords = new Map(opts.coords);
  if (opts.start.point) coords.set(opts.start.id, opts.start.point);
  if (opts.end.point) coords.set(opts.end.id, opts.end.point);

  const schools = unique.map((id) => schoolTravelPointId(id));
  const n = schools.length;
  const INF = Number.POSITIVE_INFINITY;
  const cost = (a: string, b: string) => visitPlanLegCost(a, b, coords);

  const size = 1 << n;
  const dp: number[][] = Array.from({ length: size }, () => Array(n).fill(INF));
  const parent: Array<Array<{ mask: number; j: number } | null>> = Array.from(
    { length: size },
    () => Array(n).fill(null),
  );

  for (let j = 0; j < n; j++) {
    dp[1 << j]![j] = cost(opts.start.id, schools[j]!);
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
    const cand = dp[full]![j]! + cost(schools[j]!, opts.end.id);
    if (cand < bestEnd) {
      bestEnd = cand;
      bestJ = j;
    }
  }

  if (bestJ < 0 || !Number.isFinite(bestEnd)) {
    return buildVisitPlanFromOrder({ ...opts, schoolIds: unique });
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

  return buildVisitPlanFromOrder({
    ...opts,
    schoolIds: orderedPointIds.map((id) =>
      id.startsWith("school:") ? id.slice("school:".length) : id,
    ),
  });
}

export function formatVisitPlanLegLabel(leg: RouteLeg): string | null {
  if (leg.minutes == null) return null;
  return formatDriveDuration(leg.minutes);
}

export function schoolIdsFromRoute(route: PlannedRoute): string[] {
  return route.order
    .filter((id) => id.startsWith("school:"))
    .map((id) => id.slice("school:".length));
}
