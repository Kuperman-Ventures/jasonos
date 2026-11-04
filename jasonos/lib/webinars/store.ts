/**
 * Webinar sessions / digests. MCP-safe (no Next.js imports) — shared by
 * /webinars, server actions, and JasonOS MCP tools.
 */
import { z } from "zod";
import { mondayStartOfWeekYmd, etYmd, addDaysYmd } from "../dates";
import { jasonosDb } from "../mcp/db";
import { recordUserAction } from "../actions/action-log";
import { TRACKS, type Track } from "../types";
import {
  detectWebinarSessions,
  type DetectedWebinarSession,
  type WebinarNote,
} from "./detect";
import { resolveTopicAssignment, type ActiveTopic } from "./topics";

const TRANSCRIPT_PER_SESSION_CAP = 80_000;
const TRANSCRIPT_TOTAL_CAP = 300_000;

const TRACK_SET = new Set<string>(TRACKS);

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

function isTrack(value: unknown): value is Track {
  return typeof value === "string" && TRACK_SET.has(value);
}

const speakerSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(200).optional(),
  org: z.string().max(200).optional(),
});

const takeawaySchema = z.object({
  text: z.string().min(1).max(2_000),
  lead: z.string().max(120).optional().default(""),
  topic_slug: z.string().min(1).max(60).optional(),
  track: z
    .enum(["venture", "advisors", "job_search", "personal"])
    .nullable()
    .optional(),
  relevance_note: z.string().max(1_000).optional().default(""),
  is_action: z.boolean().optional().default(false),
});

export const publishSessionSchema = z.object({
  session_key: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  topic_slug: z.string().min(1).max(60),
  host_org: z.string().max(200).optional().default(""),
  speakers: z.array(speakerSchema).max(40).optional().default([]),
  summary_md: z.string().max(50_000).optional().default(""),
  proposed_topic: z
    .object({
      slug: z.string().min(1).max(60),
      name: z.string().min(1).max(80),
      reason: z.string().max(500),
    })
    .optional(),
  takeaways: z.array(takeawaySchema).max(40),
});

export type PublishWebinarSessionInput = z.infer<typeof publishSessionSchema>;

export type WebinarSessionRow = {
  id: string;
  session_key: string;
  session_date: string;
  started_at: string | null;
  duration_minutes: number | null;
  title: string;
  host_org: string;
  speakers: unknown;
  gcal_event_id: string | null;
  calendar_url: string | null;
  transcript_source: "granola" | "wispr" | null;
  transcript_note_id: string | null;
  transcript_url: string | null;
  detection: string;
  status: "candidate" | "confirmed" | "dismissed";
  summary_md: string;
  topic_slug: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WebinarTakeawayRow = {
  id: string;
  session_id: string;
  sort_order: number;
  text: string;
  lead: string;
  topic_slug: string | null;
  track: Track | null;
  relevance_note: string;
  is_action: boolean;
  card_id: string | null;
  created_at: string;
};

export type WebinarTopicStatus = "active" | "proposed" | "archived";

export type WebinarTopicRow = {
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  status: WebinarTopicStatus;
  proposed_reason: string;
  merged_into: string | null;
  created_at: string;
  updated_at: string;
};

export type WebinarTopicWithCounts = WebinarTopicRow & {
  session_count: number;
  takeaway_count: number;
};

export type WebinarDigestRow = {
  week_start: string;
  body_md: string;
  session_ids: string[];
  published_at: string;
  updated_at: string;
};

export type WebinarCandidateView = WebinarSessionRow & {
  transcript: string | null;
  notes_summary: string | null;
  transcript_truncated?: boolean;
};

async function loadDeckNoteIds(): Promise<Set<string>> {
  const { data, error } = await jasonosDb()
    .from("decks")
    .select("transcript_note_id")
    .not("transcript_note_id", "is", null)
    .limit(500);
  if (error) fail(error);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as { transcript_note_id?: string | null }).transcript_note_id;
    if (id) ids.add(id);
  }
  return ids;
}

async function loadCalendarEvents(daysBack: number) {
  // Dynamic import keeps this module MCP/test-safe (no top-level server-only).
  const [{ fetchAccountCalendarEvents }, tokensMod] = await Promise.all([
    import("../integrations/google-calendar"),
    import("../integrations/google-tokens"),
  ]);
  const { GOOGLE_ADVISORS, GOOGLE_GMAIL, listGoogleAccessTokens } = tokensMod;
  const tokens = await listGoogleAccessTokens();
  const timeMax = new Date(Date.now() + 86_400_000).toISOString();
  const timeMin = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const lists = [];
  for (const provider of [GOOGLE_ADVISORS, GOOGLE_GMAIL] as const) {
    const token = tokens.find((t) => t.provider === provider)?.token;
    if (!token) continue;
    const fetched = await fetchAccountCalendarEvents({
      token,
      timeMin,
      timeMax,
    });
    lists.push(fetched.events);
  }
  const seen = new Set<string>();
  const events = [];
  for (const list of lists) {
    for (const ev of list) {
      const key = ev.iCalUID || ev.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      events.push(ev);
    }
  }
  return events;
}

