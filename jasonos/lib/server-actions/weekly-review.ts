"use server";

import { revalidatePath } from "next/cache";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  taskName: string;
  track: string;
  subTrack: string;
  kpiMapping: string;
  kpiValues: Record<string, unknown>;
  quantity: number;
  completionType: string | null;
  outcomeAchieved: string | null;
  definitionOfDoneUsed: boolean;
  completedAt: string;
  estimateSeconds: number;
  elapsedSeconds: number;
  pauseCount: number;
  pauseDurationSeconds: number;
  cancelledSeconds: number;
  isQuickLog: boolean;
}

export interface CalendarTagWR {
  track: string;
  subTrack: string | null;
  title: string;
  durationMin: number;
  date: string | null;
  kpiCredits: string[];
  kpiQuantities: Record<string, number>;
}

export interface FridayReview {
  id?: string;
  week_start: string;
  week_score: string | null;
  kpis_hit: number | null;
  kpis_total: number | null;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  monday_intention: string | null;
  updated_at: string;
}

export interface QuickLogEntry {
  id: string;
  who: string;
  activity_type: string;
  duration_minutes: number;
  kpi_credits: string[];
  track: string | null;
  sub_track: string | null;
  note: string | null;
  logged_at: string;
}

export interface WeeklyReviewData {
  completionLog: LogEntry[];
  calendarEventTags: Record<string, CalendarTagWR>;
  fridayReviews: FridayReview[];
  quickLogs: QuickLogEntry[];
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

/** Load all data needed for the weekly review — last 90 days. */
export async function getWeeklyReviewData(): Promise<WeeklyReviewData> {
  const db = createPublicServiceRoleClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const quickSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [timerResult, tagsResult, reviewsResult, quickLogsResult] =
    await Promise.all([
      db
        .from("timer_sessions")
        .select("*")
        .gte("created_at", since)
        .not("completion_type", "is", null)
        .order("completed_at", { ascending: true }),
      db.from("calendar_event_tags").select("*"),
      db
        .from("friday_reviews")
        .select("*")
        .order("week_start", { ascending: false }),
      db
        .from("quick_log_entries")
        .select("*")
        .gte("logged_at", quickSince)
        .order("logged_at", { ascending: false }),
    ]);

  const completionLog: LogEntry[] = (timerResult.data ?? []).map((row) => ({
    id: row.id,
    taskName: row.task_name ?? "",
    track: row.track ?? "",
    subTrack: row.sub_track ?? "",
    kpiMapping: row.kpi_mapping ?? "",
    kpiValues:
      row.kpi_values && typeof row.kpi_values === "object" ? row.kpi_values : {},
    quantity: row.quantity ?? 1,
    completionType: row.completion_type ?? null,
    outcomeAchieved: row.outcome_achieved ?? null,
    definitionOfDoneUsed: Boolean(row.definition_of_done?.trim()),
    completedAt: row.completed_at ?? row.updated_at ?? new Date().toISOString(),
    estimateSeconds: row.estimate_seconds ?? 0,
    elapsedSeconds: row.elapsed_seconds ?? 0,
    pauseCount: row.pause_count ?? 0,
    pauseDurationSeconds: row.pause_duration_seconds ?? 0,
    cancelledSeconds: row.cancelled_seconds ?? 0,
    isQuickLog: Boolean(row.is_quick_log),
  }));

  const calendarEventTags: Record<string, CalendarTagWR> = Object.fromEntries(
    (tagsResult.data ?? []).map((row) => [
      row.gcal_event_id,
      {
        track: row.track,
        subTrack: row.sub_track ?? null,
        title: row.event_title ?? "",
        durationMin: row.duration_min ?? 0,
        date: row.event_date ?? null,
        kpiCredits: Array.isArray(row.kpi_credits) ? row.kpi_credits : [],
        kpiQuantities:
          row.kpi_quantities &&
          typeof row.kpi_quantities === "object" &&
          !Array.isArray(row.kpi_quantities)
            ? row.kpi_quantities
            : {},
      },
    ])
  );

  const fridayReviews: FridayReview[] = (reviewsResult.data ?? []) as FridayReview[];

  const quickLogs: QuickLogEntry[] = (quickLogsResult.data ?? []).map((row) => ({
    id: row.id,
    who: row.who ?? "",
    activity_type: row.activity_type ?? "",
    duration_minutes: row.duration_minutes ?? 0,
    kpi_credits: Array.isArray(row.kpi_credits) ? row.kpi_credits : [],
    track: row.track ?? null,
    sub_track: row.sub_track ?? null,
    note: row.note ?? null,
    logged_at: row.logged_at ?? new Date().toISOString(),
  }));

  return { completionLog, calendarEventTags, fridayReviews, quickLogs };
}

// ─── Friday Review Persistence ────────────────────────────────────────────────

export async function upsertFridayReview(data: {
  weekStart: string;
  weekScore: string;
  kpisHit: number;
  kpisTotal: number;
  q1: string;
  q2: string;
  q3: string;
  mondayIntention: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createPublicServiceRoleClient();

  // Derive user_id from existing timer session (single-user personal app).
  const { data: session } = await db
    .from("timer_sessions")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();

  const userId = (session as { user_id?: string } | null)?.user_id ?? null;

  const record: Record<string, unknown> = {
    week_start: data.weekStart,
    week_score: data.weekScore,
    kpis_hit: data.kpisHit,
    kpis_total: data.kpisTotal,
    q1: data.q1,
    q2: data.q2,
    q3: data.q3,
    monday_intention: data.mondayIntention,
    updated_at: new Date().toISOString(),
  };
  if (userId) record.user_id = userId;

  const conflictKey = userId ? "user_id,week_start" : "week_start";
  const { error } = await db
    .from("friday_reviews")
    .upsert(record, { onConflict: conflictKey });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/weekly-review");
  return { ok: true };
}

// ─── Session Mutation (Reconcile) ─────────────────────────────────────────────

export async function deleteTimerSession(
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createPublicServiceRoleClient();
  const { error } = await db
    .from("timer_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/weekly-review");
  return { ok: true };
}
