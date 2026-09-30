"use server";

import { revalidatePath } from "next/cache";
import { etToday } from "@/lib/dates";
import { buildMailtoUrl } from "@/lib/email-templates/render";
import {
  calendarEventGuests,
  fetchAllPersonalCalendarEvents,
} from "@/lib/integrations/google-calendar";
import { listSentRecipientTouches } from "@/lib/integrations/gmail";
import { searchGranolaForContact } from "@/lib/integrations/granola";
import { matchCalendarEventToContacts } from "@/lib/outreach/calendar-matching";
import { buildContactLookup } from "@/lib/outreach/email-matching";
import { appendSyncLog } from "@/lib/outreach/sync-log";
import { composeMeetingFollowupDraft } from "@/lib/outreach/meeting-followup-compose";
import {
  attendeeLine,
  isMeetingFollowupDue,
  latestSentByEmail,
  meetingEndIso,
  meetingFollowupDaysAgo,
  meetingStartIso,
  MEETING_FOLLOWUP_SCAN_DAYS_BACK,
  planMeetingFollowup,
  qualifyPastMeeting,
  snoozeUntilYmd,
  type MeetingAttendee,
  type MeetingFollowupStatus,
  type PastMeetingCandidate,
} from "@/lib/outreach/meeting-followups";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface MeetingFollowup {
  id: string;
  gcalEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  calendarUrl: string | null;
  attendees: MeetingAttendee[];
  pendingAttendees: MeetingAttendee[];
  pendingLine: string;
  status: MeetingFollowupStatus;
  snoozeUntil: string | null;
  daysAgo: number;
  granolaSummary: string | null;
  granolaUrl: string | null;
  draftSubject: string | null;
  draftBody: string | null;
}

type ActionResult = { ok: true } | { ok: false; error: string };

interface FollowupRow {
  id: string;
  gcal_event_id: string;
  ical_uid?: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  calendar_url: string | null;
  attendees: unknown;
  pending_attendees: unknown;
  status: MeetingFollowupStatus;
  snooze_until: string | null;
  granola_summary: string | null;
  granola_url: string | null;
  draft_subject: string | null;
  draft_body: string | null;
}

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function asAttendees(value: unknown): MeetingAttendee[] {
  if (!Array.isArray(value)) return [];
  const out: MeetingAttendee[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const email = (item as { email?: unknown }).email;
    const name = (item as { name?: unknown }).name;
    if (typeof email !== "string" || !email.includes("@")) continue;
    out.push({
      email: email.trim().toLowerCase(),
      name: typeof name === "string" && name.trim() ? name.trim() : null,
    });
  }
  return out;
}

function toView(row: FollowupRow, today = etToday()): MeetingFollowup {
  const pending = asAttendees(row.pending_attendees);
  return {
    id: row.id,
    gcalEventId: row.gcal_event_id,
    title: row.title?.trim() || "Meeting",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    calendarUrl: row.calendar_url,
    attendees: asAttendees(row.attendees),
    pendingAttendees: pending,
    pendingLine: attendeeLine(pending),
    status: row.status,
    snoozeUntil: row.snooze_until?.slice(0, 10) ?? null,
    daysAgo: meetingFollowupDaysAgo(row.ends_at, today),
    granolaSummary: row.granola_summary,
    granolaUrl: row.granola_url,
    draftSubject: row.draft_subject,
    draftBody: row.draft_body,
  };
}

function rowPayload(
  meeting: PastMeetingCandidate,
  pending: MeetingAttendee[],
  status: MeetingFollowupStatus,
  snoozeUntil: string | null
) {
  return {
    gcal_event_id: meeting.gcalEventId,
    ical_uid: meeting.icalUid,
    title: meeting.title,
    starts_at: meeting.startsAt,
    ends_at: meeting.endsAt,
    calendar_url: meeting.calendarUrl,
    attendees: meeting.attendees,
    pending_attendees: pending,
    status,
    snooze_until: snoozeUntil,
    updated_at: new Date().toISOString(),
  };
}

function revalidate() {
  revalidatePath("/");
  revalidatePath("/outreach/sent");
}

export async function captureMeetingFollowups(opts?: {
  daysBack?: number;
  runId?: string;
}): Promise<
  | {
      ok: true;
      scanned: number;
      created: number;
      updated: number;
      resolved: number;
      skipped: number;
    }
  | { ok: false; error: string; unavailable?: boolean }
> {
  const result = await captureMeetingFollowupsInner(opts);
  if (result.ok) {
    await appendSyncLog(
      "meeting-followups",
      {
        ok: true,
        scanned: result.scanned,
        created: result.created,
        updated: result.updated,
        resolved: result.resolved,
        skipped: result.skipped,
        inserted: result.created,
      },
      opts?.runId
    );
  } else if (result.error !== "Not configured") {
    await appendSyncLog(
      "meeting-followups",
      {
        ok: false,
        unavailable: result.unavailable === true,
        error: result.error,
      },
      opts?.runId
    );
  }
  return result;
}

