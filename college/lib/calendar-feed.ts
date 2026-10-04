import { randomBytes } from "node:crypto";
import { collegeDb, supabaseConfigured } from "@/lib/db";

const STATE_ID = "kyle-college";

export function newCalendarFeedToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Env override wins; otherwise read/create token on app_state. */
export async function resolveCalendarFeedToken(): Promise<string | null> {
  const fromEnv = process.env.COLLEGE_ICAL_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (!supabaseConfigured()) {
    return process.env.COLLEGE_ICAL_TOKEN?.trim() || "local-dev-ical-token";
  }

  const db = collegeDb();
  const { data, error } = await db
    .from("app_state")
    .select("calendar_feed_token")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (error) throw error;
  const existing =
    data && typeof (data as { calendar_feed_token?: unknown }).calendar_feed_token === "string"
      ? (data as { calendar_feed_token: string }).calendar_feed_token.trim()
      : "";
  if (existing) return existing;

  const token = newCalendarFeedToken();
  const { error: writeError } = await db.from("app_state").upsert({
    id: STATE_ID,
    calendar_feed_token: token,
    updated_at: new Date().toISOString(),
  });
  if (writeError) throw writeError;
  return token;
}

export async function loadCalendarEventsForFeed(): Promise<
  import("@/lib/calendar-events").CalendarEvent[]
> {
  const { normalizeCalendarEvents } = await import("@/lib/calendar-events");
  if (!supabaseConfigured()) return [];
  const db = collegeDb();
  const { data, error } = await db
    .from("app_state")
    .select("calendar_events")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (error) throw error;
  return normalizeCalendarEvents(
    data ? (data as { calendar_events?: unknown }).calendar_events : [],
  );
}

export function tokensMatch(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < provided.length; i += 1) {
    ok |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return ok === 0;
}

export async function loadProcessCalendarForFeed(): Promise<
  import("@/lib/calendar-events").CalendarEvent[]
> {
  const { processCalendarEntries } = await import("@/lib/calendar-sources");
  const { allTimelineStages } = await import("@/lib/timeline-stages");
  const { listProjectTodos, normalizeTodoEdits } = await import("@/lib/project-todos");
  const { normalizePersistedSteps } = await import("@/lib/ingest");
  const { phases } = await import("@/lib/content");
  const { listSchools } = await import("@/lib/db");

  const stages = allTimelineStages();
  let checklist: Record<string, boolean> = {};
  let projectSteps: import("@/lib/ingest").PersistedProjectStep[] = [];
  let todoEdits: import("@/lib/project-todos").TodoEditMap = {};

  if (supabaseConfigured()) {
    const db = collegeDb();
    const { data, error } = await db
      .from("app_state")
      .select("project_steps, todo_edits, checklist")
      .eq("id", STATE_ID)
      .maybeSingle();
    if (error) throw error;
    const row = data as {
      project_steps?: unknown;
      todo_edits?: unknown;
      checklist?: unknown;
    } | null;
    projectSteps = normalizePersistedSteps(row?.project_steps);
    todoEdits = normalizeTodoEdits(row?.todo_edits);
    checklist =
      row?.checklist && typeof row.checklist === "object" && !Array.isArray(row.checklist)
        ? (row.checklist as Record<string, boolean>)
        : {};
  }

  const todos = listProjectTodos(checklist, phases, projectSteps, todoEdits);
  const schools = await listSchools();
  return processCalendarEntries({ stages, todos, schools });
}
