// Granola notes. Settings key first, then GRANOLA_API_KEY.
// https://public-api.granola.ai/v1/notes

import "server-only";
import { emptyResult, type IntegrationResult } from "./_base";
import { pickGranolaNote, type GranolaNoteCandidate } from "./granola-match";

export interface GranolaMeeting {
  id: string;
  title: string;
  endedAt: string;
  source: "granola";
  summary?: string;
  notesUrl?: string;
  attendees?: { name?: string; email?: string }[];
}

export interface GranolaSearchResult {
  found: boolean;
  summary?: string;
  url?: string;
  meetings?: GranolaMeeting[];
  error?: string;
}

const API = "https://public-api.granola.ai";

type NoteSummary = {
  id?: string;
  title?: string | null;
  created_at?: string;
};

type NoteDetail = NoteSummary & {
  web_url?: string;
  summary_text?: string | null;
  attendees?: Array<{ name?: string | null; email?: string }>;
  calendar_event?: {
    calendar_event_id?: string | null;
    scheduled_start_time?: string | null;
    invitees?: Array<{ email?: string }>;
  } | null;
};

type ConnectionConfig = { access_token?: string };

async function resolveGranolaApiKey(): Promise<string | null> {
  try {
    const { createPublicServiceRoleClient } = await import("@/lib/supabase/server");
    const sb = createPublicServiceRoleClient();
    const { data } = await sb
      .from("service_connections")
      .select("config")
      .eq("service_name", "granola")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fromSettings = ((data?.config ?? {}) as ConnectionConfig).access_token?.trim();
    if (fromSettings) return fromSettings;
  } catch {
    // Settings may be unreachable. Fall through to the env key.
  }
  return process.env.GRANOLA_API_KEY?.trim() || null;
}

async function granolaGet(path: string, key: string): Promise<
  { ok: true; json: unknown } | { ok: false; status: number }
> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, json: await res.json() };
}

function keyError(status: number): string {
  if (status === 401 || status === 403) {
    return "Granola rejected the API key. Paste a new key in Settings.";
  }
  return `Granola returned ${status}.`;
}

export async function getOvernightGranola(): Promise<IntegrationResult<GranolaMeeting[]>> {
  const key = await resolveGranolaApiKey();
  if (!key) return emptyResult([], false);
  const since = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
  try {
    const listed = await granolaGet(`/v1/notes?page_size=10&created_after=${encodeURIComponent(since)}`, key);
    if (!listed.ok) return emptyResult([], true, keyError(listed.status));
    const notes = ((listed.json as { notes?: NoteSummary[] }).notes ?? []).filter((note) => note.id);
    return emptyResult(
      notes.map((note) => ({
        id: note.id as string,
        title: note.title?.trim() || "Untitled meeting",
        endedAt: note.created_at ?? new Date().toISOString(),
        source: "granola" as const,
      })),
      true
    );
  } catch (error) {
    return emptyResult([], true, error instanceof Error ? error.message : "Granola request failed.");
  }
}

