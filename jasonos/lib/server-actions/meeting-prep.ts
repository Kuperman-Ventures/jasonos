"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { loadHomeContextsForPreps } from "@/lib/meeting-prep/context";
import {
  EMPTY_HOME_CONTEXT,
  type MeetingHomeContext,
} from "@/lib/meeting-prep/context-model";
import {
  loadMeetingsForDays,
  type TodaysMeeting,
} from "@/lib/meeting-prep/today";
import { isJoinBoilerplate, purposeFromCalendarDescription } from "@/lib/meeting-prep/text";
import { isContactThin } from "@/lib/meeting-prep/research-policy";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TRACKS, type Track } from "@/lib/types";

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
  projectId: string | null;
  projectName: string | null;
  projectGoal: string | null;
  primaryContactId: string | null;
  primaryContactName: string | null;
  companyId: string | null;
  primaryCompanyName: string | null;
  personalGoal: string | null;
  liveEndedAt: string | null;
  scriptId: string | null;
  scriptName: string | null;
  planSource: string | null;
  home: MeetingHomeContext;
  /** True when any attendee company was researched without reading its website. */
  researchUnverified: boolean;
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
  adaptedFromScriptId: string | null;
  adaptedFromScriptName: string | null;
  track: Track | null;
  researchRanAt: string | null;
  emailContext: string | null;
  emailContextAt: string | null;
  handoffId: string | null;
  packetHighlights: string[];
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
  project_id?: string | null;
  primary_contact_id?: string | null;
  company_id?: string | null;
  script_id?: string | null;
  adapted_from_script_id?: string | null;
  track?: string | null;
  research_ran_at?: string | null;
  email_context?: string | null;
  email_context_at?: string | null;
  plan_source?: string | null;
  handoff_id?: string | null;
  packet_highlights?: string[] | null;
}

const PREP_COLUMNS =
  "id, gcal_event_id, ical_uid, calendar_source, title, starts_at, ends_at, calendar_url, conference_url, location, description, attendees, purpose, purpose_source, purpose_confirmed, status, error, gathered_at, built_at";
const PREP_COLUMNS_WITH_LIVE = `${PREP_COLUMNS}, live_started_at, live_ended_at`;
const PREP_COLUMNS_FULL = `${PREP_COLUMNS_WITH_LIVE}, script_id`;
const PREP_COLUMNS_WITH_OUTCOME = `${PREP_COLUMNS_FULL}, outcome_sentence, outcome_mark, outcome_note, outcome_marked_at`;
const PREP_COLUMNS_WITH_LINKS = `${PREP_COLUMNS_WITH_OUTCOME}, project_id, primary_contact_id, adapted_from_script_id, adapted_at`;
const PREP_COLUMNS_WITH_COMPANY = `${PREP_COLUMNS_WITH_LINKS}, company_id`;
const PREP_COLUMNS_WITH_RESEARCH = `${PREP_COLUMNS_WITH_COMPANY}, track, research_ran_at, email_context, email_context_at`;
const PREP_COLUMNS_WITH_PACKET = `${PREP_COLUMNS_WITH_RESEARCH}, plan_source, handoff_id, packet_highlights`;

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    projectId: row.project_id ?? null,
    projectName: null,
    projectGoal: null,
    primaryContactId: row.primary_contact_id ?? null,
    primaryContactName: null,
    companyId: row.company_id ?? null,
    primaryCompanyName: null,
    personalGoal: null,
    liveEndedAt: row.live_ended_at ?? null,
    scriptId: row.script_id ?? null,
    scriptName: null,
    planSource: row.plan_source?.trim() || null,
    home: EMPTY_HOME_CONTEXT,
    researchUnverified: false,
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
    adaptedFromScriptId: row.adapted_from_script_id ?? null,
    adaptedFromScriptName: null,
    track: asTrack(row.track),
    researchRanAt: row.research_ran_at ?? null,
    emailContext: row.email_context?.trim() || null,
    emailContextAt: row.email_context_at ?? null,
    handoffId: row.handoff_id ?? null,
    packetHighlights: Array.isArray(row.packet_highlights)
      ? row.packet_highlights.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    sources,
  };
}

