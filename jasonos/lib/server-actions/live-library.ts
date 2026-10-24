"use server";

import { cadenceLabel, type CadenceInterval } from "@/lib/outreach/types";
import { getCallSheet, type CallSheet } from "@/lib/server-actions/call-sheet";
import { getRelationshipLogForMeeting, type RelationshipLogEntry } from "@/lib/server-actions/person";
import type { MeetingPoint } from "@/lib/server-actions/meeting-points";
import { getMeetingPoints } from "@/lib/server-actions/meeting-points";
import type { MeetingPrepDetail, OutcomeMark } from "@/lib/server-actions/meeting-prep";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import type { MeetingReview } from "@/lib/server-actions/meeting-reviews";
import { getMeetingReview } from "@/lib/server-actions/meeting-reviews";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type LibraryMark = OutcomeMark | "unmarked";

export interface LibraryFilters {
  person?: string | null;
  playbook?: string | null;
  /** Earlier name for playbook. */
  strategy?: string | null;
  mark?: LibraryMark | null;
  from?: string | null;
  to?: string | null;
  q?: string | null;
}

export interface LibraryMeeting {
  id: string;
  title: string;
  startsAt: string;
  primaryContactId: string | null;
  primaryContactName: string | null;
  company: string | null;
  playbookId: string | null;
  playbookName: string | null;
  adapted: boolean;
  outcomeMark: OutcomeMark | null;
  outcomeSentence: string | null;
  hasReview: boolean;
  suggestedMark: OutcomeMark | null;
  asksCovered: number;
  asksTotal: number;
  projectName: string | null;
  /** This call's touch number in the relationship log; null when it was not logged. */
  touchNumber: number | null;
}

export interface LibraryPersonFacet {
  id: string;
  name: string;
  count: number;
  cadence: string | null;
  lastTouchDate: string | null;
  lastTouchChannel: string | null;
}

export interface LibraryFacets {
  people: LibraryPersonFacet[];
  playbooks: Array<{ id: string; name: string; count: number }>;
  marks: Record<LibraryMark | "all", number>;
}

export interface LibraryCommitment {
  text: string;
  due: string | null;
}

export interface LibraryRelationship {
  contactId: string;
  name: string;
  personalGoal: string | null;
  cadenceLabel: string;
  nextTouchDate: string | null;
  nextTouchOverdue: boolean;
  lastTouchDate: string | null;
  lastTouchChannel: string | null;
  commitmentsMine: LibraryCommitment[];
  commitmentsTheirs: LibraryCommitment[];
  liveMeetings: number;
  daysSinceLastLive: number | null;
}

export interface LiveMeetingRecord {
  prep: MeetingPrepDetail;
  points: MeetingPoint[];
  review: MeetingReview | null;
  adaptation: { scriptName: string; adaptedAt: string | null } | null;
  granolaUrl: string | null;
  calendarUrl: string | null;
  sheet: CallSheet | null;
  log: RelationshipLogEntry | null;
}

type LibraryResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MARKS = new Set<LibraryMark>(["hit", "partial", "missed", "unmarked"]);
const CADENCES = new Set<CadenceInterval>(["weekly", "biweekly", "triweekly", "monthly", "quarterly", "none"]);

function hasConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function uuid(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return UUID.test(text) ? text : null;
}

function day(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return DAY.test(text) ? text : null;
}

function markOf(value: unknown): OutcomeMark | null {
  return value === "hit" || value === "partial" || value === "missed" ? value : null;
}

function etDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function todayEt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** UTC instant of midnight in America/New_York for a calendar date. */
function etMidnight(ymd: string, endOfDay: boolean): string {
  const clock = endOfDay ? "23:59:59.999" : "00:00:00.000";
  for (const offset of ["-04:00", "-05:00"]) {
    const date = new Date(`${ymd}T${clock}${offset}`);
    if (etDateKey(date.toISOString()) === ymd) {
      const hour = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(date);
      if ((endOfDay && hour === "23") || (!endOfDay && hour === "00")) return date.toISOString();
    }
  }
  return new Date(`${ymd}T${endOfDay ? "23:59:59.999" : "05:00:00.000"}Z`).toISOString();
}

