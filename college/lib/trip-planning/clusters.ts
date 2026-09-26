/**
 * Build trip clusters from visit-planning clusters + optional geocoded coords.
 */

import type { School } from "@/lib/types";
import type { GeoPoint } from "@/lib/visit-geo";
import { haversineMiles } from "@/lib/visit-geo";
import {
  buildVisitClusters,
  parseSchoolLocation,
  shortSchoolName,
  type VisitCluster,
  type VisitSlot,
} from "@/lib/visit-planning";
import { nearestAirport } from "@/lib/visit-airports";
import { KYLE_STUDENT } from "./calendar";
import { regionForLocation, type TripRegionId } from "./regions";
import { tripInterestKey, type TripInterestKey } from "./interest";

export type TripSchoolPoint = {
  id: string;
  name: string;
  mark: string;
  interest: TripInterestKey;
  lat: number;
  lng: number;
  region: TripRegionId | null;
  /** Pixel nudge for overlapping campuses (±17). */
  nudge: number;
  website: string;
};

export type TripCluster = VisitCluster & {
  /** Drive labels between consecutive stop coords (null = no label). */
  legs: (string | null)[];
  /** Optional previous-stop school id when chaining from another cluster. */
  fromId: string | null;
  fromLeg: string | null;
  /** Fraction along each polyline segment for leg labels (default 0.5). */
  at: number[];
};

export function schoolMarkLetter(name: string): string {
  const paren = name.match(/\(([^)]+)\)/);
  const source = (paren?.[1] ?? name).trim();
  const words = source.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 1) return (words[0] ?? "?").slice(0, 4).toUpperCase();
  return words
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

/** Nudge campuses within ~1 km so pins don't overlap. */
export function computePinNudges(
  points: { id: string; lat: number; lng: number }[],
): Map<string, number> {
  const nudges = new Map<string, number>();
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      const miles = haversineMiles(
        { lat: a.lat, lng: a.lng },
        { lat: b.lat, lng: b.lng },
      );
      if (miles <= 0.7) {
        if (!nudges.has(a.id)) nudges.set(a.id, -17);
        if (!nudges.has(b.id)) nudges.set(b.id, 17);
      }
    }
  }
  return nudges;
}

export function toTripSchoolPoint(
  school: School,
  coords: GeoPoint | null | undefined,
  nudge = 0,
): TripSchoolPoint | null {
  if (!coords) return null;
  const loc = parseSchoolLocation(school.location);
  return {
    id: school.id,
    name: school.name,
    mark: schoolMarkLetter(school.name),
    interest: tripInterestKey(school.interestLevel),
    lat: coords.lat,
    lng: coords.lng,
    region: regionForLocation(school.location) ?? regionForLocation(`${loc.city}, ${loc.state}`),
    nudge,
    website: school.website,
  };
}

export function enrichVisitCluster(cluster: VisitCluster): TripCluster {
  const legs = cluster.stops.slice(1).map((stop) => stop.driveFromPrev);
  return {
    ...cluster,
    legs,
    fromId: null,
    fromLeg: null,
    at: legs.map(() => 0.5),
  };
}

export function buildTripClusters(base: School, listSchools: School[]): TripCluster[] {
  return buildVisitClusters(base, listSchools).map(enrichVisitCluster);
}

export function clusterPolylinePoints(
  cluster: TripCluster,
  pointsById: Map<string, TripSchoolPoint>,
): [number, number][] {
  const pts: [number, number][] = [];
  if (cluster.fromId) {
    const from = pointsById.get(cluster.fromId);
    if (from) pts.push([from.lat, from.lng]);
  }
  for (const stop of cluster.stops) {
    const point = pointsById.get(stop.schoolId);
    if (point) pts.push([point.lat, point.lng]);
  }
  return pts;
}

export function clusterLegLabels(cluster: TripCluster): (string | null)[] {
  if (cluster.fromId && cluster.fromLeg) {
    return [cluster.fromLeg, ...cluster.legs];
  }
  return cluster.legs;
}

export function schoolsInTripClusters(
  clusters: TripCluster[],
  clusterIds: string[],
): string[] {
  const selected = new Set(clusterIds);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const cluster of clusters) {
    if (!selected.has(cluster.id)) continue;
    for (const stop of cluster.stops) {
      if (seen.has(stop.schoolId)) continue;
      seen.add(stop.schoolId);
      ids.push(stop.schoolId);
    }
  }
  return ids;
}

export function tripDaysFromClusters(
  clusters: TripCluster[],
  clusterIds: string[],
): VisitSlot[][] {
  const selected = new Set(clusterIds);
  const days: VisitSlot[][] = [];
  for (const cluster of clusters) {
    if (!selected.has(cluster.id)) continue;
    for (const day of cluster.plan) days.push(day);
  }
  return days;
}

export function tripTitle(base: School): string {
  const loc = parseSchoolLocation(base.location);
  if (loc.city && loc.state) {
    return `${loc.city} trip · ${shortSchoolName(base.name)}`;
  }
  return `${shortSchoolName(base.name)} visit trip`;
}

export function flightBlurb(schoolPoint: GeoPoint | null): {
  airport: string;
  lat: number;
  lng: number;
  flight: string;
} {
  const home = KYLE_STUDENT.homeAirport;
  if (!schoolPoint) {
    return {
      airport: "—",
      lat: 0,
      lng: 0,
      flight: `${home} → campus airport`,
    };
  }
  const nearest = nearestAirport(schoolPoint);
  if (!nearest) {
    return {
      airport: "—",
      lat: schoolPoint.lat,
      lng: schoolPoint.lng,
      flight: `${home} → nearest airport`,
    };
  }
  const hours = Math.max(1, Math.round(nearest.miles / 450));
  return {
    airport: nearest.iata,
    lat: nearest.lat,
    lng: nearest.lng,
    flight: `${home} → ${nearest.iata}, about ${hours} hr`,
  };
}

export type RegionSchoolDot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  interest: TripInterestKey;
  region: TripRegionId;
};

export function buildRegionDots(
  schools: School[],
  coordsById: Map<string, GeoPoint | null>,
): RegionSchoolDot[] {
  const out: RegionSchoolDot[] = [];
  for (const school of schools) {
    if (school.archived) continue;
    const coords = coordsById.get(school.id);
    if (!coords) continue;
    const region = regionForLocation(school.location);
    if (!region) continue;
    out.push({
      id: school.id,
      name: school.name,
      lat: coords.lat,
      lng: coords.lng,
      interest: tripInterestKey(school.interestLevel),
      region,
    });
  }
  return out;
}
