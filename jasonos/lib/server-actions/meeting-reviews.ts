"use server";

import { revalidatePath } from "next/cache";
import { callClaude } from "@/lib/ai/models";
import { getGranolaTranscript, searchGranolaForContact } from "@/lib/integrations/granola";
import {
  fallbackRubricFromOutcome,
  meetingReviewSystemPrompt,
  parseMeetingReview,
  rescueSpokenMatches,
  type CompanyFacts,
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
  rubricSource: "strategy" | "fallback" | null;
  updatedAt: string;
}

type ReviewResult<T> = ({ ok: true } & T) | { ok: false; error: string };

function hasConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function revalidateReview(prepId: string) {
  try {
    revalidatePath(`/meetings/${prepId}`);
    revalidatePath("/meetings/[id]", "page");
    revalidatePath("/live");
  } catch {
    // Outside a Next request (scripts / tests) revalidatePath throws.
  }
}

function asKind(value: string | null | undefined): MeetingReview["sourceKind"] {
  if (value === "transcript" || value === "summary" || value === "none") return value;
  return "none";
}

function asSpoken(item: SpokenPoint | Record<string, unknown>): SpokenPoint {
  const matchRaw = (item as SpokenPoint).match ?? (item as { match?: string }).match;
  const match =
    matchRaw === "exact" || matchRaw === "close" || matchRaw === "none"
      ? matchRaw
      : (item as SpokenPoint).spoken
        ? "exact"
        : "none";
  const nearest =
    (item as SpokenPoint).nearest ??
    (typeof (item as { nearest?: unknown }).nearest === "string"
      ? ((item as { nearest: string }).nearest as string)
      : null) ??
    (item as SpokenPoint).quote ??
    null;
  return {
    pointId: String(
      (item as SpokenPoint).pointId ?? (item as { point_id?: string }).point_id ?? ""
    ),
    spoken: match === "exact" || match === "close" || Boolean((item as SpokenPoint).spoken),
    match,
    nearest,
    quote: (item as SpokenPoint).quote ?? nearest,
    timestamp:
      (item as SpokenPoint).timestamp ??
      (typeof (item as { timestamp?: unknown }).timestamp === "string"
        ? (item as { timestamp: string }).timestamp
        : null),
  };
}

