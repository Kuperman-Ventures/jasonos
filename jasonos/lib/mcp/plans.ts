import { blockIsFilled, suggestedFamily, type CallSheetBlock } from "@/lib/meeting-prep/call-sheet";
import {
  buildCallSheet,
  createCallSheet,
  getCallSheet,
  getCallSheetPerson,
  getSheetStatuses,
  putSheetOnMeeting,
  updateCallSheetBlock,
  type CallSheet,
} from "@/lib/server-actions/call-sheet";
import {
  createLiveScript,
  createLiveScriptItem,
  listPlaybooks,
  updateLiveScript,
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
import { getPerson, listPeople } from "@/lib/server-actions/person";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  mergeSheetLines,
  type PlanPointInput,
  type SheetBlockInput,
  validatePlanPoints,
} from "./plan-points";

export {
  CALL_SHEET_TOOL_NAMES,
  MEETING_PLAN_TOOL_NAMES,
  validatePlanPoints,
  type PlanPointInput,
} from "./plan-points";

const APP_URL = "https://jasonos.vercel.app";

/* ---------- Call sheets ---------- */

function sheetPayload(sheet: CallSheet, pointCount = 0) {
  return {
    prep_id: sheet.prepId,
    sheet_id: sheet.sheetId,
    url: sheet.prepId ? `${APP_URL}/meetings/${sheet.prepId}` : `${APP_URL}/live/scripts/${sheet.sheetId}`,
    playbook: sheet.playbook ? { id: sheet.playbook.id, name: sheet.playbook.name, family: sheet.playbook.family } : null,
    ready_at: sheet.readyAt,
    person: sheet.person
      ? {
          contact_id: sheet.person.contactId,
          name: sheet.person.name,
          status: sheet.person.networkingStatus,
          touch_number: sheet.person.touchNumber,
          to_discuss_next: sheet.person.toDiscussNext,
        }
      : null,
    blocks: sheet.blocks.map((block) => ({
      key: block.key,
      title: block.title,
      kind: block.kind,
      required: block.required,
      filled: blockIsFilled(block, pointCount),
      confirmed: Boolean(block.confirmedAt),
      rule: block.rule,
      body: block.body,
      lines: block.lines.map((line) => ({ label: line.label, text: line.text, source: line.sourceHint })),
    })),
  };
}

async function pickPlaybookId(prepId: string | null, playbookId?: string): Promise<string> {
  const given = playbookId?.trim();
  if (given) return given;
  const listed = await listPlaybooks();
  if (!listed.ok) throw new Error(listed.error);
  let family = suggestedFamily(null, 0);
  if (prepId) {
    const person = await getCallSheetPerson(prepId);
    if (person.ok && person.person) family = suggestedFamily(person.person.networkingStatus, person.person.touchCount);
  }
  const match = listed.playbooks.find((row) => row.family === family) ?? null;
  if (!match) throw new Error("Pass playbook_id. No playbook matches this person's status.");
  return match.id;
}

async function ensureMeetingSheet(prepId: string, playbookId?: string): Promise<{ sheet: CallSheet; created: boolean }> {
  const current = await getCallSheet({ prepId });
  if (!current.ok) throw new Error(current.error);
  if (current.sheet) return { sheet: current.sheet, created: false };
  const created = await createCallSheet({ prepId, playbookId: await pickPlaybookId(prepId, playbookId) });
  if (!created.ok) throw new Error(created.error);
  return { sheet: created.sheet, created: true };
}

function findBlock(blocks: CallSheetBlock[], key: string): CallSheetBlock {
  const wanted = key.trim().toLowerCase();
  const block =
    blocks.find((row) => row.key.toLowerCase() === wanted) ??
    blocks.find((row) => row.title.trim().toLowerCase() === wanted);
  if (!block) {
    throw new Error(`No block "${key}" on this sheet. Blocks: ${blocks.map((row) => row.key).join(", ")}.`);
  }
  return block;
}

