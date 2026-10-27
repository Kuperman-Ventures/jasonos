/**
 * Nearby = list schools within a short drive of the school being viewed.
 */

import type { School } from "@/lib/types";
import {
  NEARBY_DRIVE_MAX_MINUTES,
  formatDriveDuration,
  schoolsWithinDriveMinutes,
  type NearestSchoolHit,
} from "@/lib/drive-matrix";

export type NearbySchoolRow = {
  schoolId: string;
  name: string;
  /** Null for the school being viewed. */
  minutes: number | null;
  miles: number | null;
  isBase: boolean;
  driveLabel: string;
};

export function buildNearbyDriveSchools(
  base: School,
  listSchools: School[],
  maxMinutes: number = NEARBY_DRIVE_MAX_MINUTES,
): NearbySchoolRow[] {
  const live = listSchools.filter((row) => !row.archived);
  const candidates = live.map((row) => ({ id: row.id, name: row.name }));
  const peers = schoolsWithinDriveMinutes(base.id, candidates, maxMinutes);
  return [
    {
      schoolId: base.id,
      name: base.name,
      minutes: null,
      miles: null,
      isBase: true,
      driveLabel: "Here",
    },
    ...peers.map((hit) => nearbyRowFromHit(hit)),
  ];
}

function nearbyRowFromHit(hit: NearestSchoolHit): NearbySchoolRow {
  return {
    schoolId: hit.schoolId,
    name: hit.name,
    minutes: hit.minutes,
    miles: hit.miles,
    isBase: false,
    driveLabel: formatDriveDuration(hit.minutes),
  };
}

export function nearbyPeerCount(rows: NearbySchoolRow[]): number {
  return rows.filter((row) => !row.isBase).length;
}

export { NEARBY_DRIVE_MAX_MINUTES };
