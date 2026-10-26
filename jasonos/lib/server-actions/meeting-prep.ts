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
import { isJoinBoilerplate, purposeFromCalendarDescription } from "@/lib/meeting-prep/text";
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
  companyId: string | null;
  primaryCompanyName: string | null;
  planSource: string | null;
  handoffId: string | null;
  packetHighlights: string[];
  home: MeetingHomeContext;
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
  company_id?: string | null;
  plan_source?: string | null;
  handoff_id?: string | null;
  packet_highlights?: string[] | null;
}

const PREP_COLUMNS =
  "id, gcal_event_id, ical_uid, calendar_source, title, starts_at, ends_at, calendar_url, conference_url, location, description, attendees, purpose, purpose_source, purpose_confirmed, status, error, gathered_at, built_at";
const PREP_COLUMNS_WITH_PACKET = `${PREP_COLUMNS}, company_id, plan_source, handoff_id, packet_highlights`;

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
  revalidatePath("/live");
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

function packetHighlightsOf(row: PrepRow): string[] {
  return Array.isArray(row.packet_highlights)
    ? row.packet_highlights.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function toSummary(row: PrepRow, sourceCount: number): MeetingPrepSummary {
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
    companyId: row.company_id ?? null,
    primaryCompanyName: null,
    planSource: row.plan_source?.trim() || null,
    handoffId: row.handoff_id ?? null,
    packetHighlights: packetHighlightsOf(row),
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

async function selectPrepRows(
  sb: ReturnType<typeof createServiceRoleClient>,
  eventIds: string[]
): Promise<{ rows: PrepRow[]; error: string | null }> {
  if (!eventIds.length) return { rows: [], error: null };
  const full = await sb.from("meeting_preps").select(PREP_COLUMNS_WITH_PACKET).in("gcal_event_id", eventIds);
  if (!full.error) {
    return { rows: (full.data ?? []) as PrepRow[], error: null };
  }
  if (/company_id|plan_source|handoff_id|packet_highlights/.test(full.error.message)) {
    const base = await sb.from("meeting_preps").select(PREP_COLUMNS).in("gcal_event_id", eventIds);
    return { rows: (base.data ?? []) as PrepRow[], error: base.error?.message ?? null };
  }
  return { rows: [], error: full.error.message };
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
      for (const meeting of loaded.meetings) {
        const ensured = await ensureMeetingPrepForEvent(meeting);
        if (!ensured.ok) return { ok: false, error: ensured.error };
      }
    }

    const { rows: rowsRaw, error: selectError } = await selectPrepRows(sb, eventIds);
    if (selectError) return { ok: false, error: selectError };

    const rows = rowsRaw.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    const prepIds = rows.map((row) => row.id);
    const counts = await sourceCounts(sb, prepIds);
    const meetings = rows.map((row) => toSummary(row, counts.get(row.id) ?? 0));
    const warnings = [...loaded.warnings];

    const contactIds = [
      ...new Set(
        meetings.flatMap((meeting) =>
          meeting.attendees
            .map((attendee) => attendee.contactId)
            .filter((id): id is string => Boolean(id))
        )
      ),
    ];
    const companyIds = [
      ...new Set(meetings.map((meeting) => meeting.companyId).filter((id): id is string => Boolean(id))),
    ];
    const [contactsResult, companiesResult] = await Promise.all([
      contactIds.length
        ? sb
            .from("contacts")
            .select("id, company_id, companies(name, research_verified)")
            .in("id", contactIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
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
    const companyNames = new Map(
      (companiesResult.data ?? []).map((row) => [row.id as string, String(row.name ?? "").trim()])
    );
    const contactMeta = new Map(
      (contactsResult.data ?? []).map((row) => {
        const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
        return [
          row.id as string,
          {
            researchVerified: Boolean(company?.research_verified),
            hasCompany: Boolean(company?.name?.trim() || row.company_id),
          },
        ];
      })
    );

    for (const meeting of meetings) {
      if (meeting.companyId) {
        const linked = companyNames.get(meeting.companyId);
        if (linked) meeting.primaryCompanyName = linked;
      }
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
      warnings.push(err instanceof Error ? err.message : "Could not load meeting history.");
    }
    return { ok: true, warnings, meetings };
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
  if (error && /company_id|plan_source|handoff_id|packet_highlights/.test(error.message)) {
    ({ data, error } = await sb.from("meeting_preps").select(PREP_COLUMNS).eq("id", id).maybeSingle());
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
  if (prep.companyId) {
    const { data: company } = await sb
      .from("companies")
      .select("name")
      .eq("id", prep.companyId)
      .maybeSingle();
    prep.primaryCompanyName = (company?.name as string | undefined)?.trim() || prep.primaryCompanyName;
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