type NoteBundle = {
  ok: boolean;
  notes?: Array<{
    id: string;
    title: string;
    createdAt: string;
    summary: string | null;
    transcript: string | null;
    url: string | null;
    attendeeEmails: string[];
    scheduledStart: string | null;
    folders?: string[];
    durationMinutes?: number | null;
    participantCount?: number;
  }>;
  error?: string;
};

function toWebinarNotes(
  granola: NoteBundle,
  wispr: NoteBundle
): { notes: WebinarNote[]; byId: Map<string, { summary: string | null; transcript: string | null }> } {
  const notes: WebinarNote[] = [];
  const byId = new Map<string, { summary: string | null; transcript: string | null }>();
  const pushNote = (
    source: "granola" | "wispr",
    n: NonNullable<NoteBundle["notes"]>[number]
  ) => {
    let durationMinutes = n.durationMinutes ?? null;
    // Granola/Wispr often omit duration; estimate from transcript (~150 wpm).
    if (durationMinutes == null && n.transcript) {
      const words = n.transcript.trim().split(/\s+/).filter(Boolean).length;
      if (words >= 100) durationMinutes = Math.max(1, Math.round(words / 150));
    }
    notes.push({
      id: n.id,
      source,
      title: n.title,
      createdAt: n.createdAt,
      scheduledStart: n.scheduledStart,
      url: n.url,
      folders: n.folders ?? [],
      durationMinutes,
      participantCount: n.participantCount ?? n.attendeeEmails.length,
    });
    byId.set(n.id, { summary: n.summary, transcript: n.transcript });
  };
  if (granola.ok) {
    for (const n of granola.notes ?? []) pushNote("granola", n);
  }
  if (wispr.ok) {
    for (const n of wispr.notes ?? []) pushNote("wispr", n);
  }
  return { notes, byId };
}