/** Write blocks in Jason's words. Each write confirms the block. */
async function writeBlocks(sheet: CallSheet, inputs: SheetBlockInput[]): Promise<string[]> {
  const written: string[] = [];
  for (const input of inputs) {
    const block = findBlock(sheet.blocks, input.key);
    if (block.kind === "after") throw new Error("After is written on Debrief, not with set_call_sheet.");
    if (block.kind === "points") throw new Error(`${block.title} holds points. Pass them as points, not as a block.`);
    const patch: { body?: string | null; lines?: Array<{ label: string; text: string }> } = {};
    if (input.body !== undefined) patch.body = input.body;
    if (input.lines !== undefined) {
      if (block.kind === "text") throw new Error(`${block.title} takes a body, not lines.`);
      patch.lines = mergeSheetLines(block.lines, input.lines);
    }
    if (patch.body === undefined && patch.lines === undefined) continue;
    const saved = await updateCallSheetBlock(block.id, patch);
    if (!saved.ok) throw new Error(saved.error);
    written.push(block.key);
  }
  return written;
}

async function writePoints(input: {
  prepId: string;
  outcome_sentence?: string;
  points?: PlanPointInput[];
  mode?: "add" | "replace";
}) {
  const { prepId } = input;
  if (input.outcome_sentence !== undefined) {
    const sentence = await setMeetingOutcomeSentence(prepId, input.outcome_sentence);
    if (!sentence.ok) throw new Error(sentence.error);
  }
  if (!input.points?.length) return { added: 0 };
  if (input.mode !== "add" && input.mode !== "replace") throw new Error("mode must be add or replace.");
  const validated = validatePlanPoints(input.points);
  if (!validated.ok) throw new Error(validated.error);

  const existing = await getMeetingPoints(prepId);
  if (!existing.ok) throw new Error(existing.error);
  if (input.mode === "replace") {
    for (const point of existing.points) {
      const deleted = await deleteMeetingPoint(point.id);
      if (!deleted.ok) throw new Error(deleted.error);
    }
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
    const reordered = await reorderMeetingPoints(prepId, [...existing.points.map((point) => point.id), ...createdIds]);
    if (!reordered.ok) throw new Error(reordered.error);
  }
  return { added: createdIds.length };
}

export async function buildCallSheetTool(input: { prep_id: string; playbook_id?: string }) {
  const prepId = input.prep_id.trim();
  if (!prepId) throw new Error("prep_id is required.");
  const { created } = await ensureMeetingSheet(prepId, input.playbook_id);
  const built = await buildCallSheet({ prepId });
  if (!built.ok) throw new Error(built.error);
  const points = await getMeetingPoints(prepId);
  return {
    ok: true,
    created,
    sheet: sheetPayload(built.sheet, points.ok ? points.points.length : 0),
    points_added: built.pointsAdded,
    context_used: built.contextUsed,
    context_missing: built.contextMissing,
    research_verified: built.researchVerified,
    warnings: built.warnings,
  };
}

/**
 * Write a meeting's call sheet: blocks in Jason's words, the outcome sentence, and points.
 * Starts the sheet from playbook_id (or the playbook his status suggests) when blocks are
 * given and the meeting has none.
 */
export async function setCallSheet(input: {
  prep_id: string;
  playbook_id?: string;
  blocks?: SheetBlockInput[];
  outcome_sentence?: string;
  points?: PlanPointInput[];
  mode?: "add" | "replace";
}) {
  const prepId = input.prep_id.trim();
  if (!prepId) throw new Error("prep_id is required.");
  const blocks = input.blocks ?? [];
  if (!blocks.length && !input.points?.length && input.outcome_sentence === undefined) {
    throw new Error("Pass blocks, points, or outcome_sentence.");
  }

  let created = false;
  let written: string[] = [];
  if (blocks.length) {
    const ensured = await ensureMeetingSheet(prepId, input.playbook_id);
    created = ensured.created;
    written = await writeBlocks(ensured.sheet, blocks);
  }

  const points = await writePoints({
    prepId,
    outcome_sentence: input.outcome_sentence,
    points: input.points,
    mode: input.mode,
  });

  let context: Awaited<ReturnType<typeof ensureResearchAndEmail>> | null = null;
  if (points.added) {
    context = await ensureResearchAndEmail(prepId);
    if (!context.ok) throw new Error(context.error);
    const marked = await markPlanBuilt(prepId, "chat");
    if (!marked.ok) throw new Error(marked.error);
  }

  const [sheet, pointList] = await Promise.all([getCallSheet({ prepId }), getMeetingPoints(prepId)]);
  if (!sheet.ok) throw new Error(sheet.error);
  return {
    ok: true,
    prep_id: prepId,
    created,
    blocks_written: written,
    points_added: points.added,
    mode: input.mode ?? null,
    sheet: sheet.sheet ? sheetPayload(sheet.sheet, pointList.ok ? pointList.points.length : 0) : null,
    context_used: context?.ok ? context.contextUsed : [],
    context_missing: context?.ok ? context.contextMissing : [],
    research_verified: context?.ok ? context.researchVerified : null,
  };
}

