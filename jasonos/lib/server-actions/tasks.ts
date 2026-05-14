"use server";

import { revalidatePath } from "next/cache";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Subtask {
  id: string;
  text: string;
  items: { id: string; text: string }[];
}

export interface TaskTemplate {
  id: string;
  name: string;
  track: string;
  subTrack: string | null;
  defaultTimeEstimate: number;
  kpiMapping: string;
  status: "Active" | "Paused" | "Archived";
  subtasks: Subtask[];
  createdAt: string;
}

interface TaskRow {
  id: string;
  name: string;
  track: string;
  sub_track: string | null;
  default_estimate_minutes: number;
  kpi_mapping: string;
  status: string;
  subtasks: unknown;
  created_at: string;
}

function rowToTask(row: TaskRow): TaskTemplate {
  return {
    id: row.id,
    name: row.name,
    track: row.track,
    subTrack: row.sub_track ?? null,
    defaultTimeEstimate: row.default_estimate_minutes,
    kpiMapping: row.kpi_mapping ?? "",
    status: (row.status as TaskTemplate["status"]) ?? "Active",
    subtasks: Array.isArray(row.subtasks) ? (row.subtasks as Subtask[]) : [],
    createdAt: row.created_at,
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<TaskTemplate[]> {
  if (!hasConfig()) return [];

  const db = createPublicServiceRoleClient();
  const { data, error } = await db
    .from("task_templates")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getTasks]", error.message);
    return [];
  }

  return (data ?? []).map((row) => rowToTask(row as TaskRow));
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function createTask(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const id = crypto.randomUUID();
  const { error } = await db.from("task_templates").insert([{
    id,
    name: "New Task",
    track: "advisors",
    sub_track: null,
    default_estimate_minutes: 25,
    kpi_mapping: "",
    status: "Active",
    subtasks: [],
    updated_at: new Date().toISOString(),
  }]);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks");
  return { ok: true, id };
}

export async function saveTask(task: {
  id: string;
  name: string;
  track: string;
  subTrack: string | null;
  defaultTimeEstimate: number;
  kpiMapping: string;
  status: string;
  subtasks: Subtask[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  if (!task.name.trim()) return { ok: false, error: "Name is required" };
  if (task.defaultTimeEstimate < 1) return { ok: false, error: "Time estimate must be ≥ 1 min" };

  const db = createPublicServiceRoleClient();
  const { error } = await db
    .from("task_templates")
    .update({
      name: task.name.trim(),
      track: task.track,
      sub_track: task.subTrack,
      default_estimate_minutes: task.defaultTimeEstimate,
      kpi_mapping: task.kpiMapping,
      status: task.status,
      subtasks: task.subtasks,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks");
  return { ok: true };
}

export async function deleteTask(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const db = createPublicServiceRoleClient();
  const { error } = await db.from("task_templates").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks");
  return { ok: true };
}
