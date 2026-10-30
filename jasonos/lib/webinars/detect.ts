/**
 * Pure webinar detection from calendar events + notetaker notes.
 * No DB, no server-only — unit-tested.
 */

import { etYmd } from "../dates";
import { isMyOwnAddress } from "../outreach/contact-lookup";
import { isEventPlatformAddress } from "../outreach/mail-noise";

export type WebinarDetection =
  | "calendar_and_note"
  | "calendar_only"
  | "note_folder"
  | "note_solo_long";

export type WebinarCalendarEvent = {
  id?: string;
  summary?: string;
  status?: string;
  eventType?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  organizer?: { email?: string; self?: boolean };
  attendees?: Array<{ email?: string; self?: boolean; responseStatus?: string }>;
};

export type WebinarNote = {
  id: string;
  source: "granola" | "wispr";
  title: string;
  createdAt: string;
  scheduledStart?: string | null;
  url?: string | null;
  folders: string[];
  durationMinutes: number | null;
  participantCount: number;
};

export type DetectedWebinarSession = {
  session_key: string;
  session_date: string;
  started_at: string | null;
  duration_minutes: number | null;
  title: string;
  host_org: string;
  gcal_event_id: string | null;
  calendar_url: string | null;
  transcript_source: "granola" | "wispr" | null;
  transcript_note_id: string | null;
  transcript_url: string | null;
  detection: WebinarDetection;
};

const WEBINAR_LINK_RE =
  /events\.zoom\.us|zoom\.us\/w\/|zoom\.us\/webinar|luma\.com|lu\.ma|eventbrite\.com|livestorm|sequel\.io|on24\.com|bigmarker\.com|hopin\.com|goldcast\.io/i;

const WEBINAR_FOLDER_RE = /webinar|learning|events?|conference|symposium/i;

const TITLE_STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your",
  "you",
  "our",
  "are",
  "was",
  "were",
  "how",
  "what",
  "when",
  "who",
  "why",
  "via",
  "over",
  "under",
  "about",
  "live",
  "call",
  "meeting",
  "session",
  "webinar",
  "workshop",
]);

/** Lowercase, strip punctuation, drop short / stop words. */
export function normalizeTitleWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !TITLE_STOP.has(w));
}

function titlesShareFourWords(a: string, b: string): boolean {
  const left = new Set(normalizeTitleWords(a));
  if (left.size === 0) return false;
  let hit = 0;
  for (const word of normalizeTitleWords(b)) {
    if (left.has(word)) hit += 1;
  }
  return hit >= 4;
}

