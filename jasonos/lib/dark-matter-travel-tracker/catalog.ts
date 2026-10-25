import catalogJson from "./trips.json";
import { parseTrip } from "./parse";
import type { TravelTrackerPayload, Trip } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTripCatalog(raw: unknown): { version: number; trips: Trip[] } {
  if (!isRecord(raw)) {
    throw new Error("trips.json must be an object");
  }
  if (raw.version !== 1) {
    throw new Error("trips.json version must be 1");
  }
  if (!Array.isArray(raw.trips)) {
    throw new Error("trips.json trips must be an array");
  }
  return {
    version: 1,
    trips: raw.trips.map(parseTrip),
  };
}

export function loadTripCatalog(): TravelTrackerPayload {
  const catalog = parseTripCatalog(catalogJson);
  return {
    catalogSource: "json",
    trips: catalog.trips,
  };
}
