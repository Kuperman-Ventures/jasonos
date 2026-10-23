import {
  attachPlanToMeeting,
  createLiveScript,
  createLiveScriptItem,
  updateLiveScriptItem,
} from "@/lib/server-actions/live-scripts";
import {
  acceptMeetingPlan,
  buildMeetingPlan,
  ensureResearchAndEmail,
  markPlanBuilt,
} from "@/lib/server-actions/meeting-plan";
import {
  createMeetingPoint,
  deleteMeetingPoint,
  getMeetingPoints,
  reorderMeetingPoints,
  updateMeetingPoint,
} from "@/lib/server-actions/meeting-points";
import {
  getMeetingPrep,
  getUpcomingMeetingPreps,
  setMeetingOutcomeSentence,
} from "@/lib/server-actions/meeting-prep";
import { getMeetingReview } from "@/lib/server-actions/meeting-reviews";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  type PlanPointInput,
  validatePlanPoints,
} from "./plan-points";

export { MEETING_PLAN_TOOL_NAMES, validatePlanPoints, type PlanPointInput } from "./plan-points";

export async function buildMeetingPlanTool(input: {
  prep_id: string;
  from: "playbook" | "guide" | "blank";
  script_id?: string;
}) {
  const prepId = input.prep_id.trim();
  if (!prepId) throw new Error("prep_id is required.");
  if (input.from !== "playbook" && input.from !== "guide" && input.from !== "blank") {
    throw new Error("from must be playbook, guide, or blank.");
  }

  const result = await buildMeetingPlan({
    prepId,
    from: { kind: input.from, scriptId: input.script_id },
  });
  if (!result.ok) throw new Error(result.error);

  return {
    ok: true,
    prep_id: prepId,
    from: input.from,
    proposal: result.proposal
      ? {
          adaptation_id: result.proposal.id,
          script_id: result.proposal.scriptId,
          script_name: result.proposal.scriptName,
          items: result.proposal.items.map((item) => ({
            kind: item.kind,
            headline: item.headline,
            detail: item.detail,
            listen_for: item.listenFor,
            prepare_reactions: item.prepareReactions,
            source_hint: item.sourceHint,
            dropped: item.dropped,
            dropped_reason: item.droppedReason,
            added: item.added,
          })),
          context_used: result.proposal.contextUsed,
          context_missing: result.proposal.contextMissing,
        }
      : null,
    written: result.written ?? null,
    context_used: result.contextUsed,
    context_missing: result.contextMissing,
    research_verified: result.researchVerified,
  };
}

export async function acceptMeetingPlanTool(input: { adaptation_id: string }) {
  const adaptationId = input.adaptation_id.trim();
  if (!adaptationId) throw new Error("adaptation_id is required.");
  const result = await acceptMeetingPlan({ adaptationId });
  if (!result.ok) throw new Error(result.error);
  return { ok: true, adaptation_id: adaptationId, added: result.added };
}

export async function setMeetingPlan(input: {
  prep_id: string;
  outcome_sentence?: string;
  points: PlanPointInput[];
  mode: "add" | "replace";
}) {
  const prepId = input.prep_id.trim();
  if (!prepId) throw new Error("prep_id is required.");
  if (input.mode !== "add" && input.mode !== "replace") {
    throw new Error("mode must be add or replace.");
  }
  const validated = validatePlanPoints(input.points);
  if (!validated.ok) throw new Error(validated.error);

  const existing = await getMeetingPoints(prepId);
  if (!existing.ok) throw new Error(existing.error);

  if (input.mode === "replace" && existing.points.length) {
    for (const point of existing.points) {
      const deleted = await deleteMeetingPoint(point.id);
      if (!deleted.ok) throw new Error(deleted.error);
    }
  }

  if (input.outcome_sentence !== undefined) {
    const sentence = await setMeetingOutcomeSentence(prepId, input.outcome_sentence);
    if (!sentence.ok) throw new Error(sentence.error);
  }

  const createdIds: string[] = [];
  for (const point of validated.points) {
    const created = await createMeetingPoint({
      prepId,
      kind: point.kind,
      headline: point.headline,
      detail: point.detail,
      listenFor: point.listenFor,
    });
    if (!created.ok) throw new Error(created.error);
    createdIds.push(created.point.id);
    if (point.prepareReactions || point.reactions) {
      const updated = await updateMeetingPoint(created.point.id, {
        prepareReactions: point.prepareReactions,
        reactions: point.reactions ?? undefined,
      });
      if (!updated.ok) throw new Error(updated.error);
    }
  }

  if (input.mode === "add" && existing.points.length) {
    const order = [...existing.points.map((point) => point.id), ...createdIds];
    const reordered = await reorderMeetingPoints(prepId, order);
    if (!reordered.ok) throw new Error(reordered.error);
  }

  const context = await ensureResearchAndEmail(prepId);
  if (!context.ok) throw new Error(context.error);

  const marked = await markPlanBuilt(prepId, "chat");
  if (!marked.ok) throw new Error(marked.error);

  return {
    ok: true,
    prep_id: prepId,
    added: createdIds.length,
    mode: input.mode,
    plan_source: marked.planSource,
    plan_built_at: marked.planBuiltAt,
    context_used: context.contextUsed,
    context_missing: context.contextMissing,
    research_verified: context.researchVerified,
  };
}

