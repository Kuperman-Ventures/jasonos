// Pure rules for calendar meeting follow-ups. No DB, no Gmail, no Granola.
// A past meeting with external guests needs a follow-up when Jason has not
// emailed one or more of those guests since the meeting ended.

import { daysBetweenYmd, etToday, etYmd } from "../dates";
import { canonicalEmail, isMyOwnAddress } from "./contact-lookup";
import { isNoiseEmail } from "./mail-noise";

export const MEETING_FOLLOWUP_SCAN_DAYS_BACK = 21;
export const MEETING_FOLLOWUP_MAX_GUESTS = 8;
/** Brief pause after the meeting ends so Sync does not fire mid-wrap-up. */
export const MEETING_FOLLOWUP_GRACE_MS = 15 * 60 * 1000;
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

/**
 * Safe local draft when Claude is unavailable. Never pastes Granola note
 * fragments into the body — those read like action items, not email.
 */
export function meetingFollowupDraft(input: {
  name: string | null;
  title: string;
  summary?: string | null;
  startsAt?: string | null;
}): { subject: string; body: string } {
  const who = firstName(input.name);
  const hello = who === "there" ? "Hi," : `${who},`;
  const when = meetingWhenPhrase(input.startsAt);
  const lead =
    when === "today"
      ? "It was good to reconnect today."
      : when === "yesterday"
        ? "It was good to reconnect yesterday."
        : `It was good to reconnect ${when}.`;
  return {
    subject: "Good catching up",
    body: `${hello}

${lead} Thanks again for the conversation.

Jason`,
  };
}

/** True when text looks like meeting notes / action items, not sendable prose. */
export function looksLikeGranolaNoteFragment(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (
    /\([^)]{1,40}\)/.test(t) &&
    /\b(committed|to reciprocate|action items?|next steps?)\b/i.test(t)
  ) {
    return true;
  }
  // "Shawn to reciprocate…" / "Committed to looking…" note cadence
  if (/^[A-Z][a-z]+ to [a-z]/.test(t)) return true;
  if (/\bCommitted to\b/.test(t) && !/[.!?]$/.test(t)) return true;
  if ((t.match(/\b[A-Z][a-z]+ to\b/g) ?? []).length >= 1 && !/[.!?]/.test(t)) {
    return true;
  }
  // Bullet / heading residue
  if (/^[-*•]|\b(Action items?|Next steps?|Summary)\b:/i.test(t)) return true;
  return false;
}

/**
 * Reject drafts that still dump Granola notes: parenthetical name tags,
 * third-person action items, or a large verbatim paste of the note.
 */
export function isUnacceptableFollowupBody(
  body: string,
  summary: string | null
): boolean {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return true;
  if (looksLikeGranolaNoteFragment(text)) return true;
  // "Name to verb … (Name)" is the exact failure mode from raw Granola paste.
  if (/\b[A-Z][a-z]+ to [a-z][\s\S]{0,80}\([A-Z][a-z]+\)/.test(text)) {
    return true;
  }
  if (/\bCommitted to looking through (his|her|their) network\b/i.test(text)) {
    return true;
  }
  const note = (summary ?? "").replace(/\s+/g, " ").trim();
  if (note.length >= 40) {
    const slice = note.slice(0, Math.min(80, note.length));
    if (text.includes(slice)) return true;
  }
  return false;
}

export {
  DEFAULT_MEETING_FOLLOWUP_PROMPT,
  fillMeetingFollowupPrompt,
  isHollowFollowupBody,
  normalizeMeetingFollowupPrompt,
  resolveMeetingFollowupPrompt,
} from "@/lib/outreach/meeting-followup-prompt";

/** Catch-up follow-ups that pivot into pitching Jason's work. */
export function soundsLikePitchFollowup(body: string): boolean {
  const t = body.replace(/\s+/g, " ").trim();
  if (!t) return false;
  return (
    /\bI'?ll keep\b.+\bin mind\b/i.test(t) ||
    /\bworth a more targeted conversation\b/i.test(t) ||
    /\bthesis playing out\b/i.test(t) ||
    /\b(Refactor Sprint|Equity Labs)\b/i.test(t) ||
    /\bgiven .+ role as a major\b/i.test(t)
  );
}

