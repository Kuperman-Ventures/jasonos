"use server";

import { revalidatePath } from "next/cache";
import {
  averageRubricScores,
  bulletsFromJson,
  capWords,
  extractTranscriptSection,
  normalizeRubricLines,
  normalizeSlideInputs,
  extractJsonValue,
  parseAiHelpSlidesJson,
  parseReviewJson,
  parseRubricFromJson,
  toJsonBullets,
  type ParsedRubricScore,
  type SlideInput,
} from "@/lib/live/decks-helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** Lazy so unit tests can import Save-as actions without loading AI/server-only modules. */
async function loadMeetingPrep() {
  return import("@/lib/server-actions/meeting-prep");
}

export type DeckKind = "playbook" | "deck";

export type ReviewSlideMark = "covered" | "partly" | "skipped";
export type ReviewGoalMark = "hit" | "partly" | "missed";

export type RubricScore = ParsedRubricScore;

export type DeckReview = {
  slides: Array<{
    slide_id: string;
    mark: ReviewSlideMark;
    evidence: string;
    overridden: boolean;
    evidence_unverified?: boolean;
  }>;
  goal: {
    mark: ReviewGoalMark;
    evidence: string;
    overridden: boolean;
    evidence_unverified?: boolean;
  } | null;
  said: string[];
  committed: string[];
  next_time: string[];
  model: string;
  transcript_source: "granola" | "wispr" | null;
  rubric: Array<RubricScore & { evidence_unverified?: boolean }>;
  rubric_average: number | null;
  caveat?: string | null;
  coverage_warning?: string | null;
  speakers?: Record<string, string> | null;
  jason_speaker?: string | null;
  talk_share?: { jason_chars: number; others_chars: number; jason_pct: number } | null;
  segments?: Array<{
    from_line: number;
    to_line: number;
    topic: string;
    who_led: string;
  }> | null;
};

export type AiLastRun = {
  at: string;
  instructions: string;
  sources: string[];
};

export type AiHelpSources = {
  people?: string[];
  playbookId?: string | null;
  openText?: string | null;
  transcriptDeckIds?: string[];
  meeting?: { calendar?: boolean; email?: boolean; website?: boolean } | null;
};

export type AiHelpMode = "add" | "replace";

export type DeckSummary = {
  id: string;
  kind: DeckKind;
  name: string;
  description: string | null;
  goal: string | null;
  meetingPrepId: string | null;
  sourcePlaybookId: string | null;
  slideCount: number;
  updatedAt: string;
  runStartedAt: string | null;
  runEndedAt: string | null;
  aiNotes: string | null;
  hasTranscript: boolean;
  transcriptFetchedAt: string | null;
  reviewedAt: string | null;
  reviewGoalMark: ReviewGoalMark | null;
  reviewRubricAverage: number | null;
};

export type Slide = {
  id: string;
  position: number;
  headline: string;
  bullets: string[];
};

export type DeckDetail = DeckSummary & {
  slides: Slide[];
  transcript: string | null;
  transcriptSource: "granola" | "wispr" | null;
  transcriptChars: number | null;
  transcriptComplete: boolean | null;
  review: DeckReview | null;
  aiLastRun: AiLastRun | null;
  hasAiUndo: boolean;
  rubric: string[];
  rubricSource: string | null;
};

export type AttachableMeeting = {
  id: string;
  title: string;
  startsAt: string;
  attendeeNames: string[];
  hasDeck: boolean;
  deckId: string | null;
};

export type HeldMeetingRow = {
  key: string;
  meetingPrepId: string | null;
  deckId: string | null;
  title: string;
  startsAt: string;
  attendeeNames: string[];
  hasTranscript: boolean;
  goal: string | null;
  reviewedAt: string | null;
  reviewGoalMark: ReviewGoalMark | null;
  reviewRubricAverage: number | null;
  runInLive: boolean;
};

export type AttachableNote = {
  id: string;
  title: string;
  at: string;
  source: "granola" | "wispr";
};

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

type DeckRow = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  goal: string | null;
  rubric: unknown;
  rubric_source: string | null;
  source_playbook_id: string | null;
  meeting_prep_id: string | null;
  ai_notes: string | null;
  ai_undo: unknown;
  ai_last_run: unknown;
  review: unknown;
  reviewed_at: string | null;
  run_started_at: string | null;
  run_ended_at: string | null;
  transcript: string | null;
  transcript_source: string | null;
  transcript_note_id: string | null;
  transcript_fetched_at: string | null;
  transcript_chars: number | null;
  transcript_complete: boolean | null;
  updated_at: string;
};

type SlideRow = {
  id: string;
  deck_id: string;
  position: number;
  headline: string;
  bullets: unknown;
};

const DECK_COLUMNS =
  "id, kind, name, description, goal, rubric, rubric_source, source_playbook_id, meeting_prep_id, ai_notes, ai_undo, ai_last_run, review, reviewed_at, run_started_at, run_ended_at, transcript, transcript_source, transcript_note_id, transcript_fetched_at, transcript_chars, transcript_complete, updated_at";

function hasConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function asKind(value: string): DeckKind {
  return value === "playbook" ? "playbook" : "deck";
}

function parseStoredRubricScores(value: unknown): RubricScore[] {
  if (!Array.isArray(value)) return [];
  const out: RubricScore[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (typeof item.line !== "string") continue;
    const na = Boolean(item.na);
    const scoreNum = typeof item.score === "number" ? item.score : Number(item.score);
    out.push({
      line: item.line,
      score: na
        ? null
        : Number.isFinite(scoreNum) && scoreNum >= 1 && scoreNum <= 5
          ? Math.round(scoreNum)
          : 1,
      note: typeof item.note === "string" ? item.note : "",
      na,
      overridden: Boolean(item.overridden),
    });
  }
  return out;
}

function parseReview(value: unknown): DeckReview | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const slidesRaw = Array.isArray(raw.slides) ? raw.slides : [];
  const slides: DeckReview["slides"] = [];
  for (const row of slidesRaw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const mark = item.mark;
    if (mark !== "covered" && mark !== "partly" && mark !== "skipped") continue;
    if (typeof item.slide_id !== "string") continue;
    slides.push({
      slide_id: item.slide_id,
      mark,
      evidence: typeof item.evidence === "string" ? item.evidence : "",
      overridden: Boolean(item.overridden),
      evidence_unverified: Boolean(item.evidence_unverified),
    });
  }
  let goal: DeckReview["goal"] = null;
  if (raw.goal && typeof raw.goal === "object") {
    const g = raw.goal as Record<string, unknown>;
    if (g.mark === "hit" || g.mark === "partly" || g.mark === "missed") {
      goal = {
        mark: g.mark,
        evidence: typeof g.evidence === "string" ? g.evidence : "",
        overridden: Boolean(g.overridden),
        evidence_unverified: Boolean(g.evidence_unverified),
      };
    }
  }
  const list = (key: string) =>
    Array.isArray(raw[key])
      ? (raw[key] as unknown[])
          .filter((line): line is string => typeof line === "string")
          .slice(0, key === "committed" ? 20 : 6)
      : [];
  const rubric = parseStoredRubricScores(raw.rubric).map((row, index) => {
    const rawRow = Array.isArray(raw.rubric) ? (raw.rubric as unknown[])[index] : null;
    const unverified =
      rawRow && typeof rawRow === "object"
        ? Boolean((rawRow as { evidence_unverified?: unknown }).evidence_unverified)
        : false;
    return { ...row, evidence_unverified: unverified };
  });
  const avg =
    typeof raw.rubric_average === "number"
      ? raw.rubric_average
      : averageRubricScores(rubric);
  const talk =
    raw.talk_share && typeof raw.talk_share === "object"
      ? (raw.talk_share as Record<string, unknown>)
      : null;
  return {
    slides,
    goal,
    said: list("said"),
    committed: list("committed"),
    next_time: list("next_time"),
    model: typeof raw.model === "string" ? raw.model : "claude-sonnet-4-6",
    transcript_source:
      raw.transcript_source === "granola" || raw.transcript_source === "wispr"
        ? raw.transcript_source
        : null,
    rubric,
    rubric_average: avg,
    caveat: typeof raw.caveat === "string" ? raw.caveat : null,
    coverage_warning: typeof raw.coverage_warning === "string" ? raw.coverage_warning : null,
    speakers:
      raw.speakers && typeof raw.speakers === "object" && !Array.isArray(raw.speakers)
        ? (raw.speakers as Record<string, string>)
        : null,
    jason_speaker: typeof raw.jason_speaker === "string" ? raw.jason_speaker : null,
    talk_share: talk
      ? {
          jason_chars: Number(talk.jason_chars) || 0,
          others_chars: Number(talk.others_chars) || 0,
          jason_pct: Number(talk.jason_pct) || 0,
        }
      : null,
    segments: Array.isArray(raw.segments)
      ? (raw.segments as unknown[])
          .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
          .map((row) => ({
            from_line: Number(row.from_line) || 0,
            to_line: Number(row.to_line) || 0,
            topic: typeof row.topic === "string" ? row.topic : "",
            who_led: typeof row.who_led === "string" ? row.who_led : "",
          }))
      : null,
  };
}

function parseAiLastRun(value: unknown): AiLastRun | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.at !== "string" || typeof raw.instructions !== "string") return null;
  return {
    at: raw.at,
    instructions: raw.instructions,
    sources: Array.isArray(raw.sources)
      ? raw.sources.filter((s): s is string => typeof s === "string")
      : [],
  };
}

function revalidateDeck(deckId: string, kind: DeckKind, prepId?: string | null) {
  try {
    revalidatePath("/live");
    revalidatePath("/live/library");
    revalidatePath("/live/playbooks");
    revalidatePath("/live/decks");
    if (kind === "playbook") {
      revalidatePath(`/live/playbooks/${deckId}`);
      revalidatePath(`/live/playbooks/${deckId}/rehearse`);
    } else {
      revalidatePath(`/live/decks/${deckId}`);
      revalidatePath(`/live/decks/${deckId}/rehearse`);
      revalidatePath(`/live/decks/${deckId}/run`);
      revalidatePath(`/live/decks/${deckId}/review`);
    }
    if (prepId) revalidatePath(`/meetings/${prepId}`);
  } catch {
    // Outside a Next request (unit tests) revalidatePath has no store.
  }
}

