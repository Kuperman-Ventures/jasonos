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

export async function getExportData(startDate: string, endDate: string): Promise<{
  workSearches: WorkSearch[];
  businessHours: BusinessHour[];
  error?: string;
}> {
  if (!hasConfig()) return { workSearches: [], businessHours: [], error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const [wsRes, bhRes] = await Promise.all([
    db.from("work_searches").select("*").gte("date", startDate).lte("date", endDate).order("date"),
    db.from("business_hours").select("*").gte("date", startDate).lte("date", endDate).order("date"),
  ]);

  if (wsRes.error) return { workSearches: [], businessHours: [], error: wsRes.error.message };
  if (bhRes.error) return { workSearches: [], businessHours: [], error: bhRes.error.message };

  return {
    workSearches: (wsRes.data ?? []) as WorkSearch[],
    businessHours: (bhRes.data ?? []) as BusinessHour[],
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
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("work_searches").insert([data]);
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
