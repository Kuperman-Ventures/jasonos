import { jasonosDb, publicDb } from "./db";
import { sanitizeSearch } from "./result";

function etDate(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function companyName(row: { companies?: unknown }): string | null {
  const company = row.companies as { name?: string } | { name?: string }[] | null;
  if (Array.isArray(company)) return company[0]?.name ?? null;
  return company?.name ?? null;
}

function clip(value: unknown, max = 500): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

async function firstOk<T>(jobs: Array<() => Promise<T | null>>): Promise<T | null> {
  for (const job of jobs) {
    try {
      const value = await job();
      if (value) return value;
    } catch {
      // Table may live on the other schema.
    }
  }
  return null;
}

export function listJasonosAreas() {
  return {
    ok: true,
    note: "Claude has full JasonOS read access. Use these tools instead of guessing.",
    areas: [
      { area: "today", tools: ["get_today", "get_status"] },
      { area: "must_dos_and_cards", tools: ["get_must_dos", "list_action_cards"] },
      { area: "todos_and_projects", tools: ["list_todos", "list_projects"] },
      { area: "morning_brief", tools: ["get_morning_brief"] },
      { area: "inbox", tools: ["get_inbox_dispatch"] },
      { area: "outreach", tools: ["get_outreach_queue", "list_outreach_people", "get_contact", "list_suggested_contacts"] },
      { area: "meetings", tools: ["list_meetings"] },
      { area: "jobs", tools: ["get_scoreboard", "get_job_alerts", "list_interview_preps"] },
      { area: "alerts", tools: ["list_alerts"] },
      { area: "post_master", tools: ["list_post_master_projects"] },
      { area: "connections", tools: ["get_connection_status"] },
    ],
  };
}

export async function getMorningBrief(input: { date?: string } = {}) {
  const today = etDate();
  const wanted = /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "") ? input.date : undefined;
  const cols = "id,brief_date,content_md,created_at";

  const load = async (db: ReturnType<typeof publicDb>) => {
    if (wanted) {
      const { data, error } = await db.from("morning_briefs").select(cols).eq("brief_date", wanted).maybeSingle();
      if (error) throw error;
      if (data) return data;
    }
    const todayRes = await db.from("morning_briefs").select(cols).eq("brief_date", today).maybeSingle();
    if (todayRes.error) throw todayRes.error;
    if (todayRes.data) return todayRes.data;
    const latest = await db.from("morning_briefs").select(cols).order("brief_date", { ascending: false }).limit(1).maybeSingle();
    if (latest.error) throw latest.error;
    return latest.data;
  };

  const row = await firstOk([
    async () => load(publicDb()),
    async () => load(jasonosDb()),
  ]);
  if (!row) return { ok: true, brief: null, date: today };

  return {
    ok: true,
    date: today,
    brief_date: row.brief_date,
    is_stale: row.brief_date !== today,
    created_at: row.created_at,
    content_md: typeof row.content_md === "string" ? row.content_md.slice(0, 12000) : "",
  };
}

function slimInboxItems(items: unknown, kind: "boarding" | "holding" | "noise") {
  if (!Array.isArray(items)) return [];
  return items.slice(0, kind === "noise" ? 20 : 30).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const i = item as Record<string, unknown>;
    if (kind === "noise") {
      return [{ label: i.label ?? i.name ?? i.sender, count: i.count ?? i.n ?? null, subject: clip(i.subject, 160) }];
    }
    return [
      {
        name: i.name ?? null,
        email: i.email ?? null,
        subject: i.subject ?? null,
        urgency: i.urgency ?? null,
        received_at: i.receivedAt ?? i.received_at ?? null,
        elevator: clip(i.elevator, 400),
        original: clip(i.original ?? i.body ?? i.snippet, 500),
        draft: clip(i.draft, 600),
        draft_saved: i.draftSaved === true,
      },
    ];
  });
}

