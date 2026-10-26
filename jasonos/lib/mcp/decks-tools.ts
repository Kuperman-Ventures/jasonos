import type { SlideInput } from "@/lib/live/decks-helpers";

export async function listPlaybooksMcp() {
  const { listPlaybooks } = await import("@/lib/server-actions/decks");
  const result = await listPlaybooks();
  if (!result.ok) throw new Error(result.error);
  return {
    ok: true,
    playbooks: result.playbooks.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      slide_count: row.slideCount,
      updated_at: row.updatedAt,
    })),
  };
}

export async function listDecksMcp() {
  const { listDecks } = await import("@/lib/server-actions/decks");
  const result = await listDecks();
  if (!result.ok) throw new Error(result.error);
  return {
    ok: true,
    decks: result.decks.map((row) => ({
      id: row.id,
      name: row.name,
      meeting_prep_id: row.meetingPrepId,
      source_playbook_id: row.sourcePlaybookId,
      slide_count: row.slideCount,
      updated_at: row.updatedAt,
    })),
  };
}

export async function getDeckMcp(input: { id: string }) {
  const { getDeck } = await import("@/lib/server-actions/decks");
  const result = await getDeck(input.id);
  if (!result.ok) throw new Error(result.error);
  if (result.deck.kind !== "deck") throw new Error("Not a deck.");
  return {
    ok: true,
    id: result.deck.id,
    name: result.deck.name,
    goal: result.deck.goal,
    meeting_prep_id: result.deck.meetingPrepId,
    source_playbook_id: result.deck.sourcePlaybookId,
    slides: result.deck.slides.map((slide) => ({
      id: slide.id,
      position: slide.position,
      headline: slide.headline,
      bullets: slide.bullets,
    })),
    ai_notes: result.deck.aiNotes,
    transcript: result.deck.transcript,
    transcript_source: result.deck.transcriptSource,
    reviewed_at: result.deck.reviewedAt,
    review: result.deck.review,
  };
}

export async function setGoalMcp(input: { deck_id: string; goal: string }) {
  const { setDeckGoal } = await import("@/lib/server-actions/decks");
  const result = await setDeckGoal(input.deck_id, input.goal);
  if (!result.ok) throw new Error(result.error);
  return { ok: true, goal: result.goal };
}

export async function runAiHelpMcp(input: {
  deck_id: string;
  instructions: string;
  mode: "add" | "replace";
  sources: {
    people?: string[];
    playbook_id?: string | null;
    open_text?: string | null;
    transcript_deck_ids?: string[];
    meeting?: { calendar?: boolean; email?: boolean; website?: boolean } | null;
  };
}) {
  const { runAiHelp } = await import("@/lib/server-actions/decks");
  const result = await runAiHelp(input.deck_id, {
    instructions: input.instructions,
    mode: input.mode,
    sources: {
      people: input.sources.people,
      playbookId: input.sources.playbook_id,
      openText: input.sources.open_text,
      transcriptDeckIds: input.sources.transcript_deck_ids,
      meeting: input.sources.meeting,
    },
  });
  if (!result.ok) throw new Error(result.error);
  return {
    ok: true,
    slide_count: result.slideCount,
    warnings: result.warnings,
    at: result.at,
  };
}

export async function reviewRunMcp(input: { deck_id: string }) {
  const { reviewRun } = await import("@/lib/server-actions/decks");
  const result = await reviewRun(input.deck_id);
  if (!result.ok) throw new Error(result.error);
  return { ok: true, review: result.review };
}

export async function getReviewMcp(input: { deck_id: string }) {
  const { getDeck } = await import("@/lib/server-actions/decks");
  const result = await getDeck(input.deck_id);
  if (!result.ok) throw new Error(result.error);
  if (result.deck.kind !== "deck") throw new Error("Not a deck.");
  return {
    ok: true,
    reviewed_at: result.deck.reviewedAt,
    review: result.deck.review,
  };
}

export async function attachMeetingMcp(input: {
  deck_id: string;
  meeting_prep_id: string | null;
}) {
  const { linkDeckMeeting, unlinkDeckMeeting } = await import("@/lib/server-actions/decks");
  if (input.meeting_prep_id == null) {
    const result = await unlinkDeckMeeting(input.deck_id);
    if (!result.ok) throw new Error(result.error);
    return { ok: true, meeting_prep_id: null };
  }
  const result = await linkDeckMeeting(input.deck_id, input.meeting_prep_id);
  if (!result.ok) throw new Error(result.error);
  return { ok: true, meeting_prep_id: result.meetingPrepId };
}

export async function createDeckMcp(input: {
  playbook_id?: string;
  meeting_prep_id?: string;
  name?: string;
}) {
  const { createBlankDeck, createDeckFromPlaybook } = await import("@/lib/server-actions/decks");
  if (input.playbook_id?.trim()) {
    const result = await createDeckFromPlaybook(input.playbook_id, input.meeting_prep_id ?? null);
    if (!result.ok) throw new Error(result.error);
    return { ok: true, id: result.id };
  }
  const result = await createBlankDeck(input.name, input.meeting_prep_id ?? null);
  if (!result.ok) throw new Error(result.error);
  return { ok: true, id: result.id };
}

export async function setDeckSlidesMcp(input: { id: string; slides: SlideInput[] }) {
  const { setDeckSlides } = await import("@/lib/server-actions/decks");
  const result = await setDeckSlides(input.id, input.slides);
  if (!result.ok) throw new Error(result.error);
  return { ok: true, count: result.count };
}

export async function getTranscriptMcp(input: { id: string }) {
  const { fetchTranscript } = await import("@/lib/server-actions/decks");
  const result = await fetchTranscript(input.id);
  if (!result.ok) throw new Error(result.error);
  return {
    ok: true,
    transcript: result.transcript,
    source: result.source,
    note_id: result.noteId,
  };
}

export async function updatePlaybookFromDeckMcp(input: { deck_id: string }) {
  const { updatePlaybookFromDeck } = await import("@/lib/server-actions/decks");
  const result = await updatePlaybookFromDeck(input.deck_id);
  if (!result.ok) throw new Error(result.error);
  return {
    ok: true,
    playbook_id: result.playbookId,
    slide_count: result.slideCount,
    playbook_name: result.playbookName,
  };
}

export async function createPlaybookFromDeckMcp(input: {
  deck_id: string;
  name: string;
  description?: string;
}) {
  const { createPlaybookFromDeck } = await import("@/lib/server-actions/decks");
  const result = await createPlaybookFromDeck(input.deck_id, {
    name: input.name,
    description: input.description,
  });
  if (!result.ok) throw new Error(result.error);
  return { ok: true, playbook_id: result.playbookId, name: result.name };
}
