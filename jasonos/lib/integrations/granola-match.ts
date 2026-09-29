// Pick the Granola note that belongs to one call. No network here.

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
  aroundIso?: string | null;
  calendarEventId?: string | null;
};

const HOUR = 60 * 60 * 1000;

export function pickGranolaNote(
  notes: GranolaNoteCandidate[],
  query: GranolaNoteQuery
): GranolaNoteCandidate | null {
  const name = query.name.trim();
  if (!name || !notes.length) return null;
  const email = query.email?.trim().toLowerCase() || null;
  const around = query.aroundIso ? Date.parse(query.aroundIso) : NaN;
  const eventId = query.calendarEventId?.trim() || null;

  let best: { note: GranolaNoteCandidate; score: number; distance: number } | null = null;
  for (const note of notes) {
    const score = scoreNote(note, { name, email, around, eventId });
    if (score < 4) continue;
    const distance = timeDistance(note, around);
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { note, score, distance };
    }
  }
  return best?.note ?? null;
}

function scoreNote(
  note: GranolaNoteCandidate,
  query: { name: string; email: string | null; around: number; eventId: string | null }
): number {
  let score = 0;
  const title = note.title ?? "";
  const names = [title, ...(note.attendeeNames ?? [])].filter(Boolean);
  if (names.some((value) => nameInText(query.name, value))) score += 4;
  if (query.email && (note.attendeeEmails ?? []).some((value) => value.trim().toLowerCase() === query.email)) {
    score += 8;
  }
  if (query.eventId && note.calendarEventId && idsMatch(query.eventId, note.calendarEventId)) {
    score += 20;
  }
  if (Number.isFinite(query.around) && note.scheduledStart) {
    const start = Date.parse(note.scheduledStart);
    if (Number.isFinite(start) && Math.abs(start - query.around) <= 3 * HOUR) score += 6;
  }
  return score;
}

function timeDistance(note: GranolaNoteCandidate, around: number): number {
  if (!Number.isFinite(around)) return 0;
  const start = note.scheduledStart ? Date.parse(note.scheduledStart) : Date.parse(note.createdAt);
  if (!Number.isFinite(start)) return Number.POSITIVE_INFINITY;
  return Math.abs(start - around);
}

function idsMatch(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

function nameInText(name: string, text: string): boolean {
  const parts = name.toLowerCase().split(/\s+/).filter((part) => part.length > 1);
  const hay = text.toLowerCase();
  if (parts.length < 2) return hay.includes(name.toLowerCase());
  const last = parts[parts.length - 1];
  if (!hay.includes(last)) return false;
  const first = parts[0];
  if (hay.includes(first)) return true;
  return hay.split(/[^a-z]+/).some((token) => token.startsWith(first.slice(0, 3)) && token.length >= 3);
}
