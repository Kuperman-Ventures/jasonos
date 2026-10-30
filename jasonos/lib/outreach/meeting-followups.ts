// Pure rules for calendar meeting follow-ups. No DB, no Gmail, no Granola.
// A past meeting with external guests needs a follow-up when Jason has not
// emailed one or more of those guests since the meeting ended.

import { daysBetweenYmd, etToday, etYmd } from "../dates";
import { canonicalEmail, isMyOwnAddress } from "./contact-lookup";
import { isNoiseEmail } from "./mail-noise";

export const MEETING_FOLLOWUP_SCAN_DAYS_BACK = 21;
export const MEETING_FOLLOWUP_MAX_GUESTS = 8;
/**
 * 1:1 / small meetings with guests not yet in People still count for Follow Up
 * and Suggested. Larger no-contact events stay out (webinars / blast invites).
 */
export const MEETING_FOLLOWUP_UNKNOWN_GUEST_MAX = 3;
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
 * If Jason emailed any address on a JasonOS contact, treat every address on
 * that contact as emailed at the same time. Clears meeting Follow Ups when
 * the calendar guest used a different work email than the People row.
 */
export function expandSentTouchesAcrossContactAliases(
  sentByEmail: Map<string, string>,
  aliasesFor: (email: string) => readonly string[]
): Map<string, string> {
  const out = new Map(sentByEmail);
  for (const [email, sentAt] of sentByEmail) {
    for (const alias of aliasesFor(email)) {
      const key = canonicalEmail(alias);
      if (!key.includes("@")) continue;
      const prev = out.get(key);
      if (!prev || Date.parse(sentAt) > Date.parse(prev)) {
        out.set(key, sentAt);
      }
    }
  }
  return out;
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
  // Small meetings with nobody in People yet still qualify — Suggested can
  // pick those invitees up. Bigger no-contact lists look like webinars.
  if (!known && attendees.length > MEETING_FOLLOWUP_UNKNOWN_GUEST_MAX) {
    return null;
  }
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
 * Notes look like a first conversation (intro / "great to meet you") rather
 * than catching up with someone Jason already knew.
 */
export function notesLookLikeFirstMeeting(
  summary: string | null | undefined
): boolean {
  const note = (summary ?? "").replace(/\s+/g, " ").trim();
  if (!note) return true; // no notes → never invent "reconnect"
  const lower = note.toLowerCase();
  if (
    /\b(great|nice|good|glad)\s+to\s+meet\b/.test(lower) ||
    /\bfirst\s+(time|meeting|conversation|call|chat)\b/.test(lower) ||
    /\b(intro(duction)?|introduced|getting to know)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\b(reconnect|catching up|catch up|years since|decade since|last connected|old firm|tbwa|all these years)\b/i.test(
      note
    )
  ) {
    return false;
  }
  // Substance without shared-history cues → treat as first meet.
  return true;
}

/**
 * Draft claims a prior relationship ("reconnect", decade language) when the
 * notes look like a first meeting. Mild "catching up" is allowed — "reconnect"
 * on a first conversation is the failure mode Jason keeps hitting.
 */
export function soundsLikeWrongReconnect(
  body: string,
  summary: string | null | undefined
): boolean {
  if (!notesLookLikeFirstMeeting(summary)) return false;
  return /\b(reconnect|after all these years|another (ten|10) years|decade since)\b/i.test(
    body
  );
}

/**
 * Pull a few short facts from Granola notes / transcript for drafts when the
 * model fails. Skips Jason's own bio / next-steps sections. Prefers brand and
 * product lines over generic career chronology.
 */
export function pickMeetingFollowupFacts(
  source: string | null | undefined,
  limit = 3
): string[] {
  const raw = (source ?? "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  const skipSection =
    /^(jason'?s?\s+background|jason'?s?\s+current|target role|mutual interests|next steps|private notes|attendees|summary)\b/i;
  const skipLine =
    /^(engineered by|known participants|folders?|meeting title|looking for leads)\b/i;
  const jasonBio =
    /\b(kuperman advisors|architecture degree|tbwa|outfront|agencytoolbox|vibe coding|cursor \(ide\)|claude \(strategy|joined a hardware)\b/i;
  const actionItem =
    /^(review|check out|send|follow up|suggest|look through)\b/i;
  type Scored = { text: string; score: number };
  const scored: Scored[] = [];
  const seen = new Set<string>();
  let skipBlock = false;
  for (const line of raw.split("\n")) {
    const markdownHeading = line.match(/^#{1,6}\s+(.*)$/)?.[1]?.trim();
    const plainHeading =
      !markdownHeading &&
      !/^[-*•]/.test(line) &&
      /^[A-Z][\w'’&()/ -]{2,60}$/u.test(line.trim())
        ? line.trim()
        : null;
    const heading = markdownHeading || plainHeading;
    if (heading) {
      skipBlock = skipSection.test(heading);
      continue;
    }
    if (skipBlock) continue;
    let text = line
      .replace(/^[-*•]\s+/, "")
      .replace(/^\*\*[^*]+\*\*:?\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length < 28 || text.length > 180) continue;
    if (skipSection.test(text) || skipLine.test(text) || actionItem.test(text)) {
      continue;
    }
    // Drop speaker labels from transcript lines but keep the content.
    text = text.replace(/^(Jason|Them|Speaker|[A-Z][a-z]+):\s+/, "");
    if (text.length < 28) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    if (jasonBio.test(text)) continue;
    // Keep local fallback free of action-item / parenthetical note paste.
    if (looksLikeGranolaNoteFragment(text)) continue;
    if (/\([A-Z][a-z]+\)/.test(text)) continue;
    if (/\b[A-Z][a-z]+ to [a-z]/.test(text) && /\b(committed|reciprocate|intros?)\b/i.test(text)) {
      continue;
    }
    seen.add(key);
    let score = 0;
    if (/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/.test(text)) score += 2;
    if (
      /\b(setsu|cosmetics|neevee|chatwell|franchise|brand|cmo|neckliner|gloss|raised|revenue|incubator)\b/i.test(
        text
      )
    ) {
      score += 5;
    }
    // Concrete product / brand beats tenure bio ("served as CMO for four years").
    if (/\b(hero product|neckliner|gloss ventures|setsu)\b/i.test(text)) score += 4;
    if (/^served as\b/i.test(text)) score -= 3;
    if (/\b(co-founded|founded|shared|hired|paternity)\b/i.test(text)) score += 2;
    if (/\blinkedin|introductions?\b/i.test(text)) score -= 2;
    scored.push({ text: text.replace(/\.*$/, ""), score });
  }
  scored.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
  return scored.slice(0, limit).map((row) => row.text);
}

/**
 * Jason's commitments from a Next Steps / action block (or mutual bullets).
 * Prefers LinkedIn intros, shared links, and concrete sends over bio facts.
 */
export function pickJasonOwes(source: string | null | undefined): string[] {
  const raw = (source ?? "").replace(/\r\n/g, "\n");
  if (!raw.trim()) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (text: string) => {
    const cleaned = text.replace(/\s+/g, " ").replace(/\.*$/, "").trim();
    if (cleaned.length < 12 || cleaned.length > 160) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };

  let inNext = false;
  for (const line of raw.split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.*)$/)?.[1]?.trim() ?? "";
    if (heading) {
      inNext = /\b(next steps?|action items?)\b/i.test(heading);
      continue;
    }
    if (!inNext && !/\b(both to|jason to|i(?:'|’)ll|committed to)\b/i.test(line)) {
      continue;
    }
    let text = line
      .replace(/^[-*•]\s+/, "")
      .replace(/^\*\*(.+?)\*\*\s*(?:\([^)]*\))?\s*:?\s*/u, "$1 ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    // Owner tags like "(Jason)" mark his owes.
    const jasonOwned =
      /\(jason\)/i.test(line) ||
      /\bjason (to|will)\b/i.test(text) ||
      /\bboth to\b/i.test(text) ||
      inNext;
    if (!jasonOwned) continue;
    text = text
      .replace(/\s*\(jason\)\s*/gi, " ")
      .replace(/\bjason (to|will)\s+/gi, "")
      .replace(/\bboth to\s+/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (
      /\b(linkedin|introduc|chatwell|send|review|share|check out|look through)\b/i.test(
        text
      )
    ) {
      push(text);
    }
  }
  return out.slice(0, 3);
}

/** What they offered Jason (mutual review, a link, an intro, advice). */
export function pickTheirOffer(source: string | null | undefined): string | null {
  const raw = (source ?? "").replace(/\r\n/g, "\n");
  if (!raw.trim()) return null;
  const patterns = [
    /\bboth to review each other'?s? linkedin\b[^.!\n]*/i,
    /\bshared\b[^.!\n]{0,80}\b(chatwell|link|community|intro)\b[^.!\n]*/i,
    /\b(offered|happy to|can intro|will intro|send(?:ing)? (?:you )?the)\b[^.!\n]{8,120}/i,
    /\btobias\b[^.!\n]{0,40}\b(advising|shared|sent)\b[^.!\n]{8,100}/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[0]) {
      const text = match[0].replace(/\s+/g, " ").replace(/\.*$/, "").trim();
      if (text.length >= 16) return text;
    }
  }
  if (/\blinkedin connections for warm introductions\b/i.test(raw)) {
    return "review each other's LinkedIn connections for warm introductions";
  }
  if (/\bchatwell\b/i.test(raw)) {
    return "pointed me at Chatwell Russ";
  }
  return null;
}

/**
 * Safe local draft when Claude is unavailable or rejected. Must still look
 * like Jason's operator email: specific open, concrete owe+when, what they
 * offered, a giving line, one next step. Never "You said you…" stitcher.
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
  const firstMeet = notesLookLikeFirstMeeting(input.summary);
  const facts = pickMeetingFollowupFacts(input.summary, 3);
  const owes = pickJasonOwes(input.summary);
  const offer = pickTheirOffer(input.summary);
  const due =
    when === "today" || when === "yesterday" ? "tomorrow" : "by Friday";

  const open = openingFromFact(facts[0] ?? null, firstMeet);
  const oweLine = oweLineFromCommitments(owes, due);
  const offerLine = offer
    ? restateOfferLine(offer)
    : "You offered to keep looking for a fit on your side.";
  const giveLine = givingLineFromNotes(input.summary, owes);
  const nextLine = `I'll send that ${due} afternoon unless another time is better.`;

  const subject = subjectFromDraft(facts[0] ?? null, owes[0] ?? null, firstMeet);
  return {
    subject,
    body: `${hello}

${open}

${oweLine}

${offerLine}

${giveLine}

${nextLine}

Jason`,
  };
}

function openingFromFact(fact: string | null, firstMeet: boolean): string {
  if (!fact) {
    return "One detail from our conversation stuck with me.";
  }
  const cleaned = fact.replace(/\.*$/, "").trim();
  const short =
    cleaned.length > 110 ? `${cleaned.slice(0, 107).trim()}…` : cleaned;
  // Prefer a concrete noun phrase over "You said you served as CMO…".
  if (/\bhero product\b/i.test(short) || /\bneckliner\b/i.test(short)) {
    return "Your hero product being a neckliner, then a full cosmetics line, stuck with me.";
  }
  if (/\bsetsu\b/i.test(short) || /\bgloss ventures\b/i.test(short)) {
    return "Your Setsu path through Gloss Ventures stuck with me.";
  }
  if (/\bfranchise\b/i.test(short)) {
    return `${short.endsWith(".") ? short.slice(0, -1) : short} - that is the thread I want to stay on.`;
  }
  if (/^(your|you )\b/i.test(short)) {
    return short.endsWith(".") ? short : `${short}.`;
  }
  // Past-tense bio bullets: "served as CMO…" → "You serving as CMO… stuck with me."
  if (
    /^(co-)?founded|started|built|launched|hired|raised|shared|served|moved|took|ran\b/i.test(
      short
    )
  ) {
    const gerund = short
      .replace(/^served as\b/i, "serving as")
      .replace(/^co-founded\b/i, "co-founding")
      .replace(/^founded\b/i, "founding")
      .replace(/^started\b/i, "starting")
      .replace(/^built\b/i, "building")
      .replace(/^launched\b/i, "launching")
      .replace(/^hired\b/i, "hiring")
      .replace(/^raised\b/i, "raising")
      .replace(/^shared\b/i, "sharing")
      .replace(/^moved\b/i, "moving")
      .replace(/^took\b/i, "taking")
      .replace(/^ran\b/i, "running");
    const clipped =
      gerund.length > 100 ? `${gerund.slice(0, 97).trim()}…` : gerund;
    return `You ${clipped.charAt(0).toLowerCase()}${clipped.slice(1)} stuck with me.`;
  }
  if (/[:;—-]/.test(short) || /\b(product|brand|revenue|cmo|ceo)\b/i.test(short)) {
    const lower = `${short.charAt(0).toLowerCase()}${short.slice(1)}`;
    return `${lower} - that detail stuck with me.`;
  }
  void firstMeet;
  const lower = `${short.charAt(0).toLowerCase()}${short.slice(1)}`;
  return `${lower} - that is the detail I keep coming back to.`;
}

function oweLineFromCommitments(owes: string[], due: string): string {
  const joined = owes.join(" ").toLowerCase();
  if (/\blinkedin\b/.test(joined) && /\bintro/.test(joined)) {
    return `I'll review your LinkedIn and send intro suggestions ${due}.`;
  }
  if (/\blinkedin\b/.test(joined)) {
    return `I'll review your LinkedIn connections ${due}.`;
  }
  if (/\bchatwell\b/.test(joined)) {
    return `I'll go through the Chatwell Russ link you sent and reply ${due}.`;
  }
  if (owes[0]) {
    const text = owes[0].replace(/\.*$/, "").trim();
    const lower = `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    return `I owe you: ${lower} - you'll have it ${due}.`;
  }
  return `I'll send the concrete follow-up I owe you ${due}.`;
}

function restateOfferLine(offer: string): string {
  const cleaned = offer.replace(/\.*$/, "").trim();
  if (/^you\b/i.test(cleaned)) {
    return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
  }
  if (/\beach other'?s? linkedin\b/i.test(cleaned)) {
    return "You offered to review my LinkedIn the same way for warm intros.";
  }
  if (/\bchatwell\b/i.test(cleaned)) {
    return "You pointed me at Chatwell Russ - I'll treat that as the door you opened.";
  }
  const lower = `${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  return `You offered to ${lower}.`;
}

function givingLineFromNotes(
  source: string | null | undefined,
  owes: string[]
): string {
  const raw = source ?? "";
  if (/\bchatwell\b/i.test(raw)) {
    return "I'll dig into the Chatwell Russ link you sent and tell you what I take from it.";
  }
  if (owes.some((o) => /\blinkedin|intro/i.test(o))) {
    return "First cut of intros will be people in B2B or high-consideration B2C marketing teams investing in AI.";
  }
  return "I'll keep the ask on my side until I have something useful to send.";
}

function subjectFromDraft(
  fact: string | null,
  owe: string | null,
  firstMeet: boolean
): string {
  if (owe && /\blinkedin|intro/i.test(owe)) return "LinkedIn intros";
  if (owe && /\bchatwell\b/i.test(owe)) return "Chatwell Russ";
  if (fact && /\bsetsu|cosmetics|neckliner|gloss\b/i.test(fact)) {
    return "Setsu / next steps";
  }
  return firstMeet ? "Quick follow-up" : "Following up";
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
  hasBannedFollowupPhrases,
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