async function upsertDetected(sessions: DetectedWebinarSession[]) {
  const sb = jasonosDb();
  const out: WebinarSessionRow[] = [];
  for (const session of sessions) {
    const { data: existing, error: readErr } = await sb
      .from("webinar_sessions")
      .select("*")
      .eq("session_key", session.session_key)
      .maybeSingle();
    if (readErr) fail(readErr);

    if (existing) {
      const row = existing as WebinarSessionRow;
      // Never downgrade confirmed / dismissed.
      if (row.status === "confirmed" || row.status === "dismissed") {
        out.push(row);
        continue;
      }
      const { data, error } = await sb
        .from("webinar_sessions")
        .update({
          session_date: session.session_date,
          started_at: session.started_at,
          duration_minutes: session.duration_minutes,
          title: session.title,
          gcal_event_id: session.gcal_event_id,
          calendar_url: session.calendar_url,
          transcript_source: session.transcript_source,
          transcript_note_id: session.transcript_note_id,
          transcript_url: session.transcript_url,
          detection: session.detection,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) fail(error);
      out.push(data as WebinarSessionRow);
      continue;
    }

    const { data, error } = await sb
      .from("webinar_sessions")
      .insert({
        session_key: session.session_key,
        session_date: session.session_date,
        started_at: session.started_at,
        duration_minutes: session.duration_minutes,
        title: session.title,
        host_org: session.host_org,
        speakers: [],
        gcal_event_id: session.gcal_event_id,
        calendar_url: session.calendar_url,
        transcript_source: session.transcript_source,
        transcript_note_id: session.transcript_note_id,
        transcript_url: session.transcript_url,
        detection: session.detection,
        status: "candidate",
      })
      .select("*")
      .single();
    if (error) fail(error);
    out.push(data as WebinarSessionRow);
  }
  return out;
}

function attachTranscripts(
  rows: WebinarSessionRow[],
  byId: Map<string, { summary: string | null; transcript: string | null }>
): WebinarCandidateView[] {
  const views: WebinarCandidateView[] = rows.map((row) => {
    const note = row.transcript_note_id
      ? byId.get(row.transcript_note_id)
      : null;
    let transcript: string | null = note?.transcript ?? null;
    if (transcript && transcript.length > TRANSCRIPT_PER_SESSION_CAP) {
      transcript = transcript.slice(0, TRANSCRIPT_PER_SESSION_CAP);
    }
    // calendar_only / dismissed / unconfirmed note_solo_long → no transcript out
    if (row.detection === "calendar_only" || row.status === "dismissed") {
      transcript = null;
    }
    if (row.detection === "note_solo_long" && row.status === "candidate") {
      transcript = null;
    }
    return {
      ...row,
      transcript,
      notes_summary: note?.summary ?? null,
    };
  });

  let total = views.reduce((sum, v) => sum + (v.transcript?.length ?? 0), 0);
  if (total <= TRANSCRIPT_TOTAL_CAP) return views;

  const ranked = [...views]
    .filter((v) => v.transcript)
    .sort(
      (a, b) => (b.duration_minutes ?? 0) - (a.duration_minutes ?? 0)
    );
  const keep = new Set<string>();
  let budget = 0;
  for (const row of ranked) {
    const len = row.transcript?.length ?? 0;
    if (budget + len > TRANSCRIPT_TOTAL_CAP) continue;
    keep.add(row.id);
    budget += len;
  }
  return views.map((row) => {
    if (!row.transcript || keep.has(row.id)) return row;
    return { ...row, transcript: null, transcript_truncated: true };
  });
}

/** Fetch calendar + notes, detect, upsert candidates, return with transcripts. */
export async function scanWebinarCandidates(input: {
  daysBack?: number;
}): Promise<{
  ok: true;
  days_back: number;
  sessions: WebinarCandidateView[];
  errors: string[];
}> {
  // Max 21 so the Oct 14–27 webinar window still fits when scanning mid-week.
  const daysBack = Math.max(1, Math.min(21, input.daysBack ?? 3));
  const errors: string[] = [];

  const [{ listRecentGranolaNotes }, { listRecentWisprNotes }] = await Promise.all([
    import("../integrations/granola"),
    import("../integrations/wispr"),
  ]);

  const [events, granola, wispr, deckIds] = await Promise.all([
    loadCalendarEvents(daysBack).catch((err) => {
      errors.push(err instanceof Error ? err.message : String(err));
      return [] as Awaited<ReturnType<typeof loadCalendarEvents>>;
    }),
    listRecentGranolaNotes({
      daysBack,
      limit: Math.min(40, Math.max(20, daysBack * 2)),
      includeTranscript: true,
    }),
    listRecentWisprNotes({
      daysBack,
      limit: Math.min(25, Math.max(12, daysBack)),
      includeTranscript: true,
    }),
    loadDeckNoteIds(),
  ]);

  if (!granola.ok) errors.push(`Granola: ${granola.error}`);
  if (!wispr.ok) errors.push(`Wispr: ${wispr.error}`);

  const { notes, byId } = toWebinarNotes(granola, wispr);
  const detected = detectWebinarSessions({
    events,
    notes,
    deckNoteIds: deckIds,
  });
  const rows = await upsertDetected(detected);
  return {
    ok: true,
    days_back: daysBack,
    sessions: attachTranscripts(rows, byId),
    errors,
  };
}

export async function setWebinarSessionStatus(input: {
  id: string;
  status: "candidate" | "confirmed" | "dismissed";
}) {
  const sb = jasonosDb();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  // Confirm without publish keeps published_at null (waiting for summary).
  if (input.status === "candidate" || input.status === "dismissed") {
    // leave published_at alone on dismiss; clear nothing
  }
  const { data, error } = await sb
    .from("webinar_sessions")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) fail(error);
  return { ok: true as const, session: data as WebinarSessionRow };
}

async function loadActiveTopics(): Promise<ActiveTopic[]> {
  const { data, error } = await jasonosDb()
    .from("webinar_topics")
    .select("slug, name")
    .eq("status", "active")
    .order("sort_order", { ascending: true });
  if (error) fail(error);
  return (data ?? []) as ActiveTopic[];
}

async function insertProposedTopicIfNew(proposed: {
  slug: string;
  name: string;
  proposed_reason: string;
}) {
  const sb = jasonosDb();
  const { data: existing, error: readErr } = await sb
    .from("webinar_topics")
    .select("slug")
    .eq("slug", proposed.slug)
    .maybeSingle();
  if (readErr) fail(readErr);
  if (existing) return;
  const { error } = await sb.from("webinar_topics").insert({
    slug: proposed.slug,
    name: proposed.name,
    description: "",
    sort_order: 0,
    status: "proposed",
    proposed_reason: proposed.proposed_reason,
  });
  if (error && !/duplicate|already exists/i.test(error.message)) fail(error);
}