function toSummary(row: DeckRow, slideCount: number): DeckSummary {
  const review = parseReview(row.review);
  return {
    id: row.id,
    kind: asKind(row.kind),
    name: row.name,
    description: row.description?.trim() || null,
    goal: row.goal?.trim() || null,
    meetingPrepId: row.meeting_prep_id,
    sourcePlaybookId: row.source_playbook_id,
    slideCount,
    updatedAt: row.updated_at,
    runStartedAt: row.run_started_at,
    runEndedAt: row.run_ended_at,
    aiNotes: row.ai_notes?.trim() || null,
    hasTranscript: Boolean(row.transcript?.trim()),
    transcriptFetchedAt: row.transcript_fetched_at,
    reviewedAt: row.reviewed_at,
    reviewGoalMark: review?.goal?.mark ?? null,
    reviewRubricAverage: review?.rubric_average ?? null,
  };
}

async function loadDefaultRubricLines(
  sb: ReturnType<typeof createServiceRoleClient>
): Promise<string[]> {
  const { data } = await sb.from("live_defaults").select("rubric").eq("id", true).maybeSingle();
  const lines = parseRubricFromJson(data?.rubric);
  return lines;
}

function toSlide(row: SlideRow): Slide {
  return {
    id: row.id,
    position: row.position,
    headline: row.headline,
    bullets: bulletsFromJson(row.bullets),
  };
}

