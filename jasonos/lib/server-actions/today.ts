"use server";

import { revalidatePath } from "next/cache";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodayTask {
  id: string;
  templateId: string | null;
  name: string;
  track: string;
  subTrack: string;
  estimateMinutes: number;
  kpiMapping: string;
  calendarEventId: string | null;
  queueOrder: number;
  scheduledForDate: string;
}

export interface TimerSessionRow {
  sessionId: string;
  taskId: string;
  timerState: string;
  estimateSeconds: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  pauseCount: number;
  pauseDurationSeconds: number;
  cancelledSeconds: number;
  startedAtISO: string | null;
  completionType: string | null;
  completionLoggedAtISO: string | null;
  kpiValues: Record<string, unknown>;
}

export interface TodayData {
  tasks: TodayTask[];
  sessions: Record<string, TimerSessionRow>;
  date: string;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getETDateStr(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function getTodayData(): Promise<TodayData> {
  const db = createPublicServiceRoleClient();
  const date = getETDateStr();

  const { data: taskRows } = await db
    .from("today_task_instances")
    .select("*")
    .eq("scheduled_for_date", date)
    .order("queue_order", { ascending: true });

  const tasks: TodayTask[] = (taskRows ?? []).map((row) => ({
    id: row.id,
    templateId: row.template_id_snapshot ?? null,
    name: row.name_snapshot ?? "(untitled)",
    track: row.track_snapshot ?? "advisors",
    subTrack: row.sub_track ?? "",
    estimateMinutes: Math.round((row.estimate_minutes_snapshot ?? 25)),
    kpiMapping: row.kpi_mapping_snapshot ?? "",
    calendarEventId: row.calendar_event_id ?? null,
    queueOrder: row.queue_order ?? 0,
    scheduledForDate: row.scheduled_for_date ?? date,
  }));

  let sessions: Record<string, TimerSessionRow> = {};
  if (tasks.length > 0) {
    const taskIds = tasks.map((t) => t.id);
    const { data: sessionRows } = await db
      .from("timer_sessions")
      .select("*")
      .in("task_instance_id", taskIds);

    for (const row of sessionRows ?? []) {
      const tid = row.task_instance_id;
      if (!tid) continue;
      const estimateSeconds = row.estimate_seconds ?? 0;
      const elapsedSeconds = row.elapsed_seconds ?? 0;
      const savedState = row.timer_state ?? "notStarted";
      const timerState = savedState === "running" ? "paused" : savedState;

      sessions[tid] = {
        sessionId: row.id,
        taskId: tid,
        timerState,
        estimateSeconds,
        remainingSeconds: Math.max(0, estimateSeconds - elapsedSeconds),
        elapsedSeconds,
        pauseCount: row.pause_count ?? 0,
        pauseDurationSeconds: row.pause_duration_seconds ?? 0,
        cancelledSeconds: row.cancelled_seconds ?? 0,
        startedAtISO: row.started_at ?? null,
        completionType: row.completion_type ?? null,
        completionLoggedAtISO: row.completed_at ?? null,
        kpiValues: row.kpi_values && typeof row.kpi_values === "object" ? row.kpi_values : {},
      };
    }
  }

  return { tasks, sessions, date };
}

// ─── Timer State Transitions ──────────────────────────────────────────────────

interface TaskMeta {
  id: string;
  name: string;
  track: string;
  subTrack: string;
  kpiMapping: string;
  estimateMinutes: number;
}

async function getUserId(): Promise<string | null> {
  const db = createPublicServiceRoleClient();
  const { data } = await db
    .from("timer_sessions")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

export async function persistTimerSession(
  session: TimerSessionRow,
  task: TaskMeta
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createPublicServiceRoleClient();
  const userId = await getUserId();

  const row: Record<string, unknown> = {
    id: session.sessionId,
    task_instance_id: task.id,
    task_name: task.name,
    track: task.track,
    sub_track: task.subTrack ?? "",
    kpi_mapping: task.kpiMapping ?? "",
    kpi_values:
      session.kpiValues && Object.keys(session.kpiValues).length > 0
        ? session.kpiValues
        : null,
    quantity: 1,
    timer_state: session.timerState,
    completion_type: session.completionType ?? null,
    estimate_seconds: session.estimateSeconds,
    elapsed_seconds: session.elapsedSeconds,
    pause_count: session.pauseCount,
    pause_duration_seconds: session.pauseDurationSeconds,
    overrun_seconds: Math.max(
      0,
      (session.elapsedSeconds ?? 0) - (session.estimateSeconds ?? 0)
    ),
    cancelled_seconds: session.cancelledSeconds,
    started_at: session.startedAtISO,
    completed_at: session.completionLoggedAtISO,
    updated_at: new Date().toISOString(),
  };
  if (userId) row.user_id = userId;

  const { error } = await db
    .from("timer_sessions")
    .upsert(row, { onConflict: "id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Quick Log ────────────────────────────────────────────────────────────────

export interface QuickLogInput {
  who: string;
  activityType: string;
  track: string;
  subTrack: string;
  durationMinutes: number;
  kpiCredits: string[];
  kpiQuantities: Record<string, number>;
  note: string;
}

export async function addQuickLog(
  input: QuickLogInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createPublicServiceRoleClient();
  const userId = await getUserId();

  const row: Record<string, unknown> = {
    who: input.who,
    activity_type: input.activityType,
    duration_minutes: input.durationMinutes,
    kpi_credits: input.kpiCredits,
    track: input.track || null,
    sub_track: input.subTrack || null,
    note: input.note || null,
    logged_at: new Date().toISOString(),
  };
  if (userId) row.user_id = userId;

  const { error } = await db.from("quick_log_entries").insert(row);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/today");
  return { ok: true };
}