export async function publishWebinarSession(raw: PublishWebinarSessionInput) {
  const input = publishSessionSchema.parse(raw);
  const activeTopics = await loadActiveTopics();
  const assignment = resolveTopicAssignment(
    {
      topic_slug: input.topic_slug,
      proposed_topic: input.proposed_topic ?? null,
      takeaways: input.takeaways,
    },
    activeTopics
  );
  const sb = jasonosDb();
  const { data: existing, error: readErr } = await sb
    .from("webinar_sessions")
    .select("*")
    .eq("session_key", input.session_key)
    .maybeSingle();
  if (readErr) fail(readErr);
  if (!existing) {
    throw new Error(`Unknown session_key: ${input.session_key}`);
  }
  if (assignment.proposed) await insertProposedTopicIfNew(assignment.proposed);
  const session = existing as WebinarSessionRow;

  const { data: updated, error: upErr } = await sb
    .from("webinar_sessions")
    .update({
      title: input.title,
      host_org: input.host_org ?? "",
      speakers: input.speakers ?? [],
      summary_md: input.summary_md ?? "",
      topic_slug: assignment.session_topic_slug,
      status: "confirmed",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select("*")
    .single();
  if (upErr) fail(upErr);

  const { data: priorTakes, error: priorErr } = await sb
    .from("webinar_takeaways")
    .select("id,card_id,text,is_action")
    .eq("session_id", session.id);
  if (priorErr) fail(priorErr);
  const priorByText = new Map(
    (priorTakes ?? []).map((t) => [
      String((t as { text: string }).text).trim().toLowerCase(),
      t as { id: string; card_id: string | null; is_action: boolean },
    ])
  );

  const { error: delErr } = await sb
    .from("webinar_takeaways")
    .delete()
    .eq("session_id", session.id);
  if (delErr) fail(delErr);

  const takeawayIds: string[] = [];
  for (let i = 0; i < input.takeaways.length; i += 1) {
    const t = input.takeaways[i]!;
    const prior = priorByText.get(t.text.trim().toLowerCase());
    const { data: take, error: insErr } = await sb
      .from("webinar_takeaways")
      .insert({
        session_id: session.id,
        sort_order: i,
        text: t.text.trim(),
        lead: (t.lead ?? "").trim(),
        topic_slug: assignment.takeaways[i]!.topic_slug,
        track: t.track ?? null,
        relevance_note: t.relevance_note ?? "",
        is_action: Boolean(t.is_action),
        card_id: prior?.card_id ?? null,
      })
      .select("*")
      .single();
    if (insErr) fail(insErr);
    const takeRow = take as WebinarTakeawayRow;
    takeawayIds.push(takeRow.id);

    if (takeRow.is_action && !takeRow.card_id) {
      const track: Track = isTrack(takeRow.track) ? takeRow.track : "advisors";
      const { data: card, error: cardErr } = await sb
        .from("cards")
        .insert({
          track,
          module: "webinar",
          object_type: "webinar_takeaway",
          title: takeRow.text.slice(0, 200),
          subtitle: input.title.slice(0, 200),
          body: null,
          linked_object_ids: {
            source: "webinar",
            session_id: session.id,
            takeaway_id: takeRow.id,
          },
          state: "open",
          vip: false,
          why_now: "Action from a webinar takeaway.",
          verbs: ["snooze", "dismiss", "tell_claude"],
        })
        .select("id")
        .single();
      if (cardErr) fail(cardErr);
      const cardId = (card as { id: string }).id;
      const { error: linkErr } = await sb
        .from("webinar_takeaways")
        .update({ card_id: cardId })
        .eq("id", takeRow.id);
      if (linkErr) fail(linkErr);
      await recordUserAction({
        verb: "Added",
        area: "Card",
        subject: takeRow.text.slice(0, 80),
        actor: "claude",
        targetTable: "cards",
        targetId: cardId,
      });
    }
  }

  return {
    ok: true as const,
    published: "webinar_session" as const,
    session: updated as WebinarSessionRow,
    takeaway_count: takeawayIds.length,
    webinars: "https://jasonos.vercel.app/webinars",
  };
}

export async function publishWebinarDigest(input: {
  week_start: string;
  body_md: string;
  session_ids?: string[];
}) {
  const week = input.week_start.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    throw new Error("week_start must be YYYY-MM-DD (Monday, America/New_York).");
  }
  const monday = mondayStartOfWeekYmd(week);
  if (monday !== week) {
    throw new Error(`week_start must be a Monday (got ${week}, Monday is ${monday}).`);
  }
  const sb = jasonosDb();
  const { data, error } = await sb
    .from("webinar_digests")
    .upsert(
      {
        week_start: week,
        body_md: input.body_md,
        session_ids: input.session_ids ?? [],
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "week_start" }
    )
    .select("*")
    .single();
  if (error) fail(error);
  return {
    ok: true as const,
    published: "webinar_digest" as const,
    digest: data as WebinarDigestRow,
    webinars: "https://jasonos.vercel.app/webinars",
  };
}

export async function getWebinarDigest(input: { week_start?: string } = {}) {
  const today = etYmd();
  const week = input.week_start?.trim()
    ? mondayStartOfWeekYmd(input.week_start.trim())
    : mondayStartOfWeekYmd(today);
  const weekEnd = addDaysYmd(week, 6);
  const sb = jasonosDb();
  const { data: digest, error: dErr } = await sb
    .from("webinar_digests")
    .select("*")
    .eq("week_start", week)
    .maybeSingle();
  if (dErr) fail(dErr);

  const { data: sessions, error: sErr } = await sb
    .from("webinar_sessions")
    .select("*")
    .eq("status", "confirmed")
    .gte("session_date", week)
    .lte("session_date", weekEnd)
    .order("session_date", { ascending: false });
  if (sErr) fail(sErr);

  const sessionRows = (sessions ?? []) as WebinarSessionRow[];
  const ids = sessionRows.map((s) => s.id);
  let takeaways: WebinarTakeawayRow[] = [];
  if (ids.length) {
    const { data: takes, error: tErr } = await sb
      .from("webinar_takeaways")
      .select("*")
      .in("session_id", ids)
      .order("sort_order", { ascending: true });
    if (tErr) fail(tErr);
    takeaways = (takes ?? []) as WebinarTakeawayRow[];
  }

  return {
    ok: true as const,
    week_start: week,
    digest: (digest as WebinarDigestRow | null) ?? null,
    sessions: sessionRows.map((s) => ({
      ...s,
      takeaways: takeaways.filter((t) => t.session_id === s.id),
    })),
  };
}

export type WebinarsPageWeek = {
  week_start: string;
  week_label: string;
  digest: WebinarDigestRow | null;
  confirmed: Array<WebinarSessionRow & { takeaways: WebinarTakeawayRow[] }>;
  candidates: WebinarSessionRow[];
};

/** Monday–Sunday windows ending with the current week. `weeks: 1` is this week. */
function reportingWindow(weeks: number) {
  const weekCount = Math.max(1, Math.min(12, weeks));
  const thisMonday = mondayStartOfWeekYmd(etYmd());
  const oldest = addDaysYmd(thisMonday, -(weekCount - 1) * 7);
  const newestEnd = addDaysYmd(thisMonday, 6);
  return { weekCount, thisMonday, oldest, newestEnd };
}

function isPublished(session: { status: string; published_at: string | null }): boolean {
  return session.status === "confirmed" && Boolean(session.published_at);
}

function isCandidate(session: { status: string; published_at: string | null }): boolean {
  return (
    session.status === "candidate" ||
    (session.status === "confirmed" && !session.published_at)
  );
}

export async function getWebinarsPage(input: { weeks?: number } = {}): Promise<{
  weeks: WebinarsPageWeek[];
}> {
  const { weekCount, thisMonday, oldest, newestEnd } = reportingWindow(input.weeks ?? 4);

  const sb = jasonosDb();
  const { data: digests, error: dErr } = await sb
    .from("webinar_digests")
    .select("*")
    .gte("week_start", oldest)
    .lte("week_start", thisMonday)
    .order("week_start", { ascending: false });
  if (dErr) fail(dErr);

  const { data: sessions, error: sErr } = await sb
    .from("webinar_sessions")
    .select("*")
    .gte("session_date", oldest)
    .lte("session_date", newestEnd)
    .order("session_date", { ascending: false });
  if (sErr) fail(sErr);

  const sessionRows = (sessions ?? []) as WebinarSessionRow[];
  const confirmedIds = sessionRows.filter((s) => isPublished(s)).map((s) => s.id);
  let takeaways: WebinarTakeawayRow[] = [];
  if (confirmedIds.length) {
    const { data: takes, error: tErr } = await sb
      .from("webinar_takeaways")
      .select("*")
      .in("session_id", confirmedIds)
      .order("sort_order", { ascending: true });
    if (tErr) fail(tErr);
    takeaways = (takes ?? []) as WebinarTakeawayRow[];
  }

  const digestByWeek = new Map(
    ((digests ?? []) as WebinarDigestRow[]).map((d) => [d.week_start, d])
  );

  const weeks: WebinarsPageWeek[] = [];
  for (let i = 0; i < weekCount; i += 1) {
    const week_start = addDaysYmd(thisMonday, -i * 7);
    const week_end = addDaysYmd(week_start, 6);
    const inWeek = sessionRows.filter(
      (s) => s.session_date >= week_start && s.session_date <= week_end
    );
    const confirmed = inWeek
      .filter((s) => isPublished(s))
      .map((s) => ({
        ...s,
        takeaways: takeaways.filter((t) => t.session_id === s.id),
      }));
    const candidates = inWeek.filter((s) => isCandidate(s));
    const mon = new Date(`${week_start}T12:00:00Z`);
    const week_label = `Week of ${mon.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })}`;
    weeks.push({
      week_start,
      week_label,
      digest: digestByWeek.get(week_start) ?? null,
      confirmed,
      candidates,
    });
  }
  return { weeks };
}

const TOPIC_STATUSES = new Set<WebinarTopicStatus>(["active", "proposed", "archived"]);

export async function listWebinarTopics(input: { include_archived?: boolean } = {}): Promise<{
  topics: WebinarTopicWithCounts[];
}> {
  const sb = jasonosDb();
  const [{ data: topics, error: topicErr }, { data: sessions, error: sessionErr }, { data: takes, error: takeErr }] =
    await Promise.all([
      sb.from("webinar_topics").select("*").order("sort_order", { ascending: true }),
      sb.from("webinar_sessions").select("id, topic_slug, status, published_at"),
      sb.from("webinar_takeaways").select("topic_slug, session_id"),
    ]);
  if (topicErr) fail(topicErr);
  if (sessionErr) fail(sessionErr);
  if (takeErr) fail(takeErr);

  const sessionRows = (sessions ?? []) as Array<
    Pick<WebinarSessionRow, "id" | "topic_slug" | "status" | "published_at">
  >;
  const publishedIds = new Set(
    sessionRows.filter((session) => isPublished(session)).map((session) => session.id)
  );
  const sessionCount = new Map<string, number>();
  for (const session of sessionRows) {
    if (!session.topic_slug || !publishedIds.has(session.id)) continue;
    sessionCount.set(session.topic_slug, (sessionCount.get(session.topic_slug) ?? 0) + 1);
  }
  const takeawayCount = new Map<string, number>();
  for (const takeaway of (takes ?? []) as Array<{ topic_slug: string | null; session_id: string }>) {
    if (!takeaway.topic_slug || !publishedIds.has(takeaway.session_id)) continue;
    takeawayCount.set(
      takeaway.topic_slug,
      (takeawayCount.get(takeaway.topic_slug) ?? 0) + 1
    );
  }

  const rows = ((topics ?? []) as WebinarTopicRow[])
    .filter((topic) => input.include_archived || topic.status !== "archived")
    .map((topic) => ({
      ...topic,
      session_count: sessionCount.get(topic.slug) ?? 0,
      takeaway_count: takeawayCount.get(topic.slug) ?? 0,
    }));
  return { topics: rows };
}

export async function upsertWebinarTopic(input: {
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  status: WebinarTopicStatus;
}): Promise<WebinarTopicRow> {
  const slug = input.slug.trim();
  const name = input.name.trim();
  if (!slug || slug.length > 60) throw new Error("Slug must be 1-60 characters.");
  if (!name || name.length > 80) throw new Error("Name must be 1-80 characters.");
  if (!TOPIC_STATUSES.has(input.status)) {
    throw new Error("Status must be active, proposed, or archived.");
  }
  const description = (input.description ?? "").slice(0, 2_000);
  const sort_order = Number.isFinite(input.sort_order) ? Math.trunc(input.sort_order) : 0;
  const sb = jasonosDb();
  const { data: existing, error: readErr } = await sb
    .from("webinar_topics")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (readErr) fail(readErr);
  const patch = {
    name,
    description,
    sort_order,
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { data, error } = await sb
      .from("webinar_topics")
      .update(patch)
      .eq("slug", slug)
      .select("*")
      .single();
    if (error) fail(error);
    return data as WebinarTopicRow;
  }
  const { data, error } = await sb
    .from("webinar_topics")
    .insert({ slug, ...patch })
    .select("*")
    .single();
  if (error) fail(error);
  return data as WebinarTopicRow;
}

export async function acceptProposedTopic(input: { slug: string }): Promise<WebinarTopicRow> {
  const slug = input.slug.trim();
  const sb = jasonosDb();
  const { data: topic, error: readErr } = await sb
    .from("webinar_topics")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (readErr) fail(readErr);
  if (!topic) throw new Error(`Unknown topic "${slug}".`);
  const row = topic as WebinarTopicRow;
  if (row.status !== "proposed") throw new Error(`Topic "${slug}" is not proposed.`);
  const { data: maxRow, error: maxErr } = await sb
    .from("webinar_topics")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) fail(maxErr);
  const sort_order = ((maxRow as { sort_order?: number } | null)?.sort_order ?? 0) + 10;
  const { data, error } = await sb
    .from("webinar_topics")
    .update({
      status: "active",
      sort_order,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug)
    .select("*")
    .single();
  if (error) fail(error);
  return data as WebinarTopicRow;
}

export async function mergeTopic(input: {
  from_slug: string;
  into_slug: string;
}): Promise<{ from: WebinarTopicRow; into_slug: string }> {
  const fromSlug = input.from_slug.trim();
  const intoSlug = input.into_slug.trim();
  if (!fromSlug || !intoSlug) throw new Error("Choose a topic to merge and a topic to keep.");
  if (fromSlug === intoSlug) throw new Error("Pick a different topic to merge into.");
  const sb = jasonosDb();
  const { data: rows, error: readErr } = await sb
    .from("webinar_topics")
    .select("*")
    .in("slug", [fromSlug, intoSlug]);
  if (readErr) fail(readErr);
  const topics = (rows ?? []) as WebinarTopicRow[];
  const from = topics.find((topic) => topic.slug === fromSlug);
  const into = topics.find((topic) => topic.slug === intoSlug);
  if (!from) throw new Error(`Unknown topic "${fromSlug}".`);
  if (!into) throw new Error(`Unknown topic "${intoSlug}".`);
  if (into.status !== "active") throw new Error("Merge into an active topic.");

  const now = new Date().toISOString();
  const { error: sessionErr } = await sb
    .from("webinar_sessions")
    .update({ topic_slug: intoSlug, updated_at: now })
    .eq("topic_slug", fromSlug);
  if (sessionErr) fail(sessionErr);
  const { error: takeErr } = await sb
    .from("webinar_takeaways")
    .update({ topic_slug: intoSlug })
    .eq("topic_slug", fromSlug);
  if (takeErr) fail(takeErr);
  const { data: archived, error: topicErr } = await sb
    .from("webinar_topics")
    .update({
      status: "archived",
      merged_into: intoSlug,
      updated_at: now,
    })
    .eq("slug", fromSlug)
    .select("*")
    .single();
  if (topicErr) fail(topicErr);
  return { from: archived as WebinarTopicRow, into_slug: intoSlug };
}

export async function archiveWebinarTopic(input: { slug: string }): Promise<WebinarTopicRow> {
  const slug = input.slug.trim();
  const sb = jasonosDb();
  const [{ data: sessions, error: sessionErr }, { data: takes, error: takeErr }] = await Promise.all([
    sb.from("webinar_sessions").select("id").eq("topic_slug", slug).limit(1),
    sb.from("webinar_takeaways").select("id").eq("topic_slug", slug).limit(1),
  ]);
  if (sessionErr) fail(sessionErr);
  if (takeErr) fail(takeErr);
  if ((sessions ?? []).length || (takes ?? []).length) {
    throw new Error("Merge this topic into another one first.");
  }
  const { data: existing, error: existingErr } = await sb
    .from("webinar_topics")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existingErr) fail(existingErr);
  if (!existing) throw new Error(`Unknown topic "${slug}".`);
  const { data, error } = await sb
    .from("webinar_topics")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .select("*")
    .single();
  if (error) fail(error);
  return data as WebinarTopicRow;
}

