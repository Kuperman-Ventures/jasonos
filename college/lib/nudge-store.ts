/** Persist nudge blurbs and send records on college.app_state. */

import { collegeDb, supabaseConfigured } from "@/lib/db";
import {
  advanceWeekly,
  scheduleIsDue,
  type NudgeRecord,
  type NudgeSchedule,
  type NudgeStatus,
} from "@/lib/nudge";

const STATE_ID = "kyle-college";

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.trim()) out[key] = entry.trim();
  }
  return out;
}

function asSchedule(value: unknown): NudgeSchedule | null {
  if (value === "now") return "now";
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.at === "string") return { at: row.at };
  if (row.recurring === "weekly" && row.day === "fri" && row.time === "08:00" && typeof row.nextAt === "string") {
    return { recurring: "weekly", day: "fri", time: "08:00", nextAt: row.nextAt };
  }
  return null;
}

export function normalizeNudge(value: unknown): NudgeRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const schedule = asSchedule(row.schedule);
  if (!schedule || typeof row.id !== "string") return null;
  const status: NudgeStatus =
    row.status === "sent" || row.status === "scheduled" || row.status === "draft" ? row.status : "draft";
  return {
    id: row.id,
    createdBy: typeof row.createdBy === "string" ? row.createdBy : "",
    recipients: Array.isArray(row.recipients) ? row.recipients.filter((id) => typeof id === "string") : [],
    stageIds: Array.isArray(row.stageIds) ? row.stageIds.filter((id) => typeof id === "string") : [],
    todoIds: Array.isArray(row.todoIds) ? row.todoIds.filter((id) => typeof id === "string") : [],
    note: typeof row.note === "string" ? row.note : "",
    schedule,
    status,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    sentAt: typeof row.sentAt === "string" ? row.sentAt : null,
    lastError: typeof row.lastError === "string" ? row.lastError : null,
  };
}

export function normalizeNudges(value: unknown): NudgeRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeNudge).filter((row): row is NudgeRecord => row != null);
}

type StoreRow = { nudge_blurbs?: unknown; nudges?: unknown };

async function readRow(): Promise<StoreRow> {
  if (!supabaseConfigured()) return {};
  const db = collegeDb();
  const { data, error } = await db
    .from("app_state")
    .select("nudge_blurbs, nudges")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (error) throw error;
  return (data ?? {}) as StoreRow;
}

export async function loadNudgeBlurbs(): Promise<Record<string, string>> {
  const row = await readRow();
  return asRecord(row.nudge_blurbs);
}

export async function saveNudgeBlurb(itemId: string, blurb: string): Promise<Record<string, string>> {
  const current = await loadNudgeBlurbs();
  const next = { ...current };
  const trimmed = blurb.trim();
  if (trimmed) next[itemId] = trimmed;
  else delete next[itemId];
  if (!supabaseConfigured()) return next;
  const db = collegeDb();
  const { error } = await db.from("app_state").update({ nudge_blurbs: next }).eq("id", STATE_ID);
  if (error) throw error;
  return next;
}

export async function loadNudges(): Promise<NudgeRecord[]> {
  const row = await readRow();
  return normalizeNudges(row.nudges);
}

export async function saveNudges(nudges: NudgeRecord[]): Promise<void> {
  if (!supabaseConfigured()) return;
  const db = collegeDb();
  const { error } = await db.from("app_state").update({ nudges }).eq("id", STATE_ID);
  if (error) throw error;
}

export async function appendNudge(record: NudgeRecord): Promise<void> {
  const current = await loadNudges();
  await saveNudges([record, ...current].slice(0, 40));
}

export async function patchNudge(id: string, patch: Partial<NudgeRecord>): Promise<NudgeRecord | null> {
  const current = await loadNudges();
  let updated: NudgeRecord | null = null;
  const next = current.map((row) => {
    if (row.id !== id) return row;
    updated = { ...row, ...patch };
    return updated;
  });
  if (!updated) return null;
  await saveNudges(next);
  return updated;
}

export function dueNudges(nudges: NudgeRecord[], now = new Date()): NudgeRecord[] {
  return nudges.filter((row) => row.status === "scheduled" && scheduleIsDue(row.schedule, now));
}

export function markNudgeSent(row: NudgeRecord, now = new Date()): NudgeRecord {
  if (row.schedule !== "now" && !("at" in row.schedule) && row.schedule.recurring === "weekly") {
    return {
      ...row,
      status: "scheduled",
      sentAt: now.toISOString(),
      lastError: null,
      schedule: advanceWeekly(row.schedule, now),
    };
  }
  return { ...row, status: "sent", sentAt: now.toISOString(), lastError: null };
}