function asTrack(value: string | null | undefined): Track | null {
  if (value && (TRACKS as string[]).includes(value)) return value as Track;
  return null;
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

/** One writer for prep rows keyed on calendar event id. Used by hub load and Browning booking. */
export async function ensureMeetingPrepForEvent(
  meeting: TodaysMeeting
): Promise<{ ok: true; prepId: string; created: boolean } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  const { data: existing, error: existingError } = await sb
    .from("meeting_preps")
    .select("id")
    .eq("gcal_event_id", meeting.gcalEventId)
    .maybeSingle();
  if (existingError) return { ok: false, error: existingError.message };
  if (existing?.id) {
    const { error: updateError } = await sb
      .from("meeting_preps")
      .update(refreshPayload(meeting, nowIso))
      .eq("id", existing.id as string);
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true, prepId: existing.id as string, created: false };
  }
  const purpose = purposeFromCalendarDescription(meeting.description);
  const { data: inserted, error: insertError } = await sb
    .from("meeting_preps")
    .insert({
      ...refreshPayload(meeting, nowIso),
      gcal_event_id: meeting.gcalEventId,
      purpose,
      purpose_source: purpose ? "calendar" : null,
      purpose_confirmed: false,
      status: "new",
    })
    .select("id")
    .single();
  if (insertError || !inserted?.id) {
    return { ok: false, error: insertError?.message || "Could not create the meeting prep." };
  }
  return { ok: true, prepId: inserted.id as string, created: true };
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

function startsWithinWeek(startsAt: string, now = Date.now()): boolean {
  const start = Date.parse(startsAt);
  if (Number.isNaN(start)) return false;
  return start >= now - 12 * 60 * 60 * 1000 && start <= now + 7 * 24 * 60 * 60 * 1000;
}

