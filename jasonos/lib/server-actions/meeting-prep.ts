"use server";

import { revalidatePath } from "next/cache";
import {
  loadTodaysMeetings,
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

export async function getTodaysMeetingPreps(): Promise<
  PrepResult<{ meetings: MeetingPrepSummary[]; warnings: string[] }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  try {
    const loaded = await loadTodaysMeetings();
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
        toInsert.push({
          ...refreshPayload(meeting, nowIso),
          gcal_event_id: meeting.gcalEventId,
          ...(purpose
            ? {
                purpose,
                purpose_source: "calendar",
                purpose_confirmed: false,
              }
            : {}),
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
          .select(
            "id, gcal_event_id, ical_uid, calendar_source, title, starts_at, ends_at, calendar_url, conference_url, location, description, attendees, purpose, purpose_source, purpose_confirmed, status, error, gathered_at, built_at"
          )
          .in("gcal_event_id", eventIds)
      : { data: [], error: null };
    if (error) return { ok: false, error: error.message };

    const rows = ((data ?? []) as PrepRow[]).sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)
    );
    const counts = await sourceCounts(
      sb,
      rows.map((row) => row.id)
    );
    return {
      ok: true,
      warnings: loaded.warnings,
      meetings: rows.map((row) => toSummary(row, counts.get(row.id) ?? 0)),
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
  const { data, error } = await sb
    .from("meeting_preps")
    .select(
      "id, gcal_event_id, ical_uid, calendar_source, title, starts_at, ends_at, calendar_url, conference_url, location, description, attendees, purpose, purpose_source, purpose_confirmed, status, error, gathered_at, built_at"
    )
    .eq("id", id)
    .maybeSingle();
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

  return {
    ok: true,
    prep: toDetail(data as PrepRow, sources, sources.length),
  };
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
