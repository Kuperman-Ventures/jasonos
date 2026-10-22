"use server";

import { revalidatePath } from "next/cache";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { callClaude } from "@/lib/ai/models";
import { loadMeetingContext } from "@/lib/meeting-prep/context";
import { REACTION_SHAPES, type Reaction, type ReactionShape } from "@/lib/meeting-prep/reactions";
import {
  buildReactionsUserMessage,
  parseReactions,
  reactionsSystemPrompt,
} from "@/lib/meeting-prep/reactions";
import { assembleDraftPrompt, meetingTrack } from "@/lib/meeting-prep/draft-context";
import { narrativesForTrack } from "@/lib/server-actions/narratives";
import { ensureEmailContext } from "@/lib/meeting-prep/email-context";
import {
  buildMeetingPointsUserMessage,
  meetingPointsSystemPrompt,
  newDrafts,
  parseDraftPoints,
  type PointKind,
  type PointState,
} from "@/lib/meeting-prep/points";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";

export type ConfirmedPointState = "covered" | "skipped" | "not_reached";

export interface MeetingPoint {
  id: string;
  prepId: string;
  position: number;
  kind: PointKind;
  headline: string;
  detail: string | null;
  state: PointState;
  stateChangedAt: string | null;
  confirmedState: ConfirmedPointState | null;
  confirmedAt: string | null;
  listenFor: string | null;
  note: string | null;
  source: "user" | "ai" | "script";
  editedByUser: boolean;
  sourceHint: string | null;
  prepareReactions: boolean;
  reactions: Reaction[];
  observedReaction: ReactionShape | null;
}

export type PointResult<T> = ({ ok: true } & T) | { ok: false; error: string };

interface PointRow {
  id: string;
  prep_id: string;
  position: number;
  kind: string;
  headline: string;
  detail: string | null;
  state: string;
  state_changed_at: string | null;
  confirmed_state?: string | null;
  confirmed_at?: string | null;
  listen_for?: string | null;
  note: string | null;
  source: string;
  edited_by_user: boolean;
  source_hint?: string | null;
  prepare_reactions?: boolean | null;
  reactions?: unknown;
  observed_reaction?: string | null;
}

const CONFIRMED = new Set<ConfirmedPointState>(["covered", "skipped", "not_reached"]);

const KINDS = new Set<PointKind>(["agenda", "point", "question", "ask"]);
const STATES = new Set<PointState>(["open", "covered", "skipped"]);

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function revalidatePoints(prepId: string) {
  try {
    revalidatePath("/");
    revalidatePath(`/meetings/${prepId}`);
    revalidatePath(`/meetings/${prepId}/live`);
    revalidatePath("/meetings/[id]", "page");
    revalidatePath("/meetings/[id]/live", "page");
  } catch {
    // Outside a Next request (scripts / tests) revalidatePath throws.
  }
}

function asKind(value: string): PointKind {
  return KINDS.has(value as PointKind) ? (value as PointKind) : "point";
}

function asState(value: string): PointState {
  return STATES.has(value as PointState) ? (value as PointState) : "open";
}

function asConfirmed(value: string | null | undefined): ConfirmedPointState | null {
  return value && CONFIRMED.has(value as ConfirmedPointState)
    ? (value as ConfirmedPointState)
    : null;
}

function toPoint(row: PointRow): MeetingPoint {
  return {
    id: row.id,
    prepId: row.prep_id,
    position: row.position,
    kind: asKind(row.kind),
    headline: row.headline,
    detail: row.detail?.trim() || null,
    state: asState(row.state),
    stateChangedAt: row.state_changed_at,
    confirmedState: asConfirmed(row.confirmed_state),
    confirmedAt: row.confirmed_at ?? null,
    listenFor: row.listen_for?.trim() || null,
    note: row.note?.trim() || null,
    source: row.source === "ai" || row.source === "script" ? row.source : "user",
    editedByUser: Boolean(row.edited_by_user),
    sourceHint: row.source_hint?.trim() || null,
    prepareReactions: Boolean(row.prepare_reactions),
    reactions: asReactions(row.reactions),
    observedReaction: asObserved(row.observed_reaction),
  };
}

function cleanHeadline(value: string): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (text.length > 80) return null;
  return text;
}

function cleanDetail(value: string | null | undefined): string | null {
  if (value == null) return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= 400 ? text : text.slice(0, 400).trim();
}