export async function getInboxDispatch() {
  const today = etDate();
  const load = async (db: ReturnType<typeof publicDb>) => {
    const todayRes = await db
      .from("inbox_dispatches")
      .select("dispatch_date,payload,created_at")
      .eq("dispatch_date", today)
      .maybeSingle();
    if (todayRes.error) throw todayRes.error;
    if (todayRes.data) return todayRes.data;
    const latest = await db
      .from("inbox_dispatches")
      .select("dispatch_date,payload,created_at")
      .order("dispatch_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) throw latest.error;
    return latest.data;
  };

  const row = await firstOk([
    async () => load(publicDb()),
    async () => load(jasonosDb()),
  ]);
  if (!row) return { ok: true, dispatch: null, date: today };

  const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  return {
    ok: true,
    date: today,
    dispatch_date: row.dispatch_date,
    is_stale: row.dispatch_date !== today,
    created_at: row.created_at,
    boarding: slimInboxItems(payload.boarding, "boarding"),
    holding: slimInboxItems(payload.holding, "holding"),
    noise: slimInboxItems(payload.noise, "noise"),
  };
}

export async function getOutreachQueue(input: { limit?: number } = {}) {
  const today = etDate();
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 80);
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("contacts")
    .select(
      "id,name,title,vip,intent,cadence_interval,relevance_tier,network_degree,next_touch_date,last_touch_date,last_touch_channel,companies(name)"
    )
    .not("next_touch_date", "is", null)
    .lte("next_touch_date", today)
    .order("next_touch_date", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return {
    date: today,
    due_or_overdue: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      title: row.title,
      company: companyName(row),
      vip: row.vip,
      intent: row.intent,
      cadence_interval: row.cadence_interval,
      relevance_tier: row.relevance_tier,
      network_degree: row.network_degree,
      next_touch_date: row.next_touch_date,
      last_touch_date: row.last_touch_date,
      last_touch_channel: row.last_touch_channel,
    })),
  };
}

export async function listOutreachPeople(input: { query?: string; intent?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 60);
  const sb = jasonosDb();
  let query = sb
    .from("contacts")
    .select(
      "id,name,title,vip,intent,relationship_type,cadence_interval,relevance_tier,network_degree,next_touch_date,last_touch_date,last_touch_channel,emails,linkedin_url,companies(name)"
    )
    .order("name", { ascending: true })
    .limit(limit);

  const q = input.query ? sanitizeSearch(input.query) : "";
  if (q) query = query.or(`name.ilike."%${q}%",title.ilike."%${q}%"`);
  if (input.intent?.trim()) query = query.eq("intent", input.intent.trim());

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return {
    query: q || null,
    intent: input.intent ?? null,
    people: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      title: row.title,
      company: companyName(row),
      vip: row.vip,
      intent: row.intent,
      relationship_type: row.relationship_type,
      cadence_interval: row.cadence_interval,
      relevance_tier: row.relevance_tier,
      network_degree: row.network_degree,
      next_touch_date: row.next_touch_date,
      last_touch_date: row.last_touch_date,
      last_touch_channel: row.last_touch_channel,
      emails: row.emails,
      linkedin_url: row.linkedin_url,
    })),
  };
}

export async function getContact(input: { id?: string; name?: string }) {
  const sb = jasonosDb();
  let row: Record<string, unknown> | null = null;
  if (input.id) {
    const { data, error } = await sb
      .from("contacts")
      .select(
        "id,name,title,vip,intent,personal_goal,relationship_type,cadence_interval,relevance_tier,network_degree,next_touch_date,last_touch_date,last_touch_channel,emails,phone,linkedin_url,notes,tags,tracks,companies(name)"
      )
      .eq("id", input.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    row = data as Record<string, unknown> | null;
  } else {
    const q = sanitizeSearch(input.name ?? "");
    if (!q) throw new Error("Pass id or name.");
    const { data, error } = await sb
      .from("contacts")
      .select(
        "id,name,title,vip,intent,personal_goal,relationship_type,cadence_interval,relevance_tier,network_degree,next_touch_date,last_touch_date,last_touch_channel,emails,phone,linkedin_url,notes,tags,tracks,companies(name)"
      )
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    row = data as Record<string, unknown> | null;
  }
  if (!row) return { ok: false, error: "No contact found." };

  const { data: touches } = await sb
    .from("contact_touches")
    .select("id,channel,direction,touched_at,source,brief,subject")
    .eq("contact_id", row.id)
    .order("touched_at", { ascending: false })
    .limit(12);

  return {
    ok: true,
    contact: {
      ...row,
      company: companyName(row as { companies?: unknown }),
      notes: clip(row.notes, 800),
      companies: undefined,
    },
    recent_touches: touches ?? [],
  };
}

export async function listSuggestedContacts(input: { limit?: number } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 50);
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("contact_candidates")
    .select("id,name,email,company,status,inbound_count,outbound_count,last_seen,last_subject,created_at")
    .eq("status", "new")
    .order("last_seen", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { candidates: data ?? [] };
}

export async function listMeetings(input: { limit?: number } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 50);
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("meetings")
    .select("id,contact_id,scheduled_at,channel,status,title,prep_goal,next_step,held_at,calendar_url")
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { meetings: data ?? [] };
}

