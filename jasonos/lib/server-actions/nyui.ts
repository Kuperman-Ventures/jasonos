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
 * "All Applications" history view (grouped by claim week in the client).
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

export async function addBusinessHours(data: {
  date: string;
  entity: string;
  activity_description: string;
  hours: number;
  minutes: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("business_hours").insert([data]);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/nyui");
  return { ok: true };
}
