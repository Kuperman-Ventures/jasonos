export const DARK_MATTER_ROOT = "/projects/dark-matter-travel-tracker";
export const DARK_MATTER_SHORT = "/dark-matter";
export const DARK_MATTER_API = "/api/dark-matter-travel-tracker";

export const TRIP_STATUSES = [
  "idea",
  "planning",
  "booked",
  "happening",
  "done",
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const ITEM_KINDS = [
  "flight",
  "stay",
  "transit",
  "activity",
  "meal",
  "note",
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export type Traveler = {
  id: string;
  name: string;
};

export type ItineraryItem = {
  id: string;
  occursOn: string | null;
  startTime: string | null;
  kind: ItemKind;
  title: string;
  location: string;
  confirmation: string;
  notes: string;
  sortOrder: number;
};

export type Trip = {
  id: string;
  slug: string;
  title: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  notes: string;
  travelers: Traveler[];
  items: ItineraryItem[];
};

export type TripSummary = Omit<Trip, "notes" | "travelers" | "items"> & {
  travelerNames: string[];
  itemCount: number;
};

export type TravelTrackerPayload = {
  catalogSource: "json" | "database";
  trips: Trip[];
};

export type TripWrite = {
  title: string;
  destination?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: TripStatus;
  notes?: string;
};

export type ItemWrite = {
  occursOn?: string | null;
  startTime?: string | null;
  kind?: ItemKind;
  title: string;
  location?: string;
  confirmation?: string;
  notes?: string;
  sortOrder?: number;
};

export function darkMatterTripPath(slug: string): string {
  return `${DARK_MATTER_ROOT}/${encodeURIComponent(slug)}`;
}
