// Pick the Granola note that belongs to one call. No network here.
// Prefer a hard calendar-event match. Never settle for "name appears in
// some nearby note title" when that would glue the wrong transcript to a draft.

export type GranolaNoteCandidate = {
  id: string;
  title: string | null;
  createdAt: string;
  summaryText?: string | null;
  webUrl?: string | null;
  attendeeEmails?: string[];
  attendeeNames?: string[];
  calendarEventId?: string | null;
  scheduledStart?: string | null;
};

export type GranolaNoteQuery = {
  name: string;
  email?: string | null;
  /** Extra attendee emails from the calendar invite. */
  emails?: string[] | null;
  aroundIso?: string | null;
  calendarEventId?: string | null;
  /** Extra calendar ids (iCal UID, recurring instance, etc.). */
  calendarEventIds?: string[] | null;
  meetingTitle?: string | null;
};

const HOUR = 60 * 60 * 1000;

export function pickGranolaNote(
  notes: GranolaNoteCandidate[],
  query: GranolaNoteQuery
): GranolaNoteCandidate | null {
  const name = normalizePersonName(query.name);
  if (!name || !notes.length) return null;

  const emailSet = collectEmails(query.email, query.emails);
  const around = query.aroundIso ? Date.parse(query.aroundIso) : NaN;
  const eventIds = collectEventIds(query.calendarEventId, query.calendarEventIds);
  const meetingTitle = query.meetingTitle?.trim() || null;
  const hadEventId = eventIds.size > 0;

  // 1) Calendar event id is authoritative when Granola linked the note.
  if (hadEventId) {
    const byEvent = notes.filter(
      (note) =>
        note.calendarEventId &&
        [...eventIds].some((id) => calendarIdsMatch(id, note.calendarEventId!))
    );
    if (byEvent.length === 1) return byEvent[0]!;
    if (byEvent.length > 1) {
      return pickBest(
        byEvent,
        { name, emailSet, around, eventIds, meetingTitle },
        0
      );
    }
    // Event id was provided but no note carries it. Fall through only with
    // a strong identity signal (email, or name + meeting-title overlap).
    // Name + time alone used to glue Simon's AEO notes onto Tuomas's follow-up.
  }

  // 2) Require a strong identity signal.
  // With a missed calendar id: email (8) or name+title (4+5) must contribute.
  // Without a calendar id: email or name+time is enough.
  const minScore = hadEventId
    ? emailSet.size
      ? 14
      : 15
    : emailSet.size || Number.isFinite(around)
      ? 10
      : 12;
  return pickBest(
    notes,
    { name, emailSet, around, eventIds, meetingTitle },
    minScore
  );
}

function pickBest(
  notes: GranolaNoteCandidate[],
  query: {
    name: string;
    emailSet: Set<string>;
    around: number;
    eventIds: Set<string>;
    meetingTitle: string | null;
  },
  minScore: number
): GranolaNoteCandidate | null {
  let best: { note: GranolaNoteCandidate; score: number; distance: number } | null =
    null;
  for (const note of notes) {
    const score = scoreNote(note, query);
    if (score < minScore) continue;
    // When a calendar id was expected and missed, reject pure name+time hits.
    if (
      query.eventIds.size &&
      !noteHasEventId(note, query.eventIds) &&
      !hasEmailHit(note, query.emailSet) &&
      !hasTitleOverlap(note, query.meetingTitle)
    ) {
      continue;
    }
    const distance = timeDistance(note, query.around);
    if (
      !best ||
      score > best.score ||
      (score === best.score && distance < best.distance)
    ) {
      best = { note, score, distance };
    }
  }
  return best?.note ?? null;
}

function scoreNote(
  note: GranolaNoteCandidate,
  query: {
    name: string;
    emailSet: Set<string>;
    around: number;
    eventIds: Set<string>;
    meetingTitle: string | null;
  }
): number {
  let score = 0;
  const title = note.title ?? "";
  const summary = note.summaryText ?? "";
  const names = [title, summary, ...(note.attendeeNames ?? [])].filter(Boolean);

  if (names.some((value) => nameInText(query.name, value))) {
    score += 4;
  } else if (looseNameHit(query.name, title, summary, query.emailSet)) {
    score += 4;
  }

  if (hasEmailHit(note, query.emailSet)) score += 8;

  if (noteHasEventId(note, query.eventIds)) score += 20;

  if (
    query.meetingTitle &&
    title &&
    titlesLooselyMatch(query.meetingTitle, title)
  ) {
    score += 5;
  } else if (
    query.meetingTitle &&
    title &&
    distinctiveNameOverlap(query.meetingTitle, title)
  ) {
    // "Tuomas x Jason Connect" ↔ "...with Tuomas" — one rare name is enough.
    score += 5;
  }

  if (Number.isFinite(query.around)) {
    const start = note.scheduledStart
      ? Date.parse(note.scheduledStart)
      : Date.parse(note.createdAt);
    if (Number.isFinite(start) && Math.abs(start - query.around) <= 3 * HOUR) {
      score += 6;
    } else if (
      Number.isFinite(start) &&
      Math.abs(start - query.around) <= 12 * HOUR
    ) {
      score += 2;
    }
  }

  return score;
}

