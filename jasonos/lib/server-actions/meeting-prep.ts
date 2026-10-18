"use server";

import { revalidatePath } from "next/cache";
import { loadHomeContextsForPreps } from "@/lib/meeting-prep/context";
import {
  EMPTY_HOME_CONTEXT,
  type MeetingHomeContext,
} from "@/lib/meeting-prep/context-model";
import {
  loadMeetingsForDays,
  type TodaysMeeting,
} from "@/lib/meeting-prep/today";
import { purposeFromCalendarDescription } from "@/lib/meeting-prep/text";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type MeetingPrepStatus =
  | "new"
  | "gathering"
  | "gathered"
  | "building"
  | "ready"
  | "error";

export type MeetingPurposeSource = "calendar" | "suggested" | "user";

export type CalendarSource = "google" | "outlook";

export type OutcomeMark = "hit" | "partial" | "missed";

export interface MeetingPrepAttendee {
  email: string;
  name: string | null;
  contactId: string | null;
}

export interface MeetingPrepSummary {
  id: string;
  gcalEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  conferenceUrl: string | null;
  attendees: MeetingPrepAttendee[];
  purposeConfirmed: boolean;
  status: MeetingPrepStatus;
  sourceCount: number;
  pointCount: number;
  outcomeSentence: string | null;
  outcomeMark: OutcomeMark | null;
  outcomeNote: string | null;
  outcomeMarkedAt: string | null;
  home: MeetingHomeContext;
}

export interface MeetingPrepSource {
  id: string;
  sourceType: string;
  externalId: string;
  accountEmail: string | null;
  title: string | null;
  url: string | null;
  occurredAt: string | null;
  snippet: string | null;
  relevance: number | null;
  relevanceReason: string | null;
  pinned: boolean;
  excluded: boolean;
}

export interface MeetingPrepDetail extends MeetingPrepSummary {
  icalUid: string | null;
  calendarSource: CalendarSource;
  calendarUrl: string | null;
  location: string | null;
  description: string | null;
  purpose: string | null;
  purposeSource: MeetingPurposeSource | null;
  error: string | null;
  gatheredAt: string | null;
  builtAt: string | null;
  liveStartedAt: string | null;
  liveEndedAt: string | null;
  scriptId: string | null;
  scriptName: string | null;
  sources: MeetingPrepSource[];
}

type PrepResult<T> = ({ ok: true } & T) | { ok: false; error: string };

interface PrepRow {
  id: string;
  gcal_event_id: string;
  ical_uid: string | null;
  calendar_source: string;
  title: string;
  starts_at: string;
  ends_at: string;
  calendar_url: string | null;
  conference_url: string | null;
  location: string | null;
  description: string | null;
  attendees: unknown;
  purpose: string | null;
  purpose_source: string | null;
  purpose_confirmed: boolean;
  status: string;
  error: string | null;
  gathered_at: string | null;
  built_at: string | null;
  live_started_at?: string | null;
  live_ended_at?: string | null;
  outcome_sentence?: string | null;
  outcome_mark?: string | null;
  outcome_note?: string | null;
  outcome_marked_at?: string | null;
}

const PREP_COLUMNS =
  "id, gcal_event_id, ical_uid, calendar_source, title, starts_at, ends_at, calendar_url, conference_url, location, description, attendees, purpose, purpose_source, purpose_confirmed, status, error, gathered_at, built_at";
const PREP_COLUMNS_WITH_LIVE = `${PREP_COLUMNS}, live_started_at, live_ended_at`;
const PREP_COLUMNS_FULL = `${PREP_COLUMNS_WITH_LIVE}, script_id`;
const PREP_COLUMNS_WITH_OUTCOME = `${PREP_COLUMNS_FULL}, outcome_sentence, outcome_mark, outcome_note, outcome_marked_at`;

function missingLiveColumn(message: string): boolean {
  return /live_started_at|live_ended_at/.test(message);
}

