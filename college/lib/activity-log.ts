/** Household activity log — who did what on Kyle College. */

import { collegeDb, supabaseConfigured } from "@/lib/db";

export type ActivityEntityType =
  | "todo"
  | "note"
  | "calendar"
  | "ingest"
  | "school"
  | "checklist"
  | "system";

export type ActivityEntry = {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string | null;
  summary: string;
  detail: Record<string, unknown>;
};

export type ActivityInput = {
  actorId: string;
  actorName: string;
  action: string;
  entityType: ActivityEntityType;
  entityId?: string | null;
  summary: string;
  detail?: Record<string, unknown>;
};

const ENTITY_TYPES = new Set<ActivityEntityType>([
  "todo",
  "note",
  "calendar",
  "ingest",
  "school",
  "checklist",
  "system",
]);

function mapRow(row: Record<string, unknown>): ActivityEntry | null {
  const id = typeof row.id === "string" ? row.id : "";
  if (!id) return null;
  const entityType =
    typeof row.entity_type === "string" && ENTITY_TYPES.has(row.entity_type as ActivityEntityType)
      ? (row.entity_type as ActivityEntityType)
      : "system";
  return {
    id,
    createdAt:
      typeof row.created_at === "string" && row.created_at
        ? row.created_at
        : new Date().toISOString(),
    actorId: typeof row.actor_id === "string" ? row.actor_id : "unknown",
    actorName: typeof row.actor_name === "string" && row.actor_name ? row.actor_name : "Someone",
    action: typeof row.action === "string" ? row.action : "update",
    entityType,
    entityId: typeof row.entity_id === "string" && row.entity_id ? row.entity_id : null,
    summary: typeof row.summary === "string" && row.summary.trim() ? row.summary.trim() : "Activity",
    detail:
      row.detail && typeof row.detail === "object" && !Array.isArray(row.detail)
        ? (row.detail as Record<string, unknown>)
        : {},
  };
}

/** Fire-and-forget write — never throws into the UI path. */
export async function recordActivity(input: ActivityInput): Promise<void> {
  if (!supabaseConfigured()) return;
  try {
    const db = collegeDb();
    const { error } = await db.from("activity_log").insert({
      actor_id: input.actorId,
      actor_name: input.actorName,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      summary: input.summary.slice(0, 400),
      detail: input.detail ?? {},
    });
    if (error) console.error("activity_log insert failed", error.message);
  } catch (error) {
    console.error("activity_log insert failed", error);
  }
}

export async function listActivity(limit = 100): Promise<ActivityEntry[]> {
  if (!supabaseConfigured()) return [];
  const db = collegeDb();
  const { data, error } = await db
    .from("activity_log")
    .select("id, created_at, actor_id, actor_name, action, entity_type, entity_id, summary, detail")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 300));
  if (error) throw error;
  const out: ActivityEntry[] = [];
  for (const row of data ?? []) {
    const mapped = mapRow(row as Record<string, unknown>);
    if (mapped) out.push(mapped);
  }
  return out;
}

export function formatActivityWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function entityTypeLabel(type: ActivityEntityType): string {
  switch (type) {
    case "todo":
      return "To-do";
    case "note":
      return "Note";
    case "calendar":
      return "Calendar";
    case "ingest":
      return "Ingest";
    case "school":
      return "College";
    case "checklist":
      return "Checklist";
    case "system":
      return "System";
  }
}
