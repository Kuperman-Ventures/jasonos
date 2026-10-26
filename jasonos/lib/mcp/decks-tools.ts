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
    meeting_prep_id: result.deck.meetingPrepId,
    source_playbook_id: result.deck.sourcePlaybookId,
    slides: result.deck.slides.map((slide) => ({
      position: slide.position,
      headline: slide.headline,
      bullets: slide.bullets,
    })),
    ai_notes: result.deck.aiNotes,
    transcript: result.deck.transcript,
    transcript_source: result.deck.transcriptSource,
  };
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