export type WebinarActionView = {
  id: string;
  text: string;
  lead: string;
  session_title: string;
  session_id: string;
  track: Track | null;
  card_id: string | null;
};

export type WebinarsByTopic = {
  topics: Array<
    WebinarTopicRow & {
      sessions: Array<WebinarSessionRow & { takeaways: WebinarTakeawayRow[] }>;
    }
  >;
  actions: WebinarActionView[];
  proposed: WebinarTopicRow[];
  candidates: WebinarSessionRow[];
  digest: WebinarDigestRow | null;
};

export async function getWebinarsByTopic(input: { weeks?: number | null } = {}): Promise<WebinarsByTopic> {
  const thisMonday = mondayStartOfWeekYmd(etYmd());
  const currentWeekEnd = addDaysYmd(thisMonday, 6);
  const bounded = typeof input.weeks === "number";
  const range = bounded ? reportingWindow(input.weeks as number) : null;
  const candidateWindow = reportingWindow(4);
  const sb = jasonosDb();

  let sessionQuery = sb
    .from("webinar_sessions")
    .select("*")
    .order("session_date", { ascending: false })
    .order("started_at", { ascending: false });
  if (range) {
    const from = range.oldest < candidateWindow.oldest ? range.oldest : candidateWindow.oldest;
    sessionQuery = sessionQuery.gte("session_date", from).lte("session_date", currentWeekEnd);
  }

  const [{ data: topicRows, error: topicErr }, { data: digest, error: digestErr }, { data: sessions, error: sessionErr }] =
    await Promise.all([
      sb.from("webinar_topics").select("*").order("sort_order", { ascending: true }),
      sb.from("webinar_digests").select("*").eq("week_start", thisMonday).maybeSingle(),
      sessionQuery,
    ]);
  if (topicErr) fail(topicErr);
  if (digestErr) fail(digestErr);
  if (sessionErr) fail(sessionErr);

  const allTopics = (topicRows ?? []) as WebinarTopicRow[];
  const sessionRows = (sessions ?? []) as WebinarSessionRow[];
  const inRange = (session: WebinarSessionRow) => {
    if (!range) return true;
    return session.session_date >= range.oldest && session.session_date <= range.newestEnd;
  };
  const published = sessionRows.filter((session) => isPublished(session) && inRange(session));
  const publishedIds = published.map((session) => session.id);
  let takeaways: WebinarTakeawayRow[] = [];
  if (publishedIds.length) {
    const { data: takes, error: takeErr } = await sb
      .from("webinar_takeaways")
      .select("*")
      .in("session_id", publishedIds)
      .order("sort_order", { ascending: true });
    if (takeErr) fail(takeErr);
    takeaways = (takes ?? []) as WebinarTakeawayRow[];
  }

  const byTopic = new Map<string, Array<WebinarSessionRow & { takeaways: WebinarTakeawayRow[] }>>();
  for (const session of published) {
    if (!session.topic_slug) continue;
    const list = byTopic.get(session.topic_slug) ?? [];
    list.push({
      ...session,
      takeaways: takeaways.filter((takeaway) => takeaway.session_id === session.id),
    });
    byTopic.set(session.topic_slug, list);
  }

  const topics = allTopics
    .filter((topic) => (byTopic.get(topic.slug)?.length ?? 0) > 0)
    .map((topic) => ({ ...topic, sessions: byTopic.get(topic.slug) ?? [] }));

  const candidates = sessionRows.filter(
    (session) =>
      isCandidate(session) &&
      session.session_date >= candidateWindow.oldest &&
      session.session_date <= candidateWindow.newestEnd
  );

  const sessionById = new Map(published.map((session) => [session.id, session]));
  const actions = takeaways
    .filter((takeaway) => takeaway.is_action)
    .flatMap((takeaway) => {
      const session = sessionById.get(takeaway.session_id);
      if (!session) return [];
      return [
        {
          id: takeaway.id,
          text: takeaway.text,
          lead: takeaway.lead ?? "",
          session_title: session.title,
          session_id: session.id,
          track: takeaway.track,
          card_id: takeaway.card_id,
          session_date: session.session_date,
          started_at: session.started_at,
          sort_order: takeaway.sort_order,
        },
      ];
    })
    .sort((a, b) => {
      if (a.session_date !== b.session_date) return a.session_date < b.session_date ? 1 : -1;
      const aStart = a.started_at ?? "";
      const bStart = b.started_at ?? "";
      if (aStart !== bStart) return aStart < bStart ? 1 : -1;
      return a.sort_order - b.sort_order;
    })
    .map((row) => ({
      id: row.id,
      text: row.text,
      lead: row.lead,
      session_title: row.session_title,
      session_id: row.session_id,
      track: row.track,
      card_id: row.card_id,
    }));

  return {
    topics,
    actions,
    proposed: allTopics.filter((topic) => topic.status === "proposed"),
    candidates,
    digest: (digest as WebinarDigestRow | null) ?? null,
  };
}

