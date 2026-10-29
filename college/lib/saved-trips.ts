/** Named Visit Planning trips — household library + Google Maps export. */

import { collegeDb, supabaseConfigured } from "@/lib/db";
import {
  DEFAULT_VISIT_END_ADDRESS,
  DEFAULT_VISIT_START_ADDRESS,
} from "@/lib/visit-plan-state";
import { buildMapRouteParts, schoolMapLocation, type MapRoutePart } from "@/lib/visit-planning";
import type { School } from "@/lib/types";

export const SAVED_TRIPS_STORAGE_KEY = "track-saved-trips-v1";
export const SAVED_TRIP_NAME_MAX = 80;
export const SAVED_TRIP_MAX_SCHOOLS = 12;

export type SavedTrip = {
  id: string;
  name: string;
  schoolIds: string[];
  schoolNames: string[];
  startAddress: string;
  endAddress: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdByName: string;
};

export type SavedTripInput = {
  name: string;
  schoolIds: string[];
  schoolNames: string[];
  startAddress: string;
  endAddress: string;
  createdById: string;
  createdByName: string;
};

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeTripName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, SAVED_TRIP_NAME_MAX);
}

export function normalizeAddress(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.replace(/\s+/g, " ").trim().slice(0, 200);
  return trimmed || fallback;
}

export function normalizeSchoolIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= SAVED_TRIP_MAX_SCHOOLS) break;
  }
  return out;
}

export function parseSavedTrip(raw: unknown): SavedTrip | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const name = normalizeTripName(row.name);
  if (!id || !name) return null;
  const schoolIds = normalizeSchoolIdList(row.schoolIds ?? row.school_ids);
  if (!schoolIds.length) return null;
  const namesRaw = row.schoolNames ?? row.school_names;
  const schoolNames = Array.isArray(namesRaw)
    ? namesRaw
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .slice(0, schoolIds.length)
    : [];
  while (schoolNames.length < schoolIds.length) schoolNames.push("School");
  return {
    id,
    name,
    schoolIds,
    schoolNames,
    startAddress: normalizeAddress(row.startAddress ?? row.start_address, DEFAULT_VISIT_START_ADDRESS),
    endAddress: normalizeAddress(row.endAddress ?? row.end_address, DEFAULT_VISIT_END_ADDRESS),
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : typeof row.created_at === "string"
          ? row.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof row.updatedAt === "string"
        ? row.updatedAt
        : typeof row.updated_at === "string"
          ? row.updated_at
          : new Date().toISOString(),
    createdById:
      typeof row.createdById === "string"
        ? row.createdById
        : typeof row.created_by_id === "string"
          ? row.created_by_id
          : "",
    createdByName:
      typeof row.createdByName === "string"
        ? row.createdByName
        : typeof row.created_by_name === "string"
          ? row.created_by_name
          : "",
  };
}

function mapDbRow(row: Record<string, unknown>): SavedTrip | null {
  return parseSavedTrip(row);
}

function readLocalTrips(): SavedTrip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_TRIPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseSavedTrip)
      .filter((row): row is SavedTrip => Boolean(row))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function writeLocalTrips(trips: SavedTrip[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_TRIPS_STORAGE_KEY, JSON.stringify(trips));
  } catch {
    /* private mode / quota */
  }
}

function buildTripRecord(input: SavedTripInput): SavedTrip {
  const name = normalizeTripName(input.name);
  if (!name) throw new Error("Trip name is required");
  const schoolIds = normalizeSchoolIdList(input.schoolIds);
  if (!schoolIds.length) throw new Error("Add at least one school to save a trip");
  const schoolNames = schoolIds.map((id, index) => {
    const label = input.schoolNames[index]?.trim();
    return label || id;
  });
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    schoolIds,
    schoolNames,
    startAddress: normalizeAddress(input.startAddress, DEFAULT_VISIT_START_ADDRESS),
    endAddress: normalizeAddress(input.endAddress, DEFAULT_VISIT_END_ADDRESS),
    createdAt: now,
    updatedAt: now,
    createdById: input.createdById,
    createdByName: input.createdByName,
  };
}

/** Browser-only fallback when the API / Supabase is unavailable. */
export function listSavedTripsLocal(): SavedTrip[] {
  return readLocalTrips();
}

export function createSavedTripLocal(input: SavedTripInput): SavedTrip {
  const trip = buildTripRecord(input);
  writeLocalTrips([trip, ...readLocalTrips().filter((row) => row.id !== trip.id)]);
  return trip;
}

export function deleteSavedTripLocal(id: string): void {
  writeLocalTrips(readLocalTrips().filter((row) => row.id !== id));
}

export type SavedTripUpdate = {
  name?: string;
  schoolIds?: string[];
  schoolNames?: string[];
  startAddress?: string;
  endAddress?: string;
};