function daysBetween(later: string, earlier: string): number {
  const [ay, am, ad] = later.split("-").map(Number);
  const [by, bm, bd] = earlier.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

function searchTerm(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/[%_*,()."]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

interface PrepListRow {
  id: string;
  title: string | null;
  starts_at: string;
  primary_contact_id: string | null;
  script_id: string | null;
  adapted_from_script_id: string | null;
  outcome_mark: string | null;
  outcome_sentence: string | null;
  project_id: string | null;
}

function openCommitments(value: unknown): { mine: LibraryCommitment[]; theirs: LibraryCommitment[] } {
  const mine: LibraryCommitment[] = [];
  const theirs: LibraryCommitment[] = [];
  if (!Array.isArray(value)) return { mine, theirs };
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as { text?: unknown; direction?: unknown; status?: unknown; due?: unknown };
    if (typeof row.text !== "string" || !row.text.trim()) continue;
    if (row.status === "done") continue;
    const entry = {
      text: row.text.trim(),
      due: typeof row.due === "string" && row.due.trim() ? row.due.trim() : null,
    };
    if (row.direction === "mine") mine.push(entry);
    else theirs.push(entry);
  }
  return { mine, theirs };
}

export async function listLiveMeetings(
  filters: LibraryFilters = {}
): Promise<LibraryResult<{ meetings: LibraryMeeting[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  let query = sb
    .from("meeting_preps")
    .select(
      "id, title, starts_at, primary_contact_id, script_id, adapted_from_script_id, outcome_mark, outcome_sentence, project_id"
    )
    .not("live_ended_at", "is", null)
    .order("starts_at", { ascending: false })
    .limit(200);

  const person = uuid(filters.person);
  const playbook = uuid(filters.playbook) ?? uuid(filters.strategy);
  const from = day(filters.from);
  const to = day(filters.to);
  if (person) query = query.eq("primary_contact_id", person);
  if (playbook) query = query.eq("script_id", playbook);
  if (filters.mark === "unmarked") query = query.is("outcome_mark", null);
  else if (filters.mark && MARKS.has(filters.mark)) query = query.eq("outcome_mark", filters.mark);
  if (from) query = query.gte("starts_at", etMidnight(from, false));
  if (to) query = query.lte("starts_at", etMidnight(to, true));

  const term = searchTerm(filters.q);
  if (term) {
    const { data: named, error: nameError } = await sb
      .from("contacts")
      .select("id")
      .ilike("name", `%${term}%`)
      .limit(50);
    if (nameError) return { ok: false, error: nameError.message };
    const ids = (named ?? []).map((row) => row.id as string).filter((id) => UUID.test(id));
    query = ids.length
      ? query.or(`title.ilike."*${term}*",primary_contact_id.in.(${ids.join(",")})`)
      : query.ilike("title", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as PrepListRow[];
  if (!rows.length) return { ok: true, meetings: [] };

  const prepIds = rows.map((row) => row.id);
  const contactIds = [...new Set(rows.map((row) => row.primary_contact_id).filter((id): id is string => Boolean(id)))];
  const scriptIds = [...new Set(rows.map((row) => row.script_id).filter((id): id is string => Boolean(id)))];
  const projectIds = [...new Set(rows.map((row) => row.project_id).filter((id): id is string => Boolean(id)))];

  const [contacts, scripts, projects, reviews, asks, logs] = await Promise.all([
    contactIds.length
      ? sb.from("contacts").select("id, name, company_id").in("id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    scriptIds.length
      ? sb.from("live_scripts").select("id, name").in("id", scriptIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? sb.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    sb.from("meeting_reviews").select("prep_id, suggested_mark").in("prep_id", prepIds),
    sb
      .from("meeting_points")
      .select("prep_id, state, confirmed_state")
      .in("prep_id", prepIds)
      .eq("kind", "ask"),
    sb.from("relationship_log").select("prep_id, touch_number").in("prep_id", prepIds),
  ]);
  const lookupError =
    contacts.error || scripts.error || projects.error || reviews.error || asks.error || logs.error;
  if (lookupError) return { ok: false, error: lookupError.message };
  const touchByPrep = new Map(
    (logs.data ?? [])
      .filter((row) => typeof row.touch_number === "number")
      .map((row) => [row.prep_id as string, row.touch_number as number])
  );

  const companyIds = [
    ...new Set(
      (contacts.data ?? [])
        .map((row) => row.company_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const companies = companyIds.length
    ? await sb.from("companies").select("id, name").in("id", companyIds)
    : { data: [], error: null };
  if (companies.error) return { ok: false, error: companies.error.message };

  const companyName = new Map((companies.data ?? []).map((row) => [row.id as string, String(row.name)]));
  const contactById = new Map(
    (contacts.data ?? []).map((row) => [
      row.id as string,
      {
        name: String(row.name),
        company: row.company_id ? companyName.get(row.company_id as string) ?? null : null,
      },
    ])
  );
  const scriptName = new Map((scripts.data ?? []).map((row) => [row.id as string, String(row.name)]));
  const projectName = new Map((projects.data ?? []).map((row) => [row.id as string, String(row.name)]));
  const reviewByPrep = new Map(
    (reviews.data ?? []).map((row) => [row.prep_id as string, markOf(row.suggested_mark)])
  );
  const asksByPrep = new Map<string, { covered: number; total: number }>();
  for (const row of asks.data ?? []) {
    const id = row.prep_id as string;
    const tally = asksByPrep.get(id) ?? { covered: 0, total: 0 };
    tally.total += 1;
    const confirmed = (row as { confirmed_state?: string | null }).confirmed_state;
    const effective = confirmed || (row.state as string);
    if (effective === "covered") tally.covered += 1;
    asksByPrep.set(id, tally);
  }

  return {
    ok: true,
    meetings: rows.map((row) => {
      const contact = row.primary_contact_id ? contactById.get(row.primary_contact_id) : undefined;
      const tally = asksByPrep.get(row.id) ?? { covered: 0, total: 0 };
      const suggested = reviewByPrep.has(row.id) ? reviewByPrep.get(row.id) ?? null : null;
      return {
        id: row.id,
        title: row.title?.trim() || "Meeting",
        startsAt: row.starts_at,
        primaryContactId: row.primary_contact_id,
        primaryContactName: contact?.name ?? null,
        company: contact?.company ?? null,
        playbookId: row.script_id,
        playbookName: row.script_id ? scriptName.get(row.script_id) ?? null : null,
        adapted: Boolean(row.adapted_from_script_id),
        outcomeMark: markOf(row.outcome_mark),
        outcomeSentence: row.outcome_sentence?.trim() || null,
        hasReview: reviewByPrep.has(row.id),
        suggestedMark: suggested,
        asksCovered: tally.covered,
        asksTotal: tally.total,
        projectName: row.project_id ? projectName.get(row.project_id) ?? null : null,
        touchNumber: touchByPrep.get(row.id) ?? null,
      };
    }),
  };
}

export async function listLibraryFacets(): Promise<LibraryResult<{ facets: LibraryFacets }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .select("primary_contact_id, script_id, outcome_mark")
    .not("live_ended_at", "is", null);
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];

  const peopleCount = new Map<string, number>();
  const playbookCount = new Map<string, number>();
  const marks: LibraryFacets["marks"] = { all: rows.length, hit: 0, partial: 0, missed: 0, unmarked: 0 };
  for (const row of rows) {
    if (row.primary_contact_id) {
      peopleCount.set(row.primary_contact_id as string, (peopleCount.get(row.primary_contact_id as string) ?? 0) + 1);
    }
    if (row.script_id) {
      playbookCount.set(row.script_id as string, (playbookCount.get(row.script_id as string) ?? 0) + 1);
    }
    const mark = markOf(row.outcome_mark);
    if (mark) marks[mark] += 1;
    else marks.unmarked += 1;
  }

  const contactIds = [...peopleCount.keys()];
  const scriptIds = [...playbookCount.keys()];
  const [contacts, scripts] = await Promise.all([
    contactIds.length
      ? sb
          .from("contacts")
          .select("id, name, cadence_interval, last_touch_date, last_touch_channel")
          .in("id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    scriptIds.length
      ? sb.from("live_scripts").select("id, name").in("id", scriptIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (contacts.error) return { ok: false, error: contacts.error.message };
  if (scripts.error) return { ok: false, error: scripts.error.message };

  const people: LibraryPersonFacet[] = (contacts.data ?? [])
    .map((row) => ({
      id: row.id as string,
      name: String(row.name),
      count: peopleCount.get(row.id as string) ?? 0,
      cadence: typeof row.cadence_interval === "string" ? row.cadence_interval : null,
      lastTouchDate: typeof row.last_touch_date === "string" ? row.last_touch_date : null,
      lastTouchChannel: typeof row.last_touch_channel === "string" ? row.last_touch_channel : null,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const playbooks = (scripts.data ?? [])
    .map((row) => ({
      id: row.id as string,
      name: String(row.name),
      count: playbookCount.get(row.id as string) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { ok: true, facets: { people, playbooks, marks } };
}

export async function getLibraryRelationship(
  contactId: string
): Promise<LibraryResult<{ relationship: LibraryRelationship | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = uuid(contactId);
  if (!id) return { ok: true, relationship: null };
  const sb = createServiceRoleClient();
  const [contact, brief, meetings] = await Promise.all([
    sb
      .from("contacts")
      .select("id, name, personal_goal, cadence_interval, next_touch_date, last_touch_date, last_touch_channel")
      .eq("id", id)
      .maybeSingle(),
    sb.from("contact_relationship_briefs").select("commitments").eq("contact_id", id).maybeSingle(),
    sb
      .from("meeting_preps")
      .select("starts_at")
      .eq("primary_contact_id", id)
      .not("live_ended_at", "is", null)
      .order("starts_at", { ascending: false }),
  ]);
  if (contact.error) return { ok: false, error: contact.error.message };
  if (brief.error) return { ok: false, error: brief.error.message };
  if (meetings.error) return { ok: false, error: meetings.error.message };
  if (!contact.data) return { ok: true, relationship: null };

  const cadence = CADENCES.has(contact.data.cadence_interval as CadenceInterval)
    ? (contact.data.cadence_interval as CadenceInterval)
    : null;
  const nextTouch = typeof contact.data.next_touch_date === "string" ? contact.data.next_touch_date : null;
  const commitments = openCommitments(brief.data?.commitments);
  const starts = (meetings.data ?? []).map((row) => row.starts_at as string);
  const last = starts[0] ? etDateKey(starts[0]) : null;

  return {
    ok: true,
    relationship: {
      contactId: id,
      name: String(contact.data.name),
      personalGoal: typeof contact.data.personal_goal === "string" ? contact.data.personal_goal.trim() || null : null,
      cadenceLabel: cadenceLabel(cadence),
      nextTouchDate: nextTouch,
      nextTouchOverdue: Boolean(nextTouch && nextTouch < todayEt()),
      lastTouchDate: typeof contact.data.last_touch_date === "string" ? contact.data.last_touch_date : null,
      lastTouchChannel:
        typeof contact.data.last_touch_channel === "string" ? contact.data.last_touch_channel : null,
      commitmentsMine: commitments.mine,
      commitmentsTheirs: commitments.theirs,
      liveMeetings: starts.length,
      daysSinceLastLive: last ? daysBetween(todayEt(), last) : null,
    },
  };
}

export async function getLiveMeetingRecord(
  prepId: string
): Promise<LibraryResult<{ record: LiveMeetingRecord }>> {
  const id = uuid(prepId);
  if (!id) return { ok: false, error: "Meeting not found." };
  const prepResult = await getMeetingPrep(id);
  if (!prepResult.ok) return prepResult;
  if (!prepResult.prep.liveEndedAt) {
    return { ok: false, error: "This meeting has not been run through Live." };
  }
  const [pointsResult, reviewResult, sheetResult, logResult] = await Promise.all([
    getMeetingPoints(id),
    getMeetingReview(id),
    getCallSheet({ prepId: id }),
    getRelationshipLogForMeeting(id),
  ]);
  if (!pointsResult.ok) return pointsResult;
  if (!reviewResult.ok) return reviewResult;

  let adaptedAt: string | null = null;
  if (prepResult.prep.adaptedFromScriptId && hasConfig()) {
    const sb = createServiceRoleClient();
    const { data } = await sb.from("meeting_preps").select("adapted_at").eq("id", id).maybeSingle();
    adaptedAt = typeof data?.adapted_at === "string" ? data.adapted_at : null;
  }

  return {
    ok: true,
    record: {
      prep: prepResult.prep,
      points: pointsResult.points,
      review: reviewResult.review,
      adaptation: prepResult.prep.adaptedFromScriptName
        ? { scriptName: prepResult.prep.adaptedFromScriptName, adaptedAt }
        : null,
      granolaUrl: reviewResult.review?.sourceUrl ?? null,
      calendarUrl: prepResult.prep.calendarUrl,
      sheet: sheetResult.ok ? sheetResult.sheet : null,
      log: logResult.ok ? logResult.log : null,
    },
  };
}
