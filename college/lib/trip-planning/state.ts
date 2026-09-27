/** Persist trip membership + selected week per user/school. */

import {
  DEFAULT_TRIP_WEEK_INDEX,
  type TripSeasonId,
  tripWeekGridForSeason,
} from "./calendar";

export const TRIP_PLAN_STORAGE_PREFIX = "track-trip-plan";

export type TripPlanState = {
  /** Cluster ids included in the trip (e.g. "same", "plus1"). */
  clusterIds: string[];
  /** Index into the When-to-go week grid (0–8). */
  weekIndex: number;
  /** Season for the When-to-go grid (fall prioritized for drive schools). */
  season?: TripSeasonId;
};

export function tripPlanStorageKey(userId: string, schoolId: string): string {
  return `${TRIP_PLAN_STORAGE_PREFIX}:${userId}:${schoolId}`;
}

export function defaultTripPlanState(
  clusterIds: string[] = ["same"],
  season: TripSeasonId = "spring",
): TripPlanState {
  const grid = tripWeekGridForSeason(season);
  return {
    clusterIds: [...clusterIds],
    weekIndex: grid.defaultWeekIndex,
    season,
  };
}

export function parseTripPlanState(raw: unknown): TripPlanState | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (!Array.isArray(row.clusterIds)) return null;
  const clusterIds = row.clusterIds.filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  const season: TripSeasonId | undefined =
    row.season === "fall" || row.season === "spring" ? row.season : undefined;
  const fallbackWeek =
    season != null
      ? tripWeekGridForSeason(season).defaultWeekIndex
      : DEFAULT_TRIP_WEEK_INDEX;
  const weekIndex =
    typeof row.weekIndex === "number" && Number.isFinite(row.weekIndex)
      ? Math.max(0, Math.min(8, Math.round(row.weekIndex)))
      : fallbackWeek;
  return { clusterIds, weekIndex, ...(season ? { season } : {}) };
}

export function readTripPlanState(
  userId: string,
  schoolId: string,
): TripPlanState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(tripPlanStorageKey(userId, schoolId));
    if (!raw) return null;
    return parseTripPlanState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeTripPlanState(
  userId: string,
  schoolId: string,
  state: TripPlanState,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      tripPlanStorageKey(userId, schoolId),
      JSON.stringify({
        clusterIds: state.clusterIds,
        weekIndex: state.weekIndex,
        ...(state.season ? { season: state.season } : {}),
      }),
    );
  } catch {
    /* private mode / quota */
  }
}

export function toggleClusterInTrip(
  state: TripPlanState,
  clusterId: string,
): TripPlanState {
  const has = state.clusterIds.includes(clusterId);
  return {
    ...state,
    clusterIds: has
      ? state.clusterIds.filter((id) => id !== clusterId)
      : [...state.clusterIds, clusterId],
  };
}
