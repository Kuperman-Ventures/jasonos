"use server";

import { listWeeklyProvocationRows } from "@/lib/post-master/weekly-provocation/store";
import type { WeeklyProvocationListItem } from "@/lib/post-master/weekly-provocation/types";

function ensureConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function listWeeklyProvocations(): Promise<WeeklyProvocationListItem[]> {
  if (!ensureConfigured()) return [];
  try {
    return await listWeeklyProvocationRows();
  } catch (err) {
    console.error("[weekly-provocation.list]", err);
    return [];
  }
}
