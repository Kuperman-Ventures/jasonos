import "server-only";
import { hasSupabaseConfig, jasonosDb } from "@/lib/mcp/db";
import {
  assertDateOrder,
  boundText,
  isItemKind,
  isRecord,
  isTripStatus,
  optionalDate,
  optionalTime,
  parseItem,
  parseTraveler,
  parseTrip,
  requireTitle,
} from "./parse";
import { loadTripCatalog } from "./catalog";
import { slugifyTitle, uniqueSlug } from "./slug";
import { sortItems } from "./board";
import type {
  ItemWrite,
  ItineraryItem,
  Traveler,
  TravelTrackerPayload,
  Trip,
  TripWrite,
} from "./types";

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

function rowToTrip(
  row: Record<string, unknown>,
  travelers: Traveler[],
  items: ItineraryItem[]
): Trip {
  return parseTrip(
    {
      id: row.id,
      slug: row.slug,
      title: row.title,
      destination: row.destination,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      notes: row.notes,
      travelers,
      items: sortItems(items),
    },
    0
  );
}

function travelerRow(row: unknown): Traveler | null {
  if (!isRecord(row)) return null;
  try {
    return parseTraveler(
      { id: row.id, name: row.name },
      0
    );
  } catch {
    return null;
  }
}

function itemRow(row: unknown): ItineraryItem | null {
  if (!isRecord(row)) return null;
  try {
    return parseItem(
      {
        id: row.id,
        occursOn: row.occurs_on,
        startTime: row.start_time,
        kind: row.kind,
        title: row.title,
        location: row.location,
        confirmation: row.confirmation,
        notes: row.notes,
        sortOrder: row.sort_order,
      },
      0
    );
  } catch {
    return null;
  }
}

async function loadDatabaseTrips(): Promise<Trip[] | null> {
  if (!hasSupabaseConfig()) return null;
  try {
    const db = jasonosDb();
    const [{ data: tripRows, error: tripError }, { data: travelerRows, error: travelerError }, { data: itemRows, error: itemError }] =
      await Promise.all([
        db
          .from("dark_matter_trips")
          .select("id,slug,title,destination,start_date,end_date,status,notes,created_at")
          .order("created_at", { ascending: false }),
        db.from("dark_matter_travelers").select("id,trip_id,name,created_at"),
        db
          .from("dark_matter_itinerary_items")
          .select(
            "id,trip_id,occurs_on,start_time,kind,title,location,confirmation,notes,sort_order"
          ),
      ]);
    if (tripError) fail(tripError);
    if (travelerError) fail(travelerError);
    if (itemError) fail(itemError);

    const travelersByTrip = new Map<string, Traveler[]>();
    for (const row of travelerRows ?? []) {
      const rec = row as Record<string, unknown>;
      const parsed = travelerRow(rec);
      if (!parsed || typeof rec.trip_id !== "string") continue;
      const list = travelersByTrip.get(rec.trip_id) ?? [];
      list.push(parsed);
      travelersByTrip.set(rec.trip_id, list);
    }

    const itemsByTrip = new Map<string, ItineraryItem[]>();
    for (const row of itemRows ?? []) {
      const rec = row as Record<string, unknown>;
      const parsed = itemRow(rec);
      if (!parsed || typeof rec.trip_id !== "string") continue;
      const list = itemsByTrip.get(rec.trip_id) ?? [];
      list.push(parsed);
      itemsByTrip.set(rec.trip_id, list);
    }

    return (tripRows ?? [])
      .map((row) => {
        const rec = row as Record<string, unknown>;
        if (typeof rec.id !== "string") return null;
        return rowToTrip(
          rec,
          travelersByTrip.get(rec.id) ?? [],
          itemsByTrip.get(rec.id) ?? []
        );
      })
      .filter((trip): trip is Trip => trip !== null);
  } catch (error) {
    console.error("[dark-matter] load trips failed", error);
    return null;
  }
}

export async function getTravelTracker(): Promise<TravelTrackerPayload> {
  const dbTrips = await loadDatabaseTrips();
  if (dbTrips) {
    return { catalogSource: "database", trips: dbTrips };
  }
  return loadTripCatalog();
}

export async function getTripBySlug(slug: string): Promise<Trip | null> {
  const payload = await getTravelTracker();
  return payload.trips.find((trip) => trip.slug === slug) ?? null;
}

async function takenSlugs(): Promise<Set<string>> {
  const db = jasonosDb();
  const { data, error } = await db.from("dark_matter_trips").select("slug");
  if (error) fail(error);
  return new Set((data ?? []).map((row) => String(row.slug)));
}

export async function createTrip(input: TripWrite): Promise<Trip> {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured.");
  const title = requireTitle(input.title);
  const destination = boundText(input.destination, 160, "Destination");
  const notes = boundText(input.notes, 4000, "Notes");
  const startDate = optionalDate(input.startDate ?? null);
  const endDate = optionalDate(input.endDate ?? null);
  assertDateOrder(startDate, endDate);
  const status = input.status ?? "planning";
  if (!isTripStatus(status)) throw new Error("Unknown trip status");

  const db = jasonosDb();
  const slug = uniqueSlug(slugifyTitle(title), await takenSlugs());
  const { data, error } = await db
    .from("dark_matter_trips")
    .insert({
      slug,
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      status,
      notes,
    })
    .select("id,slug,title,destination,start_date,end_date,status,notes")
    .single();
  if (error) fail(error);
  return rowToTrip(data as Record<string, unknown>, [], []);
}

