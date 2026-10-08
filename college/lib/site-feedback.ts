/** Household feature requests and feedback for the college portal. */

import { collegeDb, supabaseConfigured } from "@/lib/db";

export const FEEDBACK_KINDS = ["bug", "idea", "question"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["new", "planned", "done", "wont"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export type SiteFeedback = {
  id: string;
  createdAt: string;
  updatedAt: string;
  memberId: string;
  memberName: string;
  kind: FeedbackKind;
  body: string;
  pageTab: string | null;
  schoolId: string | null;
  schoolName: string | null;
  status: FeedbackStatus;
  adminNote: string;
};

export type FeedbackCreateInput = {
  memberId: string;
  memberName: string;
  kind: FeedbackKind;
  body: string;
  pageTab?: string | null;
  schoolId?: string | null;
  schoolName?: string | null;
};

const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Bug",
  idea: "Idea",
  question: "Question",
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  planned: "Planned",
  done: "Done",
  wont: "Won't do",
};

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export function feedbackKindLabel(kind: FeedbackKind): string {
  return KIND_LABELS[kind];
}

export function feedbackStatusLabel(status: FeedbackStatus): string {
  return STATUS_LABELS[status];
}

export function normalizeFeedbackBody(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, 2000);
}

export function clipContext(raw: unknown, max = 120): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.replace(/\s+/g, " ").trim().slice(0, max);
  return trimmed || null;
}

function mapRow(row: Record<string, unknown>): SiteFeedback | null {
  const id = typeof row.id === "string" ? row.id : "";
  if (!id) return null;
  if (!isFeedbackKind(row.kind) || !isFeedbackStatus(row.status)) return null;
  const body = typeof row.body === "string" ? row.body.trim() : "";
  if (!body) return null;
  return {
    id,
    createdAt:
      typeof row.created_at === "string" && row.created_at
        ? row.created_at
        : new Date().toISOString(),
    updatedAt:
      typeof row.updated_at === "string" && row.updated_at
        ? row.updated_at
        : new Date().toISOString(),
    memberId: typeof row.member_id === "string" ? row.member_id : "unknown",
    memberName:
      typeof row.member_name === "string" && row.member_name.trim()
        ? row.member_name.trim()
        : "Someone",
    kind: row.kind,
    body,
    pageTab: clipContext(row.page_tab, 80),
    schoolId: clipContext(row.school_id, 80),
    schoolName: clipContext(row.school_name, 160),
    status: row.status,
    adminNote: typeof row.admin_note === "string" ? row.admin_note.trim() : "",
  };
}

export async function createSiteFeedback(input: FeedbackCreateInput): Promise<SiteFeedback> {
  const body = normalizeFeedbackBody(input.body);
  if (!body) throw new Error("Message is required");
  if (!isFeedbackKind(input.kind)) throw new Error("Invalid kind");
  if (!supabaseConfigured()) {
    const now = new Date().toISOString();
    return {
      id: `local-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      memberId: input.memberId,
      memberName: input.memberName,
      kind: input.kind,
      body,
      pageTab: clipContext(input.pageTab, 80),
      schoolId: clipContext(input.schoolId, 80),
      schoolName: clipContext(input.schoolName, 160),
      status: "new",
      adminNote: "",
    };
  }
  const db = collegeDb();
  const { data, error } = await db
    .from("site_feedback")
    .insert({
      member_id: input.memberId,
      member_name: input.memberName.trim() || "Someone",
      kind: input.kind,
      body,
      page_tab: clipContext(input.pageTab, 80),
      school_id: clipContext(input.schoolId, 80),
      school_name: clipContext(input.schoolName, 160),
      status: "new",
      admin_note: "",
    })
    .select("*")
    .single();
  if (error) throw error;
  const mapped = mapRow((data ?? {}) as Record<string, unknown>);
  if (!mapped) throw new Error("Could not save feedback");
  return mapped;
}

export async function listSiteFeedbackForMember(
  memberId: string,
  limit = 20,
): Promise<SiteFeedback[]> {
  if (!supabaseConfigured()) return [];
  const db = collegeDb();
  const { data, error } = await db
    .from("site_feedback")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)));
  if (error) throw error;
  return (data ?? [])
    .map((row) => mapRow(row as Record<string, unknown>))
    .filter((row): row is SiteFeedback => Boolean(row));
}

export async function listAllSiteFeedback(limit = 100): Promise<SiteFeedback[]> {
  if (!supabaseConfigured()) return [];
  const db = collegeDb();
  const { data, error } = await db
    .from("site_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));
  if (error) throw error;
  return (data ?? [])
    .map((row) => mapRow(row as Record<string, unknown>))
    .filter((row): row is SiteFeedback => Boolean(row));
}

export async function updateSiteFeedbackStatus(
  id: string,
  patch: { status: FeedbackStatus; adminNote?: string },
): Promise<SiteFeedback> {
  if (!isFeedbackStatus(patch.status)) throw new Error("Invalid status");
  if (!supabaseConfigured()) throw new Error("Supabase is not configured");
  const db = collegeDb();
  const update: Record<string, unknown> = {
    status: patch.status,
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.adminNote === "string") {
    update.admin_note = patch.adminNote.replace(/\s+/g, " ").trim().slice(0, 500);
  }
  const { data, error } = await db
    .from("site_feedback")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const mapped = mapRow((data ?? {}) as Record<string, unknown>);
  if (!mapped) throw new Error("Feedback not found");
  return mapped;
}

export function formatFeedbackWhen(iso: string, now = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const ms = Math.max(0, now.getTime() - then.getTime());
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