async function queueResearchForThinAttendees(
  sb: ReturnType<typeof createServiceRoleClient>,
  eventIds: string[]
): Promise<void> {
  const { data, error } = await sb
    .from("meeting_preps")
    .select("id, starts_at, research_ran_at, attendees")
    .in("gcal_event_id", eventIds);
  if (error || !data?.length) return;

  const due = (data as Array<{ id: string; starts_at: string; research_ran_at: string | null; attendees: unknown }>).filter(
    (row) => !row.research_ran_at && startsWithinWeek(row.starts_at)
  );
  const contactIds = [
    ...new Set(due.flatMap((row) => asAttendees(row.attendees).map((attendee) => attendee.contactId).filter(Boolean))),
  ] as string[];
  if (!contactIds.length) return;

  const { data: contacts, error: contactError } = await sb
    .from("contacts")
    .select("id, title, company_id, linkedin_url, research_at")
    .in("id", contactIds);
  if (contactError || !contacts) return;
  const thin = new Set(
    (contacts as Array<{ id: string; title: string | null; company_id: string | null; linkedin_url: string | null; research_at: string | null }>)
      .filter((contact) =>
        isContactThin({
          title: contact.title,
          companyId: contact.company_id,
          linkedinUrl: contact.linkedin_url,
          researchAt: contact.research_at,
        })
      )
      .map((contact) => contact.id)
  );
  const prepIds = due
    .filter((row) => asAttendees(row.attendees).some((attendee) => attendee.contactId && thin.has(attendee.contactId)))
    .map((row) => row.id);
  if (!prepIds.length) return;

  after(() => {
    void import("@/lib/server-actions/meeting-research").then(({ runMeetingResearch }) =>
      Promise.all(
        prepIds.map((prepId) =>
          runMeetingResearch(prepId).catch((err) => {
            console.error("[meeting-research]", prepId, err);
          })
        )
      )
    );
  });
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

      for (const meeting of loaded.meetings) {
        const ensured = await ensureMeetingPrepForEvent(meeting);
        if (!ensured.ok) return { ok: false, error: ensured.error };
        existingByEvent.set(meeting.gcalEventId, ensured.prepId);
      }

      await queueResearchForThinAttendees(sb, eventIds);
    }

    let rowsRaw: unknown[] = [];
    let selectError: { message: string } | null = null;
    if (eventIds.length) {
      const linked = await sb
        .from("meeting_preps")
        .select(PREP_COLUMNS_WITH_PACKET)
        .in("gcal_event_id", eventIds);
      if (linked.error && /plan_source|handoff_id|packet_highlights/i.test(linked.error.message)) {
        const withoutPacket = await sb
          .from("meeting_preps")
          .select(PREP_COLUMNS_WITH_LINKS)
          .in("gcal_event_id", eventIds);
        if (
          withoutPacket.error &&
          /script_id|live_ended_at|outcome_mark|primary_contact_id/i.test(withoutPacket.error.message)
        ) {
          const fallback = await sb
            .from("meeting_preps")
            .select(PREP_COLUMNS)
            .in("gcal_event_id", eventIds);
          rowsRaw = (fallback.data ?? []) as unknown[];
          selectError = fallback.error;
        } else {
          rowsRaw = (withoutPacket.data ?? []) as unknown[];
          selectError = withoutPacket.error;
        }
      } else if (
        linked.error &&
        /script_id|live_ended_at|outcome_mark|primary_contact_id/i.test(linked.error.message)
      ) {
        const fallback = await sb
          .from("meeting_preps")
          .select(PREP_COLUMNS)
          .in("gcal_event_id", eventIds);
        rowsRaw = (fallback.data ?? []) as unknown[];
        selectError = fallback.error;
      } else {
        rowsRaw = (linked.data ?? []) as unknown[];
        selectError = linked.error;
      }
    }
    if (selectError) return { ok: false, error: selectError.message };

    const rows = (rowsRaw as PrepRow[]).sort(
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

    const scriptIds = [
      ...new Set(meetings.map((meeting) => meeting.scriptId).filter((id): id is string => Boolean(id))),
    ];
    const contactIds = [
      ...new Set(
        meetings.flatMap((meeting) => [
          ...(meeting.primaryContactId ? [meeting.primaryContactId] : []),
          ...meeting.attendees
            .map((attendee) => attendee.contactId)
            .filter((id): id is string => Boolean(id)),
        ])
      ),
    ];
    const companyIds = [
      ...new Set(meetings.map((meeting) => meeting.companyId).filter((id): id is string => Boolean(id))),
    ];
    const [scriptsResult, contactsResult, companiesResult] = await Promise.all([
      scriptIds.length
        ? sb.from("live_scripts").select("id, name").in("id", scriptIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }>, error: null }),
      contactIds.length
        ? sb
            .from("contacts")
            .select("id, name, company_id, companies(name, research_verified)")
            .in("id", contactIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              name: string | null;
              company_id: string | null;
              companies:
                | { name: string; research_verified?: boolean }
                | { name: string; research_verified?: boolean }[]
                | null;
            }>,
            error: null,
          }),
      companyIds.length
        ? sb.from("companies").select("id, name").in("id", companyIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }>, error: null }),
    ]);
    const scriptNames = new Map(
      (scriptsResult.data ?? []).map((row) => [row.id as string, String(row.name ?? "").trim()])
    );
    const companyNames = new Map(
      (companiesResult.data ?? []).map((row) => [
        row.id as string,
        String(row.name ?? "").trim(),
      ])
    );
    const contactMeta = new Map(
      (contactsResult.data ?? []).map((row) => {
        const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
        return [
          row.id as string,
          {
            name: String(row.name ?? "").trim() || null,
            company: company?.name?.trim() || null,
            researchVerified: Boolean(company?.research_verified),
            hasCompany: Boolean(company?.name?.trim() || row.company_id),
          },
        ];
      })
    );
    const planNames = new Map<string, string>();
    if (prepIds.length) {
      const { data: planRows } = await sb
        .from("live_scripts")
        .select("name, attached_prep_id")
        .eq("kind", "plan")
        .in("attached_prep_id", prepIds);
      for (const row of planRows ?? []) {
        const prepId = row.attached_prep_id as string | null;
        const name = String(row.name ?? "").trim();
        if (prepId && name) planNames.set(prepId, name);
      }
    }

    for (const meeting of meetings) {
      if (meeting.scriptId) meeting.scriptName = scriptNames.get(meeting.scriptId) || null;
      else if (planNames.has(meeting.id)) {
        meeting.scriptName = `From plan: ${planNames.get(meeting.id)}`;
      }
      if (meeting.primaryContactId) {
        const meta = contactMeta.get(meeting.primaryContactId);
        meeting.primaryContactName = meta?.name ?? meeting.primaryContactName;
        meeting.primaryCompanyName = meta?.company ?? null;
        meeting.researchUnverified = Boolean(meta?.hasCompany && !meta.researchVerified);
      }
      if (meeting.companyId) {
        const linked = companyNames.get(meeting.companyId);
        if (linked) meeting.primaryCompanyName = linked;
      }
      // Also flag when any attendee contact's company is unverified.
      const attendeeIds = meeting.attendees
        .map((attendee) => attendee.contactId)
        .filter((id): id is string => Boolean(id));
      if (attendeeIds.length) {
        meeting.researchUnverified = attendeeIds.some((id) => {
          const meta = contactMeta.get(id);
          return Boolean(meta?.hasCompany && !meta.researchVerified);
        });
      }
    }

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
    .select(PREP_COLUMNS_WITH_PACKET)
    .eq("id", id)
    .maybeSingle();
  if (error && /plan_source|handoff_id|packet_highlights/.test(error.message)) {
    ({ data, error } = await sb
      .from("meeting_preps")
      .select(PREP_COLUMNS_WITH_RESEARCH)
      .eq("id", id)
      .maybeSingle());
  }
  if (error && /research_ran_at|email_context|column meeting_preps.track/.test(error.message)) {
    ({ data, error } = await sb
      .from("meeting_preps")
      .select(PREP_COLUMNS_WITH_COMPANY)
      .eq("id", id)
      .maybeSingle());
  }
  if (error && /company_id/.test(error.message)) {
    ({ data, error } = await sb
      .from("meeting_preps")
      .select(PREP_COLUMNS_WITH_LINKS)
      .eq("id", id)
      .maybeSingle());
  }
  if (error && /project_id|primary_contact_id|adapted_from_script_id|adapted_at/.test(error.message)) {
    ({ data, error } = await sb
      .from("meeting_preps")
      .select(PREP_COLUMNS_WITH_OUTCOME)
      .eq("id", id)
      .maybeSingle());
  }
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
  } else {
    const { data: plan } = await sb
      .from("live_scripts")
      .select("name")
      .eq("kind", "plan")
      .eq("attached_prep_id", prep.id)
      .order("attached_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (plan?.name) prep.scriptName = `From plan: ${String(plan.name).trim()}`;
  }
  if (prep.adaptedFromScriptId) {
    const { data: adapted } = await sb
      .from("live_scripts")
      .select("name")
      .eq("id", prep.adaptedFromScriptId)
      .maybeSingle();
    prep.adaptedFromScriptName = (adapted?.name as string | undefined)?.trim() || null;
  }
  if (prep.projectId) {
    const { data: project } = await sb
      .from("projects")
      .select("name, goal_statement")
      .eq("id", prep.projectId)
      .maybeSingle();
    prep.projectName = (project?.name as string | undefined)?.trim() || null;
    prep.projectGoal = (project?.goal_statement as string | undefined)?.trim() || null;
  }
  if (prep.primaryContactId) {
    const { data: contact } = await sb
      .from("contacts")
      .select("name, personal_goal, company_id, companies(name)")
      .eq("id", prep.primaryContactId)
      .maybeSingle();
    prep.primaryContactName = (contact?.name as string | undefined)?.trim() || null;
    prep.personalGoal = (contact?.personal_goal as string | undefined)?.trim() || null;
    if (!prep.companyId) {
      const linked = contact?.companies as { name?: string } | { name?: string }[] | null | undefined;
      const fromContact = (Array.isArray(linked) ? linked[0]?.name : linked?.name)?.trim() || null;
      prep.primaryCompanyName = fromContact;
    }
  }
  if (prep.companyId) {
    const { data: company } = await sb
      .from("companies")
      .select("name")
      .eq("id", prep.companyId)
      .maybeSingle();
    prep.primaryCompanyName = (company?.name as string | undefined)?.trim() || prep.primaryCompanyName;
  }
  if (!prep.researchRanAt && startsWithinWeek(prep.startsAt)) {
    after(() => {
      void import("@/lib/server-actions/meeting-research").then(({ runMeetingResearch }) =>
        runMeetingResearch(prep.id).catch((err) => {
          console.error("[meeting-research]", prep.id, err);
        })
      );
    });
  }

  return { ok: true, prep };
}

