// Pure rules for calendar meeting follow-ups. No DB, no Gmail, no Granola.
// A past meeting with external guests needs a follow-up when Jason has not
// emailed one or more of those guests since the meeting ended.

import { daysBetweenYmd, etYmd } from "../dates";
import { canonicalEmail, isMyOwnAddress } from "./contact-lookup";
import { isNoiseEmail } from "./mail-noise";

export const MEETING_FOLLOWUP_SCAN_DAYS_BACK = 21;
export const MEETING_FOLLOWUP_MAX_GUESTS = 8;
/** Wait a bit after the meeting ends so the reminder is not instant. */
export const MEETING_FOLLOWUP_GRACE_MS = 2 * 60 * 60 * 1000;
export const MEETING_FOLLOWUP_SNOOZE_PRESETS = [1, 3, 5] as const;
export const MEETING_FOLLOWUP_MAX_SNOOZE_DAYS = 365;

export type MeetingFollowupStatus = "open" | "done" | "dismissed" | "snoozed";

export interface MeetingAttendee {
  email: string;
  name: string | null;
}

export interface PastMeetingCandidate {
  gcalEventId: string;
  icalUid: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  calendarUrl: string | null;
  attendees: MeetingAttendee[];
}

export interface SentRecipientTouch {
  email: string;
  sentAt: string;
}

export interface ExistingMeetingFollowup {
  gcalEventId: string;
  status: MeetingFollowupStatus;
  snoozeUntil: string | null;
}

export type MeetingFollowupPlan =
  | {
      action: "insert";
      meeting: PastMeetingCandidate;
      pending: MeetingAttendee[];
    }
  | {
      action: "refresh";
      meeting: PastMeetingCandidate;
      pending: MeetingAttendee[];
      status: MeetingFollowupStatus;
      snoozeUntil: string | null;
    }
  | {
      action: "resolve";
      gcalEventId: string;
      reason: "emailed" | "no-guests";
    }
  | { action: "skip"; gcalEventId: string };

export function qualifyMeetingAttendees(
  guests: { email?: string | null; name?: string | null }[]
): MeetingAttendee[] {
  const seen = new Set<string>();
  const out: MeetingAttendee[] = [];
  for (const guest of guests) {
    const email = (guest.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    if (isMyOwnAddress(email) || isNoiseEmail(email)) continue;
    const key = canonicalEmail(email);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      email,
      name: guest.name?.trim() || null,
    });
  }
  return out;
}