export type TopicTakeawayView = {
  id: string;
  text: string;
  lead: string;
  topic_slug: string | null;
  track: Track | null;
  relevance_note: string;
  is_action: boolean;
  card_id: string | null;
  created_at: string;
  session_id: string;
  session_title: string;
  session_date: string;
  session_topic_slug: string | null;
  transcript_url: string | null;
};

export async function getTopicPage(input: {
  slug: string;
  weeks?: number | null;
}): Promise<{
  topic: WebinarTopicRow;
  takeaway_count: number;
  session_count: number;
  takeaways: TopicTakeawayView[];
} | null> {
  const slug = input.slug.trim();
  const sb = jasonosDb();
  const { data: topic, error: topicErr } = await sb
    .from("webinar_topics")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (topicErr) fail(topicErr);
  if (!topic) return null;

  const range = typeof input.weeks === "number" ? reportingWindow(input.weeks) : null;
  const { data: takes, error: takeErr } = await sb
    .from("webinar_takeaways")
    .select("id, text, lead, topic_slug, track, relevance_note, is_action, card_id, created_at, session_id")
    .eq("topic_slug", slug)
    .order("created_at", { ascending: false });
  if (takeErr) fail(takeErr);
  const takeRows = (takes ?? []) as WebinarTakeawayRow[];
  const sessionIds = [...new Set(takeRows.map((takeaway) => takeaway.session_id))];
  const sessionById = new Map<
    string,
    Pick<WebinarSessionRow, "id" | "title" | "session_date" | "transcript_url" | "topic_slug">
  >();
  if (sessionIds.length) {
    const { data: sessions, error: sessionErr } = await sb
      .from("webinar_sessions")
      .select("id, title, session_date, transcript_url, topic_slug")
      .in("id", sessionIds);
    if (sessionErr) fail(sessionErr);
    for (const session of (sessions ?? []) as Array<
      Pick<WebinarSessionRow, "id" | "title" | "session_date" | "transcript_url" | "topic_slug">
    >) {
      sessionById.set(session.id, session);
    }
  }

  const takeaways: TopicTakeawayView[] = [];
  for (const row of takeRows) {
    const session = sessionById.get(row.session_id);
    if (!session) continue;
    if (
      range &&
      (session.session_date < range.oldest || session.session_date > range.newestEnd)
    ) {
      continue;
    }
    takeaways.push({
      id: row.id,
      text: row.text,
      lead: row.lead ?? "",
      topic_slug: row.topic_slug,
      track: row.track,
      relevance_note: row.relevance_note,
      is_action: row.is_action,
      card_id: row.card_id,
      created_at: row.created_at,
      session_id: row.session_id,
      session_title: session.title,
      session_date: session.session_date,
      session_topic_slug: session.topic_slug,
      transcript_url: session.transcript_url,
    });
  }

  return {
    topic: topic as WebinarTopicRow,
    takeaway_count: takeaways.length,
    session_count: new Set(takeaways.map((takeaway) => takeaway.session_id)).size,
    takeaways,
  };
}
