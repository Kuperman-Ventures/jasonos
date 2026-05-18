"use server";

import { revalidatePath } from "next/cache";
import {
  createPublicClient,
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import {
  getGoogleAccessToken,
  fetchAllCosaCalendarEvents,
  fetchPersonalCalendarEvents,
  createGCalEvent,
  updateGCalEvent,
  deleteGCalEvent,
  type GCalEvent,
} from "@/lib/integrations/google-calendar";
import type { CalendarTag } from "@/lib/calendar/health-model";
import { COSA_ALLOCATION_DEFAULTS } from "@/lib/calendar/health-model";

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Resolve the owner's auth.users.id for tables that require user_id (single-user app).
// Tries (in order): the authenticated session, JASONOS_OWNER_USER_ID env, the Google
// integration row's owner, then any timer_sessions row. Returns null if none can be found.
async function getOwnerUserId(): Promise<string | null> {
  try {
    const sb = await createPublicClient();
    const { data, error } = await sb.auth.getUser();
    if (!error && data.user?.id) return data.user.id;
  } catch {
    // ignored — no auth context (e.g. background invocation)
  }

  const configured = process.env.JASONOS_OWNER_USER_ID?.trim();
  if (configured) return configured;

  if (!hasConfig()) return null;

  try {
    const jasonosDb = createServiceRoleClient();
    const { data } = await jasonosDb
      .from("user_integrations")
      .select("user_id")
      .eq("provider", "google")
      .not("user_id", "is", null)
      .limit(1)
      .maybeSingle();
    const id = (data as { user_id?: string | null } | null)?.user_id ?? null;
    if (id) return id;
  } catch {
    // continue
  }

  try {
    const publicDb = createPublicServiceRoleClient();
    const { data } = await publicDb
      .from("timer_sessions")
      .select("user_id")
      .not("user_id", "is", null)
      .limit(1)
      .maybeSingle();
    return (data as { user_id?: string | null } | null)?.user_id ?? null;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarWeekData {
  weekEvents: GCalEvent[];          // CoSA-tagged events (cosaTag=cosa-event)
  untaggedCosaEvents: GCalEvent[];  // CoSA calendar events without cosaTag
  personalEvents: GCalEvent[];      // Primary calendar events
  calendarTags: Record<string, CalendarTag>;
  googleConnected: boolean;
}

export type AllocationsMap = Record<string, { weekly: number; subTracks: Record<string, number> }>;

// ─── Allocations ──────────────────────────────────────────────────────────────

export async function getAllocations(): Promise<AllocationsMap> {
  if (!hasConfig()) return COSA_ALLOCATION_DEFAULTS;

  const db = createPublicServiceRoleClient();
  const { data } = await db
    .from("user_preferences")
    .select("allocations")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const raw = (data as { allocations?: unknown } | null)?.allocations;
  if (!raw || typeof raw !== "object") return COSA_ALLOCATION_DEFAULTS;
  const parsed = raw as AllocationsMap;
  if (!parsed.development) return COSA_ALLOCATION_DEFAULTS;
  return parsed;
}

export async function saveAllocations(
  allocations: AllocationsMap
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { data: existing } = await db
    .from("user_preferences")
    .select("id")
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing?.id) {
    const { error } = await db
      .from("user_preferences")
      .update({ allocations, updated_at: now })
      .eq("id", (existing as { id: string }).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await db
      .from("user_preferences")
      .insert([{ allocations, updated_at: now }]);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/calendar");
  return { ok: true };
}

// ─── Calendar tags ────────────────────────────────────────────────────────────

async function loadCalendarTags(): Promise<Record<string, CalendarTag>> {
  if (!hasConfig()) return {};
  const db = createPublicServiceRoleClient();
  const userId = await getOwnerUserId();

  let query = db.from("calendar_event_tags").select("*");
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query;

  const tags: Record<string, CalendarTag> = {};
  for (const row of data ?? []) {
    const r = row as {
      gcal_event_id: string;
      track: string;
      sub_track?: string | null;
      event_title?: string | null;
      duration_min?: number | null;
      event_date?: string | null;
      kpi_credits?: string[] | null;
      kpi_quantities?: Record<string, number> | null;
    };
    tags[r.gcal_event_id] = {
      track: r.track,
      subTrack: r.sub_track ?? null,
      title: r.event_title ?? undefined,
      durationMin: r.duration_min ?? undefined,
      date: r.event_date ?? undefined,
      kpiCredits: Array.isArray(r.kpi_credits) ? r.kpi_credits : [],
      kpiQuantities:
        r.kpi_quantities && typeof r.kpi_quantities === "object" && !Array.isArray(r.kpi_quantities)
          ? r.kpi_quantities
          : {},
    };
  }
  return tags;
}

export async function upsertCalendarTag(
  gcalEventId: string,
  tag: CalendarTag
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!gcalEventId) return { ok: false, error: "Missing calendar event id" };

  const userId = await getOwnerUserId();
  if (!userId) {
    return {
      ok: false,
      error:
        "Cannot persist calendar tag: no owner user_id resolved (set JASONOS_OWNER_USER_ID or sign in).",
    };
  }

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("calendar_event_tags").upsert(
    {
      user_id: userId,
      gcal_event_id: gcalEventId,
      track: tag.track,
      sub_track: tag.subTrack ?? null,
      event_title: tag.title ?? null,
      duration_min: tag.durationMin ?? null,
      event_date: tag.date ?? null,
      kpi_credits: tag.kpiCredits ?? [],
      kpi_quantities: tag.kpiQuantities ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,gcal_event_id" }
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/calendar");
  return { ok: true };
}

export async function removeCalendarTag(
  gcalEventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!gcalEventId) return { ok: false, error: "Missing calendar event id" };

  const db = createPublicServiceRoleClient();
  const userId = await getOwnerUserId();

  let query = db.from("calendar_event_tags").delete().eq("gcal_event_id", gcalEventId);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Week data fetch ──────────────────────────────────────────────────────────

export async function fetchCalendarWeek(
  mondayStr: string
): Promise<CalendarWeekData> {
  const token = await getGoogleAccessToken();
  if (!token) {
    const tags = await loadCalendarTags();
    return { weekEvents: [], untaggedCosaEvents: [], personalEvents: [], calendarTags: tags, googleConnected: false };
  }

  const anchor = new Date(`${mondayStr}T12:00:00`);
  const sunday = new Date(anchor);
  sunday.setDate(anchor.getDate() + 6);
  const sundayStr = sunday.toISOString().split("T")[0];

  const timeMin = new Date(`${mondayStr}T00:00:00`).toISOString();
  const timeMax = new Date(`${sundayStr}T23:59:59.999`).toISOString();

  const [allCosa, personal, tags] = await Promise.all([
    fetchAllCosaCalendarEvents(token, timeMin, timeMax),
    fetchPersonalCalendarEvents(token, timeMin, timeMax),
    loadCalendarTags(),
  ]);

  const weekEvents = allCosa.filter(
    (ev) => ev.extendedProperties?.private?.cosaTag === "cosa-event"
  );
  const untaggedCosaEvents = allCosa.filter(
    (ev) => ev.extendedProperties?.private?.cosaTag !== "cosa-event"
  );

  // Prune stale tags for deleted events in this week's range
  const livePersonalIds = new Set(personal.map((ev) => ev.id));
  const staleIds = Object.entries(tags)
    .filter(([gcalId, tag]) => {
      const tagDate = tag.date;
      if (!tagDate || tagDate < mondayStr || tagDate > sundayStr) return false;
      return !livePersonalIds.has(gcalId);
    })
    .map(([gcalId]) => gcalId);

  if (staleIds.length > 0) {
    await Promise.all(staleIds.map((id) => removeCalendarTag(id)));
    staleIds.forEach((id) => delete tags[id]);
  }

  return { weekEvents, untaggedCosaEvents, personalEvents: personal, calendarTags: tags, googleConnected: true };
}

// ─── GCal event mutations (called from client via server actions) ──────────────

export async function createCalendarEvent(input: {
  name: string;
  track: string;
  subTrack?: string | null;
  templateId?: string | null;
  startISO: string;
  endISO: string;
  userTz: string;
}): Promise<{ ok: true; event: GCalEvent } | { ok: false; error: string }> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google not connected" };

  const event = await createGCalEvent({ token, ...input });
  if (!event) return { ok: false, error: "Failed to create calendar event" };
  return { ok: true, event };
}

export async function updateCalendarEvent(input: {
  eventId: string;
  name: string;
  track: string;
  subTrack?: string | null;
  startISO: string;
  endISO: string;
  userTz: string;
}): Promise<{ ok: true; event: GCalEvent } | { ok: false; error: string }> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google not connected" };

  const event = await updateGCalEvent({ token, ...input });
  if (!event) return { ok: false, error: "Failed to update calendar event" };
  return { ok: true, event };
}

export async function deleteCalendarEvent(
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Google not connected" };

  const ok = await deleteGCalEvent(token, eventId);
  if (!ok) return { ok: false, error: "Failed to delete calendar event" };
  return { ok: true };
}
