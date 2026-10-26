import type { SlideInput } from "@/lib/live/decks-helpers";
import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";
import { createServiceRoleClient } from "@/lib/supabase/server";

async function slidesIdByPrepId(prepIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!prepIds.length) return map;
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .select("id, meeting_prep_id")
      .eq("kind", "slides")
      .in("meeting_prep_id", prepIds);
    if (error) return map;
    for (const row of data ?? []) {
      const prepId = row.meeting_prep_id as string | null;
      const deckId = row.id as string | null;
      if (prepId && deckId) map.set(prepId, deckId);
    }
  } catch {
    // decks table may not exist until migration 0114 is applied
  }
  return map;
}

export async function listUpcomingMeetingPreps(input: { days?: number } = {}) {
  const days = Math.min(30, Math.max(1, input.days ?? 7));
  const result = await getUpcomingMeetingPreps(days);
  if (!result.ok) throw new Error(result.error);

  const slidesByPrep = await slidesIdByPrepId(result.meetings.map((meeting) => meeting.id));

  return {
    ok: true,
    days,
    meetings: result.meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      starts_at: meeting.startsAt,
      ends_at: meeting.endsAt,
      attendees: meeting.attendees.map((person) => ({
        contact_id: person.contactId,
        name: person.name,
        email: person.email,
      })),
      slides_id: slidesByPrep.get(meeting.id) ?? null,
    })),
  };
}

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

export async function listSlidesMcp() {
  const { listSlides } = await import("@/lib/server-actions/decks");
  const result = await listSlides();
  if (!result.ok) throw new Error(result.error);
  return {
    ok: true,
    slides: result.slides.map((row) => ({
      id: row.id,
      name: row.name,
      meeting_prep_id: row.meetingPrepId,
      source_playbook_id: row.sourcePlaybookId,
      slide_count: row.slideCount,
      updated_at: row.updatedAt,
    })),
  };
}

export async function getSlidesMcp(input: { id: string }) {
  const { getDeck } = await import("@/lib/server-actions/decks");
  const result = await getDeck(input.id);
  if (!result.ok) throw new Error(result.error);
  if (result.deck.kind !== "slides") throw new Error("Not slides.");
  return {
    ok: true,
    id: result.deck.id,
    name: result.deck.name,
    meeting_prep_id: result.deck.meetingPrepId,
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

export async function createSlidesMcp(input: {
  playbook_id?: string;
  meeting_prep_id?: string;
  name?: string;
}) {
  const { createBlankSlides, createSlidesFromPlaybook } = await import("@/lib/server-actions/decks");
  if (input.playbook_id?.trim()) {
    const result = await createSlidesFromPlaybook(input.playbook_id, input.meeting_prep_id ?? null);
    if (!result.ok) throw new Error(result.error);
    return { ok: true, id: result.id };
  }
  const result = await createBlankSlides(input.name, input.meeting_prep_id ?? null);
  if (!result.ok) throw new Error(result.error);
  return { ok: true, id: result.id };
}

export async function setSlidesMcp(input: { id: string; slides: SlideInput[] }) {
  const { setSlides } = await import("@/lib/server-actions/decks");
  const result = await setSlides(input.id, input.slides);
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