export async function updateTrip(slug: string, input: Partial<TripWrite>): Promise<Trip> {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured.");
  const existing = await getTripBySlug(slug);
  if (!existing) throw new Error("Trip not found");

  const title = input.title !== undefined ? requireTitle(input.title) : existing.title;
  const destination =
    input.destination !== undefined
      ? boundText(input.destination, 160, "Destination")
      : existing.destination;
  const notes = input.notes !== undefined ? boundText(input.notes, 4000, "Notes") : existing.notes;
  const startDate =
    input.startDate !== undefined ? optionalDate(input.startDate) : existing.startDate;
  const endDate = input.endDate !== undefined ? optionalDate(input.endDate) : existing.endDate;
  assertDateOrder(startDate, endDate);
  const status = input.status ?? existing.status;
  if (!isTripStatus(status)) throw new Error("Unknown trip status");

  const db = jasonosDb();
  const { data, error } = await db
    .from("dark_matter_trips")
    .update({
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      status,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug)
    .select("id,slug,title,destination,start_date,end_date,status,notes")
    .single();
  if (error) fail(error);
  return rowToTrip(data as Record<string, unknown>, existing.travelers, existing.items);
}

export async function deleteTrip(slug: string): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured.");
  const db = jasonosDb();
  const { error } = await db.from("dark_matter_trips").delete().eq("slug", slug);
  if (error) fail(error);
}

export async function addTraveler(slug: string, name: string): Promise<Traveler> {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured.");
  const trip = await getTripBySlug(slug);
  if (!trip) throw new Error("Trip not found");
  const trimmed = boundText(name, 80, "Name");
  if (!trimmed) throw new Error("Name is required");
  const db = jasonosDb();
  const { data, error } = await db
    .from("dark_matter_travelers")
    .insert({ trip_id: trip.id, name: trimmed })
    .select("id,name")
    .single();
  if (error) fail(error);
  return parseTraveler(data, 0);
}

export async function removeTraveler(slug: string, travelerId: string): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured.");
  const trip = await getTripBySlug(slug);
  if (!trip) throw new Error("Trip not found");
  const db = jasonosDb();
  const { error } = await db
    .from("dark_matter_travelers")
    .delete()
    .eq("id", travelerId)
    .eq("trip_id", trip.id);
  if (error) fail(error);
}

export async function addItem(slug: string, input: ItemWrite): Promise<ItineraryItem> {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured.");
  const trip = await getTripBySlug(slug);
  if (!trip) throw new Error("Trip not found");
  const title = requireTitle(input.title, 160);
  const kind = input.kind ?? "activity";
  if (!isItemKind(kind)) throw new Error("Unknown item kind");
  const db = jasonosDb();
  const { data, error } = await db
    .from("dark_matter_itinerary_items")
    .insert({
      trip_id: trip.id,
      occurs_on: optionalDate(input.occursOn ?? null),
      start_time: optionalTime(input.startTime ?? null),
      kind,
      title,
      location: boundText(input.location, 160, "Location"),
      confirmation: boundText(input.confirmation, 80, "Confirmation"),
      notes: boundText(input.notes, 2000, "Notes"),
      sort_order: typeof input.sortOrder === "number" ? input.sortOrder : trip.items.length,
    })
    .select("id,occurs_on,start_time,kind,title,location,confirmation,notes,sort_order")
    .single();
  if (error) fail(error);
  return parseItem(
    {
      ...(data as Record<string, unknown>),
      occursOn: (data as { occurs_on?: unknown }).occurs_on,
      startTime: (data as { start_time?: unknown }).start_time,
      sortOrder: (data as { sort_order?: unknown }).sort_order,
    },
    0
  );
}

export async function removeItem(slug: string, itemId: string): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error("Supabase is not configured.");
  const trip = await getTripBySlug(slug);
  if (!trip) throw new Error("Trip not found");
  const db = jasonosDb();
  const { error } = await db
    .from("dark_matter_itinerary_items")
    .delete()
    .eq("id", itemId)
    .eq("trip_id", trip.id);
  if (error) fail(error);
}

export function publicPayload(payload: TravelTrackerPayload): TravelTrackerPayload {
  return {
    catalogSource: payload.catalogSource,
    trips: payload.trips.map((trip) => ({
      id: trip.id,
      slug: trip.slug,
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      status: trip.status,
      notes: trip.notes,
      travelers: trip.travelers.map((traveler) => ({
        id: traveler.id,
        name: traveler.name,
      })),
      items: trip.items.map((item) => ({
        id: item.id,
        occursOn: item.occursOn,
        startTime: item.startTime,
        kind: item.kind,
        title: item.title,
        location: item.location,
        confirmation: item.confirmation,
        notes: item.notes,
        sortOrder: item.sortOrder,
      })),
    })),
  };
}
