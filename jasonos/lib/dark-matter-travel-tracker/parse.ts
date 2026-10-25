import {
  ITEM_KINDS,
  TRIP_STATUSES,
  type ItemKind,
  type ItineraryItem,
  type Traveler,
  type Trip,
  type TripStatus,
} from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTripStatus(value: unknown): value is TripStatus {
  return typeof value === "string" && (TRIP_STATUSES as readonly string[]).includes(value);
}

export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === "string" && (ITEM_KINDS as readonly string[]).includes(value);
}

export function optionalText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function optionalDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function optionalTime(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  return match?.[1] ?? null;
}

export function parseTraveler(value: unknown, index: number): Traveler {
  if (!isRecord(value)) {
    throw new Error(`traveler ${index} must be an object`);
  }
  if (typeof value.id !== "string" || !value.id) {
    throw new Error(`traveler ${index} needs an id`);
  }
  const name = optionalText(value.name);
  if (!name) throw new Error(`traveler ${index} needs a name`);
  return { id: value.id, name };
}

export function parseItem(value: unknown, index: number): ItineraryItem {
  if (!isRecord(value)) {
    throw new Error(`item ${index} must be an object`);
  }
  if (typeof value.id !== "string" || !value.id) {
    throw new Error(`item ${index} needs an id`);
  }
  const title = optionalText(value.title);
  if (!title) throw new Error(`item ${index} needs a title`);
  const kind = value.kind ?? "activity";
  if (!isItemKind(kind)) {
    throw new Error(`item ${index} kind must be one of ${ITEM_KINDS.join(", ")}`);
  }
  return {
    id: value.id,
    occursOn: optionalDate(value.occursOn ?? value.occurs_on),
    startTime: optionalTime(value.startTime ?? value.start_time),
    kind,
    title,
    location: optionalText(value.location),
    confirmation: optionalText(value.confirmation),
    notes: optionalText(value.notes),
    sortOrder:
      typeof value.sortOrder === "number"
        ? value.sortOrder
        : typeof value.sort_order === "number"
          ? value.sort_order
          : 0,
  };
}

export function parseTrip(value: unknown, index: number): Trip {
  if (!isRecord(value)) {
    throw new Error(`trip ${index} must be an object`);
  }
  if (typeof value.id !== "string" || !value.id) {
    throw new Error(`trip ${index} needs an id`);
  }
  if (typeof value.slug !== "string" || !value.slug) {
    throw new Error(`trip ${index} needs a slug`);
  }
  const title = optionalText(value.title);
  if (!title) throw new Error(`trip ${index} needs a title`);
  const status = value.status ?? "planning";
  if (!isTripStatus(status)) {
    throw new Error(`trip ${index} status must be one of ${TRIP_STATUSES.join(", ")}`);
  }
  const travelers = Array.isArray(value.travelers)
    ? value.travelers.map(parseTraveler)
    : [];
  const items = Array.isArray(value.items) ? value.items.map(parseItem) : [];
  return {
    id: value.id,
    slug: value.slug,
    title,
    destination: optionalText(value.destination),
    startDate: optionalDate(value.startDate ?? value.start_date),
    endDate: optionalDate(value.endDate ?? value.end_date),
    status,
    notes: optionalText(value.notes),
    travelers,
    items,
  };
}

export function assertDateOrder(startDate: string | null, endDate: string | null): void {
  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date cannot be before start date");
  }
}

export function requireTitle(title: unknown, max = 120): string {
  const value = optionalText(title);
  if (!value) throw new Error("Title is required");
  if (value.length > max) throw new Error(`Title must be ${max} characters or fewer`);
  return value;
}

export function boundText(value: unknown, max: number, label: string): string {
  const text = optionalText(value);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return text;
}
