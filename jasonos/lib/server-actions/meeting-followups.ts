"use server";

import { revalidatePath } from "next/cache";
import { etToday } from "@/lib/dates";
import { buildMailtoUrl } from "@/lib/email-templates/render";
import {
  calendarEventGuests,
  fetchAllPersonalCalendarEvents,
  mergeCalendarEvents,
} from "@/lib/integrations/google-calendar";
import { listSentRecipientTouches } from "@/lib/integrations/gmail";
import {
  getGranolaTranscript,
  searchGranolaForContact,
} from "@/lib/integrations/granola";
import {
  getWisprTranscript,
  searchWisprForContact,
} from "@/lib/integrations/wispr";
import { extractTranscriptSection } from "@/lib/live/decks-helpers";
import {
  listOutlookCalendarEvents,
  listOutlookSentRecipientTouches,
} from "@/lib/integrations/outlook";
import { matchCalendarEventToContacts } from "@/lib/outreach/calendar-matching";
import { upsertCandidateSightings } from "@/lib/outreach/candidate-capture";
import { buildContactLookup } from "@/lib/outreach/email-matching";
import { recordUserAction } from "@/lib/actions/action-log";
import { snoozeDetail } from "@/lib/actions/action-log-format";
import { appendSyncLog } from "@/lib/outreach/sync-log";
import { composeMeetingFollowupDraft } from "@/lib/outreach/meeting-followup-compose";
import {
  attendeeLine,
  guessFollowupDisplayName,
  isMeetingFollowupDue,
  expandSentTouchesAcrossContactAliases,
  latestSentByEmail,
  meetingEndIso,
  meetingFollowupDaysAgo,
  meetingStartIso,
  MEETING_FOLLOWUP_SCAN_DAYS_BACK,
  MEETING_FOLLOWUP_UNKNOWN_GUEST_MAX,
  planMeetingFollowup,
  qualifyMeetingAttendees,
  qualifyPastMeeting,
  snoozeUntilYmd,
  type MeetingAttendee,
  type MeetingFollowupStatus,
  type PastMeetingCandidate,
  type SentRecipientTouch,
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
  /** Primary pending attendee that matches a JasonOS contact, when known. */
  contactId: string | null;
  contactName: string | null;
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

function toView(
  row: FollowupRow,
  today = etToday(),
  contact: { id: string; name: string } | null = null
): MeetingFollowup {
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
    contactId: contact?.id ?? null,
    contactName: contact?.name ?? null,
  };
}

function contactForMeeting(
  pending: MeetingAttendee[],
  attendees: MeetingAttendee[],
  title: string,
  lookup: Awaited<ReturnType<typeof buildContactLookup>>
): { id: string; name: string } | null {
  const primary = pickPrimaryFollowupAttendee(pending, attendees, title);
  const ordered = [primary, ...pending, ...attendees];
  const seen = new Set<string>();
  for (const person of ordered) {
    const key = person.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const hit = lookup.resolveEmail(person.email);
    if (hit) return { id: hit.id, name: hit.name };
  }
  return null;
}

