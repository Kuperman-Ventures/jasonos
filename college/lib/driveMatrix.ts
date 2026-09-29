/**
 * Runtime drive-matrix extensions for schools added after the base JSON pull.
 * Base pairs stay in data/drive-matrix.json; new legs live in college.drive_pairs_extra.
 */

import { createClient } from "@supabase/supabase-js";
import { timeSourceCall } from "./data-source-checks";
import {
  drivePairKey,
  getTravelPoints,
  schoolTravelPointId,
  setDriveExtras,
  type DriveLeg,
  type TravelPoint,
} from "@/lib/drive-matrix";

const MATRIX_URL =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
/** Keep under the 50-waypoint address-matrix limit (doc: groups of 25). */
const GROUP_SIZE = 25;
const REQUEST_GAP_MS = 400;
const MAX_RETRIES = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function collegeExtraDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, {
    db: { schema: "college" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function extrasConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function parseDurationSeconds(duration: unknown): number | null {
  if (typeof duration === "number" && Number.isFinite(duration)) return duration;
  if (typeof duration !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
  return match ? Number(match[1]) : null;
}

function metersToMiles(meters: number): number {
  return Math.round(meters / 1609.344);
}

function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type MatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  duration?: unknown;
  distanceMeters?: number;
  status?: unknown;
  condition?: string;
};

function elementFailureReason(el: MatrixElement): string {
  const condition = el.condition || "";
  if (condition && condition !== "ROUTE_EXISTS") return `condition=${condition}`;
  const status = el.status;
  if (typeof status === "string" && status.trim()) return status.trim();
  if (status && typeof status === "object") {
    const record = status as { message?: string; code?: unknown };
    if (record.message) return String(record.message);
    if (record.code != null && record.code !== 0 && record.code !== "OK") {
      return String(record.code);
    }
  }
  const seconds = parseDurationSeconds(el.duration);
  if (seconds == null) return "missing duration";
  if (typeof el.distanceMeters !== "number") return "missing distanceMeters";
  return "";
}

function fetchMatrix(
  apiKey: string,
  origins: TravelPoint[],
  destinations: TravelPoint[],
): Promise<MatrixElement[]> {
  return timeSourceCall("google-routes", () => fetchMatrixWithRetries(apiKey, origins, destinations));
}

async function fetchMatrixWithRetries(
  apiKey: string,
  origins: TravelPoint[],
  destinations: TravelPoint[],
): Promise<MatrixElement[]> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(MATRIX_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,duration,distanceMeters,status,condition",
        },
        body: JSON.stringify({
          origins: origins.map((point) => ({ waypoint: { address: point.address } })),
          destinations: destinations.map((point) => ({
            waypoint: { address: point.address },
          })),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      const trimmed = text.trim();
      const data = trimmed.startsWith("[")
        ? (JSON.parse(trimmed) as MatrixElement[])
        : trimmed
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => JSON.parse(line) as MatrixElement);
      if (!Array.isArray(data)) throw new Error("Unexpected Routes response shape");
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) await sleep(REQUEST_GAP_MS * attempt);
    }
  }
  throw lastError ?? new Error("Route matrix request failed");
}

export async function loadDriveExtras(): Promise<void> {
  if (!extrasConfigured()) {
    setDriveExtras([], {});
    return;
  }
  const db = collegeExtraDb();
  const [{ data: points, error: pointsError }, { data: pairs, error: pairsError }] =
    await Promise.all([
      db.from("travel_points_extra").select("id, type, name, address, regions"),
      db.from("drive_pairs_extra").select("from_id, to_id, minutes, miles"),
    ]);
  if (pointsError) throw pointsError;
  if (pairsError) throw pairsError;

  const travelPoints: TravelPoint[] = (points ?? []).map((row) => ({
    id: String(row.id),
    type: row.type as TravelPoint["type"],
    name: String(row.name),
    address: String(row.address),
    regions: Array.isArray(row.regions)
      ? row.regions.filter((value): value is string => typeof value === "string")
      : undefined,
  }));

  const pairMap: Record<string, DriveLeg | null> = {};
  for (const row of pairs ?? []) {
    const key = drivePairKey(String(row.from_id), String(row.to_id));
    if (row.minutes == null || row.miles == null) {
      pairMap[key] = null;
    } else {
      pairMap[key] = { minutes: Number(row.minutes), miles: Number(row.miles) };
    }
  }
  setDriveExtras(travelPoints, pairMap);
}