function missingOutcomeColumn(message: string): boolean {
  return /outcome_sentence|outcome_mark|outcome_note|outcome_marked_at/.test(message);
}

const OUTCOME_MARKS = new Set<OutcomeMark>(["hit", "partial", "missed"]);

function asOutcomeMark(value: string | null | undefined): OutcomeMark | null {
  if (value && OUTCOME_MARKS.has(value as OutcomeMark)) return value as OutcomeMark;
  return null;
}

const STATUSES = new Set<MeetingPrepStatus>([
  "new",
  "gathering",
  "gathered",
  "building",
  "ready",
  "error",
]);

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function revalidatePrep(prepId?: string) {
  revalidatePath("/");
  if (prepId) revalidatePath(`/meetings/${prepId}`);
  revalidatePath("/meetings/[id]", "page");
}

function asStatus(value: string): MeetingPrepStatus {
  return STATUSES.has(value as MeetingPrepStatus) ? (value as MeetingPrepStatus) : "new";
}

function asPurposeSource(value: string | null): MeetingPurposeSource | null {
  if (value === "calendar" || value === "suggested" || value === "user") return value;
  return null;
}

function asCalendarSource(value: string): CalendarSource {
  return value === "outlook" ? "outlook" : "google";
}

function asAttendees(value: unknown): MeetingPrepAttendee[] {
  if (!Array.isArray(value)) return [];
  const out: MeetingPrepAttendee[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const email = (item as { email?: unknown }).email;
    if (typeof email !== "string" || !email.includes("@")) continue;
    const name = (item as { name?: unknown }).name;
    const contactId = (item as { contact_id?: unknown }).contact_id;
    out.push({
      email: email.trim().toLowerCase(),
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      contactId: typeof contactId === "string" && contactId ? contactId : null,
    });
  }
  return out;
}

function toSummary(row: PrepRow, sourceCount: number, pointCount = 0): MeetingPrepSummary {
  return {
    id: row.id,
    gcalEventId: row.gcal_event_id,
    title: row.title?.trim() || "Meeting",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    conferenceUrl: row.conference_url,
    attendees: asAttendees(row.attendees),
    purposeConfirmed: Boolean(row.purpose_confirmed),
    status: asStatus(row.status),
    sourceCount,
    pointCount,
    outcomeSentence: row.outcome_sentence?.trim() || null,
    outcomeMark: asOutcomeMark(row.outcome_mark),
    outcomeNote: row.outcome_note?.trim() || null,
    outcomeMarkedAt: row.outcome_marked_at ?? null,
    home: EMPTY_HOME_CONTEXT,
  };
}

function toDetail(row: PrepRow, sources: MeetingPrepSource[], sourceCount: number): MeetingPrepDetail {
  return {
    ...toSummary(row, sourceCount),
    icalUid: row.ical_uid,
    calendarSource: asCalendarSource(row.calendar_source),
    calendarUrl: row.calendar_url,
    location: row.location,
    description: row.description,
    purpose: row.purpose?.trim() || null,
    purposeSource: asPurposeSource(row.purpose_source),
    error: row.error,
    gatheredAt: row.gathered_at,
    builtAt: row.built_at,
    liveStartedAt: row.live_started_at ?? null,
    liveEndedAt: row.live_ended_at ?? null,
    scriptId: null,
    scriptName: null,
    sources,
  };
}

function attendeePayload(meeting: TodaysMeeting) {
  return meeting.attendees.map((attendee) => ({
    email: attendee.email,
    name: attendee.name,
    contact_id: attendee.contactId,
  }));
}

function refreshPayload(meeting: TodaysMeeting, nowIso: string) {
  return {
    ical_uid: meeting.icalUid,
    calendar_source: meeting.calendarSource,
    title: meeting.title,
    starts_at: meeting.startsAt,
    ends_at: meeting.endsAt,
    calendar_url: meeting.calendarUrl,
    conference_url: meeting.conferenceUrl,
    location: meeting.location,
    description: meeting.description,
    attendees: attendeePayload(meeting),
    updated_at: nowIso,
  };
}