async function slideCounts(sb: ReturnType<typeof createServiceRoleClient>, deckIds: string[]) {
  const map = new Map<string, number>();
  if (!deckIds.length) return map;
  const { data, error } = await sb.from("slides").select("deck_id").in("deck_id", deckIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const id = row.deck_id as string;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

async function loadSlides(sb: ReturnType<typeof createServiceRoleClient>, deckId: string): Promise<Slide[]> {
  const { data, error } = await sb
    .from("slides")
    .select("id, deck_id, position, headline, bullets")
    .eq("deck_id", deckId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toSlide(row as SlideRow));
}

export async function listPlaybooks(): Promise<ActionResult<{ playbooks: DeckSummary[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .select(DECK_COLUMNS)
      .eq("kind", "playbook")
      .order("name", { ascending: true });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as DeckRow[];
    const counts = await slideCounts(sb, rows.map((row) => row.id));
    return {
      ok: true,
      playbooks: rows.map((row) => toSummary(row, counts.get(row.id) ?? 0)),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listDecks(): Promise<ActionResult<{ decks: DeckSummary[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .select(DECK_COLUMNS)
      .eq("kind", "deck")
      .order("updated_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as DeckRow[];
    const counts = await slideCounts(sb, rows.map((row) => row.id));
    return {
      ok: true,
      decks: rows.map((row) => toSummary(row, counts.get(row.id) ?? 0)),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getDeck(deckId: string): Promise<ActionResult<{ deck: DeckDetail }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  if (!id) return { ok: false, error: "Not found." };
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb.from("decks").select(DECK_COLUMNS).eq("id", id).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    const row = data as DeckRow;
    const slides = await loadSlides(sb, id);
    const summary = toSummary(row, slides.length);
    return {
      ok: true,
      deck: {
        ...summary,
        slides,
        transcript: row.transcript?.trim() || null,
        transcriptSource:
          row.transcript_source === "granola" || row.transcript_source === "wispr"
            ? row.transcript_source
            : null,
        transcriptChars:
          typeof row.transcript_chars === "number" ? row.transcript_chars : null,
        transcriptComplete:
          typeof row.transcript_complete === "boolean" ? row.transcript_complete : null,
        review: parseReview(row.review),
        aiLastRun: parseAiLastRun(row.ai_last_run),
        hasAiUndo: Boolean(row.ai_undo && typeof row.ai_undo === "object"),
        rubric: parseRubricFromJson(row.rubric),
        rubricSource: row.rubric_source?.trim() || null,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setRubric(
  deckId: string,
  lines: string[],
  sourceLabel?: string | null
): Promise<ActionResult<{ rubric: string[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const rubric = normalizeRubricLines(lines);
  try {
    const sb = createServiceRoleClient();
    const rubric_source = sourceLabel?.trim() || "custom";
    const { data, error } = await sb
      .from("decks")
      .update({ rubric, rubric_source, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, kind, meeting_prep_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    revalidateDeck(id, asKind(data.kind as string), data.meeting_prep_id as string | null);
    return { ok: true, rubric };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getDefaultRubric(): Promise<ActionResult<{ rubric: string[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  try {
    const sb = createServiceRoleClient();
    const rubric = await loadDefaultRubricLines(sb);
    return { ok: true, rubric };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setDefaultRubric(
  lines: string[]
): Promise<ActionResult<{ rubric: string[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const rubric = normalizeRubricLines(lines);
  try {
    const sb = createServiceRoleClient();
    const { error } = await sb.from("live_defaults").upsert({
      id: true,
      rubric,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    try {
      revalidatePath("/settings");
      revalidatePath("/live");
    } catch {
      // outside Next request
    }
    return { ok: true, rubric };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setDeckGoal(
  deckId: string,
  goal: string
): Promise<ActionResult<{ goal: string | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const next = goal.trim().slice(0, 500) || null;
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .update({ goal: next, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, kind, meeting_prep_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    revalidateDeck(id, asKind(data.kind as string), data.meeting_prep_id as string | null);
    return { ok: true, goal: next };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Calendar meetings for Attach: past 7 days through next 30, soonest first. */
export async function listAttachableMeetings(): Promise<
  ActionResult<{ meetings: AttachableMeeting[] }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  try {
    // Keep upcoming calendar rows synced into meeting_preps.
    const { getUpcomingMeetingPreps } = await loadMeetingPrep();
    await getUpcomingMeetingPreps(30);

    const sb = createServiceRoleClient();
    const now = Date.now();
    const from = new Date(now - 7 * 86_400_000).toISOString();
    const to = new Date(now + 30 * 86_400_000).toISOString();
    const { data: preps, error } = await sb
      .from("meeting_preps")
      .select("id, title, starts_at, attendees")
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("starts_at", { ascending: true });
    if (error) return { ok: false, error: error.message };

    const { data: linked } = await sb
      .from("decks")
      .select("id, meeting_prep_id")
      .eq("kind", "deck")
      .not("meeting_prep_id", "is", null);
    const deckByPrep = new Map<string, string>();
    for (const row of linked ?? []) {
      const prepId = row.meeting_prep_id as string | null;
      if (prepId) deckByPrep.set(prepId, row.id as string);
    }

    const meetings: AttachableMeeting[] = (preps ?? []).map((row) => {
      const attendees = Array.isArray(row.attendees) ? row.attendees : [];
      const attendeeNames = attendees
        .map((person) => {
          if (!person || typeof person !== "object") return "";
          const p = person as { name?: string | null; email?: string | null };
          return (p.name?.trim() || p.email?.trim() || "") as string;
        })
        .filter(Boolean);
      const deckId = deckByPrep.get(row.id as string) ?? null;
      return {
        id: row.id as string,
        title: String(row.title ?? "Meeting"),
        startsAt: String(row.starts_at),
        attendeeNames,
        hasDeck: Boolean(deckId),
        deckId,
      };
    });
    return { ok: true, meetings };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function attendeeNamesFromJson(attendees: unknown): string[] {
  const list = Array.isArray(attendees) ? attendees : [];
  return list
    .map((person) => {
      if (!person || typeof person !== "object") return "";
      const p = person as { name?: string | null; email?: string | null };
      return (p.name?.trim() || p.email?.trim() || "") as string;
    })
    .filter(Boolean);
}

function heldRowFromPrep(
  prep: { id: string; title: string | null; starts_at: string; attendees: unknown },
  deck: DeckRow | null
): HeldMeetingRow {
  const review = deck ? parseReview(deck.review) : null;
  return {
    key: (deck?.id ?? prep.id) as string,
    meetingPrepId: prep.id as string,
    deckId: deck?.id ?? null,
    title: String(prep.title ?? "Meeting"),
    startsAt: String(prep.starts_at),
    attendeeNames: attendeeNamesFromJson(prep.attendees),
    hasTranscript: Boolean(deck?.transcript?.trim()),
    goal: deck?.goal ?? null,
    reviewedAt: deck?.reviewed_at ?? null,
    reviewGoalMark: review?.goal?.mark ?? null,
    reviewRubricAverage: review?.rubric_average ?? null,
    runInLive: Boolean(deck?.run_ended_at),
  };
}

function heldRowFromOrphanDeck(row: DeckRow): HeldMeetingRow {
  const review = parseReview(row.review);
  const startsAt = row.run_ended_at || row.transcript_fetched_at || row.updated_at;
  return {
    key: row.id,
    meetingPrepId: null,
    deckId: row.id,
    title: row.name,
    startsAt,
    attendeeNames: [],
    hasTranscript: Boolean(row.transcript?.trim()),
    goal: row.goal,
    reviewedAt: row.reviewed_at,
    reviewGoalMark: review?.goal?.mark ?? null,
    reviewRubricAverage: review?.rubric_average ?? null,
    runInLive: Boolean(row.run_ended_at),
  };
}

export async function listHeldMeetings(): Promise<ActionResult<{ rows: HeldMeetingRow[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  try {
    const sb = createServiceRoleClient();
    const now = Date.now();
    const fromIso = new Date(now - 10 * 86_400_000).toISOString();
    const nowIso = new Date(now).toISOString();

    const { data: preps, error: prepError } = await sb
      .from("meeting_preps")
      .select("id, title, starts_at, attendees")
      .lt("starts_at", nowIso)
      .gte("starts_at", fromIso)
      .order("starts_at", { ascending: false });
    if (prepError) return { ok: false, error: prepError.message };

    const prepIds = (preps ?? []).map((row) => row.id as string);
    const deckByPrep = new Map<string, DeckRow>();
    if (prepIds.length) {
      const { data: linkedDecks, error: deckError } = await sb
        .from("decks")
        .select(DECK_COLUMNS)
        .eq("kind", "deck")
        .in("meeting_prep_id", prepIds);
      if (deckError) return { ok: false, error: deckError.message };
      for (const row of (linkedDecks ?? []) as DeckRow[]) {
        const prepId = row.meeting_prep_id;
        if (prepId) deckByPrep.set(prepId, row);
      }
    }

    const rows: HeldMeetingRow[] = (preps ?? []).map((prep) =>
      heldRowFromPrep(prep, deckByPrep.get(prep.id as string) ?? null)
    );

    const { data: orphanDecks, error: orphanError } = await sb
      .from("decks")
      .select(DECK_COLUMNS)
      .eq("kind", "deck")
      .is("meeting_prep_id", null)
      .or("run_ended_at.not.is.null,transcript_fetched_at.not.is.null");
    if (orphanError) return { ok: false, error: orphanError.message };

    for (const deck of (orphanDecks ?? []) as DeckRow[]) {
      const sortAt = deck.run_ended_at || deck.transcript_fetched_at;
      if (!sortAt) continue;
      const at = Date.parse(sortAt);
      if (!Number.isFinite(at) || at < Date.parse(fromIso) || at > now) continue;
      rows.push(heldRowFromOrphanDeck(deck));
    }

    rows.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function loadTranscriptFromNote(
  noteId: string,
  source: "granola" | "wispr"
): Promise<{ text: string; complete: boolean } | null> {
  if (source === "granola") {
    const granola = await import("@/lib/integrations/granola");
    const direct = await granola.getGranolaTranscript(noteId);
    let transcript = direct?.text?.trim() || "";
    let complete = direct?.complete ?? true;
    if (!transcript) {
      const listed = await granola.listRecentGranolaNotes({ daysBack: 30, limit: 40 });
      if (listed.ok) {
        const hit = listed.notes.find((n) => n.id === noteId);
        if (hit) {
          const again = await granola.getGranolaTranscript(noteId);
          transcript =
            again?.text?.trim() ||
            extractTranscriptSection(hit.summary ?? undefined) ||
            hit.summary?.trim() ||
            "";
          complete = again?.complete ?? Boolean(transcript);
        }
      }
    }
    if (!transcript) return null;
    const { transcriptHasPagingMarker } = await import("@/lib/integrations/wispr-transcript");
    if (transcriptHasPagingMarker(transcript)) complete = false;
    return { text: transcript, complete };
  }
  const { getWisprTranscript } = await import("@/lib/integrations/wispr");
  const { transcriptHasPagingMarker } = await import("@/lib/integrations/wispr-transcript");
  const direct = await getWisprTranscript(noteId);
  if (direct?.text?.trim()) {
    return {
      text: direct.text.trim(),
      complete: direct.complete && !transcriptHasPagingMarker(direct.text),
    };
  }
  // Fallback: list recent notes (already paged when includeTranscript is set).
  const { listRecentWisprNotes } = await import("@/lib/integrations/wispr");
  const listed = await listRecentWisprNotes({
    daysBack: 30,
    limit: 40,
    includeTranscript: true,
  });
  if (!listed.ok) return null;
  const hit = listed.notes.find((n) => n.id === noteId);
  const transcript =
    hit?.transcript?.trim() ||
    extractTranscriptSection(hit?.summary ?? undefined) ||
    hit?.summary?.trim() ||
    "";
  if (!transcript) return null;
  return {
    text: transcript,
    complete: !transcriptHasPagingMarker(transcript),
  };
}

function transcriptMeta(text: string, complete: boolean) {
  return {
    transcript: text,
    transcript_chars: text.length,
    transcript_complete: complete,
  };
}

export async function attachTranscript(input: {
  meetingPrepId?: string | null;
  deckId?: string | null;
  noteId: string;
  source: "granola" | "wispr";
  name?: string | null;
  clearReview?: boolean;
}): Promise<ActionResult<{ deckId: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const noteId = input.noteId.trim();
  const source = input.source;
  const prepId = input.meetingPrepId?.trim() || null;
  const deckIdInput = input.deckId?.trim() || null;
  const orphanName = input.name?.trim().slice(0, 200) || null;

  if (!noteId) return { ok: false, error: "Pick a transcript." };
  if (source !== "granola" && source !== "wispr") {
    return { ok: false, error: "Unknown transcript source." };
  }
  if (prepId && deckIdInput) {
    return { ok: false, error: "Pass a meeting or a deck, not both." };
  }
  if (!prepId && !deckIdInput && !orphanName) {
    return { ok: false, error: "Write a name for this review." };
  }

  try {
    const loadedTranscript = await loadTranscriptFromNote(noteId, source);
    if (!loadedTranscript?.text) return { ok: false, error: "Could not read that transcript." };
    const transcript = loadedTranscript.text;
    const complete = loadedTranscript.complete;

    const sb = createServiceRoleClient();
    let deckRow: DeckRow | null = null;
    let prepIdForRevalidate: string | null = prepId;

    if (deckIdInput) {
      const { data, error } = await sb.from("decks").select(DECK_COLUMNS).eq("id", deckIdInput).maybeSingle();
      if (error) return { ok: false, error: error.message };
      if (!data || asKind(data.kind as string) !== "deck") {
        return { ok: false, error: "Deck not found." };
      }
      deckRow = data as DeckRow;
      prepIdForRevalidate = deckRow.meeting_prep_id;
    } else if (prepId) {
      const { data: existing } = await sb
        .from("decks")
        .select(DECK_COLUMNS)
        .eq("kind", "deck")
        .eq("meeting_prep_id", prepId)
        .maybeSingle();
      if (existing) {
        deckRow = existing as DeckRow;
      } else {
        const { getMeetingPrep } = await loadMeetingPrep();
        const prepResult = await getMeetingPrep(prepId);
        if (!prepResult.ok) return { ok: false, error: prepResult.error };
        const title = prepResult.prep.title.trim().slice(0, 200) || "Meeting";
        const rubric = await loadDefaultRubricLines(sb);
        const { data: created, error: createError } = await sb
          .from("decks")
          .insert({
            kind: "deck",
            name: title,
            goal: null,
            rubric,
            rubric_source: "default",
            meeting_prep_id: prepId,
          })
          .select(DECK_COLUMNS)
          .single();
        if (createError || !created) {
          return { ok: false, error: createError?.message || "Could not create deck." };
        }
        deckRow = created as DeckRow;
      }
    } else {
      const rubric = await loadDefaultRubricLines(sb);
      const { data: created, error: createError } = await sb
        .from("decks")
        .insert({
          kind: "deck",
          name: orphanName!,
          goal: null,
          rubric,
          rubric_source: "default",
          meeting_prep_id: null,
        })
        .select(DECK_COLUMNS)
        .single();
      if (createError || !created) {
        return { ok: false, error: createError?.message || "Could not create deck." };
      }
      deckRow = created as DeckRow;
      prepIdForRevalidate = null;
    }

    const fetchedAt = new Date().toISOString();
    const update: Record<string, unknown> = {
      ...transcriptMeta(transcript, complete),
      transcript_source: source,
      transcript_note_id: noteId,
      transcript_fetched_at: fetchedAt,
      updated_at: fetchedAt,
    };
    if (Boolean(deckRow.reviewed_at) && input.clearReview === true) {
      update.review = null;
      update.reviewed_at = null;
    }

    const { error: saveError } = await sb.from("decks").update(update).eq("id", deckRow.id);
    if (saveError) return { ok: false, error: saveError.message };

    revalidateDeck(deckRow.id, "deck", prepIdForRevalidate);
    return { ok: true, deckId: deckRow.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listRecentNotesForAttach(
  days = 10
): Promise<ActionResult<{ notes: AttachableNote[]; warnings: string[] }>> {
  const warnings: string[] = [];
  const notes: AttachableNote[] = [];
  const daysBack = Math.max(1, Math.min(45, days));
  try {
    const { listRecentGranolaNotes } = await import("@/lib/integrations/granola");
    const granola = await listRecentGranolaNotes({ daysBack, limit: 40 });
    if (!granola.ok) warnings.push("Could not reach Granola.");
    else {
      for (const note of granola.notes) {
        notes.push({
          id: note.id,
          title: note.title,
          at: note.scheduledStart || note.createdAt,
          source: "granola",
        });
      }
    }
  } catch {
    warnings.push("Could not reach Granola.");
  }
  try {
    const { listRecentWisprNotes } = await import("@/lib/integrations/wispr");
    const wispr = await listRecentWisprNotes({ daysBack, limit: 25 });
    if (!wispr.ok) warnings.push("Could not reach Wispr.");
    else {
      for (const note of wispr.notes) {
        notes.push({
          id: note.id,
          title: note.title,
          at: note.scheduledStart || note.createdAt,
          source: "wispr",
        });
      }
    }
  } catch {
    warnings.push("Could not reach Wispr.");
  }
  notes.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { ok: true, notes, warnings };
}

export async function suggestNoteForMeeting(
  meetingPrepId: string
): Promise<ActionResult<{ note: AttachableNote | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const prepId = meetingPrepId.trim();
  if (!prepId) return { ok: false, error: "Meeting not found." };
  try {
    const { getMeetingPrep } = await loadMeetingPrep();
    const prepResult = await getMeetingPrep(prepId);
    if (!prepResult.ok) return { ok: false, error: prepResult.error };
    const prep = prepResult.prep;
    const focus = await focusAttendee(prep.attendees);
    const emails = prep.attendees.map((row) => row.email).filter(Boolean);
    const query = {
      name: focus.name,
      email: focus.email,
      emails,
      aroundIso: prep.startsAt,
      calendarEventId: prep.gcalEventId,
      calendarEventIds: [prep.gcalEventId, prep.icalUid].filter(Boolean) as string[],
      meetingTitle: prep.title,
    };

    const candidates: import("@/lib/integrations/granola-match").GranolaNoteCandidate[] = [];
    const { listRecentGranolaNotes } = await import("@/lib/integrations/granola");
    const granola = await listRecentGranolaNotes({ daysBack: 10, limit: 40 });
    if (granola.ok) {
      for (const note of granola.notes) {
        candidates.push({
          id: note.id,
          title: note.title,
          createdAt: note.createdAt,
          summaryText: note.summary,
          attendeeEmails: note.attendeeEmails,
          attendeeNames: note.attendeeNames,
          calendarEventId: note.calendarEventId,
          scheduledStart: note.scheduledStart,
        });
      }
    }
    const { listRecentWisprNotes } = await import("@/lib/integrations/wispr");
    const wispr = await listRecentWisprNotes({ daysBack: 10, limit: 25 });
    if (wispr.ok) {
      for (const note of wispr.notes) {
        candidates.push({
          id: note.id,
          title: note.title,
          createdAt: note.createdAt,
          summaryText: note.summary,
          attendeeEmails: note.attendeeEmails,
          attendeeNames: note.attendeeNames,
          calendarEventId: note.calendarEventId,
          scheduledStart: note.scheduledStart,
        });
      }
    }

    const granolaIds = new Set(granola.ok ? granola.notes.map((n) => n.id) : []);
    const wisprIds = new Set(wispr.ok ? wispr.notes.map((n) => n.id) : []);

    const { pickGranolaNote } = await import("@/lib/integrations/granola-match");
    const picked = pickGranolaNote(candidates, query);
    if (!picked) return { ok: true, note: null };

    const listed = await listRecentNotesForAttach(10);
    const hit = listed.ok ? listed.notes.find((n) => n.id === picked.id) : null;
    if (hit) return { ok: true, note: hit };

    const source: "granola" | "wispr" = granolaIds.has(picked.id)
      ? "granola"
      : wisprIds.has(picked.id)
        ? "wispr"
        : "granola";

    return {
      ok: true,
      note: {
        id: picked.id,
        title: picked.title?.trim() || "Untitled",
        at: picked.scheduledStart || picked.createdAt,
        source,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createPlaybook(name?: string): Promise<ActionResult<{ id: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const label = (name?.trim() || "New Playbook").slice(0, 200);
  try {
    const sb = createServiceRoleClient();
    const rubric = await loadDefaultRubricLines(sb);
    const { data, error } = await sb
      .from("decks")
      .insert({ kind: "playbook", name: label, rubric, rubric_source: "default" })
      .select("id, kind")
      .single();
    if (error || !data?.id) return { ok: false, error: error?.message || "Could not create playbook." };
    const id = data.id as string;
    await sb.from("slides").insert({
      deck_id: id,
      position: 1,
      headline: "Opening",
      bullets: toJsonBullets(["What you want from this conversation."]),
    });
    revalidateDeck(id, "playbook");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createBlankDeck(
  name?: string,
  meetingPrepId?: string | null
): Promise<ActionResult<{ id: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const label = (name?.trim() || "Untitled deck").slice(0, 200);
  const prepId = meetingPrepId?.trim() || null;
  try {
    const sb = createServiceRoleClient();
    if (prepId) {
      const existing = await sb
        .from("decks")
        .select("id")
        .eq("kind", "deck")
        .eq("meeting_prep_id", prepId)
        .maybeSingle();
      if (existing.data?.id) return { ok: false, error: "This meeting already has a deck." };
    }
    const rubric = await loadDefaultRubricLines(sb);
    const { data, error } = await sb
      .from("decks")
      .insert({
        kind: "deck",
        name: label,
        meeting_prep_id: prepId,
        rubric,
        rubric_source: "default",
      })
      .select("id, kind")
      .single();
    if (error || !data?.id) return { ok: false, error: error?.message || "Could not create deck." };
    const id = data.id as string;
    await sb.from("slides").insert({
      deck_id: id,
      position: 1,
      headline: "Opening",
      bullets: toJsonBullets([]),
    });
    revalidateDeck(id, "deck", prepId);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createDeckFromPlaybook(
  playbookId: string,
  meetingPrepId?: string | null,
  name?: string | null
): Promise<ActionResult<{ id: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sourceId = playbookId.trim();
  if (!sourceId) return { ok: false, error: "Playbook not found." };
  const prepId = meetingPrepId?.trim() || null;
  try {
    const sb = createServiceRoleClient();
    const { data: source, error: sourceError } = await sb
      .from("decks")
      .select(DECK_COLUMNS)
      .eq("id", sourceId)
      .eq("kind", "playbook")
      .maybeSingle();
    if (sourceError) return { ok: false, error: sourceError.message };
    if (!source) return { ok: false, error: "Playbook not found." };
    const sourceRow = source as DeckRow;

    let deckName = name?.trim() || sourceRow.name;
    if (prepId) {
      const existing = await sb
        .from("decks")
        .select("id")
        .eq("kind", "deck")
        .eq("meeting_prep_id", prepId)
        .maybeSingle();
      if (existing.data?.id) {
        return { ok: false, error: "This meeting already has a deck." };
      }
      if (!name?.trim()) {
        const { getMeetingPrep } = await loadMeetingPrep();
        const prep = await getMeetingPrep(prepId);
        if (prep.ok && prep.prep.title.trim()) deckName = prep.prep.title.trim();
      }
    }

    const sourceSlides = await loadSlides(sb, sourceId);
    const playbookRubric = parseRubricFromJson(sourceRow.rubric);
    const rubric =
      playbookRubric.length > 0 ? playbookRubric : await loadDefaultRubricLines(sb);
    const rubric_source =
      sourceRow.rubric_source?.trim() ||
      (playbookRubric.length > 0 ? sourceRow.name : "default");
    const { data: created, error: createError } = await sb
      .from("decks")
      .insert({
        kind: "deck",
        name: deckName.slice(0, 200),
        description: sourceRow.description,
        goal: sourceRow.goal?.trim() || null,
        rubric,
        rubric_source,
        source_playbook_id: sourceId,
        meeting_prep_id: prepId,
      })
      .select("id")
      .single();
    if (createError || !created?.id) {
      return { ok: false, error: createError?.message || "Could not create deck." };
    }
    const newId = created.id as string;
    if (sourceSlides.length) {
      const { error: slideError } = await sb.from("slides").insert(
        sourceSlides.map((slide, index) => ({
          deck_id: newId,
          position: index + 1,
          headline: slide.headline,
          bullets: toJsonBullets(slide.bullets),
        }))
      );
      if (slideError) return { ok: false, error: slideError.message };
    } else {
      await sb.from("slides").insert({
        deck_id: newId,
        position: 1,
        headline: "Opening",
        bullets: toJsonBullets([]),
      });
    }
    revalidateDeck(newId, "deck", prepId);
    return { ok: true, id: newId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function renameDeck(deckId: string, name: string): Promise<ActionResult<{ name: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const label = name.trim().slice(0, 200);
  if (!label) return { ok: false, error: "Write a name." };
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .update({ name: label, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, kind, meeting_prep_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    revalidateDeck(id, asKind(data.kind as string), data.meeting_prep_id as string | null);
    return { ok: true, name: label };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteDeck(deckId: string): Promise<ActionResult<object>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .select("id, kind, meeting_prep_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    const { error: delError } = await sb.from("decks").delete().eq("id", id);
    if (delError) return { ok: false, error: delError.message };
    revalidateDeck(id, asKind(data.kind as string), data.meeting_prep_id as string | null);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setDeckSlides(
  deckId: string,
  slides: SlideInput[]
): Promise<ActionResult<{ count: number }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const normalized = normalizeSlideInputs(slides);
  if (!normalized.ok) return { ok: false, error: normalized.error };
  try {
    const sb = createServiceRoleClient();
    const { data: deck, error: deckError } = await sb
      .from("decks")
      .select("id, kind, meeting_prep_id")
      .eq("id", id)
      .maybeSingle();
    if (deckError) return { ok: false, error: deckError.message };
    if (!deck) return { ok: false, error: "Not found." };

    const { error: delError } = await sb.from("slides").delete().eq("deck_id", id);
    if (delError) return { ok: false, error: delError.message };

    if (normalized.value.length) {
      const { error: insError } = await sb.from("slides").insert(
        normalized.value.map((slide, index) => ({
          deck_id: id,
          position: index + 1,
          headline: slide.headline,
          bullets: toJsonBullets(slide.bullets),
        }))
      );
      if (insError) return { ok: false, error: insError.message };
    }

    await sb.from("decks").update({ updated_at: new Date().toISOString() }).eq("id", id);
    revalidateDeck(id, asKind(deck.kind as string), deck.meeting_prep_id as string | null);
    return { ok: true, count: normalized.value.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function startRun(deckId: string): Promise<ActionResult<{ startedAt: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const startedAt = new Date().toISOString();
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .update({ run_started_at: startedAt, run_ended_at: null, updated_at: startedAt })
      .eq("id", id)
      .eq("kind", "deck")
      .select("id, meeting_prep_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Slides not found." };
    revalidateDeck(id, "deck", data.meeting_prep_id as string | null);
    return { ok: true, startedAt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function endRun(deckId: string): Promise<ActionResult<{ endedAt: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const endedAt = new Date().toISOString();
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .update({ run_ended_at: endedAt, updated_at: endedAt })
      .eq("id", id)
      .eq("kind", "deck")
      .select("id, meeting_prep_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Slides not found." };
    revalidateDeck(id, "deck", data.meeting_prep_id as string | null);
    return { ok: true, endedAt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchTranscript(
  deckId: string
): Promise<
  ActionResult<{
    transcript: string | null;
    source: "granola" | "wispr" | null;
    noteId: string | null;
  }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const loaded = await getDeck(id);
    if (!loaded.ok) return loaded;
    const deck = loaded.deck;
    if (deck.kind !== "deck") return { ok: false, error: "Transcripts are for decks only." };
    if (!deck.meetingPrepId) return { ok: false, error: "These Slides are not linked to a meeting." };

    const { getMeetingPrep } = await loadMeetingPrep();
    const prepResult = await getMeetingPrep(deck.meetingPrepId);
    if (!prepResult.ok) return { ok: false, error: prepResult.error };
    const prep = prepResult.prep;
    const focus = await focusAttendee(prep.attendees);
    const emails = prep.attendees.map((row) => row.email).filter(Boolean);
    const searchBase = {
      contactName: focus.name,
      email: focus.email,
      emails,
      aroundIso: prep.startsAt,
      calendarEventId: prep.gcalEventId,
      calendarEventIds: [prep.gcalEventId, prep.icalUid].filter(Boolean) as string[],
      meetingTitle: prep.title,
      includeTranscript: true,
    };

    let transcript: string | null = null;
    let source: "granola" | "wispr" | null = null;
    let noteId: string | null = null;
    let complete = true;
    const { transcriptHasPagingMarker } = await import("@/lib/integrations/wispr-transcript");

    const { getGranolaTranscript, searchGranolaForContact } = await import("@/lib/integrations/granola");
    const granola = await searchGranolaForContact(searchBase);
    if (granola.found && granola.meetings?.[0]?.id) {
      noteId = granola.meetings[0].id;
      const direct = await getGranolaTranscript(noteId);
      transcript = direct?.text?.trim() || extractTranscriptSection(granola.summary) || null;
      complete = direct?.complete ?? Boolean(transcript);
      if (transcript) source = "granola";
    }

    if (!transcript) {
      const { searchWisprForContact, getWisprTranscript } = await import(
        "@/lib/integrations/wispr"
      );
      const wispr = await searchWisprForContact(searchBase);
      if (wispr.found) {
        noteId = wispr.meetingId ?? null;
        if (noteId) {
          const paged = await getWisprTranscript(noteId);
          transcript = paged?.text?.trim() || null;
          complete = paged?.complete ?? false;
        }
        if (!transcript && wispr.summary?.trim()) {
          transcript = extractTranscriptSection(wispr.summary) || wispr.summary.trim();
          complete = !transcriptHasPagingMarker(transcript);
        }
        if (transcript) source = "wispr";
      }
    }

    if (transcript && transcriptHasPagingMarker(transcript)) complete = false;

    const fetchedAt = new Date().toISOString();
    const sb = createServiceRoleClient();
    await sb
      .from("decks")
      .update({
        ...(transcript
          ? transcriptMeta(transcript, complete)
          : { transcript: null, transcript_chars: null, transcript_complete: null }),
        transcript_source: source,
        transcript_note_id: noteId,
        transcript_fetched_at: fetchedAt,
        updated_at: fetchedAt,
      })
      .eq("id", id);

    revalidateDeck(id, "deck", deck.meetingPrepId);
    return { ok: true, transcript, source, noteId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getPersonContextPreview(
  contactId: string
): Promise<
  ActionResult<{
    contactId: string;
    name: string;
    found: string[];
    missing: string[];
    line: string;
  }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = contactId.trim();
  if (!id) return { ok: false, error: "Contact required." };
  try {
    const { buildPersonContext, formatFoundMissingLine } = await import(
      "@/lib/live/person-context"
    );
    const ctx = await buildPersonContext(id);
    return {
      ok: true,
      contactId: ctx.contactId,
      name: ctx.name,
      found: ctx.sections.map((row) => row.label),
      missing: ctx.missing,
      line: formatFoundMissingLine(ctx),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runAiHelp(
  deckId: string,
  input: {
    instructions?: string;
    mode?: AiHelpMode;
    sources?: AiHelpSources;
    preset?: "why" | "rapport" | "what_how" | "tailor" | null;
  }
): Promise<ActionResult<{ slideCount: number; warnings: string[]; at: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const { getAiHelpPreset } = await import("@/lib/live/ai-help-presets");
  const preset = getAiHelpPreset(input.preset ?? null);
  const instructions = (preset?.instructions ?? input.instructions ?? "").trim();
  if (!instructions) return { ok: false, error: "Write what you want help with." };
  const mode: AiHelpMode = preset
    ? preset.mode
    : input.mode === "replace"
      ? "replace"
      : "add";
  const sources = input.sources ?? {};

  try {
    const loaded = await getDeck(id);
    if (!loaded.ok) return loaded;
    const deck = loaded.deck;

    const contextParts: string[] = [];
    const sourceLabels: string[] = [];
    const warnings: string[] = [];
    const sb = createServiceRoleClient();

    const peopleIdSet = new Set(
      (sources.people ?? []).map((row) => row.trim()).filter(Boolean)
    );
    const prepId = deck.meetingPrepId;
    if (prepId) {
      try {
        const matched = await resolveMeetingContactIds(sb, prepId);
        for (const contactId of matched) peopleIdSet.add(contactId);
      } catch (err) {
        warnings.push(
          `Meeting people: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    const peopleIds = [...peopleIdSet];
    if (peopleIds.length) {
      sourceLabels.push("People");
      try {
        const { buildPersonContext } = await import("@/lib/live/person-context");
        const chunks: string[] = [];
        for (const contactId of peopleIds) {
          const ctx = await buildPersonContext(contactId);
          if (ctx.text.trim()) chunks.push(ctx.text);
        }
        if (chunks.length) contextParts.push(chunks.join("\n\n"));
      } catch (err) {
        warnings.push(`People: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const playbookId = sources.playbookId?.trim() || null;
    if (playbookId) {
      sourceLabels.push("Playbook");
      try {
        const { data, error } = await sb
          .from("decks")
          .select("id, name, goal, kind")
          .eq("id", playbookId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data || data.kind !== "playbook") throw new Error("Playbook not found.");
        const pbSlides = await loadSlides(sb, playbookId);
        contextParts.push(
          `Playbook reference (do not copy verbatim — use as structure/ideas only):\nName: ${String(data.name)}\nGoal: ${String(data.goal ?? "").trim() || "(none)"}\nSlides:\n${JSON.stringify(
            pbSlides.map((slide) => ({ headline: slide.headline, bullets: slide.bullets })),
            null,
            2
          )}`
        );
      } catch (err) {
        warnings.push(`Playbook: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const openText = sources.openText?.trim();
    if (openText) {
      sourceLabels.push("Notes");
      contextParts.push(`Open notes from Jason:\n${openText}`);
    }

    const transcriptDeckIds = (sources.transcriptDeckIds ?? [])
      .map((row) => row.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (transcriptDeckIds.length) {
      sourceLabels.push("Transcripts");
      try {
        const { data, error } = await sb
          .from("decks")
          .select("id, name, transcript")
          .in("id", transcriptDeckIds);
        if (error) throw new Error(error.message);
        const chunks: string[] = [];
        for (const row of data ?? []) {
          const text = (row.transcript as string | null)?.trim();
          if (!text) continue;
          chunks.push(
            `Deck: ${String(row.name)}\n${capWords(text, 6000)}`
          );
        }
        if (chunks.length) contextParts.push(`Past call transcripts:\n${chunks.join("\n\n---\n\n")}`);
      } catch (err) {
        warnings.push(`Transcripts: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const meetingFlags = sources.meeting;
    if (prepId && meetingFlags && (meetingFlags.calendar || meetingFlags.email || meetingFlags.website)) {
      try {
        const { getMeetingPrep } = await loadMeetingPrep();
        const prepResult = await getMeetingPrep(prepId);
        if (!prepResult.ok) throw new Error(prepResult.error);
        const prep = prepResult.prep;
        const focus = await focusAttendee(prep.attendees);

        if (meetingFlags.calendar) {
          sourceLabels.push("Meeting calendar");
          contextParts.push(
            `Linked meeting:\nTitle: ${prep.title}\nWhen: ${prep.startsAt}\nPurpose: ${prep.purpose?.trim() || "(none)"}\nPrimary: ${focus.name}${focus.company ? ` (${focus.company})` : ""}`
          );
        }

        if (meetingFlags.email) {
          sourceLabels.push("Meeting email");
          const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
          const { searchThreadsByParticipants } = await import("@/lib/integrations/gmail");
          const threads = await searchThreadsByParticipants({
            addresses: focus.email ? [focus.email] : emailsFromAttendees(prep.attendees),
            domains: domainFromEmail(focus.email),
            since,
          });
          const mailText = formatMailContext(threads, 4000);
          if (mailText) contextParts.push(`Recent email (90 days):\n${mailText}`);
        }

        if (meetingFlags.website) {
          sourceLabels.push("Meeting website");
          const companyName = focus.company || prep.primaryCompanyName;
          const siteText = await loadCompanySiteText(focus.contactId, companyName);
          if (siteText) contextParts.push(`Company site:\n${siteText}`);
        }
      } catch (err) {
        warnings.push(`Meeting: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const undo = {
      slides: deck.slides.map((slide) => ({ headline: slide.headline, bullets: slide.bullets })),
      aiNotes: deck.aiNotes,
    };

    const { NO_AI_SLOP_WRITING_RULES } = await import("@/lib/ai/no-ai-slop");
    const modeLine =
      mode === "replace"
        ? "Replace mode: return a full new slide deck."
        : "Add mode: keep existing slides unless Jason's instructions say to remove or replace them; you may append slides.";
    const presetScope = preset?.slideScope?.trim()
      ? `\n${preset.slideScope.trim()}`
      : "";

    const system = `You help Jason Kuperman edit Live Slides (spoken headlines + bullets) for an upcoming conversation.
${NO_AI_SLOP_WRITING_RULES}

${modeLine}${presetScope}
Each bullet is one short spoken line (under 14 words). Max 6 bullets per slide. No markdown in slide text.
Facts from context that you cannot verify from the provided sources should be phrased cautiously or omitted.
Person context sections are labelled by source and date. When drafting lines about why this call matters, who referred Jason, or what to raise, use the person context first and quote it in Jason's voice. If a needed fact is not in the context, write the line with the gap in square brackets, for example [what you hope to learn from her], and do not invent it.

Reply with a single JSON array only. No markdown fences. No commentary before or after.
Shape:
[{"headline":"...","bullets":["..."]}]`;

    const user = `Instructions:\n${instructions}

Sources:
${contextParts.join("\n\n") || "(none — use instructions and current slides only)"}

Current slides:
${JSON.stringify(
  deck.slides.map((slide) => ({ headline: slide.headline, bullets: slide.bullets })),
  null,
  2
)}`;

    const { callClaude } = await import("@/lib/ai/models");
    const callModel = async (messages: { role: "user" | "assistant"; content: string }[]) =>
      callClaude({
        model: "claude-sonnet-4-6",
        maxTokens: 6000,
        system,
        messages,
      });

    let raw = await callModel([{ role: "user", content: user }]);
    let parsed = parseAiHelpSlidesJson(raw);
    if (!parsed.ok) {
      raw = await callModel([
        { role: "user", content: user },
        { role: "assistant", content: raw.slice(0, 4000) },
        {
          role: "user",
          content:
            'That reply was not valid JSON. Reply again with ONLY a JSON array of slides — no markdown fences, no prose. Example: [{"headline":"...","bullets":["..."]}]',
        },
      ]);
      parsed = parseAiHelpSlidesJson(raw);
    }
    if (!parsed.ok) return { ok: false, error: parsed.error };

    await sb
      .from("decks")
      .update({
        ai_undo: undo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    const saved = await setDeckSlides(id, parsed.value);
    if (!saved.ok) return saved;

    const at = new Date().toISOString();
    const aiLastRun: AiLastRun = {
      at,
      instructions,
      sources: sourceLabels.length ? sourceLabels : ["Current slides"],
    };
    await sb
      .from("decks")
      .update({
        ai_last_run: aiLastRun,
        updated_at: at,
      })
      .eq("id", id);

    revalidateDeck(id, deck.kind, prepId);
    return { ok: true, slideCount: parsed.value.length, warnings, at };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reviewRun(
  deckId: string,
  options?: { speakerOverrides?: Record<string, string> | null; skipPass1?: boolean }
): Promise<ActionResult<{ review: DeckReview }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const loaded = await getDeck(id);
    if (!loaded.ok) return loaded;
    const deck = loaded.deck;
    if (deck.kind !== "deck") return { ok: false, error: "Review is for decks only." };
    if (!deck.transcript?.trim()) {
      return { ok: false, error: "Fetch a transcript before running review." };
    }

    const { transcriptHasPagingMarker } = await import("@/lib/integrations/wispr-transcript");
    const incomplete =
      deck.transcriptComplete === false || transcriptHasPagingMarker(deck.transcript);
    if (incomplete) {
      return {
        ok: false,
        error: "The transcript is incomplete. Re-attach it, then review.",
      };
    }

    const engine = await import("@/lib/live/review-engine");
    const numbered = engine.numberTranscriptLines(deck.transcript);
    const numberedText = engine.formatNumberedTranscript(numbered);
    const coverage = engine.coverageMinutes(
      deck.transcript.length,
      deck.runStartedAt,
      deck.runEndedAt
    );
    let coverageWarning: string | null = null;
    if (coverage && coverage.ratio < 0.6) {
      coverageWarning = `The transcript covers about ${coverage.coveredMinutes} of the ${coverage.recordedMinutes} minutes recorded. Scores may be low for the part not covered.`;
    }

    let attendeesText = "(no meeting attached)";
    if (deck.meetingPrepId) {
      const { getMeetingPrep } = await loadMeetingPrep();
      const prepResult = await getMeetingPrep(deck.meetingPrepId);
      if (prepResult.ok) {
        attendeesText = prepResult.prep.attendees
          .map((row) => `${row.name || "(no name)"}${row.email ? ` <${row.email}>` : ""}`)
          .join("\n");
      }
    }

    let playbookName: string | null = null;
    if (deck.sourcePlaybookId) {
      const sb = createServiceRoleClient();
      const { data: pb } = await sb
        .from("decks")
        .select("name")
        .eq("id", deck.sourcePlaybookId)
        .maybeSingle();
      playbookName = typeof pb?.name === "string" ? pb.name : null;
    }
    const rubricSourceLabel =
      deck.rubricSource === "default"
        ? "Default (Browning networking)"
        : deck.rubricSource || playbookName || "custom";

    const { callClaude } = await import("@/lib/ai/models");
    const { NO_AI_SLOP_WRITING_RULES } = await import("@/lib/ai/no-ai-slop");

    let layout: import("@/lib/live/review-engine").Pass1Layout | null = null;
    if (options?.skipPass1 && options.speakerOverrides && deck.review?.speakers) {
      const speakers = { ...deck.review.speakers, ...options.speakerOverrides };
      let jasonSpeaker = deck.review.jason_speaker ?? null;
      for (const [label, name] of Object.entries(speakers)) {
        if (/jason|kupe/i.test(name)) {
          jasonSpeaker = label;
          break;
        }
      }
      layout = {
        speakers,
        jason_speaker: jasonSpeaker,
        segments: deck.review.segments ?? [],
        talk_share: engine.computeTalkShare(numbered, jasonSpeaker),
      };
    } else {
      const pass1System = `Identify speakers and lay out Jason Kuperman's call.
${NO_AI_SLOP_WRITING_RULES}
Jason Kuperman is the user. Others may address him as Jason or Kupe.
Critical: when a line is "Speaker N: Hi, Ian", Speaker N is greeting Ian — Speaker N is NOT Ian. The name in a greeting is the other person.
Decide who Jason is from greetings, how speakers address each other, and from what he says about himself; when unsure, say "unknown" and never guess from position.
Return JSON only:
{
  "speakers": { "Speaker 1": "Jason Kuperman", "Speaker 2": "Name", "Speaker 3": "unknown" },
  "jason_speaker": "Speaker 1",
  "segments": [{ "from_line": 1, "to_line": 40, "topic": "...", "who_led": "Jason" }]
}
Do not invent talk_share — that is computed in code.`;
      const pass1User = `Meeting attendees:
${attendeesText}

Numbered transcript:
${numberedText}`;
      let pass1Raw = await callClaude({
        model: "claude-sonnet-4-6",
        maxTokens: 4000,
        system: pass1System,
        messages: [{ role: "user", content: pass1User }],
      });
      layout = engine.parsePass1Layout(pass1Raw, numbered);
      if (!layout) {
        pass1Raw = await callClaude({
          model: "claude-sonnet-4-6",
          maxTokens: 4000,
          system: pass1System,
          messages: [
            { role: "user", content: pass1User },
            { role: "assistant", content: pass1Raw.slice(0, 3000) },
            {
              role: "user",
              content: "That was not valid JSON. Reply with ONLY the speakers/segments JSON object.",
            },
          ],
        });
        layout = engine.parsePass1Layout(pass1Raw, numbered);
      }
      if (!layout) {
        return { ok: false, error: "Could not identify speakers for this transcript." };
      }
      if (options?.speakerOverrides) {
        layout.speakers = { ...layout.speakers, ...options.speakerOverrides };
        let jasonSpeaker = layout.jason_speaker;
        for (const [label, name] of Object.entries(layout.speakers)) {
          if (/jason|kupe/i.test(name)) {
            jasonSpeaker = label;
            break;
          }
        }
        layout.jason_speaker = jasonSpeaker;
        layout.talk_share = engine.computeTalkShare(numbered, jasonSpeaker);
      }
    }

    const slideIds = deck.slides.map((slide) => slide.id);
    const slidePayload = deck.slides.map((slide) => ({
      slide_id: slide.id,
      position: slide.position,
      headline: slide.headline,
      bullets: slide.bullets,
    }));
    const rubricLines = deck.rubric;
    const mentionItems = [
      ...deck.slides.map((slide, index) => ({
        label: `Slide ${index + 1}`,
        text: `${slide.headline}\n${slide.bullets.join("\n")}`,
      })),
      ...rubricLines.map((line, index) => ({
        label: `Rubric ${index + 1}`,
        text: line,
      })),
    ];
    const mentions = engine.buildMentionsIndex(numbered, mentionItems);
    const mentionsText = engine.formatMentionsIndex(mentions);

    const pass2System = `You review how Jason Kuperman's live call matched his slide deck, goal, and rubric.
${NO_AI_SLOP_WRITING_RULES}

Use jason_speaker to decide who said what. Rubric lines about what Jason did are judged on Jason's lines only.
Every evidence field and every rubric note must end with the line numbers it relies on, as [L212-L215]. Evidence is a verbatim quote of at most 30 words from those lines.
Score the whole call. Do not write "visible transcript", "truncated", or "not reached" in any note; if the transcript seems to end early, say so once in a caveat field and score what is there.
Mark a rubric line na when it describes a kind of call this one is not (for example asking for networking contacts or recruiters on a client discovery / pitch call). The playbook name and the slides tell you the kind of call. Use na instead of a 1 whenever the line does not apply.
For negative rubric lines (for example "Did not ask for a job"), score 5 when Jason complied and 1 only when he broke the rule.
A slide or rubric line may be marked skipped, scored 1, or "not mentioned" only if the mentions index shows none of its terms were found; when a term was found, the note must cite the line and must not treat the slide as skipped.
committed must list every promise Jason made, including sending a document, a proposal, pricing, an introduction, or a date, each with the line number. Prefer over-listing to missing a promise.
goal: judge against the exact goal line; if the goal names a decision the other person had to make, quote where they made it or say they did not, with line numbers.

If there are slides, mark every slide covered|partly|skipped. If none, return "slides": [].
Return JSON only:
{
  "slides": [{"slide_id":"uuid","mark":"covered|partly|skipped","evidence":"... [L12]"}],
  "goal": {"mark":"hit|partly|missed","evidence":"... [L12]"} or null,
  "said": ["..."],
  "committed": ["... [L12]"],
  "next_time": ["..."],
  "rubric": [{"line":"...","score":1,"note":"... [L12]","na":false}],
  "caveat": ""
}
Use the exact slide_id values provided when slides exist.`;

    const pass2User = `Playbook / rubric source: ${rubricSourceLabel}
Goal: ${deck.goal?.trim() || "(none)"}

Pass 1 speakers and layout:
${JSON.stringify(layout, null, 2)}

Mentions index:
${mentionsText}

Slides:
${JSON.stringify(slidePayload, null, 2)}

Rubric lines (score in this order):
${JSON.stringify(rubricLines, null, 2)}

Numbered transcript:
${numberedText}`;

    const callPass2 = async (extra?: string) =>
      callClaude({
        model: "claude-sonnet-4-6",
        maxTokens: 10_000,
        system: pass2System,
        messages: [
          { role: "user", content: pass2User },
          ...(extra
            ? ([
                {
                  role: "user" as const,
                  content: extra,
                },
              ] as const)
            : []),
        ],
      });

    let raw = await callPass2();
    let parsed = parseReviewJson(raw, slideIds, rubricLines);
    if (!parsed.ok) {
      raw = await callPass2(
        "That reply was not valid JSON. Reply again with ONLY the review JSON object."
      );
      parsed = parseReviewJson(raw, slideIds, rubricLines);
    }
    if (!parsed.ok) return { ok: false, error: parsed.error };

    // Validate evidence quotes and line refs; flag mismatches with mentions.
    const maxLine = numbered.length;
    const transcriptText = deck.transcript;
    const mentionByLabel = new Map(mentions.map((entry) => [entry.label, entry]));

    const validateEvidence = (evidence: string): { evidence: string; unverified: boolean } => {
      let cleaned = engine.stripInvalidLineRefs(evidence, maxLine);
      const quote = cleaned.replace(/\[L\d+(?:\s*[-–]\s*L?\d+)?\]/gi, "").trim();
      if (quote && !engine.quoteInTranscript(quote, transcriptText)) {
        return { evidence: engine.stripInvalidLineRefs(cleaned.replace(quote, "").trim(), maxLine), unverified: true };
      }
      return { evidence: cleaned, unverified: false };
    };

    for (const row of parsed.value.slides) {
      const checked = validateEvidence(row.evidence);
      row.evidence = checked.evidence;
      (row as { evidence_unverified?: boolean }).evidence_unverified = checked.unverified;
    }
    if (parsed.value.goal) {
      const checked = validateEvidence(parsed.value.goal.evidence);
      parsed.value.goal.evidence = checked.evidence;
      (parsed.value.goal as { evidence_unverified?: boolean }).evidence_unverified =
        checked.unverified;
    }
    for (const row of parsed.value.rubric) {
      const checked = validateEvidence(row.note);
      row.note = checked.evidence;
      (row as { evidence_unverified?: boolean }).evidence_unverified = checked.unverified;
    }
    parsed.value.committed = parsed.value.committed.map((line) =>
      engine.stripInvalidLineRefs(line, maxLine)
    );
    parsed.value.said = parsed.value.said.map((line) =>
      engine.stripInvalidLineRefs(line, maxLine)
    );
    parsed.value.next_time = parsed.value.next_time.map((line) =>
      engine.stripInvalidLineRefs(line, maxLine)
    );

    // Re-ask once for skipped/1 rows that have mention hits.
    const conflicts: string[] = [];
    for (let index = 0; index < parsed.value.slides.length; index += 1) {
      const row = parsed.value.slides[index]!;
      const entry = mentionByLabel.get(`Slide ${index + 1}`);
      if (row.mark === "skipped" && entry && entry.found.length) {
        const quotes = entry.found
          .flatMap((hit) =>
            hit.lines.slice(0, 3).map((n) => {
              const line = numbered.find((item) => item.n === n);
              return line ? `[L${n}] ${line.raw}` : `[L${n}]`;
            })
          )
          .join("\n");
        conflicts.push(
          `Slide ${index + 1} (${deck.slides[index]?.headline}) was marked skipped but terms were found:\n${quotes}`
        );
      }
    }
    for (let index = 0; index < parsed.value.rubric.length; index += 1) {
      const row = parsed.value.rubric[index]!;
      const entry = mentionByLabel.get(`Rubric ${index + 1}`);
      if (!row.na && row.score === 1 && entry && entry.found.length) {
        const quotes = entry.found
          .flatMap((hit) =>
            hit.lines.slice(0, 3).map((n) => {
              const line = numbered.find((item) => item.n === n);
              return line ? `[L${n}] ${line.raw}` : `[L${n}]`;
            })
          )
          .join("\n");
        conflicts.push(
          `Rubric ${index + 1} ("${row.line}") scored 1 but terms were found:\n${quotes}`
        );
      }
    }
    if (conflicts.length) {
      const repairRaw = await callPass2(
        `Re-score ONLY these conflicting rows. Keep every other row identical. Found lines:\n\n${conflicts.join(
          "\n\n"
        )}\n\nReturn the full review JSON again.`
      );
      const repaired = parseReviewJson(repairRaw, slideIds, rubricLines);
      if (repaired.ok) {
        parsed = repaired;
        for (const row of parsed.value.slides) {
          const checked = validateEvidence(row.evidence);
          row.evidence = checked.evidence;
          (row as { evidence_unverified?: boolean }).evidence_unverified = checked.unverified;
        }
        if (parsed.value.goal) {
          const checked = validateEvidence(parsed.value.goal.evidence);
          parsed.value.goal.evidence = checked.evidence;
          (parsed.value.goal as { evidence_unverified?: boolean }).evidence_unverified =
            checked.unverified;
        }
        for (const row of parsed.value.rubric) {
          const checked = validateEvidence(row.note);
          row.note = checked.evidence;
          (row as { evidence_unverified?: boolean }).evidence_unverified = checked.unverified;
        }
      }
    }

    const caveatValue = extractJsonValue(raw);
    const caveat =
      caveatValue &&
      typeof caveatValue === "object" &&
      typeof (caveatValue as { caveat?: unknown }).caveat === "string"
        ? String((caveatValue as { caveat: string }).caveat).trim() || null
        : null;

    const review: DeckReview = {
      ...parsed.value,
      model: "claude-sonnet-4-6",
      transcript_source: deck.transcriptSource,
      rubric_average: averageRubricScores(parsed.value.rubric),
      caveat,
      coverage_warning: coverageWarning,
      speakers: layout.speakers,
      jason_speaker: layout.jason_speaker,
      talk_share: layout.talk_share,
      segments: layout.segments,
    };

    const reviewedAt = new Date().toISOString();
    const sb = createServiceRoleClient();
    const { error } = await sb
      .from("decks")
      .update({
        review,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidateDeck(id, "deck", deck.meetingPrepId);
    return { ok: true, review };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reassignReviewSpeakers(
  deckId: string,
  speakers: Record<string, string>
): Promise<ActionResult<{ review: DeckReview }>> {
  return reviewRun(deckId, { speakerOverrides: speakers, skipPass1: true });
}

export async function setRubricMark(
  deckId: string,
  index: number,
  input: { score: number | "na" }
): Promise<ActionResult<{ review: DeckReview }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb.from("decks").select("review, kind, meeting_prep_id").eq("id", id).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    if (asKind(data.kind as string) !== "deck") {
      return { ok: false, error: "Review is for decks only." };
    }
    const review = parseReview(data.review);
    if (!review) return { ok: false, error: "Run review first." };
    const row = review.rubric[index];
    if (!row) return { ok: false, error: "Rubric line not found." };

    if (input.score === "na") {
      row.na = true;
      row.score = null;
      row.overridden = true;
    } else {
      const score = Math.round(input.score);
      if (score < 1 || score > 5) return { ok: false, error: "Score must be 1 to 5." };
      row.na = false;
      row.score = score;
      row.overridden = true;
    }
    review.rubric_average = averageRubricScores(review.rubric);

    const { error: saveError } = await sb
      .from("decks")
      .update({ review, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (saveError) return { ok: false, error: saveError.message };

    revalidateDeck(id, "deck", data.meeting_prep_id as string | null);
    return { ok: true, review };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setReviewMark(
  deckId: string,
  input: { target: string; mark: ReviewSlideMark | ReviewGoalMark }
): Promise<ActionResult<{ review: DeckReview }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const target = input.target.trim();
  const mark = input.mark;
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb.from("decks").select("review, kind, meeting_prep_id").eq("id", id).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    if (asKind(data.kind as string) !== "deck") {
      return { ok: false, error: "Review is for decks only." };
    }
    const review = parseReview(data.review);
    if (!review) return { ok: false, error: "Run review first." };

    if (target === "goal") {
      if (mark !== "hit" && mark !== "partly" && mark !== "missed") {
        return { ok: false, error: "Invalid goal mark." };
      }
      review.goal = {
        mark,
        evidence: review.goal?.evidence ?? "",
        overridden: true,
      };
    } else {
      if (mark !== "covered" && mark !== "partly" && mark !== "skipped") {
        return { ok: false, error: "Invalid slide mark." };
      }
      const slide = review.slides.find((row) => row.slide_id === target);
      if (!slide) return { ok: false, error: "Slide not found in review." };
      slide.mark = mark;
      slide.overridden = true;
    }

    const { error: saveError } = await sb
      .from("decks")
      .update({ review, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (saveError) return { ok: false, error: saveError.message };

    revalidateDeck(id, "deck", data.meeting_prep_id as string | null);
    return { ok: true, review };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function undoAiHelp(deckId: string): Promise<ActionResult<object>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb.from("decks").select("ai_undo, kind, meeting_prep_id").eq("id", id).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    const undo = data.ai_undo as { slides?: SlideInput[]; aiNotes?: string | null } | null;
    if (!undo?.slides?.length) return { ok: false, error: "Nothing to undo." };

    const restored = await setDeckSlides(id, undo.slides);
    if (!restored.ok) return restored;

    await sb
      .from("decks")
      .update({
        ai_notes: undo.aiNotes ?? null,
        ai_undo: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    revalidateDeck(id, asKind(data.kind as string), data.meeting_prep_id as string | null);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------- internal ----------

async function focusAttendee(
  attendees: Array<{ email: string; name: string | null; contactId: string | null }>
): Promise<{ name: string; email: string | null; company: string | null; contactId: string | null }> {
  const pool = attendees.filter((row) => row.email && !row.email.toLowerCase().includes("jason@"));
  const withContact = pool.filter((row) => row.contactId);
  const sb = hasConfig() ? createServiceRoleClient() : null;
  if (sb && withContact.length) {
    const ids = withContact.map((row) => row.contactId!).filter(Boolean);
    const { data } = await sb
      .from("contacts")
      .select("id, name, email, company_id, companies(name)")
      .in("id", ids);
    const byId = new Map((data ?? []).map((row) => [row.id as string, row]));
    for (const attendee of withContact) {
      const contact = byId.get(attendee.contactId!);
      const company = embeddedCompanyName(contact?.companies);
      if (company) {
        return {
          name: attendee.name?.trim() || contact?.name?.trim() || attendee.email.split("@")[0],
          email: attendee.email,
          company,
          contactId: attendee.contactId,
        };
      }
    }
  }
  const first = pool[0] ?? attendees[0];
  if (!first) return { name: "Guest", email: null, company: null, contactId: null };
  let company: string | null = null;
  if (sb && first.contactId) {
    const { data } = await sb
      .from("contacts")
      .select("companies(name)")
      .eq("id", first.contactId)
      .maybeSingle();
    company = embeddedCompanyName(data?.companies);
  }
  return {
    name: first.name?.trim() || first.email.split("@")[0] || "Guest",
    email: first.email ?? null,
    company,
    contactId: first.contactId,
  };
}

function embeddedCompanyName(value: unknown): string | null {
  const company = value as { name?: string } | { name?: string }[] | null;
  const name = Array.isArray(company) ? company[0]?.name : company?.name;
  const trimmed = name?.trim();
  return trimmed || null;
}

async function resolveMeetingContactIds(
  sb: ReturnType<typeof createServiceRoleClient>,
  prepId: string
): Promise<string[]> {
  const { getMeetingPrep } = await loadMeetingPrep();
  const prepResult = await getMeetingPrep(prepId);
  if (!prepResult.ok) throw new Error(prepResult.error);
  const ids = new Set<string>();
  const unmatched: Array<{ email: string; name: string | null }> = [];
  for (const attendee of prepResult.prep.attendees) {
    if (attendee.contactId) {
      ids.add(attendee.contactId);
      continue;
    }
    unmatched.push({ email: attendee.email, name: attendee.name });
  }
  for (const row of unmatched) {
    if (row.email) {
      const { data, error } = await sb
        .from("contacts")
        .select("id, emails")
        .contains("emails", [row.email.toLowerCase()])
        .limit(1);
      if (error) throw new Error(error.message);
      if (data?.[0]?.id) {
        ids.add(String(data[0].id));
        continue;
      }
    }
    const name = row.name?.trim();
    if (name && name.length >= 2) {
      const { data, error } = await sb
        .from("contacts")
        .select("id, name")
        .ilike("name", name)
        .limit(2);
      if (error) throw new Error(error.message);
      if (data?.length === 1) ids.add(String(data[0].id));
    }
  }
  return [...ids];
}

function emailsFromAttendees(
  attendees: Array<{ email: string; name: string | null; contactId: string | null }>
): string[] {
  return attendees.map((row) => row.email).filter((email) => email.includes("@"));
}

function domainFromEmail(email: string | null): string[] {
  if (!email?.includes("@")) return [];
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || domain.includes("gmail.") || domain.includes("icloud.")) return [];
  return [domain];
}

function formatMailContext(
  threads: Array<{ subject: string | null; messages: Array<{ from: string; date: string; text: string }> }>,
  maxWords: number
): string {
  const chunks: string[] = [];
  for (const thread of threads) {
    const subject = thread.subject?.trim() || "(no subject)";
    for (const message of thread.messages.slice(0, 4)) {
      const body = message.text.trim();
      if (!body) continue;
      chunks.push(`Subject: ${subject}\nFrom: ${message.from}\n${body}`);
    }
  }
  return capWords(chunks.join("\n\n---\n\n"), maxWords);
}

async function loadCompanySiteText(contactId: string | null, companyName: string | null): Promise<string | null> {
  const sb = createServiceRoleClient();
  let url: string | null = null;
  if (contactId) {
    const { data } = await sb
      .from("contacts")
      .select("company_id, companies(name, website)")
      .eq("id", contactId)
      .maybeSingle();
    const company = Array.isArray(data?.companies) ? data?.companies[0] : data?.companies;
    const website = (company as { website?: string } | undefined)?.website?.trim();
    if (website && /^https?:\/\//i.test(website)) url = website;
  }
  if (!url && companyName) {
    const { data } = await sb
      .from("companies")
      .select("website")
      .ilike("name", companyName)
      .limit(1)
      .maybeSingle();
    const website = (data?.website as string | undefined)?.trim();
    if (website && /^https?:\/\//i.test(website)) url = website;
  }
  if (!url) return null;
  const { firecrawlScrape } = await import("@/lib/integrations/firecrawl");
  const scraped = await firecrawlScrape(url);
  if (!scraped?.text?.trim()) return null;
  return capWords(scraped.text.trim(), 3000);
}

export async function setDeckDescription(
  deckId: string,
  description: string
): Promise<ActionResult<{ description: string | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const next = description.trim() || null;
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .update({ description: next, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, kind, meeting_prep_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    revalidateDeck(id, asKind(data.kind as string), data.meeting_prep_id as string | null);
    return { ok: true, description: next };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function linkDeckMeeting(
  deckId: string,
  meetingPrepId: string
): Promise<ActionResult<{ meetingPrepId: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const prepId = meetingPrepId.trim();
  if (!prepId) return { ok: false, error: "Pick a meeting." };
  try {
    const sb = createServiceRoleClient();
    const { data: deck, error: deckError } = await sb
      .from("decks")
      .select("id, kind, meeting_prep_id")
      .eq("id", id)
      .maybeSingle();
    if (deckError) return { ok: false, error: deckError.message };
    if (!deck) return { ok: false, error: "Not found." };
    if (asKind(deck.kind as string) !== "deck") {
      return { ok: false, error: "Only decks can link to a meeting." };
    }
    const existing = await sb
      .from("decks")
      .select("id")
      .eq("kind", "deck")
      .eq("meeting_prep_id", prepId)
      .neq("id", id)
      .maybeSingle();
    if (existing.data?.id) return { ok: false, error: "That meeting already has a deck." };

    const prevPrep = deck.meeting_prep_id as string | null;
    const { error } = await sb
      .from("decks")
      .update({ meeting_prep_id: prepId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateDeck(id, "deck", prepId);
    if (prevPrep) {
      try {
        revalidatePath(`/meetings/${prevPrep}`);
      } catch {
        // Outside a Next request (unit tests) revalidatePath has no store.
      }
    }
    return { ok: true, meetingPrepId: prepId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function unlinkDeckMeeting(deckId: string): Promise<ActionResult<object>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const sb = createServiceRoleClient();
    const { data: deck, error: deckError } = await sb
      .from("decks")
      .select("id, kind, meeting_prep_id")
      .eq("id", id)
      .maybeSingle();
    if (deckError) return { ok: false, error: deckError.message };
    if (!deck) return { ok: false, error: "Not found." };
    const prevPrep = deck.meeting_prep_id as string | null;
    const { error } = await sb
      .from("decks")
      .update({ meeting_prep_id: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateDeck(id, asKind(deck.kind as string), prevPrep);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Replace the source playbook's slides with copies of this deck's slides.
 * Deck is unchanged.
 */
export async function updatePlaybookFromDeck(
  deckId: string
): Promise<ActionResult<{ playbookId: string; playbookName: string; slideCount: number }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const sb = createServiceRoleClient();
    const { data: deck, error } = await sb.from("decks").select(DECK_COLUMNS).eq("id", id).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!deck) return { ok: false, error: "Not found." };
    const row = deck as DeckRow;
    if (asKind(row.kind) !== "deck") return { ok: false, error: "Only decks can update a playbook." };
    const playbookId = row.source_playbook_id?.trim() || null;
    if (!playbookId) return { ok: false, error: "This deck has no source playbook." };

    const { data: playbook, error: playbookError } = await sb
      .from("decks")
      .select("id, name, kind")
      .eq("id", playbookId)
      .maybeSingle();
    if (playbookError) return { ok: false, error: playbookError.message };
    if (!playbook || asKind(playbook.kind as string) !== "playbook") {
      return { ok: false, error: "Source playbook no longer exists." };
    }

    const deckSlides = await loadSlides(sb, id);
    const previous = await loadSlides(sb, playbookId);

    const { error: delError } = await sb.from("slides").delete().eq("deck_id", playbookId);
    if (delError) return { ok: false, error: delError.message };

    if (deckSlides.length) {
      const { error: insError } = await sb.from("slides").insert(
        deckSlides.map((slide, index) => ({
          deck_id: playbookId,
          position: index + 1,
          headline: slide.headline,
          bullets: toJsonBullets(slide.bullets),
        }))
      );
      if (insError) {
        if (previous.length) {
          await sb.from("slides").insert(
            previous.map((slide, index) => ({
              deck_id: playbookId,
              position: index + 1,
              headline: slide.headline,
              bullets: toJsonBullets(slide.bullets),
            }))
          );
        }
        return { ok: false, error: insError.message };
      }
    }

    await sb
      .from("decks")
      .update({
        goal: row.goal?.trim() || null,
        description: row.description?.trim() || null,
        rubric: parseRubricFromJson(row.rubric),
        updated_at: new Date().toISOString(),
      })
      .eq("id", playbookId);
    revalidateDeck(playbookId, "playbook");
    revalidateDeck(id, "deck", row.meeting_prep_id);
    return {
      ok: true,
      playbookId,
      playbookName: String(playbook.name),
      slideCount: deckSlides.length,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Copy deck slides into a new playbook and point the deck at it. */
export async function createPlaybookFromDeck(
  deckId: string,
  input: { name: string; description?: string | null }
): Promise<ActionResult<{ playbookId: string; name: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  const label = input.name.trim().slice(0, 200);
  if (!label) return { ok: false, error: "Write a playbook name." };
  const description = input.description?.trim() || null;
  try {
    const sb = createServiceRoleClient();
    const { data: deck, error } = await sb.from("decks").select(DECK_COLUMNS).eq("id", id).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!deck) return { ok: false, error: "Not found." };
    const row = deck as DeckRow;
    if (asKind(row.kind) !== "deck") return { ok: false, error: "Only decks can create a playbook." };

    const deckSlides = await loadSlides(sb, id);
    const { data: created, error: createError } = await sb
      .from("decks")
      .insert({
        kind: "playbook",
        name: label,
        description,
        goal: row.goal?.trim() || null,
        rubric: parseRubricFromJson(row.rubric),
      })
      .select("id")
      .single();
    if (createError || !created?.id) {
      return { ok: false, error: createError?.message || "Could not create playbook." };
    }
    const playbookId = created.id as string;
    if (deckSlides.length) {
      const { error: slideError } = await sb.from("slides").insert(
        deckSlides.map((slide, index) => ({
          deck_id: playbookId,
          position: index + 1,
          headline: slide.headline,
          bullets: toJsonBullets(slide.bullets),
        }))
      );
      if (slideError) {
        await sb.from("decks").delete().eq("id", playbookId);
        return { ok: false, error: slideError.message };
      }
    }

    const { error: linkError } = await sb
      .from("decks")
      .update({ source_playbook_id: playbookId, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (linkError) return { ok: false, error: linkError.message };

    revalidateDeck(playbookId, "playbook");
    revalidateDeck(id, "deck", row.meeting_prep_id);
    return { ok: true, playbookId, name: label };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Unlinked duplicate named "Copy of {name}" with the same slides. */
export async function copyDeck(deckId: string): Promise<ActionResult<{ id: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const sb = createServiceRoleClient();
    const { data: source, error } = await sb.from("decks").select(DECK_COLUMNS).eq("id", id).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!source) return { ok: false, error: "Not found." };
    const row = source as DeckRow;
    const kind = asKind(row.kind);
    const label = `Copy of ${row.name}`.slice(0, 200);
    const sourceSlides = await loadSlides(sb, id);
    const { data: created, error: createError } = await sb
      .from("decks")
      .insert({
        kind,
        name: label,
        description: row.description,
        goal: row.goal?.trim() || null,
        rubric: parseRubricFromJson(row.rubric),
        rubric_source: row.rubric_source?.trim() || "custom",
        source_playbook_id: kind === "deck" ? row.source_playbook_id : null,
        meeting_prep_id: null,
      })
      .select("id")
      .single();
    if (createError || !created?.id) {
      return { ok: false, error: createError?.message || "Could not copy." };
    }
    const newId = created.id as string;
    if (sourceSlides.length) {
      const { error: slideError } = await sb.from("slides").insert(
        sourceSlides.map((slide, index) => ({
          deck_id: newId,
          position: index + 1,
          headline: slide.headline,
          bullets: toJsonBullets(slide.bullets),
        }))
      );
      if (slideError) return { ok: false, error: slideError.message };
    }
    revalidateDeck(newId, kind);
    return { ok: true, id: newId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