export async function getJobAlerts(input: { limit?: number } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 60);
  const sb = jasonosDb();
  const [opps, keywords, harvest] = await Promise.all([
    sb
      .from("job_opportunities")
      .select("id,title,company,compensation,job_url,gmail_url,received_at,first_seen_at")
      .is("deleted_at", null)
      .order("received_at", { ascending: false })
      .limit(limit),
    sb.from("job_alert_keywords").select("id,keyword").order("keyword", { ascending: true }).limit(80),
    sb.from("job_alert_harvest_state").select("last_run_at,label_name,error,account_email").limit(1).maybeSingle(),
  ]);
  if (opps.error) throw new Error(opps.error.message);
  return {
    last_scan: harvest.data ?? null,
    keywords: keywords.data ?? [],
    opportunities: opps.data ?? [],
  };
}

export async function listInterviewPreps(input: { limit?: number } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 40);
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("interview_preps")
    .select("id,company,role_title,updated_at,created_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { preps: data ?? [] };
}

export async function listAlerts(input: { limit?: number } = {}) {
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 60);
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("alerts")
    .select("id,severity,category,title,body,state,created_at")
    .eq("state", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return {
    alerts: (data ?? []).map((row) => ({
      ...row,
      body: clip(row.body, 400),
    })),
  };
}

export async function listProjects() {
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("projects")
    .select("id,track,name,goal_statement,status,target_date,updated_at")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  const projects = data ?? [];
  const ids = projects.map((p) => p.id);
  const { data: todos } = ids.length
    ? await sb.from("todos").select("id,project_id,state").in("project_id", ids).eq("state", "open")
    : { data: [] as { project_id: string }[] };
  const openByProject = new Map<string, number>();
  for (const todo of todos ?? []) {
    openByProject.set(todo.project_id, (openByProject.get(todo.project_id) ?? 0) + 1);
  }
  return {
    projects: projects.map((project) => ({
      ...project,
      open_todos: openByProject.get(project.id) ?? 0,
    })),
  };
}

export async function listPostMasterProjects() {
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("post_master_projects")
    .select("id,title,step,input_mode,idea_preview,topic,updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return {
    projects: (data ?? []).map((row) => ({
      ...row,
      idea_preview: clip(row.idea_preview, 280),
    })),
  };
}

export async function getConnectionStatus() {
  const db = publicDb();
  const { data, error } = await db
    .from("service_connections")
    .select(
      "service_name,status,connection_type,api_key_masked,health_status,error_message,connected_at,last_health_check"
    )
    .order("service_name", { ascending: true });
  if (error) throw new Error(error.message);

  let google: { provider: string; connected: boolean; expires_at: string | null }[] = [];
  try {
    const { data: integrations } = await jasonosDb()
      .from("user_integrations")
      .select("provider,expires_at");
    google = (integrations ?? []).map((row) => ({
      provider: row.provider as string,
      connected: true,
      expires_at: (row.expires_at as string | null) ?? null,
    }));
  } catch {
    google = [];
  }

  return {
    services: data ?? [],
    oauth_connections: google,
  };
}
