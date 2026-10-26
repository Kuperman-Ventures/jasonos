"use server";

import { revalidatePath } from "next/cache";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { callClaude } from "@/lib/ai/models";
import { firecrawlScrape } from "@/lib/integrations/firecrawl";
import { getGranolaTranscript, searchGranolaForContact } from "@/lib/integrations/granola";
import { searchThreadsByParticipants } from "@/lib/integrations/gmail";
import { searchWisprForContact } from "@/lib/integrations/wispr";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import {
  bulletsFromJson,
  bulletsLinesToText,
  bulletsTextToLines,
  capWords,
  extractTranscriptSection,
  normalizeSlideInputs,
  parseTailorJson,
  toJsonBullets,
} from "@/lib/live/decks-helpers";
import type { SlideInput } from "@/lib/live/decks-helpers";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type DeckKind = "playbook" | "slides";

export {
  bulletsFromJson,
  bulletsLinesToText,
  bulletsTextToLines,
  capWords,
  extractTranscriptSection,
  formatElapsed,
  normalizeSlideInputs,
  parseTailorJson,
  toJsonBullets,
} from "@/lib/live/decks-helpers";

export type { SlideInput } from "@/lib/live/decks-helpers";

export type DeckSummary = {
  id: string;
  kind: DeckKind;
  name: string;
  description: string | null;
  meetingPrepId: string | null;
  sourcePlaybookId: string | null;
  slideCount: number;
  updatedAt: string;
  runStartedAt: string | null;
  runEndedAt: string | null;
  aiNotes: string | null;
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
  transcriptFetchedAt: string | null;
};

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