async function viewsWithContacts(
  rows: FollowupRow[],
  today = etToday()
): Promise<MeetingFollowup[]> {
  if (!rows.length) return [];
  const lookup = await buildContactLookup();
  return rows.map((row) => {
    const pending = asAttendees(row.pending_attendees);
    const attendees = asAttendees(row.attendees);
    return toView(
      row,
      today,
      contactForMeeting(pending, attendees, row.title, lookup)
    );
  });
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

async function logMeetingDecision(
  sb: ReturnType<typeof createServiceRoleClient>,
  id: string,
  verb: string,
  detail?: string | null
) {
  const { data } = await sb
    .from("meeting_followups")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  const title =
    typeof data?.title === "string" && data.title.trim() ? data.title.trim() : "Meeting";
  await recordUserAction({
    verb,
    area: "Meeting follow-up",
    subject: title,
    detail: detail ?? null,
    targetTable: "meeting_followups",
    targetId: id,
  });
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
      granolaEnriched: number;
    }
  | { ok: false; error: string; unavailable?: boolean }
> {
  const result = await captureMeetingFollowupsInner(opts);
  if (result.ok) {
    const granolaEnriched = await enrichOpenMeetingFollowupsWithGranola({
      limit: 12,
    });
    const withEnrich = { ...result, granolaEnriched };
    await appendSyncLog(
      "meeting-followups",
      {
        ok: true,
        scanned: withEnrich.scanned,
        created: withEnrich.created,
        updated: withEnrich.updated,
        resolved: withEnrich.resolved,
        skipped: withEnrich.skipped,
        granolaEnriched: withEnrich.granolaEnriched,
        inserted: withEnrich.created,
      },
      opts?.runId
    );
    return withEnrich;
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

/**
 * Backfill Granola summary (+ transcript when the summary is thin) onto open
 * Meeting Follow Ups so Home Draft and Commitments can use them without a click.
 */
export async function enrichOpenMeetingFollowupsWithGranola(opts?: {
  limit?: number;
}): Promise<number> {
  if (!hasConfig()) return 0;
  const limit = Math.max(1, Math.min(25, opts?.limit ?? 12));
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_followups")
    .select(
      "id, gcal_event_id, ical_uid, title, starts_at, attendees, pending_attendees, granola_summary"
    )
    .in("status", ["open", "snoozed"])
    .order("ends_at", { ascending: false })
    .limit(40);
  if (error || !data?.length) return 0;

  const needs = (data as FollowupRow[])
    .filter((row) => !(row.granola_summary && row.granola_summary.trim().length > 80))
    .slice(0, limit);

  let enriched = 0;
  for (const row of needs) {
    const pending = asAttendees(row.pending_attendees);
    const attendees = asAttendees(row.attendees);
    const pool = pending.length ? pending : attendees;
    if (!pool.length) continue;
    const primary = pickPrimaryFollowupAttendee(pending, attendees, row.title);
    const displayName =
      guessFollowupDisplayName({
        name: primary.name,
        email: primary.email,
        title: row.title,
      }) ??
      primary.name ??
      row.title;
    const contactName = displayName || primary.email.split("@")[0] || row.title;
    const calendarEventIds = [
      row.gcal_event_id,
      typeof row.ical_uid === "string" ? row.ical_uid : null,
    ].filter((value): value is string => Boolean(value?.trim()));
    try {
      const emails = [...pending.map((a) => a.email), ...attendees.map((a) => a.email)];
      const search = {
        contactName,
        email: primary.email,
        emails,
        aroundIso: row.starts_at,
        calendarEventId: row.gcal_event_id,
        calendarEventIds,
        meetingTitle: row.title,
        includeTranscript: true,
      };
      let note = await searchGranolaForContact(search);
      if (!note.found || !note.summary?.trim()) {
        const wispr = await searchWisprForContact(search);
        if (wispr.found && wispr.summary?.trim()) {
          note = {
            found: true,
            summary: wispr.summary,
            url: wispr.url,
          };
        }
      }
      if (!note.found) continue;
      const summary = note.summary?.trim() || null;
      if (!summary) continue;
      const { error: updateError } = await sb
        .from("meeting_followups")
        .update({
          granola_summary: summary.slice(0, 20_000),
          granola_url: note.url ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (!updateError) enriched += 1;
    } catch {
      // One note failure must not abort the Sync lane.
    }
  }
  if (enriched) revalidate();
  return enriched;
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

  const [cal, sent, outlookSent, outlookCal, lookup] = await Promise.all([
    fetchAllPersonalCalendarEvents({ timeMin, timeMax }),
    listSentRecipientTouches({ daysBack: daysBack + 2 }),
    listOutlookSentRecipientTouches({ daysBack: daysBack + 2 }),
    listOutlookCalendarEvents({ timeMin, timeMax }),
    buildContactLookup(),
  ]);

  const events = mergeCalendarEvents([
    cal.events,
    outlookCal.events,
  ]);

  if (cal.error && !events.length && !outlookCal.events.length) {
    return { ok: false, unavailable: true, error: cal.error };
  }
  if (!sent.configured && !outlookSent.configured) {
    return {
      ok: false,
      unavailable: true,
      error: "No mail account connected for sent-mail follow-up checks.",
    };
  }
  const sentTouches: SentRecipientTouch[] = [
    ...(sent.data ?? []),
    ...(outlookSent.data ?? []),
  ];
  if (
    !sentTouches.length &&
    ((sent.error && sent.configured) || (outlookSent.error && outlookSent.configured)) &&
    !events.length
  ) {
    return {
      ok: false,
      error: [sent.error, outlookSent.error].filter(Boolean).join(" · "),
    };
  }

  const sentByEmail = expandSentTouchesAcrossContactAliases(
    latestSentByEmail(sentTouches),
    (email) => lookup.resolveEmail(email)?.emails ?? []
  );
  const today = etToday();
  const meetings: PastMeetingCandidate[] = [];
  /** Large no-contact events (webinars) — dismiss if they were queued earlier. */
  const webinarEventIds: string[] = [];
  const suggestedSightings: {
    email: string;
    name: string | null;
    dateIso: string;
    subject: string;
    direction: "inbound";
  }[] = [];
  for (const ev of events) {
    const guests = calendarEventGuests(ev);
    const { matches, unmatchedGuests } = matchCalendarEventToContacts({
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
    const qualifiedIgnoringContact = qualifyPastMeeting({
      ...base,
      hasKnownContact: true,
    });
    const externalCount = qualifyMeetingAttendees(guests).length;
    // Webinars / blast invites: many guests, nobody in People.
    if (
      ev.id &&
      qualifiedIgnoringContact &&
      !hasKnownContact &&
      externalCount > MEETING_FOLLOWUP_UNKNOWN_GUEST_MAX
    ) {
      webinarEventIds.push(ev.id);
    }
    const qualified = qualifyPastMeeting({
      ...base,
      // Small meetings with unknown invitees still qualify; large no-contact
      // lists stay out so webinars do not flood Follow Up / Suggested.
      hasKnownContact,
    });
    if (!qualified) continue;
    meetings.push(qualified);

    // Stage invitees who are not in People onto Suggested.
    const startIso = qualified.startsAt;
    for (const guest of unmatchedGuests) {
      if (!guest.email || !guest.email.includes("@")) continue;
      suggestedSightings.push({
        email: guest.email,
        name: guest.name ?? null,
        dateIso: startIso,
        subject: qualified.title,
        direction: "inbound",
      });
    }
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

  // Drop open rows for webinars / blast invites (many guests, nobody in People).
  if (webinarEventIds.length) {
    const { data: dropped, error } = await sb
      .from("meeting_followups")
      .update({
        status: "dismissed",
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("gcal_event_id", webinarEventIds)
      .in("status", ["open", "snoozed"])
      .select("id");
    if (error) return { ok: false, error: error.message };
    resolved += dropped?.length ?? 0;
  }

  if (suggestedSightings.length) {
    await upsertCandidateSightings(suggestedSightings, lookup);
    revalidatePath("/outreach/suggested");
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
  // Follow Up tab = due queue: open now, or snoozed whose date has arrived.
  // Future snoozes stay hidden until that day.
  return getDueMeetingFollowups();
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
  const views = await viewsWithContacts((data ?? []) as FollowupRow[], today);
  return views.filter((row) =>
    isMeetingFollowupDue(row.status, row.snoozeUntil, today)
  );
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
  await logMeetingDecision(sb, id, "Snoozed", snoozeDetail(days, until));
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
  await logMeetingDecision(sb, id, "Skipped");
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
  await logMeetingDecision(sb, id, "Done");
  revalidate();
  return { ok: true };
}

/**
 * Pull the Granola (or Wispr) transcript for this meeting, draft from it, and
 * return a mailto: URL. Nothing is sent — Apple Mail opens with fields filled.
 */
export async function draftMeetingFollowupMailto(
  id: string
): Promise<
  | {
      ok: true;
      mailtoUrl: string;
      subject: string;
      body: string;
      granola: boolean;
      fromTranscript: boolean;
      confirmFacts: string[];
    }
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
  const displayName =
    guessFollowupDisplayName({
      name: primary.name,
      email: primary.email,
      title: row.title,
    }) ?? primary.name;
  const contactName =
    displayName || primary.email.split("@")[0] || row.title;
  // Always re-fetch the note for this calendar event, then load the spoken
  // transcript separately. A cached summary must not power the wrong draft,
  // and AI notes alone must not crowd the transcript out of the prompt.
  const calendarEventIds = [
    row.gcal_event_id,
    typeof row.ical_uid === "string" ? row.ical_uid : null,
  ].filter((value): value is string => Boolean(value?.trim()));
  const search = {
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
  };

  let summary: string | null = null;
  let transcript: string | null = null;
  let noteUrl: string | null = null;

  const granola = await searchGranolaForContact(search);
  if (granola.found) {
    noteUrl = granola.url ?? null;
    const rawSummary = granola.summary?.trim() || "";
    // Notes only — strip any appended transcript block from older helpers.
    const marker = "--- Transcript ---";
    const markerAt = rawSummary.indexOf(marker);
    summary =
      markerAt >= 0 ? rawSummary.slice(0, markerAt).trim() || null : rawSummary || null;
    const noteId = granola.meetings?.[0]?.id ?? null;
    if (noteId) {
      const paged = await getGranolaTranscript(noteId);
      transcript = paged?.text?.trim() || extractTranscriptSection(granola.summary) || null;
    } else {
      transcript = extractTranscriptSection(granola.summary);
    }
  }

  if (!transcript) {
    const wispr = await searchWisprForContact({
      ...search,
      includeTranscript: true,
    });
    if (wispr.found) {
      if (!noteUrl) noteUrl = wispr.url ?? null;
      if (!summary) {
        const raw = wispr.summary?.trim() || "";
        const marker = "--- Transcript ---";
        const markerAt = raw.indexOf(marker);
        summary =
          markerAt >= 0 ? raw.slice(0, markerAt).trim() || null : raw || null;
      }
      if (wispr.meetingId) {
        const paged = await getWisprTranscript(wispr.meetingId);
        transcript =
          paged?.text?.trim() || extractTranscriptSection(wispr.summary) || null;
      } else {
        transcript = extractTranscriptSection(wispr.summary);
      }
    }
  }

  const draft = await composeMeetingFollowupDraft({
    name: displayName,
    email: primary.email,
    title: row.title?.trim() || "Meeting",
    summary,
    transcript,
    startsAt: row.starts_at,
  });
  const to = pending.map((a) => a.email).join(", ");
  const mailtoUrl = buildMailtoUrl({
    to,
    subject: draft.subject,
    body: draft.body,
  });

  // Persist notes for the Home card; keep transcript out of the column so the
  // row preview stays short. Draft body already used the transcript.
  const storedSummary = (summary ?? transcript?.slice(0, 4_000) ?? null)?.slice(
    0,
    20_000
  );

  const { error: updateError } = await sb
    .from("meeting_followups")
    .update({
      granola_summary: storedSummary,
      granola_url: noteUrl,
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
    granola: Boolean(summary || transcript) && draft.source === "ai",
    fromTranscript: draft.usedTranscript && draft.source === "ai",
    confirmFacts: draft.confirmFacts,
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
  if (named) return named;

  // Title may name them when the guest card has no display name.
  const guessed = guessFollowupDisplayName({ title, email: pool[0]?.email });
  if (guessed) {
    const byLocal = pool.find((person) => {
      const local = person.email.split("@")[0]?.toLowerCase() ?? "";
      return local.startsWith(guessed.toLowerCase());
    });
    if (byLocal) {
      return { ...byLocal, name: byLocal.name ?? guessed };
    }
  }
  const first = pool[0]!;
  return {
    ...first,
    name:
      first.name ??
      guessFollowupDisplayName({
        email: first.email,
        title,
      }),
  };
}