function missingPointsTable(message: string): boolean {
  return /meeting_points/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

const POINT_COLUMNS =
  "id, prep_id, position, kind, headline, detail, state, state_changed_at, confirmed_state, confirmed_at, listen_for, note, source, edited_by_user, source_hint, prepare_reactions, reactions, observed_reaction";

const REACTION_SHAPE_SET = new Set<string>(REACTION_SHAPES);

function asReactions(value: unknown): Reaction[] {
  if (!Array.isArray(value)) return [];
  const out: Reaction[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const shape = (item as { shape?: unknown }).shape;
    const soundsLike = (item as { soundsLike?: unknown }).soundsLike;
    const pivot = (item as { pivot?: unknown }).pivot;
    if (typeof shape !== "string" || !REACTION_SHAPE_SET.has(shape) || seen.has(shape)) continue;
    if (typeof soundsLike !== "string" || typeof pivot !== "string") continue;
    const sound = soundsLike.trim();
    const line = pivot.trim();
    if (!sound || !line) continue;
    seen.add(shape);
    out.push({ shape: shape as ReactionShape, soundsLike: sound, pivot: line });
  }
  return out;
}

function asObserved(value: string | null | undefined): ReactionShape | null {
  if (value && REACTION_SHAPE_SET.has(value)) return value as ReactionShape;
  return null;
}

export async function getMeetingPoints(
  prepId: string
): Promise<PointResult<{ points: MeetingPoint[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_points")
    .select(POINT_COLUMNS)
    .eq("prep_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (missingPointsTable(error.message)) {
      return {
        ok: false,
        error: "Meeting points are not set up yet. Run migration 0092.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, points: ((data ?? []) as PointRow[]).map(toPoint) };
}

async function nextPosition(
  sb: ReturnType<typeof createServiceRoleClient>,
  prepId: string
): Promise<{ ok: true; position: number } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from("meeting_points")
    .select("position")
    .eq("prep_id", prepId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const current = typeof data?.position === "number" ? data.position : 0;
  return { ok: true, position: current + 1 };
}

export async function createMeetingPoint(input: {
  prepId: string;
  kind: PointKind;
  headline: string;
  detail?: string | null;
  listenFor?: string | null;
  position?: number;
}): Promise<PointResult<{ point: MeetingPoint }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const prepId = input.prepId.trim();
  if (!prepId) return { ok: false, error: "Meeting prep not found." };
  if (!KINDS.has(input.kind)) return { ok: false, error: "Pick a kind." };
  const headline = cleanHeadline(input.headline);
  if (!headline) return { ok: false, error: "Write a headline under 80 characters." };

  const sb = createServiceRoleClient();
  let position = input.position;
  if (position == null || !Number.isInteger(position) || position < 1) {
    const appended = await nextPosition(sb, prepId);
    if (!appended.ok) return appended;
    position = appended.position;
  }

  const listenFor =
    typeof input.listenFor === "string" && input.listenFor.trim()
      ? input.listenFor.trim().replace(/\s+/g, " ").slice(0, 160)
      : null;

  const { data, error } = await sb
    .from("meeting_points")
    .insert({
      prep_id: prepId,
      position,
      kind: input.kind,
      headline,
      detail: cleanDetail(input.detail),
      listen_for: listenFor,
      state: "open",
      source: "user",
      edited_by_user: true,
    })
    .select(POINT_COLUMNS)
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePoints(prepId);
  return { ok: true, point: toPoint(data as PointRow) };
}

export async function updateMeetingPoint(
  id: string,
  patch: {
    kind?: PointKind;
    headline?: string;
    detail?: string | null;
    listenFor?: string | null;
    prepareReactions?: boolean;
    reactions?: Reaction[];
  }
): Promise<PointResult<{ point: MeetingPoint }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const pointId = id.trim();
  if (!pointId) return { ok: false, error: "Point not found." };

  const update: Record<string, unknown> = {};
  if (
    patch.kind != null ||
    patch.headline != null ||
    patch.detail !== undefined ||
    patch.listenFor !== undefined
  ) {
    update.edited_by_user = true;
  }
  if (patch.kind != null) {
    if (!KINDS.has(patch.kind)) return { ok: false, error: "Pick a kind." };
    update.kind = patch.kind;
  }
  if (patch.headline != null) {
    const headline = cleanHeadline(patch.headline);
    if (!headline) return { ok: false, error: "Write a headline under 80 characters." };
    update.headline = headline;
  }
  if (patch.detail !== undefined) update.detail = cleanDetail(patch.detail);
  if (patch.listenFor !== undefined) {
    update.listen_for =
      typeof patch.listenFor === "string" && patch.listenFor.trim()
        ? patch.listenFor.trim().replace(/\s+/g, " ").slice(0, 160)
        : null;
  }
  if (patch.prepareReactions !== undefined) update.prepare_reactions = Boolean(patch.prepareReactions);
  if (patch.reactions !== undefined) {
    const stored = parseReactions(JSON.stringify(patch.reactions));
    if (!stored) return { ok: false, error: "Reactions need all six shapes." };
    update.reactions = stored;
  }
  if (!Object.keys(update).length) return { ok: false, error: "Nothing to change." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_points")
    .update(update)
    .eq("id", pointId)
    .select(POINT_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Point not found." };

  revalidatePoints((data as PointRow).prep_id);
  return { ok: true, point: toPoint(data as PointRow) };
}

export async function setMeetingPointState(
  id: string,
  state: PointState
): Promise<PointResult<{ point: MeetingPoint }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!STATES.has(state)) return { ok: false, error: "Unknown point state." };
  const pointId = id.trim();
  if (!pointId) return { ok: false, error: "Point not found." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_points")
    .update({
      state,
      state_changed_at: state === "open" ? null : new Date().toISOString(),
    })
    .eq("id", pointId)
    .select(POINT_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Point not found." };

  revalidatePoints((data as PointRow).prep_id);
  return { ok: true, point: toPoint(data as PointRow) };
}

export async function confirmMeetingPointState(
  id: string,
  state: ConfirmedPointState
): Promise<PointResult<{ point: MeetingPoint }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  if (!CONFIRMED.has(state)) return { ok: false, error: "Unknown confirmed state." };
  const pointId = id.trim();
  if (!pointId) return { ok: false, error: "Point not found." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_points")
    .update({
      confirmed_state: state,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", pointId)
    .select(POINT_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Point not found." };

  revalidatePoints((data as PointRow).prep_id);
  return { ok: true, point: toPoint(data as PointRow) };
}

export async function confirmMeetingPointsAsShown(
  prepId: string,
  rows: Array<{ pointId: string; state: ConfirmedPointState }>
): Promise<PointResult<{ updated: number }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const sb = createServiceRoleClient();
  const now = new Date().toISOString();
  let updated = 0;
  for (const row of rows) {
    if (!CONFIRMED.has(row.state) || !row.pointId.trim()) continue;
    const { error } = await sb
      .from("meeting_points")
      .update({ confirmed_state: row.state, confirmed_at: now })
      .eq("id", row.pointId.trim())
      .eq("prep_id", id);
    if (!error) updated += 1;
  }
  revalidatePoints(id);
  return { ok: true, updated };
}

export async function setMeetingPointNote(
  id: string,
  note: string
): Promise<PointResult<{ note: string | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const pointId = id.trim();
  if (!pointId) return { ok: false, error: "Point not found." };
  const value = note.trim() ? note.trim() : null;

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_points")
    .update({ note: value })
    .eq("id", pointId)
    .select("prep_id, note")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Point not found." };

  revalidatePoints(data.prep_id as string);
  const stored = typeof data.note === "string" && data.note.trim() ? data.note.trim() : null;
  return { ok: true, note: stored };
}

export async function reorderMeetingPoints(
  prepId: string,
  orderedIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const ids = orderedIds.map((item) => item.trim()).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Point order does not match this meeting." };
  }

  const sb = createServiceRoleClient();
  const { error } = await sb.rpc("reorder_meeting_points", {
    p_prep_id: id,
    p_ids: ids,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePoints(id);
  return { ok: true };
}

export async function deleteMeetingPoint(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const pointId = id.trim();
  if (!pointId) return { ok: false, error: "Point not found." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_points")
    .delete()
    .eq("id", pointId)
    .select("prep_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Point not found." };

  revalidatePoints(data.prep_id as string);
  return { ok: true };
}

export async function draftMeetingPoints(
  prepId: string
): Promise<PointResult<{ added: number; contextUsed: string[]; contextMissing: string[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };

  const prepResult = await getMeetingPrep(id);
  if (!prepResult.ok) return prepResult;

  let context;
  try {
    context = await loadMeetingContext(id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  try {
    prepResult.prep.emailContext = await ensureEmailContext(prepResult.prep);
  } catch (err) {
    console.error("[draftMeetingPoints] email context", err);
  }

  const track = meetingTrack(prepResult.prep.track, context.people);
  const narrativeResult = await narrativesForTrack(track);
  const narratives = narrativeResult.ok
    ? narrativeResult.narratives.map((item) => ({ title: item.title, body: item.body }))
    : [];
  const assembled = assembleDraftPrompt(prepResult.prep, context, narratives);
  const companyVerified = !context.people.some(
    (person) => person.companyResearch && !person.companyResearch.verified
  );

  let text: string;
  try {
    text = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 1200,
      system: meetingPointsSystemPrompt(NO_AI_SLOP_WRITING_RULES, companyVerified),
      messages: [{ role: "user", content: buildMeetingPointsUserMessage(assembled.input) }],
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not draft points." };
  }

  const drafted = parseDraftPoints(text);
  if (!drafted) return { ok: false, error: "Could not read the draft." };

  const existing = await getMeetingPoints(id);
  if (!existing.ok) return existing;

  const fresh = newDrafts(
    existing.points.map((point) => point.headline),
    drafted
  );
  if (!fresh.length) return { ok: true, added: 0, contextUsed: assembled.contextUsed, contextMissing: assembled.contextMissing };

  const start =
    existing.points.reduce((max, point) => Math.max(max, point.position), 0) + 1;
  const sb = createServiceRoleClient();
  const { error } = await sb.from("meeting_points").insert(
    fresh.map((point, index) => ({
      prep_id: id,
      position: start + index,
      kind: point.kind,
      headline: point.headline,
      detail: point.detail,
      listen_for: point.listenFor,
      state: "open",
      source: "ai",
      edited_by_user: false,
      source_hint: point.sourceHint,
    }))
  );
  if (error) return { ok: false, error: error.message };

  revalidatePoints(id);
  return {
    ok: true,
    added: fresh.length,
    contextUsed: assembled.contextUsed,
    contextMissing: assembled.contextMissing,
  };
}

export async function startLiveMeeting(
  prepId: string
): Promise<PointResult<{ liveStartedAt: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };

  const sb = createServiceRoleClient();
  const { data: existing, error: readError } = await sb
    .from("meeting_preps")
    .select("id, live_started_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "Meeting prep not found." };

  const current = existing.live_started_at as string | null;
  if (current) return { ok: true, liveStartedAt: current };

  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("meeting_preps")
    .update({ live_started_at: nowIso })
    .eq("id", id)
    .is("live_started_at", null)
    .select("live_started_at")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data?.live_started_at) {
    revalidatePoints(id);
    return { ok: true, liveStartedAt: data.live_started_at as string };
  }

  const { data: again, error: againError } = await sb
    .from("meeting_preps")
    .select("live_started_at")
    .eq("id", id)
    .maybeSingle();
  if (againError) return { ok: false, error: againError.message };
  const started = (again?.live_started_at as string | null) ?? null;
  if (!started) return { ok: false, error: "Could not start the live call." };
  return { ok: true, liveStartedAt: started };
}

export async function endLiveMeeting(
  prepId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .update({ live_ended_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Meeting prep not found." };

  revalidatePoints(id);
  return { ok: true };
}

export async function draftMeetingPointReactions(
  pointId: string
): Promise<PointResult<{ reactions: Reaction[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = pointId.trim();
  if (!id) return { ok: false, error: "Point not found." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_points")
    .select(POINT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Point not found." };
  const point = toPoint(data as PointRow);

  const prepResult = await getMeetingPrep(point.prepId);
  if (!prepResult.ok) return prepResult;

  let context;
  try {
    context = await loadMeetingContext(point.prepId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const person = context.people[0] ?? null;

  let text: string;
  try {
    text = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 1200,
      system: reactionsSystemPrompt(NO_AI_SLOP_WRITING_RULES),
      messages: [
        {
          role: "user",
          content: buildReactionsUserMessage({
            headline: point.headline,
            detail: point.detail,
            kind: point.kind,
            situation: null,
            successSentence: prepResult.prep.outcomeSentence,
            person: person
              ? { name: person.name, title: person.title, company: person.company }
              : null,
          }),
        },
      ],
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not draft reactions." };
  }

  const reactions = parseReactions(text);
  if (!reactions) return { ok: false, error: "Could not read the reactions." };

  const { error: writeError } = await sb
    .from("meeting_points")
    .update({ reactions, prepare_reactions: true })
    .eq("id", id);
  if (writeError) return { ok: false, error: writeError.message };

  revalidatePoints(point.prepId);
  return { ok: true, reactions };
}

export async function setMeetingPointObservedReaction(
  pointId: string,
  shape: ReactionShape | null
): Promise<PointResult<object>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = pointId.trim();
  if (!id) return { ok: false, error: "Point not found." };
  if (shape !== null && !REACTION_SHAPE_SET.has(shape)) {
    return { ok: false, error: "Unknown reaction." };
  }

  const sb = createServiceRoleClient();
  const { data: marked, error: markError } = await sb
    .from("meeting_points")
    .update({ observed_reaction: shape })
    .eq("id", id)
    .select("prep_id")
    .maybeSingle();
  if (markError) return { ok: false, error: markError.message };
  if (!marked) return { ok: false, error: "Point not found." };

  revalidatePoints(marked.prep_id as string);
  return { ok: true };
}
