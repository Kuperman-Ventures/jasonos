"use server";

import { revalidatePath } from "next/cache";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkSearch {
  id: string;
  date: string;
  company_name: string;
  company_location: string;
  contact_method: string;
  contact_person: string | null;
  position_applied: string;
  result: string;
  created_at: string;
  // Proof-of-effort fields (migration 0022). Nullable for rows logged before
  // the columns existed; the UI derives a fallback tier from contact_method.
  activity_tier: string | null;
  outcome_next_step: string | null;
  next_contact_date: string | null;
  parent_activity_id: string | null;
}

export interface BusinessHour {
  id: string;
  date: string;
  entity: string;
  activity_description: string;
  hours: number;
  minutes: number;
  created_at: string;
  // Category for hourly breakdowns (migration 0042). Nullable for older rows.
  activity_category: string | null;
  // Client the hours were for (migration 0043). Nullable for older rows.
  client_name: string | null;
}

export interface NyuiWeekData {
  workSearches: WorkSearch[];
  businessHours: BusinessHour[];
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getWeekData(weekStart: string, weekEnd: string): Promise<NyuiWeekData> {
  if (!hasConfig()) return { workSearches: [], businessHours: [] };

  const db = createPublicServiceRoleClient();
  const [wsRes, bhRes] = await Promise.all([
    db.from("work_searches").select("*").gte("date", weekStart).lte("date", weekEnd).order("date"),
    db.from("business_hours").select("*").gte("date", weekStart).lte("date", weekEnd).order("date"),
  ]);

  return {
    workSearches: (wsRes.data ?? []) as WorkSearch[],
    businessHours: (bhRes.data ?? []) as BusinessHour[],
  };
}

/**
 * All work-search activities across all time, newest first. Powers the
 * "All Activity" history view (grouped by claim week in the client).
 */
export async function getAllWorkSearches(): Promise<WorkSearch[]> {
  if (!hasConfig()) return [];

  const db = createPublicServiceRoleClient();
  const { data } = await db
    .from("work_searches")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []) as WorkSearch[];
}

/**
 * All business-hours entries across all time, newest first. Shown under each
 * claim week in the All Activity view alongside work searches.
 */
export async function getAllBusinessHours(): Promise<BusinessHour[]> {
  if (!hasConfig()) return [];

  const db = createPublicServiceRoleClient();
  const { data } = await db
    .from("business_hours")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []) as BusinessHour[];
}

/**
 * NYS Work Search ID (format "NY" + 9 digits). Sensitive config — stamped on
 * audit exports so an auditor can match the claimant, NEVER the SSN. Stored in
 * the NYUI_WORK_SEARCH_ID env var (server-only); the SSN is never stored or
 * surfaced anywhere in this tool.
 */
export async function getWorkSearchId(): Promise<string | null> {
  return process.env.NYUI_WORK_SEARCH_ID?.trim() || null;
}

export async function getExportData(startDate: string, endDate: string): Promise<{
  workSearches: WorkSearch[];
  businessHours: BusinessHour[];
  workSearchId: string | null;
  error?: string;
}> {
  const workSearchId = await getWorkSearchId();
  if (!hasConfig())
    return { workSearches: [], businessHours: [], workSearchId, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const [wsRes, bhRes] = await Promise.all([
    db.from("work_searches").select("*").gte("date", startDate).lte("date", endDate).order("date"),
    db.from("business_hours").select("*").gte("date", startDate).lte("date", endDate).order("date"),
  ]);

  if (wsRes.error)
    return { workSearches: [], businessHours: [], workSearchId, error: wsRes.error.message };
  if (bhRes.error)
    return { workSearches: [], businessHours: [], workSearchId, error: bhRes.error.message };

  return {
    workSearches: (wsRes.data ?? []) as WorkSearch[],
    businessHours: (bhRes.data ?? []) as BusinessHour[],
    workSearchId,
  };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function addWorkSearch(data: {
  date: string;
  company_name: string;
  company_location: string;
  contact_method: string;
  contact_person: string | null;
  position_applied: string;
  result: string;
  // Proof-of-effort fields (migration 0022). All optional/additive.
  activity_tier?: string | null;
  outcome_next_step?: string | null;
  next_contact_date?: string | null;
  parent_activity_id?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("work_searches").insert([
    {
      date: data.date,
      company_name: data.company_name,
      company_location: data.company_location,
      contact_method: data.contact_method,
      contact_person: data.contact_person,
      position_applied: data.position_applied,
      result: data.result,
      activity_tier: data.activity_tier ?? null,
      outcome_next_step: data.outcome_next_step ?? null,
      next_contact_date: data.next_contact_date ?? null,
      parent_activity_id: data.parent_activity_id ?? null,
    },
  ]);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}

export async function updateWorkSearch(data: {
  id: string;
  date: string;
  company_name: string;
  company_location: string;
  contact_method: string;
  contact_person: string | null;
  position_applied: string;
  result: string;
  activity_tier?: string | null;
  outcome_next_step?: string | null;
  next_contact_date?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db
    .from("work_searches")
    .update({
      date: data.date,
      company_name: data.company_name,
      company_location: data.company_location,
      contact_method: data.contact_method,
      contact_person: data.contact_person,
      position_applied: data.position_applied,
      result: data.result,
      activity_tier: data.activity_tier ?? null,
      outcome_next_step: data.outcome_next_step ?? null,
      next_contact_date: data.next_contact_date ?? null,
    })
    .eq("id", data.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}

export async function deleteWorkSearch(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  // parent_activity_id is ON DELETE SET NULL, so removing a parent just unlinks
  // any follow-ups rather than deleting them.
  const { error } = await db.from("work_searches").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}

export async function addBusinessHours(data: {
  date: string;
  entity: string;
  activity_description: string;
  hours: number;
  minutes: number;
  activity_category?: string | null;
  client_name?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("business_hours").insert([
    {
      date: data.date,
      entity: data.entity,
      activity_description: data.activity_description,
      hours: data.hours,
      minutes: data.minutes,
      activity_category: data.activity_category ?? null,
      client_name: data.client_name?.trim() || null,
    },
  ]);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}

/** Insert multiple category breakdown rows for one date + entity in one shot. */
export async function addBusinessHoursBatch(
  rows: {
    date: string;
    entity: string;
    activity_description: string;
    hours: number;
    minutes: number;
    activity_category: string;
    client_name?: string | null;
  }[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (rows.length === 0) return { ok: false, error: "No hours to log" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("business_hours").insert(
    rows.map((r) => ({
      date: r.date,
      entity: r.entity,
      activity_description: r.activity_description,
      hours: r.hours,
      minutes: r.minutes,
      activity_category: r.activity_category,
      client_name: r.client_name?.trim() || null,
    }))
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true, count: rows.length };
}

export async function updateBusinessHours(data: {
  id: string;
  date: string;
  entity: string;
  activity_description: string;
  hours: number;
  minutes: number;
  activity_category?: string | null;
  client_name?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db
    .from("business_hours")
    .update({
      date: data.date,
      entity: data.entity,
      activity_description: data.activity_description,
      hours: data.hours,
      minutes: data.minutes,
      activity_category: data.activity_category ?? null,
      client_name: data.client_name?.trim() || null,
    })
    .eq("id", data.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}

export async function deleteBusinessHours(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("business_hours").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}