export async function searchGranolaForContact({
  contactName,
  email,
  emails,
  aroundIso,
  calendarEventId,
  calendarEventIds,
  meetingTitle,
}: {
  contactName: string;
  email?: string | null;
  emails?: string[] | null;
  aroundIso?: string | null;
  calendarEventId?: string | null;
  calendarEventIds?: string[] | null;
  meetingTitle?: string | null;
}): Promise<GranolaSearchResult> {
  const name = contactName.trim();
  if (!name) return { found: false };
  const key = await resolveGranolaApiKey();
  if (!key) return { found: false, error: "Granola is not connected. Add an API key in Settings." };

  const around = aroundIso ? Date.parse(aroundIso) : NaN;
  const createdAfter = new Date(
    (Number.isFinite(around) ? around : Date.now()) - 2 * 24 * 60 * 60 * 1000
  ).toISOString();
  const createdBefore = new Date(
    (Number.isFinite(around) ? around : Date.now()) + 24 * 60 * 60 * 1000
  ).toISOString();
  const eventIds = [calendarEventId, ...(calendarEventIds ?? [])].filter(
    (value): value is string => Boolean(value?.trim())
  );

  try {
    const listed = await listNotes(key, createdAfter, createdBefore);
    if (!listed.ok) return { found: false, error: keyError(listed.status) };
    // Prefer notes closest in time; title rank is a tie-breaker only.
    // Pull enough detail pages that a calendar-linked note is not dropped
    // just because its title is generic ("Meeting with…").
    const shortlist = listed.notes
      .filter((note) => note.id)
      .sort(
        (a, b) =>
          timeRank(a, around) - timeRank(b, around) ||
          titleRank(b, name) - titleRank(a, name) ||
          titleRank(b, meetingTitle ?? "") - titleRank(a, meetingTitle ?? "")
      )
      .slice(0, eventIds.length ? 16 : 10);

    const details: GranolaNoteCandidate[] = [];
    for (const note of shortlist) {
      const detail = await granolaGet(`/v1/notes/${encodeURIComponent(note.id as string)}`, key);
      if (!detail.ok) {
        if (detail.status === 401 || detail.status === 403) return { found: false, error: keyError(detail.status) };
        continue;
      }
      details.push(toCandidate(detail.json as NoteDetail, note));
    }

    const match = pickGranolaNote(details, {
      name,
      email,
      emails,
      aroundIso,
      calendarEventId: eventIds[0] ?? null,
      calendarEventIds: eventIds,
      meetingTitle,
    });
    const summary = match?.summaryText?.trim();
    if (!match || !summary) {
      return { found: false, error: "No Granola note for this call yet." };
    }
    return {
      found: true,
      summary,
      url: match.webUrl ?? undefined,
      meetings: [
        {
          id: match.id,
          title: match.title?.trim() || name,
          endedAt: match.scheduledStart || match.createdAt,
          source: "granola",
          summary,
          notesUrl: match.webUrl ?? undefined,
        },
      ],
    };
  } catch (error) {
    return { found: false, error: error instanceof Error ? error.message : "Granola request failed." };
  }
}

async function listNotes(
  key: string,
  createdAfter: string,
  createdBefore: string
): Promise<{ ok: true; notes: NoteSummary[] } | { ok: false; status: number }> {
  const notes: NoteSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 2; page += 1) {
    const params = new URLSearchParams({
      page_size: "30",
      created_after: createdAfter,
      created_before: createdBefore,
    });
    if (cursor) params.set("cursor", cursor);
    const listed = await granolaGet(`/v1/notes?${params}`, key);
    if (!listed.ok) return listed;
    const body = listed.json as { notes?: NoteSummary[]; hasMore?: boolean; cursor?: string | null };
    notes.push(...(body.notes ?? []));
    if (!body.hasMore || !body.cursor) break;
    cursor = body.cursor;
  }
  return { ok: true, notes };
}

function toCandidate(detail: NoteDetail, fallback: NoteSummary): GranolaNoteCandidate {
  const emails = new Set<string>();
  const names: string[] = [];
  for (const person of detail.attendees ?? []) {
    if (person.email) emails.add(person.email);
    if (person.name) names.push(person.name);
  }
  for (const invitee of detail.calendar_event?.invitees ?? []) {
    if (invitee.email) emails.add(invitee.email);
  }
  return {
    id: detail.id || (fallback.id as string),
    title: detail.title ?? fallback.title ?? null,
    createdAt: detail.created_at || fallback.created_at || new Date().toISOString(),
    summaryText: detail.summary_text,
    webUrl: detail.web_url,
    attendeeEmails: [...emails],
    attendeeNames: names,
    calendarEventId: detail.calendar_event?.calendar_event_id,
    scheduledStart: detail.calendar_event?.scheduled_start_time,
  };
}

function titleRank(note: NoteSummary, name: string): number {
  const title = (note.title ?? "").toLowerCase();
  const parts = name.toLowerCase().split(/\s+/).filter((part) => part.length > 1);
  if (parts.length >= 2 && parts.every((part) => title.includes(part))) return 2;
  if (parts.length >= 2 && title.includes(parts[parts.length - 1])) return 1;
  return 0;
}

function timeRank(note: NoteSummary, around: number): number {
  if (!Number.isFinite(around) || !note.created_at) return 0;
  const created = Date.parse(note.created_at);
  if (!Number.isFinite(created)) return Number.POSITIVE_INFINITY;
  return Math.abs(created - around);
}
