import type { Track } from "../types";
import {
  canonicalApplicationRows,
  isApplicationWorkSearch,
  resolvedScoreboardStatus,
} from "../scoreboard/types";
import { jasonosDb, publicDb } from "./db";
import { sanitizeSearch, uniqueAlerts } from "./result";

/** Live public.today_task_instances columns. sub_track lives on timer_sessions, not here. */
export const TODAY_TASK_COLUMNS =
  "id,name_snapshot,track_snapshot,estimate_minutes_snapshot,kpi_mapping_snapshot,queue_order,scheduled_for_date,calendar_event_id,template_id_snapshot";

const TRACKS = ["venture", "advisors", "job_search", "personal"] as const;
const CARD_STATES = ["open", "actioned", "dismissed", "snoozed", "archived"] as const;
const TODO_STATES = ["open", "done"] as const;

function etDate(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function isTrack(value: string | undefined): value is Track {
  return !!value && (TRACKS as readonly string[]).includes(value);
}

function slimCard(row: Record<string, unknown>) {
  const body = row.body && typeof row.body === "object" ? (row.body as Record<string, unknown>) : null;
  const draft = typeof body?.draft === "string" ? body.draft.slice(0, 600) : undefined;
  return {
    id: row.id,
    track: row.track,
    module: row.module,
    title: row.title,
    subtitle: row.subtitle ?? null,
    why_now: row.why_now ?? null,
    state: row.state,
    vip: row.vip ?? false,
    priority_score: row.priority_score ?? null,
    verbs: row.verbs ?? [],
    pinned_at: row.pinned_at ?? null,
    snoozed_until: row.snoozed_until ?? null,
    created_at: row.created_at,
    draft,
  };
}

export async function getStatus() {
  const sb = jasonosDb();
  const date = etDate();
  const [cards, todos, alerts, today, latestBrief] = await Promise.all([
    sb.from("cards").select("id", { count: "exact", head: true }).eq("state", "open"),
    sb.from("todos").select("id", { count: "exact", head: true }).eq("state", "open"),
    sb
      .from("alerts")
      .select("id,source,title,body,created_at")
      .eq("state", "open")
      .eq("severity", "critical")
      .order("created_at", { ascending: false })
      .limit(200),
    publicDb()
      .from("today_task_instances")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_for_date", date),
    publicDb()
      .from("morning_briefs")
      .select("brief_date,created_at")
      .order("brief_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const openAlerts = uniqueAlerts(alerts.data).map((row) => ({
    id: row.id,
    source: row.source,
    title: row.title,
    created_at: row.created_at,
  }));

  return {
    ok: true,
    date,
    timezone: "America/New_York",
    open_cards: cards.count ?? 0,
    open_todos: todos.count ?? 0,
    critical_alerts: openAlerts.length,
    alerts: openAlerts,
    today_tasks: today.error ? null : (today.count ?? 0),
    last_morning_brief_date: latestBrief.error ? null : (latestBrief.data?.brief_date ?? null),
    morning_brief_is_stale: latestBrief.error
      ? null
      : !latestBrief.data || latestBrief.data.brief_date !== date,
    app: "https://jasonos.vercel.app",
  };
}

export async function getToday() {
  const db = publicDb();
  const date = etDate();
  const { data: taskRows, error: taskError } = await db
    .from("today_task_instances")
    .select(TODAY_TASK_COLUMNS)
    .eq("scheduled_for_date", date)
    .order("queue_order", { ascending: true });

  if (taskError) throw new Error(taskError.message);

  const tasks = (taskRows ?? []).map((row) => ({
    id: row.id,
    name: row.name_snapshot ?? "(untitled)",
    track: row.track_snapshot,
    estimate_minutes: row.estimate_minutes_snapshot,
    kpi_mapping: row.kpi_mapping_snapshot,
    queue_order: row.queue_order,
    calendar_event_id: row.calendar_event_id,
    template_id: row.template_id_snapshot ?? null,
    sub_track: null as string | null,
  }));

  const sessions: Record<string, unknown> = {};
  if (tasks.length) {
    const { data: sessionRows, error: sessionError } = await db
      .from("timer_sessions")
      .select(
        "id,task_instance_id,timer_state,estimate_seconds,elapsed_seconds,pause_count,started_at,completion_type,completed_at,sub_track"
      )
      .in(
        "task_instance_id",
        tasks.map((task) => task.id)
      );
    if (sessionError) throw new Error(sessionError.message);
    for (const row of sessionRows ?? []) {
      if (!row.task_instance_id) continue;
      const saved = row.timer_state ?? "notStarted";
      sessions[row.task_instance_id] = {
        session_id: row.id,
        timer_state: saved === "running" ? "paused" : saved,
        estimate_seconds: row.estimate_seconds ?? 0,
        elapsed_seconds: row.elapsed_seconds ?? 0,
        pause_count: row.pause_count ?? 0,
        started_at: row.started_at,
        completion_type: row.completion_type,
        completed_at: row.completed_at,
        sub_track: row.sub_track ?? null,
      };
    }
  }

  for (const task of tasks) {
    const session = sessions[task.id] as { sub_track?: string | null } | undefined;
    task.sub_track = session?.sub_track ?? null;
  }

  return { date, tasks, sessions };
}

export async function listActionCards(input: {
  track?: string;
  state?: string;
  limit?: number;
}) {
  const sb = jasonosDb();
  const state = input.state && (CARD_STATES as readonly string[]).includes(input.state)
    ? input.state
    : "open";
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

  let query = sb
    .from("cards")
    .select(
      "id,track,module,title,subtitle,why_now,state,vip,priority_score,verbs,pinned_at,snoozed_until,created_at,body"
    )
    .eq("state", state)
    .order("priority_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (isTrack(input.track)) query = query.eq("track", input.track);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { state, track: input.track ?? "all", cards: (data ?? []).map((row) => slimCard(row as Record<string, unknown>)) };
}

export async function listTodos(input: { track?: string; state?: string; limit?: number }) {
  const sb = jasonosDb();
  const state = input.state && (TODO_STATES as readonly string[]).includes(input.state)
    ? input.state
    : "open";
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 80);

  let query = sb
    .from("todos")
    .select("id,track,title,notes,tags,due_date,state,project_id,created_at,updated_at")
    .eq("state", state)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (isTrack(input.track)) query = query.eq("track", input.track);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { state, track: input.track ?? "all", todos: data ?? [] };
}

export async function getMustDos() {
  const { todos } = await listTodos({ state: "open", limit: 15 });
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("cards")
    .select(
      "id,track,module,title,subtitle,why_now,state,vip,priority_score,verbs,pinned_at,snoozed_until,created_at,body"
    )
    .eq("state", "open")
    .not("pinned_at", "is", null)
    .order("pinned_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return {
    todos,
    pinned_cards: (data ?? []).map((row) => slimCard(row as Record<string, unknown>)),
  };
}

export async function addTodo(input: {
  title: string;
  track?: string;
  notes?: string;
  due_date?: string;
}) {
  const sb = jasonosDb();
  const track: Track = isTrack(input.track) ? input.track : "personal";
  const { data, error } = await sb
    .from("todos")
    .insert({
      title: input.title.trim(),
      track,
      notes: input.notes?.trim() || null,
      due_date: input.due_date || null,
      state: "open",
      source_type: "manual",
      tags: ["mcp"],
    })
    .select("id,track,title,notes,due_date,state,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, todo: data };
}

export async function completeTodo(input: { id: string; completion_note?: string }) {
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("todos")
    .update({
      state: "done",
      completion_note: input.completion_note?.trim() || null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("id,title,state,completed_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No todo found for id ${input.id}`);
  return { ok: true, todo: data };
}

export type ActionCardLink = { label: string; href: string };

export function assertSafeCardLinks(links: ActionCardLink[]): ActionCardLink[] {
  for (const link of links) {
    const href = link.href;
    if (
      !href.startsWith("https://") &&
      !href.startsWith("/") &&
      !href.startsWith("mailto:")
    ) {
      throw new Error(
        `Card link href must start with https://, /, or mailto:. Rejected: ${href}`
      );
    }
  }
  return links;
}

export function actionCardBody(input: {
  draft?: string;
  links?: ActionCardLink[];
}): Record<string, unknown> | null {
  if (input.links?.length) assertSafeCardLinks(input.links);
  return input.draft || input.links?.length
    ? {
        ...(input.draft ? { draft: input.draft } : {}),
        ...(input.links?.length ? { links: input.links } : {}),
      }
    : null;
}

export function mergeActionCardLinks(
  existingBody: unknown,
  links: ActionCardLink[]
): Record<string, unknown> {
  const safe = assertSafeCardLinks(links);
  const base =
    existingBody && typeof existingBody === "object" && !Array.isArray(existingBody)
      ? { ...(existingBody as Record<string, unknown>) }
      : {};
  return { ...base, links: safe };
}

export async function addActionCard(input: {
  title: string;
  track?: string;
  subtitle?: string;
  why_now?: string;
  draft?: string;
  module?: string;
  links?: ActionCardLink[];
}) {
  const sb = jasonosDb();
  const track: Track = isTrack(input.track) ? input.track : "advisors";
  const { data, error } = await sb
    .from("cards")
    .insert({
      track,
      module: input.module?.trim() || "mcp",
      object_type: "outreach",
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      body: actionCardBody(input),
      linked_object_ids: { source: "claude_desktop_mcp" },
      state: "open",
      vip: false,
      why_now: input.why_now?.trim() || "Added from Claude Desktop via JasonOS MCP.",
      verbs: ["send", "edit_send", "snooze", "dismiss", "tell_claude"],
    })
    .select("id,track,module,title,subtitle,why_now,state,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, card: data };
}

export async function updateCard(input: {
  id: string;
  state: "actioned" | "dismissed" | "snoozed" | "open" | "archived";
  snoozed_until?: string;
  links?: ActionCardLink[];
}) {
  const sb = jasonosDb();
  const patch: Record<string, unknown> = { state: input.state };
  if (input.state === "actioned") patch.actioned_at = new Date().toISOString();
  if (input.state === "snoozed") {
    if (!input.snoozed_until) throw new Error("snoozed_until (ISO date) is required when state is snoozed.");
    patch.snoozed_until = input.snoozed_until;
  }
  if (input.links !== undefined) {
    assertSafeCardLinks(input.links);
    const { data: existing, error: readErr } = await sb
      .from("cards")
      .select("body")
      .eq("id", input.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error(`No card found for id ${input.id}`);
    patch.body = mergeActionCardLinks(existing.body, input.links);
  }
  const { data, error } = await sb
    .from("cards")
    .update(patch)
    .eq("id", input.id)
    .select("id,title,state,snoozed_until,actioned_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No card found for id ${input.id}`);
  return { ok: true, card: data };
}

export async function pinCard(input: { id: string; pin: boolean }) {
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("cards")
    .update({ pinned_at: input.pin ? new Date().toISOString() : null })
    .eq("id", input.id)
    .select("id,title,pinned_at,state")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No card found for id ${input.id}`);
  return { ok: true, card: data };
}

export async function searchContacts(input: { query: string; limit?: number }) {
  const q = sanitizeSearch(input.query);
  if (!q) return { query: input.query, contacts: [] };

  const sb = jasonosDb();
  const limit = Math.min(Math.max(input.limit ?? 15, 1), 40);
  const like = `"%${q.replaceAll(" ", "%")}%"`;
  const { data, error } = await sb
    .from("contacts")
    .select(
      "id,name,emails,title,vip,tracks,last_touch_date,last_touch_channel,notes,linkedin_url,companies(name)"
    )
    .or(`name.ilike.${like},title.ilike.${like},notes.ilike.${like}`)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  return {
    query: q,
    contacts: (data ?? []).map((row) => {
      const company = row.companies as { name?: string } | { name?: string }[] | null;
      const companyName = Array.isArray(company) ? company[0]?.name : company?.name;
      return {
        id: row.id,
        name: row.name,
        title: row.title,
        company: companyName ?? null,
        emails: row.emails,
        vip: row.vip,
        tracks: row.tracks,
        last_touch_date: row.last_touch_date,
        last_touch_channel: row.last_touch_channel,
        linkedin_url: row.linkedin_url,
        notes: typeof row.notes === "string" ? row.notes.slice(0, 400) : null,
      };
    }),
  };
}

const PROJECT_LINK_KINDS = ["artifact", "doc", "file", "other"] as const;

export async function addProjectLink(input: {
  project_slug: string;
  title: string;
  url: string;
  kind?: string;
  description?: string;
}) {
  const sb = jasonosDb();
  const project_slug = input.project_slug.trim();
  const title = input.title.trim();
  const url = input.url.trim();
  const requestedKind =
    input.kind && (PROJECT_LINK_KINDS as readonly string[]).includes(input.kind)
      ? input.kind
      : null;

  const { data: existing, error: existingError } = await sb
    .from("project_links")
    .select("sort_order, kind, description")
    .eq("project_slug", project_slug)
    .eq("url", url)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  let sort_order = existing?.sort_order as number | undefined;
  if (sort_order == null) {
    const { data: maxRow, error: maxError } = await sb
      .from("project_links")
      .select("sort_order")
      .eq("project_slug", project_slug)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw new Error(maxError.message);
    sort_order = ((maxRow?.sort_order as number | undefined) ?? 0) + 1;
  }

  const { data, error } = await sb
    .from("project_links")
    .upsert(
      {
        project_slug,
        title,
        url,
        kind: requestedKind ?? (existing?.kind as string | undefined) ?? "artifact",
        description:
          input.description === undefined
            ? ((existing?.description as string | null | undefined) ?? null)
            : input.description.trim() || null,
        sort_order,
      },
      { onConflict: "project_slug,url" }
    )
    .select("id, project_slug, title, url, kind, description, sort_order, created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true as const, link: data };
}

export async function getScoreboard() {
  const db = publicDb();
  const { data, error } = await db
    .from("work_searches")
    .select(
      "id,date,company_name,position_applied,contact_method,result,scoreboard_status,activity_tier,parent_activity_id"
    )
    .order("date", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const applications = canonicalApplicationRows(
    (data ?? []).filter(isApplicationWorkSearch)
  ).slice(0, 80);

  const counts: Record<string, number> = {};
  for (const row of applications) {
    const status = resolvedScoreboardStatus(row);
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return {
    counts,
    recent: applications.slice(0, 25).map((row) => ({
      id: row.id,
      date: row.date,
      company: row.company_name,
      role: row.position_applied,
      status: resolvedScoreboardStatus(row),
      result: row.result,
    })),
  };
}