/** A sheet with no meeting yet. From a playbook when playbook_id is given; otherwise from points. */
export async function createSheet(input: {
  name?: string;
  playbook_id?: string;
  blocks?: SheetBlockInput[];
  for?: string;
  outcome_sentence?: string;
  notes?: string;
  points?: PlanPointInput[];
}) {
  const name = input.name?.trim() ?? "";
  const validated = input.points?.length ? validatePlanPoints(input.points) : null;
  if (validated && !validated.ok) throw new Error(validated.error);

  let sheetId: string;
  if (input.playbook_id?.trim()) {
    const created = await createCallSheet({ prepId: null, playbookId: input.playbook_id.trim() });
    if (!created.ok) throw new Error(created.error);
    sheetId = created.sheet.sheetId as string;
    const patch = {
      ...(name ? { name } : {}),
      ...(input.for?.trim() ? { description: input.for.trim() } : {}),
      ...(input.outcome_sentence?.trim() ? { outcomeSentence: input.outcome_sentence.trim() } : {}),
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    };
    if (Object.keys(patch).length) {
      const renamed = await updateLiveScript(sheetId, patch);
      if (!renamed.ok) throw new Error(renamed.error);
    }
    if (input.blocks?.length) await writeBlocks(created.sheet, input.blocks);
  } else {
    if (!name) throw new Error("name is required without playbook_id.");
    if (!validated) throw new Error("Pass playbook_id, or points for a sheet without a playbook.");
    const created = await createLiveScript({
      name,
      kind: "plan",
      description: input.for?.trim() || null,
      outcomeSentence: input.outcome_sentence?.trim() || null,
      notes: input.notes?.trim() || null,
    });
    if (!created.ok) throw new Error(created.error);
    sheetId = created.script.id;
  }

  for (const point of validated?.ok ? validated.points : []) {
    const item = await createLiveScriptItem({
      scriptId: sheetId,
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
    id: sheetId,
    url: `/live/scripts/${sheetId}`,
    point_count: validated?.ok ? validated.points.length : 0,
  };
}

export async function putSheetOnMeetingTool(input: { sheet_id?: string; script_id?: string; prep_id: string }) {
  const sheetId = (input.sheet_id ?? input.script_id ?? "").trim();
  const prepId = input.prep_id.trim();
  if (!sheetId || !prepId) throw new Error("sheet_id and prep_id are required.");
  const result = await putSheetOnMeeting({ sheetId, prepId });
  if (!result.ok) throw new Error(result.error);
  return { ok: true, prep_id: prepId, sheet_id: sheetId, moved: result.moved, added: result.added };
}

export async function getCallSheetTool(input: { prep_id?: string; sheet_id?: string }) {
  const prepId = input.prep_id?.trim() || null;
  const sheetId = input.sheet_id?.trim() || null;
  if (!prepId && !sheetId) throw new Error("Pass prep_id or sheet_id.");
  const sheet = await getCallSheet({ prepId, sheetId });
  if (!sheet.ok) throw new Error(sheet.error);
  if (!prepId) {
    return { ok: true, sheet: sheet.sheet ? sheetPayload(sheet.sheet) : null };
  }
  const [prepResult, pointsResult] = await Promise.all([getMeetingPrep(prepId), getMeetingPoints(prepId)]);
  if (!prepResult.ok) throw new Error(prepResult.error);
  const points = pointsResult.ok ? pointsResult.points : [];
  return {
    ok: true,
    prep_id: prepId,
    title: prepResult.prep.title,
    starts_at: prepResult.prep.startsAt,
    outcome_sentence: prepResult.prep.outcomeSentence,
    sheet: sheet.sheet ? sheetPayload(sheet.sheet, points.length) : null,
    points: points.map((point) => ({
      id: point.id,
      kind: point.kind,
      headline: point.headline,
      detail: point.detail,
      listen_for: point.listenFor,
      state: point.state,
      confirmed_state: point.confirmedState,
    })),
  };
}

export async function getPersonTool(input: { contact_id: string }) {
  const contactId = input.contact_id.trim();
  if (!contactId) throw new Error("contact_id is required.");
  const result = await getPerson(contactId);
  if (!result.ok) throw new Error(result.error);
  const person = result.person;
  return {
    ok: true,
    contact_id: person.contactId,
    name: person.name,
    title: person.title,
    company: person.company,
    status: person.status,
    touch_count: person.touchCount,
    next_contact: person.nextContact,
    to_discuss_next: person.toDiscussNext,
    referred_by: person.referrer?.name ?? null,
    referral_received_at: person.referralReceivedAt,
    first_contact_at: person.firstContactAt,
    past_48h: person.overdue48h,
    next_contact_overdue: person.overdueNext,
    next_playbook: person.nextPlaybook.label,
    next_meeting: person.nextMeeting
      ? {
          prep_id: person.nextMeeting.prepId,
          title: person.nextMeeting.title,
          starts_at: person.nextMeeting.startsAt,
          has_sheet: person.nextMeeting.hasSheet,
        }
      : null,
    open_items: person.openItems,
    calls: person.timeline.map((row) => ({
      touch_number: row.touchNumber,
      occurred_at: row.occurredAt,
      prep_id: row.prepId,
      playbook: row.playbookName,
      conversation: row.conversation,
      contacts_received: row.contactsReceived.map((item) => ({ name: item.name, company: item.company })),
      follow_up_with: row.followUpWith,
      next_contact_at: row.nextContactAt,
      to_discuss_next: row.toDiscussNext,
      thank_you_sent_at: row.thankYouSentAt,
    })),
  };
}

export async function listPeopleTool(input: { limit?: number } = {}) {
  const limit = Math.min(200, Math.max(1, input.limit ?? 100));
  const result = await listPeople();
  if (!result.ok) throw new Error(result.error);
  return {
    ok: true,
    total: result.people.length,
    people: result.people.slice(0, limit).map((person) => ({
      contact_id: person.id,
      name: person.name,
      company: person.company,
      status: person.status,
      touch_count: person.touchCount,
      next_contact: person.nextContact,
      past_48h: person.overdue48h,
      next_contact_overdue: person.overdueNext,
    })),
  };
}

/* ---------- Earlier names (kept for one release) ---------- */

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
  return setCallSheet(input);
}

export async function createGuide(input: {
  name: string;
  for?: string;
  outcome_sentence?: string;
  notes?: string;
  points: PlanPointInput[];
}) {
  return createSheet(input);
}

export async function useGuideForMeeting(input: { script_id: string; prep_id: string }) {
  return putSheetOnMeetingTool(input);
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
  const statuses = await getSheetStatuses(
    result.meetings.map((meeting) => ({
      id: meeting.id,
      primaryContactId: meeting.primaryContactId,
      attendeeContactIds: meeting.attendees
        .map((attendee) => attendee.contactId)
        .filter((id): id is string => Boolean(id)),
    }))
  );
  const sheetOf = statuses.ok ? statuses.statuses : {};

  return {
    ok: true,
    days,
    meetings: result.meetings.map((meeting) => {
      const sheet = sheetOf[meeting.id];
      return {
        id: meeting.id,
        title: meeting.title,
        starts_at: meeting.startsAt,
        track: trackById.get(meeting.id) ?? null,
        primary_contact_id: meeting.primaryContactId,
        has_sheet: sheet ? sheet.status !== "none" : null,
        sheet_status: sheet?.status ?? null,
        call: sheet?.callLabel ?? null,
        playbook: sheet?.playbookName ?? null,
        has_plan: Boolean(meeting.planBuiltAt) || meeting.pointCount > 0,
        research_verified: !meeting.researchUnverified,
        attendees: meeting.attendees.map((person) => ({
          contact_id: person.contactId,
          name: person.name,
          email: person.email,
        })),
      };
    }),
  };
}