async function saveExtraPoint(point: TravelPoint): Promise<void> {
  const db = collegeExtraDb();
  const { error } = await db.from("travel_points_extra").upsert(
    {
      id: point.id,
      type: point.type,
      name: point.name,
      address: point.address,
      regions: point.regions ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function saveExtraPairs(
  pairs: Record<string, DriveLeg | null>,
  calculatedDate: string,
): Promise<void> {
  const db = collegeExtraDb();
  const rows = Object.entries(pairs).map(([key, leg]) => {
    const [fromId, toId] = key.split("|");
    return {
      from_id: fromId,
      to_id: toId,
      minutes: leg?.minutes ?? null,
      miles: leg?.miles ?? null,
      calculated_date: calculatedDate,
    };
  });
  if (!rows.length) return;
  const { error } = await db.from("drive_pairs_extra").upsert(rows, {
    onConflict: "from_id,to_id",
  });
  if (error) throw error;
}

async function deletePairsForPoint(pointId: string): Promise<void> {
  const db = collegeExtraDb();
  await db.from("drive_pairs_extra").delete().eq("from_id", pointId);
  await db.from("drive_pairs_extra").delete().eq("to_id", pointId);
}

/**
 * Add one school travel point and compute legs to/from every existing point.
 * Saves extras to Supabase and refreshes the in-memory overlay.
 */
export async function addSchoolDrivePoint(input: {
  schoolId: string;
  schoolName: string;
  cityState: string;
  address?: string;
}): Promise<{ pointId: string; pairCount: number }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured on the server");
  }

  await loadDriveExtras();
  const existing = getTravelPoints();
  const pointId = schoolTravelPointId(input.schoolId);
  const address =
    input.address?.trim() ||
    `${input.schoolName}, ${input.cityState}`.replace(/\s+/g, " ").trim();
  const newPoint: TravelPoint = {
    id: pointId,
    type: "school",
    name: input.schoolName,
    address,
  };

  await saveExtraPoint(newPoint);
  await deletePairsForPoint(pointId);

  const others = existing.filter((point) => point.id !== pointId);
  const pairs: Record<string, DriveLeg | null> = {
    [drivePairKey(pointId, pointId)]: { minutes: 0, miles: 0 },
  };
  const calculatedDate = today();

  const otherGroups = chunk(others, GROUP_SIZE);

  // New point → every other point
  for (const group of otherGroups) {
    if (!group.length) continue;
    const elements = await fetchMatrix(apiKey, [newPoint], group);
    for (const el of elements) {
      const to = group[el.destinationIndex ?? -1];
      if (!to) continue;
      const key = drivePairKey(pointId, to.id);
      const reason = elementFailureReason(el);
      pairs[key] = reason
        ? null
        : {
            minutes: secondsToMinutes(parseDurationSeconds(el.duration)!),
            miles: metersToMiles(el.distanceMeters!),
          };
    }
    await sleep(REQUEST_GAP_MS);
  }

  // Every other point → new point
  for (const group of otherGroups) {
    if (!group.length) continue;
    const elements = await fetchMatrix(apiKey, group, [newPoint]);
    for (const el of elements) {
      const from = group[el.originIndex ?? -1];
      if (!from) continue;
      const key = drivePairKey(from.id, pointId);
      const reason = elementFailureReason(el);
      pairs[key] = reason
        ? null
        : {
            minutes: secondsToMinutes(parseDurationSeconds(el.duration)!),
            miles: metersToMiles(el.distanceMeters!),
          };
    }
    await sleep(REQUEST_GAP_MS);
  }

  await saveExtraPairs(pairs, calculatedDate);
  await loadDriveExtras();
  return { pointId, pairCount: Object.keys(pairs).length };
}

/** Recompute legs after the drive address changes. */
export async function refreshSchoolDrivePoint(input: {
  schoolId: string;
  schoolName: string;
  cityState: string;
  address: string;
}): Promise<{ pointId: string; pairCount: number }> {
  return addSchoolDrivePoint(input);
}