/** Greeting name. Handles "First Last" and Outlook-style "Last, First". */
export function firstName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "there";
  const comma = trimmed.match(/^([^,]+),\s*(.+)$/);
  if (comma) {
    // "Peltoniemi, Tuomas" → Tuomas
    const given = comma[2]!.trim().split(/\s+/)[0];
    return given || "there";
  }
  return trimmed.split(/\s+/)[0] || "there";
}

const TITLE_NAME_STOP =
  /^(jason|k|kuperman|catch|catch-up|catchup|up|ii|iii|iv|chat|call|meet|meeting|sync|quick|zoom|intro|follow|follow-up|followup|with|and|the|a|an|if|you|can|make|this|recurring|weekly|biweekly)$/i;

/**
 * When calendar guests lack a display name (common on GCal), pull a first
 * name from the meeting title or email local-part so drafts do not open "Hi,".
 * Titles like "Jason K/ Simon B Catch-Up II" → "Simon".
 */
export function guessFollowupDisplayName(input: {
  name?: string | null;
  email?: string | null;
  title?: string | null;
}): string | null {
  const fromGuest = firstName(input.name);
  if (fromGuest !== "there") return fromGuest;

  const title = (input.title ?? "").replace(/\[[^\]]*]/g, " ").trim();
  if (title) {
    const slash = title.match(/\/\s*([A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z])?)\b/);
    if (slash?.[1]) {
      const first = slash[1].split(/\s+/)[0]!;
      if (!TITLE_NAME_STOP.test(first)) {
        return first[0]!.toUpperCase() + first.slice(1);
      }
    }
    const withName = title.match(
      /\b(?:with|and|\/)\s+([A-Za-z][A-Za-z'’.-]+)\b/i
    );
    if (withName?.[1] && !TITLE_NAME_STOP.test(withName[1])) {
      const first = withName[1];
      return first[0]!.toUpperCase() + first.slice(1);
    }
    // "Simon B <> Jason" / "Simon - Jason"
    const leading = title.match(/^([A-Za-z][A-Za-z'’.-]+)(?:\s+[A-Za-z])?\b/);
    if (leading?.[1] && !TITLE_NAME_STOP.test(leading[1])) {
      const first = leading[1];
      return first[0]!.toUpperCase() + first.slice(1);
    }
  }

  const local = (input.email ?? "").split("@")[0]?.split(/[._+-]/)[0] ?? "";
  if (local.length >= 2 && !TITLE_NAME_STOP.test(local)) {
    return local[0]!.toUpperCase() + local.slice(1).toLowerCase();
  }
  return null;
}

/**
 * How to refer to when the meeting happened, in Eastern calendar days.
 * Keeps drafts from saying "today" for a call last week.
 */
export function meetingWhenPhrase(
  startsAtIso: string | null | undefined,
  todayYmd: string = etToday()
): string {
  if (!startsAtIso?.trim()) return "recently";
  const meetingYmd = etYmd(startsAtIso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingYmd)) return "recently";
  const daysAgo = daysBetweenYmd(meetingYmd, todayYmd);
  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo <= 6) return "earlier this week";
  if (daysAgo <= 13) return "last week";
  if (daysAgo <= 45) return "a few weeks ago";
  return "a while back";
}

/** True when the body claims "today" / "this morning" for an older meeting. */
export function hasWrongMeetingDayLanguage(
  body: string,
  whenPhrase: string
): boolean {
  if (whenPhrase === "today") return false;
  const t = body.replace(/\s+/g, " ");
  return (
    /\b(today|this morning|this afternoon|this evening)\b/i.test(t) ||
    (whenPhrase !== "yesterday" && /\byesterday\b/i.test(t))
  );
}