export function meetingEndIso(ev: {
  start?: { dateTime?: string; date?: string } | null;
  end?: { dateTime?: string; date?: string } | null;
}): string | null {
  if (ev.end?.dateTime) {
    const ms = Date.parse(ev.end.dateTime);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  if (ev.end?.date) {
    // All-day end is exclusive (next day). Treat as end of prior ET day noon UTC.
    const day = ev.end.date;
    const ms = Date.parse(`${day}T00:00:00.000Z`) - 60_000;
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  if (ev.start?.dateTime) {
    const start = Date.parse(ev.start.dateTime);
    if (!Number.isFinite(start)) return null;
    return new Date(start + 30 * 60_000).toISOString();
  }
  if (ev.start?.date) {
    return new Date(`${ev.start.date}T23:59:00.000Z`).toISOString();
  }
  return null;
}

export function meetingStartIso(ev: {
  start?: { dateTime?: string; date?: string } | null;
}): string | null {
  if (ev.start?.dateTime) {
    const ms = Date.parse(ev.start.dateTime);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  if (ev.start?.date) {
    return new Date(`${ev.start.date}T12:00:00.000Z`).toISOString();
  }
  return null;
}

export function isMeetingPastForFollowup(
  endsAt: string,
  now: Date = new Date(),
  graceMs = MEETING_FOLLOWUP_GRACE_MS
): boolean {
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return false;
  return end + graceMs <= now.getTime();
}

/** Latest outbound sentAt per canonical email. */
export function latestSentByEmail(
  touches: SentRecipientTouch[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const touch of touches) {
    const email = touch.email.trim().toLowerCase();
    if (!email.includes("@")) continue;
    if (isMyOwnAddress(email) || isNoiseEmail(email)) continue;
    const key = canonicalEmail(email);
    const prev = map.get(key);
    if (!prev || Date.parse(touch.sentAt) > Date.parse(prev)) {
      map.set(key, touch.sentAt);
    }
  }
  return map;
}

/**
 * Attendees with no sent mail at or after the meeting end.
 * Same-day mail after the meeting clears the reminder.
 */
export function pendingAttendeesForMeeting(
  attendees: MeetingAttendee[],
  endsAt: string,
  sentByEmail: Map<string, string>
): MeetingAttendee[] {
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(endMs)) return attendees;
  return attendees.filter((attendee) => {
    const sentAt = sentByEmail.get(canonicalEmail(attendee.email));
    if (!sentAt) return true;
    const sentMs = Date.parse(sentAt);
    if (!Number.isFinite(sentMs)) return true;
    return sentMs < endMs;
  });
}

/**
 * Webinars and blast invites stay out: the meeting must include at least one
 * person already in JasonOS (matched by email or name).
 */
export function meetingHasKnownContact(
  attendees: MeetingAttendee[],
  knownEmails: ReadonlySet<string>
): boolean {
  if (!knownEmails.size) return false;
  return attendees.some((attendee) =>
    knownEmails.has(canonicalEmail(attendee.email))
  );
}

export function qualifyPastMeeting(input: {
  gcalEventId?: string | null;
  icalUid?: string | null;
  title?: string | null;
  status?: string | null;
  startsAt: string | null;
  endsAt: string | null;
  calendarUrl?: string | null;
  guests: { email?: string | null; name?: string | null }[];
  now?: Date;
  /** Canonical emails (and any aliases) for people in JasonOS. */
  knownEmails?: ReadonlySet<string>;
  /** True when title/guest matching already found a JasonOS contact. */
  hasKnownContact?: boolean;
}): PastMeetingCandidate | null {
  if (!input.gcalEventId?.trim()) return null;
  if (input.status === "cancelled") return null;
  if (!input.startsAt || !input.endsAt) return null;
  if (!isMeetingPastForFollowup(input.endsAt, input.now ?? new Date())) {
    return null;
  }
  const attendees = qualifyMeetingAttendees(input.guests);
  if (!attendees.length) return null;
  if (attendees.length > MEETING_FOLLOWUP_MAX_GUESTS) return null;
  const known =
    input.hasKnownContact === true ||
    (input.knownEmails
      ? meetingHasKnownContact(attendees, input.knownEmails)
      : false);
  if (!known) return null;
  return {
    gcalEventId: input.gcalEventId,
    icalUid: input.icalUid?.trim() || null,
    title: input.title?.trim() || "Meeting",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    calendarUrl: input.calendarUrl?.trim() || null,
    attendees,
  };
}

export function planMeetingFollowup(
  meeting: PastMeetingCandidate,
  sentByEmail: Map<string, string>,
  existing: ExistingMeetingFollowup | undefined,
  todayYmd: string
): MeetingFollowupPlan {
  const pending = pendingAttendeesForMeeting(
    meeting.attendees,
    meeting.endsAt,
    sentByEmail
  );

  if (!pending.length) {
    if (existing && (existing.status === "open" || existing.status === "snoozed")) {
      return { action: "resolve", gcalEventId: meeting.gcalEventId, reason: "emailed" };
    }
    return { action: "skip", gcalEventId: meeting.gcalEventId };
  }

  if (!existing) {
    return { action: "insert", meeting, pending };
  }

  if (existing.status === "done" || existing.status === "dismissed") {
    return { action: "skip", gcalEventId: meeting.gcalEventId };
  }

  // Snoozed rows stay snoozed until the day arrives, but pending list refreshes.
  if (
    existing.status === "snoozed" &&
    existing.snoozeUntil &&
    existing.snoozeUntil > todayYmd
  ) {
    return {
      action: "refresh",
      meeting,
      pending,
      status: "snoozed",
      snoozeUntil: existing.snoozeUntil,
    };
  }

  return {
    action: "refresh",
    meeting,
    pending,
    status: "open",
    snoozeUntil: null,
  };
}

export function snoozeUntilYmd(todayYmd: string, days: number): string | null {
  if (!Number.isInteger(days) || days < 1 || days > MEETING_FOLLOWUP_MAX_SNOOZE_DAYS) {
    return null;
  }
  const [y, m, d] = todayYmd.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function isMeetingFollowupDue(
  status: MeetingFollowupStatus,
  snoozeUntil: string | null | undefined,
  todayYmd: string
): boolean {
  if (status === "open") return true;
  if (status === "snoozed") {
    return Boolean(snoozeUntil && snoozeUntil <= todayYmd);
  }
  return false;
}

export function meetingFollowupDaysAgo(endsAt: string, todayYmd = etYmd()): number {
  return daysBetweenYmd(etYmd(endsAt), todayYmd);
}

export function attendeeLine(attendees: MeetingAttendee[], limit = 3): string {
  const labels = attendees.map((a) => a.name || a.email);
  if (!labels.length) return "";
  if (labels.length <= limit) return labels.join(", ");
  return `${labels.slice(0, limit).join(", ")} +${labels.length - limit}`;
}

export function meetingFollowupDraft(input: {
  name: string | null;
  title: string;
  summary: string | null;
}): { subject: string; body: string } {
  const who = firstName(input.name);
  const hello = who === "there" ? "Hi," : `${who},`;
  const fact = firstUsefulSentence(input.summary ?? "");
  const middle = fact
    ? `Thanks again for the conversation. ${fact}`
    : `Thanks again for taking the time${input.title && input.title !== "Meeting" ? ` on ${input.title}` : ""}.`;
  return {
    subject: input.title && input.title !== "Meeting"
      ? `Following up: ${input.title}`
      : "Following up",
    body: `${hello}

${middle}

Jason`,
  };
}

function firstName(name: string | null | undefined): string {
  const part = (name ?? "").trim().split(/\s+/)[0];
  return part || "there";
}

function firstUsefulSentence(summary: string): string | null {
  const sentence = summary
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .find((part) => part.length >= 24 && part.length <= 220);
  return sentence ?? null;
}