export function updateSavedTripLocal(id: string, patch: SavedTripUpdate): SavedTrip {
  const trips = readLocalTrips();
  const index = trips.findIndex((row) => row.id === id);
  if (index < 0) throw new Error("Trip not found");
  const before = trips[index]!;
  const name =
    patch.name !== undefined ? normalizeTripName(patch.name) : before.name;
  if (!name) throw new Error("Trip name is required");
  const schoolIds =
    patch.schoolIds !== undefined
      ? normalizeSchoolIdList(patch.schoolIds)
      : before.schoolIds;
  if (!schoolIds.length) throw new Error("Add at least one school");
  const schoolNames =
    patch.schoolNames !== undefined
      ? schoolIds.map((schoolId, i) => patch.schoolNames?.[i]?.trim() || schoolId)
      : before.schoolNames.slice(0, schoolIds.length);
  while (schoolNames.length < schoolIds.length) schoolNames.push("School");
  const next: SavedTrip = {
    ...before,
    name,
    schoolIds,
    schoolNames,
    startAddress:
      patch.startAddress !== undefined
        ? normalizeAddress(patch.startAddress, DEFAULT_VISIT_START_ADDRESS)
        : before.startAddress,
    endAddress:
      patch.endAddress !== undefined
        ? normalizeAddress(patch.endAddress, DEFAULT_VISIT_END_ADDRESS)
        : before.endAddress,
    updatedAt: new Date().toISOString(),
  };
  const list = [...trips];
  list[index] = next;
  writeLocalTrips(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  return next;
}

export async function listSavedTrips(): Promise<SavedTrip[]> {
  if (!supabaseConfigured()) return [];
  const db = collegeDb();
  const { data, error } = await db
    .from("saved_trips")
    .select(
      "id, name, school_ids, school_names, start_address, end_address, created_at, updated_at, created_by_id, created_by_name",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>[])
    .map(mapDbRow)
    .filter((row): row is SavedTrip => Boolean(row));
}

export async function createSavedTrip(input: SavedTripInput): Promise<SavedTrip> {
  if (!supabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  const draft = buildTripRecord(input);
  const db = collegeDb();
  const { data, error } = await db
    .from("saved_trips")
    .insert({
      name: draft.name,
      school_ids: draft.schoolIds,
      school_names: draft.schoolNames,
      start_address: draft.startAddress,
      end_address: draft.endAddress,
      created_by_id: draft.createdById,
      created_by_name: draft.createdByName,
      updated_at: draft.updatedAt,
    })
    .select(
      "id, name, school_ids, school_names, start_address, end_address, created_at, updated_at, created_by_id, created_by_name",
    )
    .single();
  if (error) throw new Error(error.message);
  const trip = mapDbRow(data as Record<string, unknown>);
  if (!trip) throw new Error("Could not save trip");
  return trip;
}

export async function deleteSavedTrip(id: string): Promise<void> {
  if (!id.trim()) throw new Error("Missing trip id");
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const { error } = await db.from("saved_trips").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Update name and/or route. Any signed-in family member can edit. */
export async function updateSavedTrip(id: string, patch: SavedTripUpdate): Promise<SavedTrip> {
  if (!id.trim()) throw new Error("Missing trip id");
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const name = normalizeTripName(patch.name);
    if (!name) throw new Error("Trip name is required");
    row.name = name;
  }
  if (patch.schoolIds !== undefined) {
    const schoolIds = normalizeSchoolIdList(patch.schoolIds);
    if (!schoolIds.length) throw new Error("Add at least one school");
    row.school_ids = schoolIds;
    const schoolNames = schoolIds.map(
      (schoolId, index) => patch.schoolNames?.[index]?.trim() || schoolId,
    );
    row.school_names = schoolNames;
  } else if (patch.schoolNames !== undefined) {
    row.school_names = patch.schoolNames.map((value) =>
      typeof value === "string" ? value.trim() : "",
    );
  }
  if (patch.startAddress !== undefined) {
    row.start_address = normalizeAddress(patch.startAddress, DEFAULT_VISIT_START_ADDRESS);
  }
  if (patch.endAddress !== undefined) {
    row.end_address = normalizeAddress(patch.endAddress, DEFAULT_VISIT_END_ADDRESS);
  }

  const db = collegeDb();
  const { data, error } = await db
    .from("saved_trips")
    .update(row)
    .eq("id", id.trim())
    .select(
      "id, name, school_ids, school_names, start_address, end_address, created_at, updated_at, created_by_id, created_by_name",
    )
    .single();
  if (error) throw new Error(error.message);
  const trip = mapDbRow(data as Record<string, unknown>);
  if (!trip) throw new Error("Could not update trip");
  return trip;
}

/** Google (and Apple) Maps links for turn-by-turn driving from a saved/current trip. */
export function tripMapRouteParts(
  trip: Pick<SavedTrip, "schoolIds" | "startAddress" | "endAddress">,
  schoolsById: Map<string, School>,
): MapRoutePart[] {
  const stops = trip.schoolIds.map((id) => {
    const school = schoolsById.get(id);
    if (school) return schoolMapLocation(school);
    return id;
  });
  const origin = trip.startAddress.trim() || null;
  const end = trip.endAddress.trim() || null;
  return buildMapRouteParts(stops, origin, end);
}

export function formatTripSchoolSummary(trip: SavedTrip, max = 3): string {
  const names = trip.schoolNames.filter(Boolean);
  if (!names.length) return `${trip.schoolIds.length} schools`;
  if (names.length <= max) return names.join(" · ");
  return `${names.slice(0, max).join(" · ")} · +${names.length - max}`;
}

export function formatTripSavedWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