function asCompanyFacts(value: unknown): CompanyFacts {
  if (!value || typeof value !== "object") return { attendees: [] };
  const root = value as { attendees?: unknown };
  const rows = Array.isArray(root.attendees) ? root.attendees : [];
  return {
    attendees: rows
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const item = row as Record<string, unknown>;
        return {
          contactId: typeof item.contactId === "string" ? item.contactId : typeof item.contact_id === "string" ? item.contact_id : null,
          name: typeof item.name === "string" ? item.name : null,
          title: typeof item.title === "string" ? item.title : null,
          company: typeof item.company === "string" ? item.company : null,
          roleLine:
            typeof item.roleLine === "string"
              ? item.roleLine
              : typeof item.role_line === "string"
                ? item.role_line
                : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
  };
}

function toReview(row: Record<string, unknown>): MeetingReview {
  const spoken = Array.isArray(row.points_spoken) ? (row.points_spoken as SpokenPoint[]) : [];
  const rubric = Array.isArray(row.rubric_results) ? (row.rubric_results as RubricResult[]) : [];
  const reactions = Array.isArray(row.reactions_observed)
    ? (row.reactions_observed as ObservedAsk[])
    : [];
  const mark = row.suggested_mark;
  const ratio = row.talk_ratio;
  const rubricSource =
    row.rubric_source === "strategy" || row.rubric_source === "fallback"
      ? row.rubric_source
      : null;
  return {
    id: String(row.id),
    prepId: String(row.prep_id),
    source: typeof row.source === "string" ? row.source : "granola",
    sourceUrl: typeof row.source_url === "string" ? row.source_url : null,
    sourceKind: asKind(typeof row.source_kind === "string" ? row.source_kind : null),
    error: typeof row.error === "string" ? row.error : null,
    rubricSource,
    pointsSpoken: spoken.map((item) => asSpoken(item)),
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
    relationshipGoalNote:
      typeof row.relationship_goal_note === "string" ? row.relationship_goal_note : null,
    companyFacts: asCompanyFacts(row.company_facts),
    truncated: false,
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

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a?.trim().toLowerCase() ?? "";
  const right = b?.trim().toLowerCase() ?? "";
  if (!left || !right) return false;
  if (left === right) return true;
  const leftParts = left.split(/\s+/);
  const rightParts = right.split(/\s+/);
  if (leftParts[0] && rightParts[0] && leftParts[0] === rightParts[0]) {
    if (leftParts.length === 1 || rightParts.length === 1) return true;
    if (leftParts[leftParts.length - 1] === rightParts[rightParts.length - 1]) return true;
  }
  return left.includes(right) || right.includes(left);
}

async function writeCompanyFactsToContacts(
  prepId: string,
  facts: CompanyFacts,
  attendees: Array<{ contactId: string | null; name: string | null; email: string }>
): Promise<void> {
  if (!facts.attendees.length) return;
  const sb = createServiceRoleClient();
  const contactIds = [
    ...new Set(attendees.map((person) => person.contactId).filter((id): id is string => Boolean(id))),
  ];
  const contactById = new Map<string, { id: string; name: string | null; title: string | null }>();
  if (contactIds.length) {
    const { data } = await sb.from("contacts").select("id, name, title").in("id", contactIds);
    for (const row of data ?? []) {
      contactById.set(String(row.id), {
        id: String(row.id),
        name: typeof row.name === "string" ? row.name : null,
        title: typeof row.title === "string" ? row.title : null,
      });
    }
  }
  const resolvedAttendees = attendees.map((person) => ({
    ...person,
    name: person.name || (person.contactId ? contactById.get(person.contactId)?.name ?? null : null),
  }));
  const soleContactId =
    resolvedAttendees.filter((person) => person.contactId).length === 1
      ? resolvedAttendees.find((person) => person.contactId)?.contactId ?? null
      : null;

  for (const fact of facts.attendees) {
    const title = fact.title?.trim();
    if (!title) continue;
    if (/^jason\b/i.test(fact.name?.trim() || "")) continue;
    let contactId = fact.contactId?.trim() || null;
    if (!contactId && fact.name?.trim()) {
      contactId =
        resolvedAttendees.find((person) => namesMatch(person.name, fact.name))?.contactId ?? null;
    }
    if (!contactId && soleContactId && fact.name?.trim()) contactId = soleContactId;
    if (!contactId) continue;
    const existing = contactById.get(contactId);
    if (existing?.title?.trim()) continue;
    await sb
      .from("contacts")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", contactId);
  }
  try {
    revalidatePath(`/meetings/${prepId}`);
  } catch {
    // Outside a Next request.
  }
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
    if (
      /meeting_reviews/i.test(error.message) &&
      /does not exist|schema cache|could not find/i.test(error.message)
    ) {
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
  let rubricSource: "strategy" | "fallback" = "fallback";
  if (prep.scriptId) {
    const script = await getLiveScript(prep.scriptId);
    if (script.ok && script.script.rubric.length) {
      rubric = script.script.rubric;
      rubricSource = "strategy";
    }
  }

  const markable = pointsResult.points.filter((point) => point.kind !== "agenda");
  const asks = markable.filter((point) => point.kind === "ask");
  if (rubricSource === "fallback" || !rubric.length) {
    rubric = fallbackRubricFromOutcome(
      prep.outcomeSentence,
      asks.map((ask) => ({ headline: ask.headline }))
    );
    rubricSource = "fallback";
  }

  const primary = prep.attendees[0];
  const note = await searchGranolaForContact({
    contactName: primary?.name || prep.title,
    email: primary?.email ?? null,
    emails: prep.attendees.map((person) => person.email),
    aroundIso: prep.startsAt,
    calendarEventId: prep.gcalEventId,
    calendarEventIds: [prep.gcalEventId, prep.icalUid].filter((value): value is string =>
      Boolean(value)
    ),
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
      company_facts: { attendees: [] },
      error: note.error?.trim() || "No Granola note found for this meeting.",
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
      company_facts: { attendees: [] },
      error: "Granola note had no text to review.",
    });
    if (!saved.ok) return saved;
    revalidateReview(id);
    return saved;
  }

  const sbContacts = createServiceRoleClient();
  const attendeeContactIds = [
    ...new Set(
      prep.attendees.map((person) => person.contactId).filter((id): id is string => Boolean(id))
    ),
  ];
  const contactNames = new Map<string, string>();
  if (attendeeContactIds.length) {
    const { data: contactRows } = await sbContacts
      .from("contacts")
      .select("id, name")
      .in("id", attendeeContactIds);
    for (const row of contactRows ?? []) {
      if (typeof row.name === "string" && row.name.trim()) {
        contactNames.set(String(row.id), row.name.trim());
      }
    }
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
    attendees: prep.attendees.map((person) => ({
      name: person.name || (person.contactId ? contactNames.get(person.contactId) ?? null : null),
      email: person.email,
      contact_id: person.contactId,
    })),
    projectGoal: prep.projectGoal,
    relationshipGoal: prep.personalGoal,
    sourceKind,
    text: sourceText,
  };

  let modelText: string;
  try {
    modelText = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 4000,
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

  parsed.pointsSpoken = rescueSpokenMatches(
    parsed.pointsSpoken,
    markable.map((point) => ({
      id: point.id,
      headline: point.headline,
      detail: point.detail,
    })),
    sourceText
  );

  // Prefer contact_id from the prep attendees when the model omitted it.
  if (parsed.companyFacts.attendees.length) {
    parsed.companyFacts = {
      attendees: parsed.companyFacts.attendees.map((fact) => {
        if (fact.contactId) return fact;
        const byName = prep.attendees.find((person) => {
          const resolved =
            person.name || (person.contactId ? contactNames.get(person.contactId) ?? null : null);
          return namesMatch(resolved, fact.name);
        });
        if (byName?.contactId) return { ...fact, contactId: byName.contactId };
        if (
          prep.attendees.filter((person) => person.contactId).length === 1 &&
          fact.name &&
          !/^jason\b/i.test(fact.name)
        ) {
          return {
            ...fact,
            contactId: prep.attendees.find((person) => person.contactId)?.contactId ?? null,
          };
        }
        return fact;
      }),
    };
  }

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
    company_facts: parsed.companyFacts,
    error: parsed.truncated ? "Review output was cut off" : null,
  });
  if (!saved.ok) return saved;

  try {
    await writeCompanyFactsToContacts(
      id,
      parsed.companyFacts,
      prep.attendees.map((person) => ({
        contactId: person.contactId,
        name: person.name || (person.contactId ? contactNames.get(person.contactId) ?? null : null),
        email: person.email,
      }))
    );
  } catch (err) {
    console.error("[runMeetingReview] company facts", err);
  }

  // Attach rubric source for the UI (not a DB column — inferred).
  saved.review.rubricSource = rubricSource;
  revalidateReview(id);
  return saved;
}