export async function createGuide(input: {
  name: string;
  for?: string;
  outcome_sentence?: string;
  notes?: string;
  points: PlanPointInput[];
}) {
  const name = input.name.trim();
  if (!name) throw new Error("name is required.");
  const validated = validatePlanPoints(input.points);
  if (!validated.ok) throw new Error(validated.error);

  const created = await createLiveScript({
    name,
    kind: "plan",
    description: input.for?.trim() || null,
    outcomeSentence: input.outcome_sentence?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (!created.ok) throw new Error(created.error);

  for (const point of validated.points) {
    const item = await createLiveScriptItem({
      scriptId: created.script.id,
      kind: point.kind,
      headline: point.headline,
      detail: point.detail,
      listenFor: point.listenFor,
    });
    if (!item.ok) throw new Error(item.error);
    if (point.prepareReactions || point.reactions) {
      const updated = await updateLiveScriptItem(item.item.id, {
        prepareReactions: point.prepareReactions,
        reactions: point.reactions ?? undefined,
      });
      if (!updated.ok) throw new Error(updated.error);
    }
  }

  return {
    ok: true,
    id: created.script.id,
    url: `/live/scripts/${created.script.id}`,
    point_count: validated.points.length,
  };
}

export async function useGuideForMeeting(input: { script_id: string; prep_id: string }) {
  const scriptId = input.script_id.trim();
  const prepId = input.prep_id.trim();
  if (!scriptId || !prepId) throw new Error("script_id and prep_id are required.");
  const result = await attachPlanToMeeting({
    scriptId,
    prepId,
    mode: "replace",
  });
  if (!result.ok) throw new Error(result.error);
  return { ok: true, added: result.added, prep_id: prepId, script_id: scriptId };
}

export async function getMeetingPlan(input: { prep_id: string }) {
  const prepId = input.prep_id.trim();
  if (!prepId) throw new Error("prep_id is required.");
  const [prepResult, pointsResult, reviewResult] = await Promise.all([
    getMeetingPrep(prepId),
    getMeetingPoints(prepId),
    getMeetingReview(prepId),
  ]);
  if (!prepResult.ok) throw new Error(prepResult.error);
  if (!pointsResult.ok) throw new Error(pointsResult.error);

  const review = reviewResult.ok ? reviewResult.review : null;
  const granolaUrl = review?.sourceUrl ?? null;
  return {
    ok: true,
    prep_id: prepId,
    title: prepResult.prep.title,
    outcome_sentence: prepResult.prep.outcomeSentence,
    plan_source: prepResult.prep.planSource,
    plan_built_at: prepResult.prep.planBuiltAt,
    granola_url: granolaUrl,
    points: pointsResult.points.map((point) => ({
      id: point.id,
      kind: point.kind,
      headline: point.headline,
      detail: point.detail,
      listen_for: point.listenFor,
      state: point.state,
      confirmed_state: point.confirmedState,
    })),
    review: review
      ? {
          suggested_mark: review.suggestedMark,
          suggested_reason: review.suggestedReason,
          points_spoken_count: review.pointsSpoken.filter((row) => row.spoken).length,
          granola_url: granolaUrl,
        }
      : null,
  };
}

export async function listUpcomingMeetingPreps(input: { days?: number } = {}) {
  const days = Math.min(30, Math.max(1, input.days ?? 7));
  const result = await getUpcomingMeetingPreps(days);
  if (!result.ok) throw new Error(result.error);

  const prepIds = result.meetings.map((meeting) => meeting.id);
  const trackById = new Map<string, string | null>();
  if (prepIds.length) {
    const sb = createServiceRoleClient();
    const { data, error } = await sb.from("meeting_preps").select("id, track").in("id", prepIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      trackById.set(
        row.id as string,
        typeof row.track === "string" && row.track.trim() ? row.track.trim() : null
      );
    }
  }

  return {
    ok: true,
    days,
    meetings: result.meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      starts_at: meeting.startsAt,
      track: trackById.get(meeting.id) ?? null,
      has_plan: Boolean(meeting.planBuiltAt) || meeting.pointCount > 0,
      research_verified: !meeting.researchUnverified,
      attendees: meeting.attendees.map((person) => ({
        contact_id: person.contactId,
        name: person.name,
        email: person.email,
      })),
    })),
  };
}
