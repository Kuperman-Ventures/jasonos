"use server";

import { revalidatePath } from "next/cache";
import { callClaude } from "@/lib/ai/models";
import { getGranolaTranscript, searchGranolaForContact } from "@/lib/integrations/granola";
import {
  meetingReviewSystemPrompt,
  parseMeetingReview,
  type ObservedAsk,
  type ParsedMeetingReview,
  type RubricResult,
  type SpokenPoint,
} from "@/lib/meeting-prep/review";
import { getLiveScript } from "@/lib/server-actions/live-scripts";
import { getMeetingPoints } from "@/lib/server-actions/meeting-points";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import { createServiceRoleClient } from "@/lib/supabase/server";

const SOURCE_CAP = 60_000;

export interface MeetingReview extends ParsedMeetingReview {
  id: string;
  prepId: string;
  source: string;
  sourceUrl: string | null;
  sourceKind: "transcript" | "summary" | "none";
  error: string | null;
  updatedAt: string;
}

type ReviewResult<T> = ({ ok: true } & T) | { ok: false; error: string };

function hasConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function revalidateReview(prepId: string) {
  revalidatePath(`/meetings/${prepId}`);
  revalidatePath("/meetings/[id]", "page");
  revalidatePath("/live");
}

function asKind(value: string | null | undefined): MeetingReview["sourceKind"] {
  if (value === "transcript" || value === "summary" || value === "none") return value;
  return "none";
}

function toReview(row: Record<string, unknown>): MeetingReview {
  const spoken = Array.isArray(row.points_spoken) ? (row.points_spoken as SpokenPoint[]) : [];
  const rubric = Array.isArray(row.rubric_results) ? (row.rubric_results as RubricResult[]) : [];
  const reactions = Array.isArray(row.reactions_observed) ? (row.reactions_observed as ObservedAsk[]) : [];
  const mark = row.suggested_mark;
  const ratio = row.talk_ratio;
  return {
    id: String(row.id),
    prepId: String(row.prep_id),
    source: typeof row.source === "string" ? row.source : "granola",
    sourceUrl: typeof row.source_url === "string" ? row.source_url : null,
    sourceKind: asKind(typeof row.source_kind === "string" ? row.source_kind : null),
    error: typeof row.error === "string" ? row.error : null,
    pointsSpoken: spoken.map((item) => ({
      pointId: String(item.pointId ?? (item as { point_id?: string }).point_id ?? ""),
      spoken: Boolean(item.spoken),
      quote: item.quote ?? null,
    })),
    rubricResults: rubric.map((item) => ({
      item: String(item.item ?? ""),
      met: Boolean(item.met),
      quote: item.quote ?? null,
    })),
    reactionsObserved: reactions.map((item) => ({
      pointId: String(item.pointId ?? (item as { point_id?: string }).point_id ?? ""),
      shape: item.shape ?? null,
      quote: item.quote ?? null,
    })),
    suggestedMark:
      mark === "hit" || mark === "partial" || mark === "missed" ? mark : null,
    suggestedReason: typeof row.suggested_reason === "string" ? row.suggested_reason : null,
    talkRatio: typeof ratio === "number" ? ratio : null,
    projectGoalNote: typeof row.project_goal_note === "string" ? row.project_goal_note : null,
    relationshipGoalNote: typeof row.relationship_goal_note === "string" ? row.relationship_goal_note : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}

async function saveReview(row: Record<string, unknown>): Promise<ReviewResult<{ review: MeetingReview }>> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_reviews")
    .upsert(row, { onConflict: "prep_id" })
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Could not save the review." };
  return { ok: true, review: toReview(data as Record<string, unknown>) };
}