function timeDistance(note: GranolaNoteCandidate, around: number): number {
  if (!Number.isFinite(around)) return 0;
  const start = note.scheduledStart
    ? Date.parse(note.scheduledStart)
    : Date.parse(note.createdAt);
  if (!Number.isFinite(start)) return Number.POSITIVE_INFINITY;
  return Math.abs(start - around);
}

/** Exact match only — substring includes() glued unrelated Google event ids. */
export function calendarIdsMatch(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  // Google recurring instances look like baseId_YYYYMMDDTHHMMSSZ.
  // Also allow long suffix equality / iCal bare id vs id@google.com.
  const strip = (value: string) => value.replace(/@.*$/, "");
  const as = strip(a);
  const bs = strip(b);
  if (as.length < 10 || bs.length < 10) return false;
  if (as === bs) return true;
  if (as.startsWith(`${bs}_`) || bs.startsWith(`${as}_`)) return true;
  if (as.endsWith(bs) || bs.endsWith(as)) return true;
  return false;
}

/** "Peltoniemi, Tuomas" → "Tuomas Peltoniemi". */
export function normalizePersonName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const comma = trimmed.match(/^([^,]+),\s*(.+)$/);
  if (comma) {
    return `${comma[2]!.trim()} ${comma[1]!.trim()}`.replace(/\s+/g, " ");
  }
  return trimmed;
}

function collectEmails(
  email?: string | null,
  emails?: string[] | null
): Set<string> {
  const out = new Set<string>();
  for (const value of [email, ...(emails ?? [])]) {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed?.includes("@")) out.add(trimmed);
  }
  return out;
}

function collectEventIds(
  primary?: string | null,
  extras?: string[] | null
): Set<string> {
  const out = new Set<string>();
  for (const value of [primary, ...(extras ?? [])]) {
    const trimmed = value?.trim();
    if (trimmed) out.add(trimmed);
  }
  return out;
}

function noteHasEventId(
  note: GranolaNoteCandidate,
  eventIds: Set<string>
): boolean {
  if (!note.calendarEventId || !eventIds.size) return false;
  return [...eventIds].some((id) => calendarIdsMatch(id, note.calendarEventId!));
}

function hasEmailHit(
  note: GranolaNoteCandidate,
  emailSet: Set<string>
): boolean {
  if (!emailSet.size) return false;
  return (note.attendeeEmails ?? []).some((value) =>
    emailSet.has(value.trim().toLowerCase())
  );
}

function hasTitleOverlap(
  note: GranolaNoteCandidate,
  meetingTitle: string | null
): boolean {
  if (!meetingTitle || !note.title) return false;
  return (
    titlesLooselyMatch(meetingTitle, note.title) ||
    distinctiveNameOverlap(meetingTitle, note.title)
  );
}

function titlesLooselyMatch(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(left.split(" ").filter((t) => t.length > 2));
  const rightTokens = right.split(" ").filter((t) => t.length > 2);
  if (!leftTokens.size || !rightTokens.length) return false;
  const overlap = rightTokens.filter((t) => leftTokens.has(t)).length;
  return overlap >= 2 && overlap / Math.min(leftTokens.size, rightTokens.length) >= 0.5;
}

/** One uncommon personal name shared across titles (Tuomas, Shawn, …). */
function distinctiveNameOverlap(meetingTitle: string, noteTitle: string): boolean {
  const left = new Set(
    normalizeTitle(meetingTitle)
      .split(" ")
      .filter((t) => t.length >= 4 && !GENERIC_TITLE_TOKENS.has(t))
  );
  if (!left.size) return false;
  const right = normalizeTitle(noteTitle)
    .split(" ")
    .filter((t) => t.length >= 4 && !GENERIC_TITLE_TOKENS.has(t));
  return right.some((t) => left.has(t));
}

const GENERIC_TITLE_TOKENS = new Set([
  "jason",
  "kuperman",
  "connect",
  "catch",
  "meeting",
  "call",
  "with",
  "intro",
  "chat",
  "sync",
  "update",
  "follow",
  "virtual",
  "minute",
  "minutes",
  "networking",
]);

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(jason|kuperman|connect|call|meeting|with)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameInText(name: string, text: string): boolean {
  const normalized = normalizePersonName(name);
  const parts = normalized
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length > 1);
  const hay = text.toLowerCase();
  if (parts.length < 2) return hay.includes(normalized.toLowerCase());
  const last = parts[parts.length - 1]!;
  if (!hay.includes(last)) return false;
  const first = parts[0]!;
  if (hay.includes(first)) return true;
  return hay
    .split(/[^a-z]+/)
    .some((token) => token.startsWith(first.slice(0, 3)) && token.length >= 3);
}

/**
 * Granola often omits guest emails. Accept first-name-in-title when the last
 * name appears in the attendee email local-part (tuomas.peltoniemi@…).
 */
function looseNameHit(
  name: string,
  title: string,
  summary: string,
  emailSet: Set<string>
): boolean {
  const parts = normalizePersonName(name)
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length > 1);
  if (parts.length < 2) return false;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const hay = `${title}\n${summary}`.toLowerCase();
  if (!hay.includes(first)) return false;
  for (const email of emailSet) {
    const local = email.split("@")[0] ?? "";
    if (local.includes(last)) return true;
  }
  return false;
}