type DeckRow = {
  id: string;
  kind: string;
  name: string;
  description: string | null;
  source_playbook_id: string | null;
  meeting_prep_id: string | null;
  ai_notes: string | null;
  ai_undo: unknown;
  run_started_at: string | null;
  run_ended_at: string | null;
  transcript: string | null;
  transcript_source: string | null;
  transcript_note_id: string | null;
  transcript_fetched_at: string | null;
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
  "id, kind, name, description, source_playbook_id, meeting_prep_id, ai_notes, ai_undo, run_started_at, run_ended_at, transcript, transcript_source, transcript_note_id, transcript_fetched_at, updated_at";

function hasConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function asKind(value: string): DeckKind {
  return value === "playbook" ? "playbook" : "slides";
}

function revalidateDeck(deckId: string, kind: DeckKind, prepId?: string | null) {
  revalidatePath("/live");
  revalidatePath("/live/playbooks");
  if (kind === "playbook") {
    revalidatePath(`/live/playbooks/${deckId}`);
    revalidatePath(`/live/playbooks/${deckId}/rehearse`);
  } else {
    revalidatePath(`/live/slides/${deckId}`);
    revalidatePath(`/live/slides/${deckId}/rehearse`);
    revalidatePath(`/live/slides/${deckId}/run`);
  }
  if (prepId) revalidatePath(`/meetings/${prepId}`);
}

function toSummary(row: DeckRow, slideCount: number): DeckSummary {
  return {
    id: row.id,
    kind: asKind(row.kind),
    name: row.name,
    description: row.description?.trim() || null,
    meetingPrepId: row.meeting_prep_id,
    sourcePlaybookId: row.source_playbook_id,
    slideCount,
    updatedAt: row.updated_at,
    runStartedAt: row.run_started_at,
    runEndedAt: row.run_ended_at,
    aiNotes: row.ai_notes?.trim() || null,
  };
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

export async function listSlides(): Promise<ActionResult<{ slides: DeckSummary[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("decks")
      .select(DECK_COLUMNS)
      .eq("kind", "slides")
      .order("updated_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as DeckRow[];
    const counts = await slideCounts(sb, rows.map((row) => row.id));
    return {
      ok: true,
      slides: rows.map((row) => toSummary(row, counts.get(row.id) ?? 0)),
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
        transcriptFetchedAt: row.transcript_fetched_at,
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
    const { data, error } = await sb
      .from("decks")
      .insert({ kind: "playbook", name: label })
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

export async function createBlankSlides(
  name?: string,
  meetingPrepId?: string | null
): Promise<ActionResult<{ id: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const label = (name?.trim() || "New Slides").slice(0, 200);
  const prepId = meetingPrepId?.trim() || null;
  try {
    const sb = createServiceRoleClient();
    if (prepId) {
      const existing = await sb
        .from("decks")
        .select("id")
        .eq("kind", "slides")
        .eq("meeting_prep_id", prepId)
        .maybeSingle();
      if (existing.data?.id) return { ok: false, error: "This meeting already has Slides." };
    }
    const { data, error } = await sb
      .from("decks")
      .insert({ kind: "slides", name: label, meeting_prep_id: prepId })
      .select("id, kind")
      .single();
    if (error || !data?.id) return { ok: false, error: error?.message || "Could not create slides." };
    const id = data.id as string;
    await sb.from("slides").insert({
      deck_id: id,
      position: 1,
      headline: "Opening",
      bullets: toJsonBullets([]),
    });
    revalidateDeck(id, "slides", prepId);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createSlidesFromPlaybook(
  playbookId: string,
  meetingPrepId?: string | null
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

    let deckName = (source as DeckRow).name;
    if (prepId) {
      const existing = await sb
        .from("decks")
        .select("id")
        .eq("kind", "slides")
        .eq("meeting_prep_id", prepId)
        .maybeSingle();
      if (existing.data?.id) {
        return { ok: false, error: "This meeting already has Slides." };
      }
      const prep = await getMeetingPrep(prepId);
      if (prep.ok && prep.prep.title.trim()) deckName = prep.prep.title.trim();
    }

    const sourceSlides = await loadSlides(sb, sourceId);
    const { data: created, error: createError } = await sb
      .from("decks")
      .insert({
        kind: "slides",
        name: deckName.slice(0, 200),
        source_playbook_id: sourceId,
        meeting_prep_id: prepId,
      })
      .select("id")
      .single();
    if (createError || !created?.id) {
      return { ok: false, error: createError?.message || "Could not create slides." };
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
    revalidateDeck(newId, "slides", prepId);
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

export async function setSlides(
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
      .eq("kind", "slides")
      .select("id, meeting_prep_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Slides not found." };
    revalidateDeck(id, "slides", data.meeting_prep_id as string | null);
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
      .eq("kind", "slides")
      .select("id, meeting_prep_id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Slides not found." };
    revalidateDeck(id, "slides", data.meeting_prep_id as string | null);
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
    if (deck.kind !== "slides") return { ok: false, error: "Transcripts are for Slides only." };
    if (!deck.meetingPrepId) return { ok: false, error: "These Slides are not linked to a meeting." };

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

    const granola = await searchGranolaForContact(searchBase);
    if (granola.found && granola.meetings?.[0]?.id) {
      noteId = granola.meetings[0].id;
      const direct = await getGranolaTranscript(noteId);
      transcript = direct?.text?.trim() || extractTranscriptSection(granola.summary) || null;
      if (transcript) source = "granola";
    }

    if (!transcript) {
      const wispr = await searchWisprForContact(searchBase);
      if (wispr.found && wispr.summary?.trim()) {
        transcript = extractTranscriptSection(wispr.summary) || wispr.summary.trim();
        noteId = wispr.meetingId ?? null;
        source = "wispr";
      }
    }

    const fetchedAt = new Date().toISOString();
    const sb = createServiceRoleClient();
    await sb
      .from("decks")
      .update({
        transcript,
        transcript_source: source,
        transcript_note_id: noteId,
        transcript_fetched_at: fetchedAt,
        updated_at: fetchedAt,
      })
      .eq("id", id);

    revalidateDeck(id, "slides", deck.meetingPrepId);
    return { ok: true, transcript, source, noteId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function tailorSlides(deckId: string): Promise<ActionResult<{ aiNotes: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const loaded = await getDeck(id);
    if (!loaded.ok) return loaded;
    const deck = loaded.deck;
    if (deck.kind !== "slides") return { ok: false, error: "Tailor works on Slides only." };
    if (!deck.slides.length) return { ok: false, error: "Add at least one Slide first." };

    const contextParts: string[] = [];
    let prepId: string | null = deck.meetingPrepId;

    if (prepId) {
      const prepResult = await getMeetingPrep(prepId);
      if (prepResult.ok) {
        const prep = prepResult.prep;
        contextParts.push(
          `Meeting: ${prep.title}\nWhen: ${prep.startsAt}\nPurpose: ${prep.purpose?.trim() || "(none)"}`
        );
        const focus = await focusAttendee(prep.attendees);
        contextParts.push(`Primary person: ${focus.name}${focus.company ? ` (${focus.company})` : ""}`);

        const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
        const threads = await searchThreadsByParticipants({
          addresses: focus.email ? [focus.email] : emailsFromAttendees(prep.attendees),
          domains: domainFromEmail(focus.email),
          since,
        });
        const mailText = formatMailContext(threads, 4000);
        if (mailText) contextParts.push(`Recent email (90 days):\n${mailText}`);

        const companyName = focus.company || prep.primaryCompanyName;
        const siteText = await loadCompanySiteText(focus.contactId, companyName);
        if (siteText) contextParts.push(`Company site:\n${siteText}`);
      }
    }

    const system = `You tailor Live Slides for Jason Kuperman's upcoming conversation.
${NO_AI_SLOP_WRITING_RULES}

Return JSON only:
{"notes":"1-3 sentences on what you changed","slides":[{"headline":"...","bullets":["..."]}]}
Keep the same number of slides unless context clearly needs one more or fewer (max ±1).
Each bullet is one short spoken line. No markdown.`;

    const user = `${contextParts.join("\n\n") || "No meeting context — tighten wording only."}

Current slides:
${JSON.stringify(
  deck.slides.map((slide) => ({ headline: slide.headline, bullets: slide.bullets })),
  null,
  2
)}`;

    const raw = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });

    const parsed = parseTailorJson(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const undo = {
      slides: deck.slides.map((slide) => ({ headline: slide.headline, bullets: slide.bullets })),
      aiNotes: deck.aiNotes,
    };

    const sb = createServiceRoleClient();
    await sb
      .from("decks")
      .update({
        ai_notes: parsed.value.notes,
        ai_undo: undo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    const saved = await setSlides(id, parsed.value.slides);
    if (!saved.ok) return saved;

    revalidateDeck(id, "slides", prepId);
    return { ok: true, aiNotes: parsed.value.notes };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function undoTailor(deckId: string): Promise<ActionResult<object>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = deckId.trim();
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb.from("decks").select("ai_undo, kind, meeting_prep_id").eq("id", id).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Not found." };
    const undo = data.ai_undo as { slides?: SlideInput[]; aiNotes?: string | null } | null;
    if (!undo?.slides?.length) return { ok: false, error: "Nothing to undo." };

    const restored = await setSlides(id, undo.slides);
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
  const scraped = await firecrawlScrape(url);
  if (!scraped?.text?.trim()) return null;
  return capWords(scraped.text.trim(), 3000);
}