export async function getMeetingReview(
  prepId: string
): Promise<ReviewResult<{ review: MeetingReview | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const sb = createServiceRoleClient();
  const { data, error } = await sb.from("meeting_reviews").select("*").eq("prep_id", id).maybeSingle();
  if (error) {
    if (/meeting_reviews/i.test(error.message) && /does not exist|schema cache|could not find/i.test(error.message)) {
      return { ok: true, review: null };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: true, review: null };
  return { ok: true, review: toReview(data as Record<string, unknown>) };
}

export async function runMeetingReview(
  prepId: string
): Promise<ReviewResult<{ review: MeetingReview }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };

  const prepResult = await getMeetingPrep(id);
  if (!prepResult.ok) return prepResult;
  const pointsResult = await getMeetingPoints(id);
  if (!pointsResult.ok) return pointsResult;

  const prep = prepResult.prep;
  let rubric: string[] = [];
  if (prep.scriptId) {
    const script = await getLiveScript(prep.scriptId);
    if (script.ok) rubric = script.script.rubric;
  }

  const markable = pointsResult.points.filter((point) => point.kind !== "agenda");
  const asks = markable.filter((point) => point.kind === "ask");
  const primary = prep.attendees[0];
  const note = await searchGranolaForContact({
    contactName: primary?.name || prep.title,
    email: primary?.email ?? null,
    emails: prep.attendees.map((person) => person.email),
    aroundIso: prep.startsAt,
    calendarEventId: prep.gcalEventId,
    calendarEventIds: [prep.gcalEventId, prep.icalUid].filter((value): value is string => Boolean(value)),
    meetingTitle: prep.title,
  });

  if (!note.found) {
    const saved = await saveReview({
      prep_id: id,
      source: "granola",
      source_url: null,
      source_kind: "none",
      source_text: null,
      points_spoken: [],
      rubric_results: [],
      reactions_observed: [],
      suggested_mark: null,
      suggested_reason: null,
      talk_ratio: null,
      project_goal_note: null,
      relationship_goal_note: null,
      error: "No Granola note found for this meeting.",
    });
    if (!saved.ok) return saved;
    revalidateReview(id);
    return saved;
  }

  const noteId = note.meetings?.[0]?.id ?? null;
  const transcript = noteId ? await getGranolaTranscript(noteId) : null;
  const summary = note.summary?.trim() || "";
  const sourceKind = transcript?.text ? "transcript" : summary ? "summary" : "none";
  const sourceText = (transcript?.text || summary).slice(0, SOURCE_CAP);

  if (sourceKind === "none") {
    const saved = await saveReview({
      prep_id: id,
      source: "granola",
      source_url: note.url ?? null,
      source_kind: "none",
      source_text: null,
      points_spoken: [],
      rubric_results: [],
      reactions_observed: [],
      suggested_mark: null,
      suggested_reason: null,
      talk_ratio: null,
      project_goal_note: null,
      relationship_goal_note: null,
      error: "Granola note had no text to review.",
    });
    if (!saved.ok) return saved;
    revalidateReview(id);
    return saved;
  }

  const payload = {
    outcome: prep.outcomeSentence,
    points: markable.map((point) => ({
      id: point.id,
      kind: point.kind,
      headline: point.headline,
      detail: point.detail,
    })),
    rubric,
    asks: asks.map((point) => point.id),
    projectGoal: prep.projectGoal,
    relationshipGoal: prep.personalGoal,
    sourceKind,
    text: sourceText,
  };

  let modelText: string;
  try {
    modelText = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 2500,
      system: meetingReviewSystemPrompt(),
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not review the meeting." };
  }

  const parsed = parseMeetingReview(modelText, {
    pointIds: markable.map((point) => point.id),
    rubric,
    askIds: asks.map((point) => point.id),
  });
  if (!parsed) return { ok: false, error: "Could not read the review." };

  const saved = await saveReview({
    prep_id: id,
    source: "granola",
    source_url: note.url ?? null,
    source_kind: sourceKind,
    source_text: sourceText,
    points_spoken: parsed.pointsSpoken,
    rubric_results: parsed.rubricResults,
    reactions_observed: parsed.reactionsObserved,
    suggested_mark: parsed.suggestedMark,
    suggested_reason: parsed.suggestedReason,
    talk_ratio: parsed.talkRatio,
    project_goal_note: parsed.projectGoalNote,
    relationship_goal_note: parsed.relationshipGoalNote,
    error: null,
  });
  if (!saved.ok) return saved;
  revalidateReview(id);
  return saved;
}