async function sourceCounts(
  sb: ReturnType<typeof createServiceRoleClient>,
  prepIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!prepIds.length) return counts;
  const { data, error } = await sb
    .from("meeting_prep_sources")
    .select("prep_id")
    .in("prep_id", prepIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const id = row.prep_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function missingPointsTable(message: string): boolean {
  return /meeting_points/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

async function pointCounts(
  sb: ReturnType<typeof createServiceRoleClient>,
  prepIds: string[]
): Promise<{ counts: Map<string, number>; missing: boolean }> {
  const counts = new Map<string, number>();
  if (!prepIds.length) return { counts, missing: false };
  const { data, error } = await sb
    .from("meeting_points")
    .select("prep_id")
    .in("prep_id", prepIds);
  if (error) {
    if (missingPointsTable(error.message)) return { counts, missing: true };
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    const id = row.prep_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return { counts, missing: false };
}

export async function getTodaysMeetingPreps(): Promise<
  PrepResult<{ meetings: MeetingPrepSummary[]; warnings: string[] }>
> {
  return getMeetingPrepsForDays(1);
}

/** Today and the following Eastern days. Default is today and tomorrow. */
export async function getUpcomingMeetingPreps(
  days = 2
): Promise<PrepResult<{ meetings: MeetingPrepSummary[]; warnings: string[] }>> {
  return getMeetingPrepsForDays(days);
}

async function getMeetingPrepsForDays(
  days: number
): Promise<PrepResult<{ meetings: MeetingPrepSummary[]; warnings: string[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  try {
    const loaded = await loadMeetingsForDays(days);
    const sb = createServiceRoleClient();
    const nowIso = new Date().toISOString();
    const eventIds = loaded.meetings.map((meeting) => meeting.gcalEventId);

    if (eventIds.length) {
      const { data: existingRows, error: existingError } = await sb
        .from("meeting_preps")
        .select("id, gcal_event_id")
        .in("gcal_event_id", eventIds);
      if (existingError) return { ok: false, error: existingError.message };

      const existingByEvent = new Map<string, string>();
      for (const row of existingRows ?? []) {
        existingByEvent.set(row.gcal_event_id as string, row.id as string);
      }

      const toInsert = [];
      for (const meeting of loaded.meetings) {
        if (existingByEvent.has(meeting.gcalEventId)) continue;
        const purpose = purposeFromCalendarDescription(meeting.description);
        // Every row needs the same keys. A bulk insert turns a missing key
        // into null, which rejects purpose_confirmed.
        toInsert.push({
          ...refreshPayload(meeting, nowIso),
          gcal_event_id: meeting.gcalEventId,
          purpose,
          purpose_source: purpose ? "calendar" : null,
          purpose_confirmed: false,
          status: "new",
        });
      }

      if (toInsert.length) {
        const { error: insertError } = await sb.from("meeting_preps").insert(toInsert);
        if (insertError) return { ok: false, error: insertError.message };
      }

      for (const meeting of loaded.meetings) {
        const id = existingByEvent.get(meeting.gcalEventId);
        if (!id) continue;
        const { error: updateError } = await sb
          .from("meeting_preps")
          .update(refreshPayload(meeting, nowIso))
          .eq("id", id);
        if (updateError) return { ok: false, error: updateError.message };
      }
    }

    const { data, error } = eventIds.length
      ? await sb
          .from("meeting_preps")
          .select(PREP_COLUMNS)
          .in("gcal_event_id", eventIds)
      : { data: [], error: null };
    if (error) return { ok: false, error: error.message };

    const rows = ((data ?? []) as PrepRow[]).sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)
    );
    const prepIds = rows.map((row) => row.id);
    const counts = await sourceCounts(sb, prepIds);
    const points = await pointCounts(sb, prepIds);
    const meetings = rows.map((row) =>
      toSummary(row, counts.get(row.id) ?? 0, points.counts.get(row.id) ?? 0)
    );
    const warnings = [...loaded.warnings];
    if (points.missing) warnings.push("Meeting points are not in the database yet.");
    try {
      const homes = await loadHomeContextsForPreps(
        meetings.map((meeting) => ({
          id: meeting.id,
          gcalEventId: meeting.gcalEventId,
          attendees: meeting.attendees.map((attendee) => ({
            email: attendee.email,
            contactId: attendee.contactId,
          })),
        }))
      );
      for (const meeting of meetings) {
        meeting.home = homes.get(meeting.id) ?? EMPTY_HOME_CONTEXT;
      }
    } catch (err) {
      warnings.push(
        err instanceof Error ? err.message : "Could not load meeting history."
      );
    }
    return {
      ok: true,
      warnings,
      meetings,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getMeetingPrep(
  prepId: string
): Promise<PrepResult<{ prep: MeetingPrepDetail }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };

  const sb = createServiceRoleClient();
  let { data, error } = await sb
    .from("meeting_preps")
    .select(PREP_COLUMNS_WITH_OUTCOME)
    .eq("id", id)
    .maybeSingle();
  if (error && missingOutcomeColumn(error.message)) {
    ({ data, error } = await sb
      .from("meeting_preps")
      .select(PREP_COLUMNS_FULL)
      .eq("id", id)
      .maybeSingle());
  }
  if (error && /script_id/.test(error.message)) {
    ({ data, error } = await sb
      .from("meeting_preps")
      .select(PREP_COLUMNS_WITH_LIVE)
      .eq("id", id)
      .maybeSingle());
  }
  if (error && missingLiveColumn(error.message)) {
    ({ data, error } = await sb
      .from("meeting_preps")
      .select(PREP_COLUMNS)
      .eq("id", id)
      .maybeSingle());
  }
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Meeting prep not found." };

  const { data: sourceRows, error: sourceError } = await sb
    .from("meeting_prep_sources")
    .select(
      "id, source_type, external_id, account_email, title, url, occurred_at, snippet, relevance, relevance_reason, pinned, excluded"
    )
    .eq("prep_id", id)
    .order("relevance", { ascending: false, nullsFirst: false })
    .order("occurred_at", { ascending: false, nullsFirst: false });
  if (sourceError) return { ok: false, error: sourceError.message };

  const sources: MeetingPrepSource[] = (sourceRows ?? []).map((row) => ({
    id: row.id as string,
    sourceType: row.source_type as string,
    externalId: row.external_id as string,
    accountEmail: (row.account_email as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    occurredAt: (row.occurred_at as string | null) ?? null,
    snippet: (row.snippet as string | null) ?? null,
    relevance: typeof row.relevance === "number" ? row.relevance : null,
    relevanceReason: (row.relevance_reason as string | null) ?? null,
    pinned: Boolean(row.pinned),
    excluded: Boolean(row.excluded),
  }));

  const prep = toDetail(data as PrepRow, sources, sources.length);
  const scriptId = (data as { script_id?: string | null }).script_id ?? null;
  prep.scriptId = scriptId;
  if (scriptId) {
    const { data: script } = await sb
      .from("live_scripts")
      .select("name")
      .eq("id", scriptId)
      .maybeSingle();
    prep.scriptName = (script?.name as string | undefined)?.trim() || null;
  }

  return { ok: true, prep };
}

export async function setMeetingPurpose(
  prepId: string,
  purpose: string
): Promise<PrepResult<{ purpose: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const text = purpose.trim();
  if (!text) return { ok: false, error: "Write a purpose first." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .update({
      purpose: text,
      purpose_source: "user",
      purpose_confirmed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prepId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Meeting prep not found." };

  revalidatePrep(prepId);
  return { ok: true, purpose: text };
}

export async function confirmMeetingPurpose(
  prepId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const sb = createServiceRoleClient();
  const { data: existing, error: readError } = await sb
    .from("meeting_preps")
    .select("id, purpose")
    .eq("id", prepId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "Meeting prep not found." };
  if (!String(existing.purpose ?? "").trim()) {
    return { ok: false, error: "Write a purpose first." };
  }

  const { error } = await sb
    .from("meeting_preps")
    .update({
      purpose_confirmed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prepId);
  if (error) return { ok: false, error: error.message };

  revalidatePrep(prepId);
  return { ok: true };
}

export async function setMeetingOutcomeSentence(
  prepId: string,
  sentence: string
): Promise<PrepResult<{ outcomeSentence: string | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const text = sentence.trim().replace(/\s+/g, " ");
  if (text.length > 400) return { ok: false, error: "Keep the outcome sentence under 400 characters." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .update({
      outcome_sentence: text || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Meeting prep not found." };

  revalidatePrep(id);
  return { ok: true, outcomeSentence: text || null };
}

export async function setMeetingOutcomeMark(
  prepId: string,
  input: { mark: OutcomeMark | null; note?: string }
): Promise<PrepResult<{ outcomeMark: OutcomeMark | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  if (input.mark !== null && !OUTCOME_MARKS.has(input.mark)) {
    return { ok: false, error: "Unknown outcome mark." };
  }
  const note = input.note?.trim().replace(/\s+/g, " ") || null;
  if (note && note.length > 400) return { ok: false, error: "Keep the note under 400 characters." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .update({
      outcome_mark: input.mark,
      outcome_note: input.mark ? note : null,
      outcome_marked_at: input.mark ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Meeting prep not found." };

  revalidatePrep(id);
  return { ok: true, outcomeMark: input.mark };
}

export interface RecentLiveMeeting {
  id: string;
  startsAt: string;
  title: string;
  attendeeName: string | null;
  strategyName: string | null;
  outcomeMark: OutcomeMark | null;
  reviewed: boolean;
}

interface RecentPrepRow {
  id: string;
  title: string | null;
  starts_at: string;
  attendees: unknown;
  script_id: string | null;
  outcome_mark: string | null;
}

export async function getRecentLiveMeetings(
  limit = 10
): Promise<PrepResult<{ meetings: RecentLiveMeeting[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const take = Math.min(Math.max(Math.floor(limit) || 10, 1), 50);
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .select("id, title, starts_at, attendees, script_id, outcome_mark")
    .not("live_ended_at", "is", null)
    .order("live_ended_at", { ascending: false })
    .limit(take);
  if (error) {
    if (missingLiveColumn(error.message)) return { ok: true, meetings: [] };
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as RecentPrepRow[];
  const prepIds = rows.map((row) => row.id);
  const scriptIds = [
    ...new Set(rows.map((row) => row.script_id).filter((id): id is string => Boolean(id))),
  ];
  const [scriptsResult, reviewsResult] = await Promise.all([
    scriptIds.length
      ? sb.from("live_scripts").select("id, name").in("id", scriptIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
    prepIds.length
      ? sb.from("meeting_reviews").select("prep_id").in("prep_id", prepIds)
      : Promise.resolve({ data: [] as { prep_id: string }[], error: null }),
  ]);

  const names = new Map<string, string>();
  if (!scriptsResult.error) {
    for (const row of scriptsResult.data ?? []) {
      const name = row.name?.trim();
      if (row.id && name) names.set(row.id, name);
    }
  }
  const reviewedIds = new Set<string>();
  if (!reviewsResult.error) {
    for (const row of reviewsResult.data ?? []) {
      if (row.prep_id) reviewedIds.add(row.prep_id);
    }
  }

  return {
    ok: true,
    meetings: rows.map((row) => {
      const first = asAttendees(row.attendees)[0];
      return {
        id: row.id,
        startsAt: row.starts_at,
        title: row.title?.trim() || "Meeting",
        attendeeName: first ? first.name || first.email.split("@")[0] || null : null,
        strategyName: row.script_id ? (names.get(row.script_id) ?? null) : null,
        outcomeMark: asOutcomeMark(row.outcome_mark),
        reviewed: reviewedIds.has(row.id),
      };
    }),
  };
}