export async function setMeetingTitle(
  prepId: string,
  title: string
): Promise<PrepResult<{ title: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const text = title.trim();
  if (!text) return { ok: false, error: "Write a meeting name." };
  if (text.length > 200) return { ok: false, error: "Keep the name under 200 characters." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .update({ title: text, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Meeting prep not found." };

  revalidatePrep(id);
  revalidatePath("/live");
  return { ok: true, title: text };
}

export async function setMeetingCompany(
  prepId: string,
  companyId: string | null
): Promise<PrepResult<{ companyId: string | null; companyName: string | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const next = companyId?.trim() || null;
  if (next && !UUID_RE.test(next)) return { ok: false, error: "Unknown company." };

  const sb = createServiceRoleClient();
  let companyName: string | null = null;
  if (next) {
    const { data: company, error: companyError } = await sb
      .from("companies")
      .select("id, name")
      .eq("id", next)
      .maybeSingle();
    if (companyError) return { ok: false, error: companyError.message };
    if (!company) return { ok: false, error: "Unknown company." };
    companyName = String(company.name ?? "").trim() || null;
  }

  const { error } = await sb
    .from("meeting_preps")
    .update({ company_id: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePrep(id);
  revalidatePath("/live");
  return { ok: true, companyId: next, companyName };
}

export async function searchCompaniesForMeeting(
  query: string,
  limit = 10
): Promise<{ id: string; name: string }[]> {
  if (!hasConfig()) return [];
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  const take = Math.min(Math.max(Math.floor(limit) || 10, 1), 20);
  const sb = createServiceRoleClient();
  const pattern = `%${trimmed.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const { data, error } = await sb
    .from("companies")
    .select("id, name")
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(take);
  if (error) {
    console.error("[meeting-prep.searchCompanies]", error);
    return [];
  }
  return (data ?? [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim(),
    }))
    .filter((row) => row.name);
}

export async function setMeetingPurpose(
  prepId: string,
  purpose: string
): Promise<PrepResult<{ purpose: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const text = purpose.trim();
  if (!text) return { ok: false, error: "Write a purpose first." };
  if (isJoinBoilerplate(text)) {
    return { ok: false, error: "That looks like join info. Write what you want out of the call." };
  }

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
  /** Best display label: contact, company, human attendee, or title. */
  attendeeName: string | null;
  companyName: string | null;
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
  primary_contact_id?: string | null;
  company_id?: string | null;
}

/** Prefer a real person name; never fall back to an email local-part like molly.millar. */
function humanAttendeeName(attendees: MeetingPrepAttendee[]): string | null {
  for (const row of attendees) {
    const name = row.name?.trim() || null;
    if (!name) continue;
    if (name.includes("@")) continue;
    const local = row.email.split("@")[0]?.toLowerCase() ?? "";
    if (local && name.toLowerCase() === local) continue;
    if (/^[a-z0-9._+-]+$/i.test(name) && name.includes(".") && !/\s/.test(name)) continue;
    return name;
  }
  return null;
}

function recentDisplayName(input: {
  title: string;
  contactName: string | null;
  companyName: string | null;
  attendees: MeetingPrepAttendee[];
}): string {
  if (input.contactName) return input.contactName;
  if (input.companyName) return input.companyName;
  const human = humanAttendeeName(input.attendees);
  if (human) return human;
  return input.title;
}

export async function getRecentLiveMeetings(
  limit = 10
): Promise<PrepResult<{ meetings: RecentLiveMeeting[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const take = Math.min(Math.max(Math.floor(limit) || 10, 1), 50);
  const sb = createServiceRoleClient();
  const full = await sb
    .from("meeting_preps")
    .select("id, title, starts_at, attendees, script_id, outcome_mark, primary_contact_id, company_id")
    .not("live_ended_at", "is", null)
    .order("live_ended_at", { ascending: false })
    .limit(take);
  let rows: RecentPrepRow[] = [];
  let error = full.error;
  if (!error) {
    rows = (full.data ?? []) as RecentPrepRow[];
  } else if (/company_id/.test(error.message)) {
    const withoutCompany = await sb
      .from("meeting_preps")
      .select("id, title, starts_at, attendees, script_id, outcome_mark, primary_contact_id")
      .not("live_ended_at", "is", null)
      .order("live_ended_at", { ascending: false })
      .limit(take);
    error = withoutCompany.error;
    rows = (withoutCompany.data ?? []) as RecentPrepRow[];
  }
  if (error && /primary_contact_id/.test(error.message)) {
    const bare = await sb
      .from("meeting_preps")
      .select("id, title, starts_at, attendees, script_id, outcome_mark")
      .not("live_ended_at", "is", null)
      .order("live_ended_at", { ascending: false })
      .limit(take);
    error = bare.error;
    rows = (bare.data ?? []) as RecentPrepRow[];
  }
  if (error) {
    if (missingLiveColumn(error.message)) return { ok: true, meetings: [] };
    return { ok: false, error: error.message };
  }
  const prepIds = rows.map((row) => row.id);
  const scriptIds = [
    ...new Set(rows.map((row) => row.script_id).filter((id): id is string => Boolean(id))),
  ];
  const contactIds = [
    ...new Set(rows.map((row) => row.primary_contact_id).filter((id): id is string => Boolean(id))),
  ];
  const companyIds = [
    ...new Set(rows.map((row) => row.company_id).filter((id): id is string => Boolean(id))),
  ];
  const [scriptsResult, reviewsResult, contactsResult, companiesResult] = await Promise.all([
    scriptIds.length
      ? sb.from("live_scripts").select("id, name").in("id", scriptIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
    prepIds.length
      ? sb.from("meeting_reviews").select("prep_id").in("prep_id", prepIds)
      : Promise.resolve({ data: [] as { prep_id: string }[], error: null }),
    contactIds.length
      ? sb.from("contacts").select("id, name, company_id, companies(name)").in("id", contactIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            name: string | null;
            company_id: string | null;
            companies: { name?: string } | { name?: string }[] | null;
          }>,
          error: null,
        }),
    companyIds.length
      ? sb.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
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
  const contactById = new Map<string, { name: string | null; company: string | null }>();
  if (!contactsResult.error) {
    for (const row of contactsResult.data ?? []) {
      const linked = row.companies;
      const company = (Array.isArray(linked) ? linked[0]?.name : linked?.name)?.trim() || null;
      contactById.set(row.id, {
        name: row.name?.trim() || null,
        company,
      });
    }
  }
  const companyById = new Map<string, string>();
  if (!companiesResult.error) {
    for (const row of companiesResult.data ?? []) {
      const name = row.name?.trim();
      if (row.id && name) companyById.set(row.id, name);
    }
  }

  return {
    ok: true,
    meetings: rows.map((row) => {
      const attendees = asAttendees(row.attendees);
      const contact = row.primary_contact_id ? contactById.get(row.primary_contact_id) : undefined;
      const companyName =
        (row.company_id ? companyById.get(row.company_id) ?? null : null) ||
        contact?.company ||
        null;
      const title = row.title?.trim() || "Meeting";
      const label = recentDisplayName({
        title,
        contactName: contact?.name ?? null,
        companyName,
        attendees,
      });
      return {
        id: row.id,
        startsAt: row.starts_at,
        title,
        attendeeName: label === title ? null : label,
        companyName,
        strategyName: row.script_id ? (names.get(row.script_id) ?? null) : null,
        outcomeMark: asOutcomeMark(row.outcome_mark),
        reviewed: reviewedIds.has(row.id),
      };
    }),
  };
}

export interface ProjectPickerOption {
  id: string;
  name: string;
  track: string;
  goalStatement: string;
}

export async function listProjectsForPicker(): Promise<PrepResult<{ projects: ProjectPickerOption[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const { data, error } = await sb.from("projects").select("id, name, track, goal_statement");
  if (error) return { ok: false, error: error.message };
  const projects = (data ?? [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim(),
      track: String(row.track ?? ""),
      goalStatement: String(row.goal_statement ?? "").trim(),
    }))
    .filter((row) => row.name && row.goalStatement);
  const rank = (track: string) => (track === "job_search" || track === "advisors" ? 0 : 1);
  projects.sort((a, b) => rank(a.track) - rank(b.track) || a.name.localeCompare(b.name));
  return { ok: true, projects };
}

export async function setMeetingProject(
  prepId: string,
  projectId: string | null
): Promise<PrepResult<{ projectId: string | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const next = projectId?.trim() || null;
  if (next && !UUID_RE.test(next)) return { ok: false, error: "Unknown project." };
  const sb = createServiceRoleClient();
  if (next) {
    const { data: project, error: projectError } = await sb
      .from("projects")
      .select("id")
      .eq("id", next)
      .maybeSingle();
    if (projectError) return { ok: false, error: projectError.message };
    if (!project) return { ok: false, error: "Unknown project." };
  }
  const { error } = await sb
    .from("meeting_preps")
    .update({ project_id: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePrep(id);
  return { ok: true, projectId: next };
}

export async function setMeetingPrimaryContact(
  prepId: string,
  contactId: string | null
): Promise<PrepResult<{ contactId: string | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const next = contactId?.trim() || null;
  if (next && !UUID_RE.test(next)) return { ok: false, error: "Unknown person." };
  const sb = createServiceRoleClient();
  if (next) {
    const { data: contact, error: contactError } = await sb
      .from("contacts")
      .select("id")
      .eq("id", next)
      .maybeSingle();
    if (contactError) return { ok: false, error: contactError.message };
    if (!contact) return { ok: false, error: "Unknown person." };
  }
  const { error } = await sb
    .from("meeting_preps")
    .update({ primary_contact_id: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePrep(id);
  revalidatePath("/live");
  return { ok: true, contactId: next };
}

export async function setMeetingTrack(
  prepId: string,
  track: string | null
): Promise<PrepResult<{ track: Track | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const next = asTrack(track?.trim() || null);
  if (track?.trim() && !next) return { ok: false, error: "Unknown track." };
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("meeting_preps")
    .update({ track: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePrep(id);
  return { ok: true, track: next };
}
