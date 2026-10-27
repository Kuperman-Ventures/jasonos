/** Persist trip membership + selected week per user/school. */

import {
  DEFAULT_TRIP_WEEK_INDEX,
  type TripSeasonId,
  tripWeekGridForSeason,
} from "./calendar";

export const TRIP_PLAN_STORAGE_PREFIX = "track-trip-plan";

export type TripPlanState = {
  /** School ids included in the trip (individual selection). */
  schoolIds: string[];
  /** Index into the When-to-go week grid (0–8). */
  weekIndex: number;
  /** Season for the When-to-go grid (fall prioritized for drive schools). */
  season?: TripSeasonId;
};

export function tripPlanStorageKey(userId: string, schoolId: string): string {
  return `${TRIP_PLAN_STORAGE_PREFIX}:${userId}:${schoolId}`;
}

export function defaultTripPlanState(
  schoolIds: string[] = [],
  season: TripSeasonId = "spring",
): TripPlanState {
  const grid = tripWeekGridForSeason(season);
  return {
    schoolIds: [...schoolIds],
    weekIndex: grid.defaultWeekIndex,
    season,
  };
}

export function parseTripPlanState(raw: unknown): TripPlanState | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  // Prefer schoolIds. Old clusterIds-only saves are ignored so Nearby re-seeds.
  if (!Array.isArray(row.schoolIds)) return null;
  const schoolIds = row.schoolIds.filter(
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
  return { schoolIds, weekIndex, ...(season ? { season } : {}) };
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
        schoolIds: state.schoolIds,
        weekIndex: state.weekIndex,
        ...(state.season ? { season: state.season } : {}),
      }),
    );
  } catch {
    /* private mode / quota */
  }
}

/** Toggle a school in/out of the trip. Adding a peer also keeps the base school. */
export function toggleSchoolInTrip(
  state: TripPlanState,
  schoolId: string,
  baseSchoolId?: string,
): TripPlanState {
  const has = state.schoolIds.includes(schoolId);
  if (has) {
    return {
      ...state,
      schoolIds: state.schoolIds.filter((id) => id !== schoolId),
    };
  }
  const schoolIds = [...state.schoolIds, schoolId];
  if (
    baseSchoolId &&
    schoolId !== baseSchoolId &&
    !schoolIds.includes(baseSchoolId)
  ) {
    schoolIds.unshift(baseSchoolId);
  }
  return { ...state, schoolIds };
}