async function captureMeetingFollowupsInner(opts?: {
  daysBack?: number;
}): Promise<
  | {
      ok: true;
      scanned: number;
      created: number;
      updated: number;
      resolved: number;
      skipped: number;
    }
  | { ok: false; error: string; unavailable?: boolean }
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };

  const daysBack = Math.max(
    1,
    Math.min(90, opts?.daysBack ?? MEETING_FOLLOWUP_SCAN_DAYS_BACK)
  );
  const now = new Date();
  const timeMin = new Date(now.getTime() - daysBack * 86_400_000).toISOString();
  const timeMax = now.toISOString();

  const [cal, sent, lookup] = await Promise.all([
    fetchAllPersonalCalendarEvents({ timeMin, timeMax }),
    listSentRecipientTouches({ daysBack: daysBack + 2 }),
    buildContactLookup(),
  ]);

  if (cal.error && !cal.events.length) {
    return { ok: false, unavailable: true, error: cal.error };
  }
  if (!sent.configured) {
    return {
      ok: false,
      unavailable: true,
      error: "Gmail is not connected.",
    };
  }
  if (sent.error && !sent.data.length) {
    return { ok: false, error: sent.error };
  }

  const sentByEmail = latestSentByEmail(sent.data);
  const today = etToday();
  const meetings: PastMeetingCandidate[] = [];
  /** Past meetings that look real but have no JasonOS contact — dismiss if queued. */
  const noContactEventIds: string[] = [];
  for (const ev of cal.events) {
    const guests = calendarEventGuests(ev);
    const { matches } = matchCalendarEventToContacts({
      title: ev.summary,
      guests,
      lookup,
    });
    const hasKnownContact = matches.length > 0;
    const base = {
      gcalEventId: ev.id,
      icalUid: ev.iCalUID,
      title: ev.summary,
      status: ev.status,
      startsAt: meetingStartIso(ev),
      endsAt: meetingEndIso(ev),
      calendarUrl: ev.htmlLink ?? null,
      guests,
      now,
    };
    // Detect webinars / blast invites we may have queued before the contact filter.
    if (
      ev.id &&
      qualifyPastMeeting({ ...base, hasKnownContact: true }) &&
      !hasKnownContact
    ) {
      noContactEventIds.push(ev.id);
    }
    const qualified = qualifyPastMeeting({
      ...base,
      // Require a JasonOS contact so webinars / blast invites stay out.
      hasKnownContact,
    });
    if (qualified) meetings.push(qualified);
  }

  const sb = createServiceRoleClient();
  const eventIds = meetings.map((m) => m.gcalEventId);
  const existing = new Map<
    string,
    { gcalEventId: string; status: MeetingFollowupStatus; snoozeUntil: string | null }
  >();
  if (eventIds.length) {
    const { data, error } = await sb
      .from("meeting_followups")
      .select("gcal_event_id, status, snooze_until")
      .in("gcal_event_id", eventIds);
    if (error) return { ok: false, error: error.message };
    for (const row of data ?? []) {
      existing.set(row.gcal_event_id as string, {
        gcalEventId: row.gcal_event_id as string,
        status: row.status as MeetingFollowupStatus,
        snoozeUntil: (row.snooze_until as string | null)?.slice(0, 10) ?? null,
      });
    }
  }

  let created = 0;
  let updated = 0;
  let resolved = 0;
  let skipped = 0;

  for (const meeting of meetings) {
    const plan = planMeetingFollowup(
      meeting,
      sentByEmail,
      existing.get(meeting.gcalEventId),
      today
    );
    if (plan.action === "skip") {
      skipped += 1;
      continue;
    }
    if (plan.action === "insert") {
      const { error } = await sb
        .from("meeting_followups")
        .insert(rowPayload(plan.meeting, plan.pending, "open", null));
      if (error) return { ok: false, error: error.message };
      created += 1;
      continue;
    }
    if (plan.action === "resolve") {
      const { error } = await sb
        .from("meeting_followups")
        .update({
          status: "done",
          pending_attendees: [],
          decided_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("gcal_event_id", plan.gcalEventId)
        .in("status", ["open", "snoozed"]);
      if (error) return { ok: false, error: error.message };
      resolved += 1;
      continue;
    }
    const { error } = await sb
      .from("meeting_followups")
      .update(rowPayload(plan.meeting, plan.pending, plan.status, plan.snoozeUntil))
      .eq("gcal_event_id", plan.meeting.gcalEventId);
    if (error) return { ok: false, error: error.message };
    updated += 1;
  }

  // Drop open rows for webinars / blast invites (no JasonOS contact).
  if (noContactEventIds.length) {
    const { data: dropped, error } = await sb
      .from("meeting_followups")
      .update({
        status: "dismissed",
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("gcal_event_id", noContactEventIds)
      .in("status", ["open", "snoozed"])
      .select("id");
    if (error) return { ok: false, error: error.message };
    resolved += dropped?.length ?? 0;
  }

  revalidate();
  return {
    ok: true,
    scanned: meetings.length,
    created,
    updated,
    resolved,
    skipped,
  };
}

export async function getOpenMeetingFollowups(): Promise<MeetingFollowup[]> {
  if (!hasConfig()) return [];
  const today = etToday();
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_followups")
    .select("*")
    .in("status", ["open", "snoozed"])
    .order("ends_at", { ascending: false });
  if (error) {
    console.error("[meeting-followups.list]", error);
    return [];
  }
  return ((data ?? []) as FollowupRow[]).map((row) => toView(row, today));
}

export async function getDueMeetingFollowups(): Promise<MeetingFollowup[]> {
  if (!hasConfig()) return [];
  const today = etToday();
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_followups")
    .select("*")
    .in("status", ["open", "snoozed"])
    .order("ends_at", { ascending: false });
  if (error) {
    console.error("[meeting-followups.due]", error);
    return [];
  }
  return ((data ?? []) as FollowupRow[])
    .map((row) => toView(row, today))
    .filter((row) => isMeetingFollowupDue(row.status, row.snoozeUntil, today));
}

export async function getOpenMeetingFollowupCount(): Promise<number> {
  const rows = await getDueMeetingFollowups();
  return rows.length;
}

export async function snoozeMeetingFollowup(
  id: string,
  days: number
): Promise<ActionResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const until = snoozeUntilYmd(etToday(), days);
  if (!until) return { ok: false, error: "Enter a number of days from 1 to 365." };
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("meeting_followups")
    .update({
      status: "snoozed",
      snooze_until: until,
      decided_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That follow-up is gone." };
  revalidate();
  return { ok: true };
}

export async function dismissMeetingFollowup(id: string): Promise<ActionResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("meeting_followups")
    .update({
      status: "dismissed",
      snooze_until: null,
      decided_at: now,
      updated_at: now,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function completeMeetingFollowup(id: string): Promise<ActionResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("meeting_followups")
    .update({
      status: "done",
      decided_at: now,
      updated_at: now,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/**
 * Pull Granola for the meeting, seed a draft, return a mailto: URL.
 * Nothing is sent — Apple Mail opens with To / subject / body filled in.
 */
export async function draftMeetingFollowupMailto(
  id: string
): Promise<
  | { ok: true; mailtoUrl: string; subject: string; body: string; granola: boolean }
  | { ok: false; error: string }
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_followups")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That follow-up is gone." };

  const row = data as FollowupRow;
  const pending = asAttendees(row.pending_attendees);
  if (!pending.length) {
    return { ok: false, error: "Everyone on this meeting already got an email." };
  }

  const primary = pickPrimaryFollowupAttendee(
    pending,
    asAttendees(row.attendees),
    row.title
  );
  const contactName = primary.name || primary.email.split("@")[0] || row.title;
  // Always re-fetch Granola for this calendar event. A cached summary from a
  // bad match must not keep powering the wrong draft.
  const calendarEventIds = [
    row.gcal_event_id,
    typeof row.ical_uid === "string" ? row.ical_uid : null,
  ].filter((value): value is string => Boolean(value?.trim()));
  const note = await searchGranolaForContact({
    contactName,
    email: primary.email,
    emails: [
      ...pending.map((a) => a.email),
      ...asAttendees(row.attendees).map((a) => a.email),
    ],
    aroundIso: row.starts_at,
    calendarEventId: row.gcal_event_id,
    calendarEventIds,
    meetingTitle: row.title,
  });
  const summary = note.found && note.summary ? note.summary : null;
  const granolaUrl = note.found ? note.url ?? null : null;
  const fromGranola = Boolean(summary);

  const draft = await composeMeetingFollowupDraft({
    name: primary.name,
    title: row.title?.trim() || "Meeting",
    summary,
  });
  const to = pending.map((a) => a.email).join(", ");
  const mailtoUrl = buildMailtoUrl({
    to,
    subject: draft.subject,
    body: draft.body,
  });

  const { error: updateError } = await sb
    .from("meeting_followups")
    .update({
      granola_summary: summary,
      granola_url: granolaUrl,
      draft_subject: draft.subject,
      draft_body: draft.body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };

  revalidate();
  return {
    ok: true,
    mailtoUrl,
    subject: draft.subject,
    body: draft.body,
    granola: fromGranola && draft.source === "ai",
  };
}

/** Prefer the attendee named in the meeting title; else first pending. */
function pickPrimaryFollowupAttendee(
  pending: MeetingAttendee[],
  attendees: MeetingAttendee[],
  title: string | null | undefined
): MeetingAttendee {
  const hay = (title ?? "").toLowerCase();
  const pool = pending.length ? pending : attendees;
  const named = pool.find((person) => {
    const name = (person.name ?? "").trim().toLowerCase();
    if (!name || name.length < 2) return false;
    const parts = name.split(/\s+/).filter((part) => part.length > 1);
    if (parts.length >= 2) {
      return parts.every((part) => hay.includes(part));
    }
    return hay.includes(name);
  });
  return named ?? pool[0]!;
}