function eventStartIso(ev: WebinarCalendarEvent): string | null {
  return ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T12:00:00.000Z` : null);
}

function eventDurationMinutes(ev: WebinarCalendarEvent & { end?: { dateTime?: string; date?: string } }): number | null {
  const start = eventStartIso(ev);
  const end =
    ev.end?.dateTime ||
    (ev.end?.date ? `${ev.end.date}T12:00:00.000Z` : null);
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60_000);
}

function hasWebinarLink(ev: WebinarCalendarEvent): boolean {
  return WEBINAR_LINK_RE.test(`${ev.location ?? ""}\n${ev.description ?? ""}`);
}

function nonSelfAttendeeCount(ev: WebinarCalendarEvent): number {
  const attendees = ev.attendees ?? [];
  if (!attendees.length) {
    // Organizer-only FROM_GMAIL invites often omit attendees.
    return 0;
  }
  return attendees.filter((a) => {
    if (a.self) return false;
    if (a.responseStatus === "declined") return false;
    if (a.email && isMyOwnAddress(a.email)) return false;
    return Boolean(a.email);
  }).length;
}

/** Calendar event looks like a webinar registration / broadcast. */
export function isWebinarCalendarEvent(ev: WebinarCalendarEvent): boolean {
  if ((ev.status ?? "").toLowerCase() === "cancelled") return false;
  const organizerEmail = ev.organizer?.email?.trim() ?? "";
  if (organizerEmail && isEventPlatformAddress(organizerEmail)) return true;
  if (hasWebinarLink(ev)) return true;
  // Google Calendar API uses eventType "fromGmail" (no underscore).
  if (
    (ev.eventType ?? "").replace(/_/g, "").toLowerCase() === "fromgmail" &&
    nonSelfAttendeeCount(ev) === 0
  ) {
    return true;
  }
  return false;
}

/** Skip Jason's own working blocks (he organized, no platform link). */
export function isOwnWorkingBlock(ev: WebinarCalendarEvent): boolean {
  if (hasWebinarLink(ev)) return false;
  const org = ev.organizer?.email?.trim() ?? "";
  if (ev.organizer?.self) return true;
  if (org && isMyOwnAddress(org)) return true;
  return false;
}

export function noteHitsFolderRule(note: WebinarNote): boolean {
  return note.folders.some((name) => WEBINAR_FOLDER_RE.test(name));
}

export function noteHitsSoloLongRule(note: WebinarNote): boolean {
  return (
    note.participantCount <= 1 &&
    note.durationMinutes != null &&
    note.durationMinutes >= 30
  );
}

export function isWebinarNote(note: WebinarNote): boolean {
  return noteHitsFolderRule(note) || noteHitsSoloLongRule(note);
}

function noteStartIso(note: WebinarNote): string | null {
  return note.scheduledStart?.trim() || note.createdAt?.trim() || null;
}

/** Same Eastern date and within 20 minutes, or titles share ≥4 significant words. */
export function noteMatchesEvent(
  note: WebinarNote,
  ev: WebinarCalendarEvent
): boolean {
  const noteStart = noteStartIso(note);
  const eventStart = eventStartIso(ev);
  if (noteStart && eventStart) {
    const noteDay = etYmd(noteStart);
    const eventDay = etYmd(eventStart);
    if (noteDay === eventDay) {
      const delta = Math.abs(Date.parse(noteStart) - Date.parse(eventStart));
      if (Number.isFinite(delta) && delta <= 20 * 60_000) return true;
    }
  }
  const eventTitle = ev.summary?.trim() || "";
  if (eventTitle && note.title) {
    return titlesShareFourWords(note.title, eventTitle);
  }
  return false;
}

export function sessionKeyForEvent(eventId: string): string {
  return `gcal:${eventId}`;
}

export function sessionKeyForNote(
  source: "granola" | "wispr",
  noteId: string
): string {
  return `${source}:${noteId}`;
}

export function detectWebinarSessions(input: {
  events: Array<WebinarCalendarEvent & { end?: { dateTime?: string; date?: string } }>;
  notes: WebinarNote[];
  /** Note ids already attached to a Live deck — skip. */
  deckNoteIds?: Set<string> | string[];
}): DetectedWebinarSession[] {
  const deckIds = new Set(
    Array.isArray(input.deckNoteIds)
      ? input.deckNoteIds
      : [...(input.deckNoteIds ?? [])]
  );

  const webinarEvents = input.events.filter(
    (ev) =>
      Boolean(ev.id) &&
      isWebinarCalendarEvent(ev) &&
      !isOwnWorkingBlock(ev)
  );

  const webinarNotes = input.notes.filter(
    (note) => isWebinarNote(note) && !deckIds.has(note.id)
  );

  const usedNoteIds = new Set<string>();
  const sessions: DetectedWebinarSession[] = [];

  for (const ev of webinarEvents) {
    const eventId = ev.id!;
    const matched = webinarNotes.find(
      (note) => !usedNoteIds.has(note.id) && noteMatchesEvent(note, ev)
    );
    const start = eventStartIso(ev);
    if (matched) {
      usedNoteIds.add(matched.id);
      sessions.push({
        session_key: sessionKeyForEvent(eventId),
        session_date: etYmd(start || matched.scheduledStart || matched.createdAt),
        started_at: start,
        duration_minutes:
          eventDurationMinutes(ev) ?? matched.durationMinutes,
        title: (ev.summary?.trim() || matched.title || "Webinar").slice(0, 300),
        host_org: "",
        gcal_event_id: eventId,
        calendar_url: ev.htmlLink ?? null,
        transcript_source: matched.source,
        transcript_note_id: matched.id,
        transcript_url: matched.url ?? null,
        detection: "calendar_and_note",
      });
    } else {
      sessions.push({
        session_key: sessionKeyForEvent(eventId),
        session_date: etYmd(start || new Date().toISOString()),
        started_at: start,
        duration_minutes: eventDurationMinutes(ev),
        title: (ev.summary?.trim() || "Webinar").slice(0, 300),
        host_org: "",
        gcal_event_id: eventId,
        calendar_url: ev.htmlLink ?? null,
        transcript_source: null,
        transcript_note_id: null,
        transcript_url: null,
        detection: "calendar_only",
      });
    }
  }

  for (const note of webinarNotes) {
    if (usedNoteIds.has(note.id)) continue;
    const folderHit = noteHitsFolderRule(note);
    const detection: WebinarDetection = folderHit
      ? "note_folder"
      : "note_solo_long";
    const start = noteStartIso(note);
    sessions.push({
      session_key: sessionKeyForNote(note.source, note.id),
      session_date: etYmd(start || new Date().toISOString()),
      started_at: start,
      duration_minutes: note.durationMinutes,
      title: (note.title || "Webinar").slice(0, 300),
      host_org: "",
      gcal_event_id: null,
      calendar_url: null,
      transcript_source: note.source,
      transcript_note_id: note.id,
      transcript_url: note.url ?? null,
      detection,
    });
  }

  return sessions;
}
