/** Drive-time chain helpers for the All-schools region detail map. */

import {
  driveLeg,
  formatDriveDuration,
  schoolTravelPointId,
} from "@/lib/drive-matrix";

export type RegionRouteLeg = {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  minutes: number | null;
  miles: number | null;
};

export type RegionRouteSummary = {
  legs: RegionRouteLeg[];
  /** Sum of known legs only. */
  knownMinutes: number;
  knownMiles: number;
  missingLegs: number;
  /** Known minutes when every leg resolved; otherwise null. */
  totalMinutes: number | null;
};

export function appendRegionRouteStop(chain: readonly string[], schoolId: string): string[] {
  const id = schoolId.trim();
  if (!id) return [...chain];
  const existing = chain.indexOf(id);
  if (existing >= 0) return chain.slice(0, existing + 1);
  if (chain[chain.length - 1] === id) return [...chain];
  return [...chain, id];
}

export function buildRegionRouteLegs(
  schoolIds: readonly string[],
  namesById: ReadonlyMap<string, string>,
): RegionRouteSummary {
  const legs: RegionRouteLeg[] = [];
  let knownMinutes = 0;
  let knownMiles = 0;
  let missingLegs = 0;

  for (let i = 1; i < schoolIds.length; i++) {
    const fromId = schoolIds[i - 1]!;
    const toId = schoolIds[i]!;
    const cell = driveLeg(schoolTravelPointId(fromId), schoolTravelPointId(toId));
    const minutes = cell?.minutes ?? null;
    const miles = cell?.miles ?? null;
    legs.push({
      fromId,
      toId,
      fromName: namesById.get(fromId) ?? fromId,
      toName: namesById.get(toId) ?? toId,
      minutes,
      miles,
    });
    if (minutes == null) missingLegs += 1;
    else knownMinutes += minutes;
    if (miles != null) knownMiles += miles;
  }

  return {
    legs,
    knownMinutes,
    knownMiles,
    missingLegs,
    totalMinutes: legs.length > 0 && missingLegs === 0 ? knownMinutes : null,
  };
}

export function formatRegionRouteTotal(summary: RegionRouteSummary): string {
  if (!summary.legs.length) return "Click schools to build a drive path";
  if (summary.totalMinutes != null) {
    const miles =
      summary.knownMiles > 0 ? ` · ${Math.round(summary.knownMiles)} mi` : "";
    return `Total ${formatDriveDuration(summary.totalMinutes)}${miles}`;
  }
  const known =
    summary.knownMinutes > 0
      ? formatDriveDuration(summary.knownMinutes)
      : "0 min";
  return `Total ${known} (+ ${summary.missingLegs} unknown leg${summary.missingLegs === 1 ? "" : "s"})`;
}

export function formatRegionRouteLeg(leg: RegionRouteLeg): string {
  if (leg.minutes == null) return "Drive time unknown";
  const miles = leg.miles != null ? ` · ${Math.round(leg.miles)} mi` : "";
  return `${formatDriveDuration(leg.minutes)}${miles}`;
}
