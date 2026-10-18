"use server";

import { revalidatePath } from "next/cache";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { callClaude } from "@/lib/ai/models";
import { loadMeetingContext } from "@/lib/meeting-prep/context";
import { isJoinBoilerplate } from "@/lib/meeting-prep/text";
import { REACTION_SHAPES, type Reaction, type ReactionShape } from "@/lib/meeting-prep/reactions";
import {
  buildMeetingPointsUserMessage,
  draftContextLines,
  meetingPointsSystemPrompt,
  newDrafts,
  parseDraftPoints,
  type PointKind,
  type PointState,
} from "@/lib/meeting-prep/points";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";

export interface MeetingPoint {
  id: string;
  prepId: string;
  position: number;
  kind: PointKind;
  headline: string;
  detail: string | null;
  state: PointState;
  stateChangedAt: string | null;
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
  note: string | null;
  source: string;
  edited_by_user: boolean;
  source_hint?: string | null;
  prepare_reactions?: boolean | null;
  reactions?: unknown;
  observed_reaction?: string | null;
}

const KINDS = new Set<PointKind>(["agenda", "point", "question", "ask"]);
const STATES = new Set<PointState>(["open", "covered", "skipped"]);

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function revalidatePoints(prepId: string) {
  revalidatePath("/");
  revalidatePath(`/meetings/${prepId}`);
  revalidatePath(`/meetings/${prepId}/live`);
  revalidatePath("/meetings/[id]", "page");
  revalidatePath("/meetings/[id]/live", "page");
}

function asKind(value: string): PointKind {
  return KINDS.has(value as PointKind) ? (value as PointKind) : "point";
}

function asState(value: string): PointState {
  return STATES.has(value as PointState) ? (value as PointState) : "open";
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
  "id, prep_id, position, kind, headline, detail, state, state_changed_at, note, source, edited_by_user, source_hint, prepare_reactions, reactions, observed_reaction";

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

  const { data, error } = await sb
    .from("meeting_points")
    .insert({
      prep_id: prepId,
      position,
      kind: input.kind,
      headline,
      detail: cleanDetail(input.detail),
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
  patch: { kind?: PointKind; headline?: string; detail?: string | null }
): Promise<PointResult<{ point: MeetingPoint }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const pointId = id.trim();
  if (!pointId) return { ok: false, error: "Point not found." };

  const update: Record<string, unknown> = { edited_by_user: true };
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
  if (Object.keys(update).length === 1) return { ok: false, error: "Nothing to change." };

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

  const prep = prepResult.prep;
  const purpose = prep.purpose && !isJoinBoilerplate(prep.purpose) ? prep.purpose : null;
  const person = context.people[0] ?? null;
  const referrer =
    context.people.find((item) => item.referredByName?.trim())?.referredByName?.trim() ||
    context.connections.find((item) => item.who?.trim())?.who?.trim() ||
    null;
  const personalGoal = person?.personalGoal?.trim() || null;
  const openCommitments = context.brief.commitments
    .filter((item) => item.status === "open")
    .map((item) => ({
      text: item.text,
      direction: item.direction,
      due: item.due,
      personName: item.personName,
    }));
  const granolaSummaries = [
    ...context.pastMeetings
      .filter((meeting) => meeting.granolaSummary?.trim())
      .map((meeting) => ({
        title: meeting.title,
        date: meeting.when,
        summary: meeting.granolaSummary!.trim().slice(0, 1500),
        sort: meeting.when ? Date.parse(meeting.when) : 0,
      })),
    ...context.granolaNotes
      .filter((note) => note.summary.trim())
      .map((note) => ({
        title: note.title,
        date: note.when,
        summary: note.summary.trim().slice(0, 1500),
        sort: note.when ? Date.parse(note.when) : 0,
      })),
  ]
    .sort((a, b) => (Number.isNaN(b.sort) ? 0 : b.sort) - (Number.isNaN(a.sort) ? 0 : a.sort))
    .filter((note, index, list) => list.findIndex((item) => item.summary === note.summary) === index)
    .slice(0, 3)
    .map(({ title, date, summary }) => ({ title, date, summary }));
  const lastNextStep =
    context.pastMeetings.find((meeting) => meeting.nextStep?.trim())?.nextStep?.trim() || null;
  const contextLines = draftContextLines({
    purpose,
    outcomeSentence: prep.outcomeSentence,
    relationshipBrief: context.brief.summary,
    openCommitments: openCommitments.length,
    referrer,
    personalGoal,
    granolaNotes: granolaSummaries.length,
    earlierMeetings: context.pastMeetings.length,
    jobSearch: context.jobSearch.length,
  });
  const knownEmails = new Set(context.people.map((item) => item.email.toLowerCase()));
  const attendees = [
    ...context.people.map((person) => ({
      name: person.name,
      title: person.title,
      company: person.company,
    })),
    ...prep.attendees
      .filter((attendee) => !knownEmails.has(attendee.email.toLowerCase()))
      .map((attendee) => ({
        name: attendee.name || attendee.email,
        title: null,
        company: null,
      })),
  ];

  let text: string;
  try {
    text = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 1200,
      system: meetingPointsSystemPrompt(NO_AI_SLOP_WRITING_RULES),
      messages: [
        {
          role: "user",
          content: buildMeetingPointsUserMessage({
            title: prep.title,
            attendees,
            purpose,
            outcomeSentence: prep.outcomeSentence,
            summary: context.brief.summary,
            nextMove: context.brief.nextMove,
            openCommitments,
            topics: context.brief.topics,
            whereItStands: context.briefing.whereItStands?.text ?? null,
            yourStake: context.briefing.yourStake?.text ?? null,
            introduction: context.briefing.introduction?.text ?? null,
            referrer,
            personalGoal,
            lastNextStep,
            granolaSummaries,
            pastMeetings: context.pastMeetings.map((meeting) => ({
              title: meeting.title,
              debriefNotes: meeting.debriefNotes,
              nextStep: meeting.nextStep,
            })),
            jobSearch: context.jobSearch.map((job) => ({
              title: job.title,
              company: job.company,
              kind: job.kind,
            })),
          }),
        },
      ],
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
  if (!fresh.length) return { ok: true, added: 0, ...contextLines };

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
      state: "open",
      source: "ai",
      edited_by_user: false,
      source_hint: point.sourceHint,
    }))
  );
  if (error) return { ok: false, error: error.message };

  revalidatePoints(id);
  return { ok: true, added: fresh.length, ...contextLines };
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
