import type { Track } from "../types";
import { jasonosDb, publicDb } from "./db";
import { sanitizeSearch } from "./result";

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
  const [cards, todos, alerts, today] = await Promise.all([
    sb.from("cards").select("id", { count: "exact", head: true }).eq("state", "open"),
    sb.from("todos").select("id", { count: "exact", head: true }).eq("state", "open"),
    sb
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("state", "open")
      .eq("severity", "critical"),
    publicDb()
      .from("today_task_instances")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_for_date", date),
  ]);

  return {
    ok: true,
    date,
    timezone: "America/New_York",
    open_cards: cards.count ?? 0,
    open_todos: todos.count ?? 0,
    critical_alerts: alerts.count ?? 0,
    today_tasks: today.error ? null : (today.count ?? 0),
    app: "https://jasonos.vercel.app",
  };
}

export async function getToday() {
  const db = publicDb();
  const date = etDate();
  const { data: taskRows, error: taskError } = await db
    .from("today_task_instances")
    .select(
      "id,name_snapshot,track_snapshot,sub_track,estimate_minutes_snapshot,kpi_mapping_snapshot,queue_order,scheduled_for_date,calendar_event_id"
    )
    .eq("scheduled_for_date", date)
    .order("queue_order", { ascending: true });

  if (taskError) throw new Error(taskError.message);

  const tasks = (taskRows ?? []).map((row) => ({
    id: row.id,
    name: row.name_snapshot ?? "(untitled)",
    track: row.track_snapshot,
    sub_track: row.sub_track,
    estimate_minutes: row.estimate_minutes_snapshot,
    kpi_mapping: row.kpi_mapping_snapshot,
    queue_order: row.queue_order,
    calendar_event_id: row.calendar_event_id,
  }));

  let sessions: Record<string, unknown> = {};
  if (tasks.length) {
    const { data: sessionRows, error: sessionError } = await db
      .from("timer_sessions")
      .select(
        "id,task_instance_id,timer_state,estimate_seconds,elapsed_seconds,pause_count,started_at,completion_type,completed_at"
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
      };
    }
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

export async function getMustDos() {
  const sb = jasonosDb();
  const { data: run, error } = await sb
    .from("bna_runs")
    .select("items,run_at")
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const items = Array.isArray(run?.items) ? run.items : [];
  if (!items.length) return { run_at: run?.run_at ?? null, items: [] };

  const cardIds = items
    .map((item: { card_id?: string }) => item.card_id)
    .filter((id): id is string => Boolean(id));

  const { data: cards } = cardIds.length
    ? await sb
        .from("cards")
        .select("id,track,module,title,subtitle,why_now,state,vip,priority_score,verbs")
        .in("id", cardIds)
    : { data: [] as Record<string, unknown>[] };

  const byId = new Map((cards ?? []).map((card) => [card.id, card]));
  return {
    run_at: run?.run_at ?? null,
    items: items.map((item: { card_id?: string; rank?: number; rationale?: string }) => ({
      ...item,
      card: item.card_id ? byId.get(item.card_id) ?? null : null,
    })),
  };
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

export async function addActionCard(input: {
  title: string;
  track?: string;
  subtitle?: string;
  why_now?: string;
  draft?: string;
  module?: string;
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
      body: input.draft ? { draft: input.draft } : null,
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
}) {
  const sb = jasonosDb();
  const patch: Record<string, unknown> = { state: input.state };
  if (input.state === "actioned") patch.actioned_at = new Date().toISOString();
  if (input.state === "snoozed") {
    if (!input.snoozed_until) throw new Error("snoozed_until (ISO date) is required when state is snoozed.");
    patch.snoozed_until = input.snoozed_until;
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

export async function getScoreboard() {
  const db = publicDb();
  const { data, error } = await db
    .from("work_searches")
    .select(
      "id,date,company_name,position_applied,contact_method,result,scoreboard_status,activity_tier"
    )
    .order("date", { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const applications = rows.filter((row) => {
    if (row.scoreboard_status) return true;
    if (row.activity_tier === "networking") return false;
    return row.contact_method === "Online Portal" || row.contact_method === "Direct Email";
  });

  const counts: Record<string, number> = {};
  for (const row of applications) {
    const status = row.scoreboard_status || "submitted";
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return {
    counts,
    recent: applications.slice(0, 25).map((row) => ({
      id: row.id,
      date: row.date,
      company: row.company_name,
      role: row.position_applied,
      status: row.scoreboard_status || "submitted",
      result: row.result,
    })),
  };
}
