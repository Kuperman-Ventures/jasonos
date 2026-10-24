"use server";

import { revalidatePath } from "next/cache";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { callClaude } from "@/lib/ai/models";
import {
  blockRowsFromPlaybook,
  buildSheetDraftMessage,
  cleanBody,
  DRAFT_BLOCK_KEYS,
  editedLines,
  blockIsFilled,
  asNetworkingStatus,
  mergeDraftLines,
  parseSheetDraft,
  parseSheetLines,
  readyProblem,
  sheetDraftSystemPrompt,
  type CallSheetBlock,
  type CallSheetBlockDraft,
  type CallSheetLine,
  type NetworkingStatus,
} from "@/lib/meeting-prep/call-sheet";
import { loadMeetingContext } from "@/lib/meeting-prep/context";
import type { MeetingContextPerson } from "@/lib/meeting-prep/context-model";
import { assembleDraftPrompt, meetingTrack } from "@/lib/meeting-prep/draft-context";
import {
  BLOCK_KINDS,
  BROWNING_FAMILIES,
  asFamily,
  blockKeyFromTitle,
  parseObjections,
  parseTimeBudget,
  type BlockKind,
  type PlaybookFamily,
  type PlaybookObjection,
  type PlaybookTimeBudget,
} from "@/lib/meeting-prep/playbook-blocks";
import {
  buildMeetingPointsUserMessage,
  fillNarrativePlaceholders,
  fillScriptPlaceholders,
  fillStrategySettings,
} from "@/lib/meeting-prep/points";
import { callOfThree } from "@/lib/meeting-prep/people";
import {
  acceptAdaptation,
  attachPlanToMeeting,
  createLiveScript,
  getLiveScript,
  proposeAdaptation,
} from "@/lib/server-actions/live-scripts";
import { getLiveSettings, type LiveSettings } from "@/lib/server-actions/live-settings";
import { ensureResearchAndEmail } from "@/lib/server-actions/meeting-plan";
import { draftMeetingPoints } from "@/lib/server-actions/meeting-points";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import { listNarratives, narrativesForTrack } from "@/lib/server-actions/narratives";
import { createServiceRoleClient } from "@/lib/supabase/server";

type SheetResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface CallSheetPlaybook {
  id: string | null;
  name: string;
  family: PlaybookFamily;
  timeBudget: PlaybookTimeBudget | null;
  objections: PlaybookObjection[];
}

export interface CallSheetPerson {
  contactId: string;
  name: string;
  networkingStatus: NetworkingStatus | null;
  touchCount: number;
  toDiscussNext: string | null;
  /** This call's place in the relationship log: the logged touch, or the next one. */
  touchNumber: number;
}

export interface CallSheet {
  prepId: string | null;
  sheetId: string | null;
  playbook: CallSheetPlaybook | null;
  blocks: CallSheetBlock[];
  readyAt: string | null;
  person: CallSheetPerson | null;
}

interface BlockRow {
  id: string;
  prep_id: string | null;
  sheet_id: string | null;
  position: number;
  key: string;
  title: string;
  kind: string;
  required: boolean;
  body: string | null;
  lines: unknown;
  rule: string | null;
  confirmed_at: string | null;
  updated_at: string;
}

const BLOCK_COLUMNS =
  "id, prep_id, sheet_id, position, key, title, kind, required, body, lines, rule, confirmed_at, updated_at";
const KIND_SET = new Set<string>(BLOCK_KINDS);
const EMPTY_SETTINGS: LiveSettings = { targetCompanies: [], snapshot: null };

function hasConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function revalidateSheet(prepId?: string | null) {
  try {
    revalidatePath("/live");
    if (prepId) {
      revalidatePath(`/meetings/${prepId}`);
      revalidatePath(`/meetings/${prepId}/live`);
    }
    revalidatePath("/meetings/[id]", "page");
    revalidatePath("/live/sheets/[id]", "page");
  } catch {
    // Outside a Next request revalidatePath throws.
  }
}

function toBlock(row: BlockRow): CallSheetBlock {
  return {
    id: row.id,
    position: row.position,
    key: row.key,
    title: row.title,
    kind: KIND_SET.has(row.kind) ? (row.kind as BlockKind) : "text",
    required: Boolean(row.required),
    body: row.body?.trim() ? row.body : null,
    lines: parseSheetLines(row.lines),
    rule: row.rule?.trim() || null,
    confirmedAt: row.confirmed_at ?? null,
    updatedAt: row.updated_at,
  };
}

type Owner = { prepId: string; sheetId?: undefined } | { sheetId: string; prepId?: undefined };

function ownerOf(input: { prepId?: string | null; sheetId?: string | null }): Owner | null {
  const prepId = input.prepId?.trim();
  if (prepId) return { prepId };
  const sheetId = input.sheetId?.trim();
  if (sheetId) return { sheetId };
  return null;
}

function ownerColumn(owner: Owner): ["prep_id" | "sheet_id", string] {
  return owner.prepId ? ["prep_id", owner.prepId] : ["sheet_id", owner.sheetId as string];
}

type Filler = (value: string | null) => string | null;

function makeFiller(
  person: { name?: string | null; company?: string | null; title?: string | null } | null,
  settings: LiveSettings,
  narratives: Array<{ key: string; body: string }>
): Filler {
  return (value) =>
    fillNarrativePlaceholders(fillStrategySettings(fillScriptPlaceholders(value, person), settings), narratives);
}

async function fillerFor(
  person: { name?: string | null; company?: string | null; title?: string | null } | null
): Promise<Filler> {
  const [settingsResult, narrativesResult] = await Promise.all([getLiveSettings(), listNarratives()]);
  const settings = settingsResult.ok ? settingsResult : EMPTY_SETTINGS;
  const narratives = narrativesResult.ok
    ? narrativesResult.narratives.map((item) => ({ key: item.key, body: item.body }))
    : [];
  return makeFiller(person, settings, narratives);
}

function primaryPerson(
  people: MeetingContextPerson[],
  primaryContactId: string | null
): MeetingContextPerson | null {
  return people.find((person) => person.contactId === primaryContactId) ?? people[0] ?? null;
}

/** Who, from what research already found. Build may replace it. */
function whoFromPerson(person: MeetingContextPerson | null): string | null {
  if (!person) return null;
  const parts: string[] = [];
  const role = [person.title, person.company].filter(Boolean).join(" at ");
  if (person.researchLead?.trim()) parts.push(person.researchLead.trim());
  else if (role) parts.push(`${person.name}, ${role}.`);
  if (person.referredByName) parts.push(`Introduced by ${person.referredByName}.`);
  return parts.join(" ") || null;
}

async function loadBlocks(owner: Owner): Promise<SheetResult<{ blocks: CallSheetBlock[] }>> {
  const sb = createServiceRoleClient();
  const [column, id] = ownerColumn(owner);
  const { data, error } = await sb
    .from("call_sheet_blocks")
    .select(BLOCK_COLUMNS)
    .eq(column, id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, blocks: ((data ?? []) as BlockRow[]).map(toBlock) };
}

async function loadPerson(prepId: string): Promise<CallSheetPerson | null> {
  const sb = createServiceRoleClient();
  const { data: prep } = await sb
    .from("meeting_preps")
    .select("primary_contact_id, attendees")
    .eq("id", prepId)
    .maybeSingle();
  if (!prep) return null;
  let contactId = (prep.primary_contact_id as string | null) ?? null;
  if (!contactId && Array.isArray(prep.attendees)) {
    for (const row of prep.attendees as Array<{ contact_id?: string | null }>) {
      if (row?.contact_id) {
        contactId = row.contact_id;
        break;
      }
    }
  }
  if (!contactId) return null;
  const { data: contact } = await sb
    .from("contacts")
    .select("id, name, networking_status, touch_count, to_discuss_next")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return null;
  const touchCount = typeof contact.touch_count === "number" ? contact.touch_count : 0;
  const { data: logged } = await sb
    .from("relationship_log")
    .select("touch_number")
    .eq("prep_id", prepId)
    .maybeSingle();
  const touchNumber = typeof logged?.touch_number === "number" ? logged.touch_number : touchCount + 1;
  return {
    contactId,
    name: String(contact.name ?? "").trim() || "This person",
    networkingStatus: asNetworkingStatus(contact.networking_status),
    touchCount,
    toDiscussNext: (contact.to_discuss_next as string | null)?.trim() || null,
    touchNumber,
  };
}

async function loadPlaybook(scriptId: string | null): Promise<CallSheetPlaybook | null> {
  if (!scriptId) return null;
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("live_scripts")
    .select("id, name, family, time_budget, objections")
    .eq("id", scriptId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    name: String(data.name ?? "").trim() || "Playbook",
    family: asFamily(data.family),
    timeBudget: parseTimeBudget(data.time_budget),
    objections: parseObjections(data.objections),
  };
}

/** Browning tracking for the meeting's person; the playbook picker suggests from it. */
export async function getCallSheetPerson(prepId: string): Promise<SheetResult<{ person: CallSheetPerson | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  return { ok: true, person: await loadPerson(id) };
}

/** The sheet for a meeting (prepId) or an unattached sheet (sheetId). Null when the meeting has none. */
export async function getCallSheet(input: {
  prepId?: string | null;
  sheetId?: string | null;
}): Promise<SheetResult<{ sheet: CallSheet | null }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const owner = ownerOf(input);
  if (!owner) return { ok: false, error: "Call sheet not found." };
  const loaded = await loadBlocks(owner);
  if (!loaded.ok) return loaded;
  if (!loaded.blocks.length) return { ok: true, sheet: null };

  const sb = createServiceRoleClient();
  if (owner.prepId) {
    const { data: prep, error } = await sb
      .from("meeting_preps")
      .select("id, script_id, sheet_ready_at")
      .eq("id", owner.prepId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!prep) return { ok: false, error: "Meeting prep not found." };
    const [playbook, person] = await Promise.all([
      loadPlaybook((prep.script_id as string | null) ?? null),
      loadPerson(owner.prepId),
    ]);
    let filledPlaybook = playbook;
    if (playbook?.objections.length) {
      const fill = await fillerFor(person ? { name: person.name } : null);
      filledPlaybook = {
        ...playbook,
        objections: playbook.objections.map((row) => ({
          ...row,
          soundsLike: fill(row.soundsLike) ?? row.soundsLike,
          pivot: fill(row.pivot) ?? row.pivot,
        })),
      };
    }
    return {
      ok: true,
      sheet: {
        prepId: owner.prepId,
        sheetId: null,
        playbook: filledPlaybook,
        blocks: loaded.blocks,
        readyAt: (prep.sheet_ready_at as string | null) ?? null,
        person,
      },
    };
  }

  const playbook = await loadPlaybook(owner.sheetId as string);
  return {
    ok: true,
    sheet: {
      prepId: null,
      sheetId: owner.sheetId as string,
      playbook,
      blocks: loaded.blocks,
      readyAt: null,
      person: null,
    },
  };
}

async function insertBlocks(owner: Owner, rows: CallSheetBlockDraft[]): Promise<SheetResult<object>> {
  const sb = createServiceRoleClient();
  const [column, id] = ownerColumn(owner);
  const { error } = await sb.from("call_sheet_blocks").insert(
    rows.map((row) => ({
      [column]: id,
      position: row.position,
      key: row.key,
      title: row.title,
      kind: row.kind,
      required: row.required,
      body: cleanBody(row.body),
      lines: row.lines,
      rule: row.rule,
    }))
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function bumpUse(scriptId: string) {
  const sb = createServiceRoleClient();
  const { data } = await sb.from("live_scripts").select("use_count").eq("id", scriptId).maybeSingle();
  await sb
    .from("live_scripts")
    .update({
      use_count: (typeof data?.use_count === "number" ? data.use_count : 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", scriptId);
}

function easternDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
}

/**
 * Start a sheet from a playbook. With a meeting: blocks go on the meeting, playbook
 * points go to meeting_points when the meeting has none, and the meeting records the
 * playbook. Without one: an unattached sheet (live_scripts kind plan) holds the blocks
 * and points until it is attached.
 */
export async function createCallSheet(input: {
  prepId: string | null;
  playbookId: string;
}): Promise<SheetResult<{ sheet: CallSheet; pointsAdded: number }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const playbookId = input.playbookId.trim();
  if (!playbookId) return { ok: false, error: "Pick a playbook." };
  const loaded = await getLiveScript(playbookId);
  if (!loaded.ok) return loaded;
  if (loaded.script.kind !== "strategy") return { ok: false, error: "Pick a playbook." };
  if (!loaded.script.blocks.length) return { ok: false, error: "This playbook has no blocks yet." };
  const sb = createServiceRoleClient();
  const prepId = input.prepId?.trim() || null;

  if (prepId) {
    const existing = await loadBlocks({ prepId });
    if (!existing.ok) return existing;
    if (existing.blocks.length) return { ok: false, error: "This meeting already has a call sheet." };
    const prepResult = await getMeetingPrep(prepId);
    if (!prepResult.ok) return prepResult;

    let person: MeetingContextPerson | null = null;
    try {
      const context = await loadMeetingContext(prepId);
      person = primaryPerson(context.people, prepResult.prep.primaryContactId);
    } catch (err) {
      console.error("[createCallSheet] context", err);
    }
    const fill = await fillerFor(person);
    const rows = blockRowsFromPlaybook(loaded.script.blocks, fill);
    const who = rows.find((row) => row.key === "who" && row.kind === "text");
    if (who && !who.body) who.body = whoFromPerson(person);

    const inserted = await insertBlocks({ prepId }, rows);
    if (!inserted.ok) return inserted;

    let pointsAdded = 0;
    const { count, error: countError } = await sb
      .from("meeting_points")
      .select("id", { count: "exact", head: true })
      .eq("prep_id", prepId);
    if (countError) return { ok: false, error: countError.message };
    if (!count && loaded.items.length) {
      const { error: pointError } = await sb.from("meeting_points").insert(
        loaded.items.map((item, index) => ({
          prep_id: prepId,
          position: index + 1,
          kind: item.kind,
          headline: fill(item.headline) || item.headline,
          detail: fill(item.detail),
          listen_for: item.listenFor,
          state: "open",
          source: "script",
          script_id: playbookId,
          edited_by_user: false,
          prepare_reactions: item.prepareReactions,
          reactions: item.reactions.map((reaction) => ({
            shape: reaction.shape,
            soundsLike: fill(reaction.soundsLike) || reaction.soundsLike,
            pivot: fill(reaction.pivot) || reaction.pivot,
          })),
        }))
      );
      if (pointError) {
        await sb.from("call_sheet_blocks").delete().eq("prep_id", prepId);
        return { ok: false, error: pointError.message };
      }
      pointsAdded = loaded.items.length;
    }

    const now = new Date().toISOString();
    const { error: prepError } = await sb
      .from("meeting_preps")
      .update({ script_id: playbookId, sheet_ready_at: null, updated_at: now })
      .eq("id", prepId);
    if (prepError) return { ok: false, error: prepError.message };
    await bumpUse(playbookId);

    const sheet = await getCallSheet({ prepId });
    if (!sheet.ok) return sheet;
    if (!sheet.sheet) return { ok: false, error: "Could not read the new sheet." };
    revalidateSheet(prepId);
    return { ok: true, sheet: sheet.sheet, pointsAdded };
  }

  const baseName = `${loaded.script.name} sheet, ${easternDay(new Date().toISOString())}`;
  let created: Awaited<ReturnType<typeof createLiveScript>> | null = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    created = await createLiveScript({
      name: attempt === 1 ? baseName : `${baseName} (${attempt})`,
      kind: "plan",
      family: loaded.script.family,
      blocks: loaded.script.blocks,
      timeBudget: loaded.script.timeBudget,
      objections: loaded.script.objections,
    });
    if (created.ok || !/already exists/i.test(created.error)) break;
  }
  if (!created?.ok) return { ok: false, error: created?.error ?? "Could not start the sheet." };
  const sheetId = created.script.id;

  const inserted = await insertBlocks({ sheetId }, blockRowsFromPlaybook(loaded.script.blocks));
  if (!inserted.ok) {
    await sb.from("live_scripts").delete().eq("id", sheetId);
    return inserted;
  }
  if (loaded.items.length) {
    const { error: itemError } = await sb.from("live_script_items").insert(
      loaded.items.map((item, index) => ({
        script_id: sheetId,
        position: index + 1,
        kind: item.kind,
        headline: item.headline,
        detail: item.detail,
        listen_for: item.listenFor,
        prepare_reactions: item.prepareReactions,
        reactions: item.reactions,
      }))
    );
    if (itemError) {
      await sb.from("live_scripts").delete().eq("id", sheetId);
      return { ok: false, error: itemError.message };
    }
  }
  await bumpUse(playbookId);
  const sheet = await getCallSheet({ sheetId });
  if (!sheet.ok) return sheet;
  if (!sheet.sheet) return { ok: false, error: "Could not read the new sheet." };
  revalidateSheet(null);
  return { ok: true, sheet: sheet.sheet, pointsAdded: loaded.items.length };
}

async function previousToDiscuss(contactId: string, prepId: string, stored: string | null): Promise<string | null> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("relationship_log")
    .select("prep_id, to_discuss_next, occurred_at")
    .eq("contact_id", contactId)
    .not("to_discuss_next", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(3);
  for (const row of data ?? []) {
    if (row.prep_id === prepId) continue;
    const text = typeof row.to_discuss_next === "string" ? row.to_discuss_next.trim() : "";
    if (text) return text;
  }
  return stored;
}

async function writeBlock(
  blockId: string,
  patch: { body?: string | null; lines?: CallSheetLine[] }
): Promise<SheetResult<object>> {
  const sb = createServiceRoleClient();
  const { error } = await sb.from("call_sheet_blocks").update(patch).eq("id", blockId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Fill the sheet from research, email and the playbook. Only unconfirmed, empty parts change. */
export async function buildCallSheet(input: { prepId: string }): Promise<
  SheetResult<{
    sheet: CallSheet;
    contextUsed: string[];
    contextMissing: string[];
    researchVerified: boolean;
    pointsAdded: number;
    warnings: string[];
  }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const prepId = input.prepId.trim();
  if (!prepId) return { ok: false, error: "Meeting prep not found." };
  const current = await getCallSheet({ prepId });
  if (!current.ok) return current;
  if (!current.sheet) return { ok: false, error: "Start a sheet first." };
  const sheet = current.sheet;

  const prepared = await ensureResearchAndEmail(prepId);
  if (!prepared.ok) return prepared;
  const prepResult = await getMeetingPrep(prepId);
  if (!prepResult.ok) return prepResult;
  const prep = prepResult.prep;
  let context;
  try {
    context = await loadMeetingContext(prepId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const person = primaryPerson(context.people, prep.primaryContactId);
  const warnings: string[] = [];

  const fillLines = async () => {
    const who = sheet.blocks.find((block) => block.key === "who" && block.kind === "text");
    const wantWho = Boolean(who && !who.confirmedAt);
    const empty: Record<string, string[]> = {};
    for (const key of DRAFT_BLOCK_KEYS) {
      const block = sheet.blocks.find((item) => item.key === key && item.kind === "lines");
      if (!block || block.confirmedAt) continue;
      const labels = block.lines.filter((line) => !line.text.trim()).map((line) => line.label);
      if (labels.length) empty[key] = labels;
    }

    if (wantWho || Object.keys(empty).length) {
      const track = meetingTrack(prep.track, context.people);
      const narrativeResult = await narrativesForTrack(track);
      const narratives = narrativeResult.ok
        ? narrativeResult.narratives.map((item) => ({ title: item.title, body: item.body }))
        : [];
      const assembled = assembleDraftPrompt(prep, context, narratives);
      let draft = null;
      try {
        const text = await callClaude({
          model: "claude-sonnet-4-6",
          maxTokens: 1500,
          system: sheetDraftSystemPrompt(NO_AI_SLOP_WRITING_RULES),
          messages: [
            {
              role: "user",
              content: buildSheetDraftMessage({
                context: buildMeetingPointsUserMessage(assembled.input),
                wantWho,
                empty,
              }),
            },
          ],
        });
        draft = parseSheetDraft(text);
        if (!draft) warnings.push("Could not read the drafted lines.");
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : "Could not draft lines.");
      }

      if (who && wantWho) {
        const body = draft?.who?.text || whoFromPerson(person);
        if (body && body !== who.body) await writeBlock(who.id, { body });
      }
      for (const key of Object.keys(empty)) {
        const block = sheet.blocks.find((item) => item.key === key && item.kind === "lines");
        const drafted = draft?.lines[key];
        if (!block || !drafted?.length) continue;
        const merged = mergeDraftLines(block.lines, drafted);
        if (merged.changed) await writeBlock(block.id, { lines: merged.lines });
      }
    }

    const why = sheet.blocks.find((block) => block.key === "why" && block.kind === "lines");
    if (why && !why.confirmedAt && why.lines.length >= 3 && !why.lines[2].text.trim() && sheet.person) {
      const carried = await previousToDiscuss(sheet.person.contactId, prepId, sheet.person.toDiscussNext);
      if (carried) {
        const lines = why.lines.map((line, index) =>
          index === 2 ? { ...line, text: carried, sourceHint: "To discuss next, from your last debrief" } : line
        );
        await writeBlock(why.id, { lines });
      }
    }
  };

  const fillPoints = async (): Promise<number> => {
    const family = sheet.playbook?.family ?? "custom";
    const playbookId = sheet.playbook?.id ?? null;
    const adapt = playbookId && (BROWNING_FAMILIES.has(family) || family === "advisors");
    if (adapt && playbookId) {
      const proposed = await proposeAdaptation({ scriptId: playbookId, prepId });
      if (!proposed.ok) {
        if (!/already accepted|has no points/i.test(proposed.error)) warnings.push(proposed.error);
        if (!/has no points/i.test(proposed.error)) return 0;
      } else {
        const sb = createServiceRoleClient();
        const { data: points } = await sb
          .from("meeting_points")
          .select("source, edited_by_user")
          .eq("prep_id", prepId);
        const touched = (points ?? []).some((row) => row.edited_by_user || row.source === "user");
        const accepted = await acceptAdaptation({
          adaptationId: proposed.adaptation.id,
          mode: touched ? "add" : "replace",
        });
        if (!accepted.ok) {
          warnings.push(accepted.error);
          return 0;
        }
        return accepted.added;
      }
    }
    const drafted = await draftMeetingPoints(prepId);
    if (!drafted.ok) {
      warnings.push(drafted.error);
      return 0;
    }
    return drafted.added;
  };

  const [, pointsAdded] = await Promise.all([fillLines(), fillPoints()]);

  const now = new Date().toISOString();
  const sb = createServiceRoleClient();
  await sb
    .from("meeting_preps")
    .update({
      plan_built_at: now,
      plan_source: sheet.playbook?.family === "blank" ? "blank" : "playbook",
      updated_at: now,
    })
    .eq("id", prepId);

  const rebuilt = await getCallSheet({ prepId });
  if (!rebuilt.ok) return rebuilt;
  if (!rebuilt.sheet) return { ok: false, error: "Could not read the sheet." };
  revalidateSheet(prepId);
  return {
    ok: true,
    sheet: rebuilt.sheet,
    contextUsed: prepared.contextUsed,
    contextMissing: prepared.contextMissing,
    researchVerified: prepared.researchVerified,
    pointsAdded,
    warnings,
  };
}

async function readBlock(blockId: string): Promise<SheetResult<{ row: BlockRow }>> {
  const id = blockId.trim();
  if (!id) return { ok: false, error: "Block not found." };
  const sb = createServiceRoleClient();
  const { data, error } = await sb.from("call_sheet_blocks").select(BLOCK_COLUMNS).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Block not found." };
  return { ok: true, row: data as BlockRow };
}

export async function updateCallSheetBlock(
  blockId: string,
  patch: { body?: string | null; lines?: Array<{ label: string; text: string; sourceHint?: string | null }> }
): Promise<SheetResult<{ block: CallSheetBlock }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const read = await readBlock(blockId);
  if (!read.ok) return read;
  const previous = toBlock(read.row);

  const update: Record<string, unknown> = { confirmed_at: new Date().toISOString() };
  if (patch.body !== undefined) update.body = cleanBody(patch.body);
  if (patch.lines !== undefined) {
    const next = parseSheetLines(
      patch.lines.map((line) => ({ label: line.label, text: line.text, sourceHint: line.sourceHint ?? null }))
    );
    update.lines = editedLines(previous.lines, next);
  }
  if (patch.body === undefined && patch.lines === undefined) return { ok: false, error: "Nothing to save." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("call_sheet_blocks")
    .update(update)
    .eq("id", previous.id)
    .select(BLOCK_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Block not found." };
  const block = toBlock(data as BlockRow);

  if (read.row.prep_id && block.required && !blockIsFilled(block)) {
    await sb.from("meeting_preps").update({ sheet_ready_at: null }).eq("id", read.row.prep_id);
  }
  revalidateSheet(read.row.prep_id);
  return { ok: true, block };
}

export async function confirmCallSheetBlock(blockId: string): Promise<SheetResult<{ confirmedAt: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const read = await readBlock(blockId);
  if (!read.ok) return read;
  const now = new Date().toISOString();
  const sb = createServiceRoleClient();
  const { error } = await sb.from("call_sheet_blocks").update({ confirmed_at: now }).eq("id", read.row.id);
  if (error) return { ok: false, error: error.message };
  revalidateSheet(read.row.prep_id);
  return { ok: true, confirmedAt: now };
}

async function renumber(owner: Owner, orderedIds: string[]): Promise<SheetResult<object>> {
  const sb = createServiceRoleClient();
  const [column, id] = ownerColumn(owner);
  for (const [index, blockId] of orderedIds.entries()) {
    const { error } = await sb
      .from("call_sheet_blocks")
      .update({ position: index + 1 })
      .eq("id", blockId)
      .eq(column, id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function addCallSheetBlock(input: {
  prepId?: string | null;
  sheetId?: string | null;
  title: string;
  kind: BlockKind;
  afterBlockId?: string | null;
}): Promise<SheetResult<{ block: CallSheetBlock }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const owner = ownerOf(input);
  if (!owner) return { ok: false, error: "Call sheet not found." };
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!title) return { ok: false, error: "Name the block." };
  if (!KIND_SET.has(input.kind)) return { ok: false, error: "Pick a kind." };
  const loaded = await loadBlocks(owner);
  if (!loaded.ok) return loaded;
  if (input.kind === "points" && loaded.blocks.some((block) => block.kind === "points")) {
    return { ok: false, error: "This sheet already has a points block." };
  }

  const sb = createServiceRoleClient();
  const [column, id] = ownerColumn(owner);
  const { data, error } = await sb
    .from("call_sheet_blocks")
    .insert({
      [column]: id,
      position: loaded.blocks.length + 1,
      key: blockKeyFromTitle(title, loaded.blocks.map((block) => block.key)),
      title,
      kind: input.kind,
      required: false,
      body: null,
      lines: input.kind === "lines" ? [{ label: "Line", text: "", sourceHint: null }] : [],
      rule: null,
    })
    .select(BLOCK_COLUMNS)
    .single();
  if (error) return { ok: false, error: error.message };
  const block = toBlock(data as BlockRow);

  const order = loaded.blocks.map((item) => item.id);
  const after = input.afterBlockId ? order.indexOf(input.afterBlockId) : -1;
  if (after >= 0 && after < order.length - 1) {
    order.splice(after + 1, 0, block.id);
    const renumbered = await renumber(owner, order);
    if (!renumbered.ok) return renumbered;
  }
  revalidateSheet(owner.prepId);
  return { ok: true, block };
}

export async function removeCallSheetBlock(blockId: string): Promise<SheetResult<object>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const read = await readBlock(blockId);
  if (!read.ok) return read;
  const owner = ownerOf({ prepId: read.row.prep_id, sheetId: read.row.sheet_id });
  const sb = createServiceRoleClient();
  const { error } = await sb.from("call_sheet_blocks").delete().eq("id", read.row.id);
  if (error) return { ok: false, error: error.message };
  if (owner) {
    const loaded = await loadBlocks(owner);
    if (loaded.ok) await renumber(owner, loaded.blocks.map((block) => block.id));
  }
  revalidateSheet(read.row.prep_id);
  return { ok: true };
}

export async function reorderCallSheetBlocks(input: {
  prepId?: string | null;
  sheetId?: string | null;
  orderedIds: string[];
}): Promise<SheetResult<object>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const owner = ownerOf(input);
  if (!owner) return { ok: false, error: "Call sheet not found." };
  const loaded = await loadBlocks(owner);
  if (!loaded.ok) return loaded;
  const ids = input.orderedIds.map((item) => item.trim()).filter(Boolean);
  const known = new Set(loaded.blocks.map((block) => block.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((item) => !known.has(item))) {
    return { ok: false, error: "Block order does not match this sheet." };
  }
  const renumbered = await renumber(owner, ids);
  if (!renumbered.ok) return renumbered;
  revalidateSheet(owner.prepId);
  return { ok: true };
}

/**
 * Ready checks saved values only. Unsaved edits are checked in the browser before this runs.
 */
export async function markSheetReady(prepId: string): Promise<SheetResult<{ readyAt: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const loaded = await loadBlocks({ prepId: id });
  if (!loaded.ok) return loaded;
  if (!loaded.blocks.length) return { ok: false, error: "Start a sheet first." };

  const sb = createServiceRoleClient();
  const { count } = await sb
    .from("meeting_points")
    .select("id", { count: "exact", head: true })
    .eq("prep_id", id)
    .neq("kind", "agenda");
  const problem = readyProblem(loaded.blocks, count ?? 0);
  if (problem) return { ok: false, error: problem };

  const now = new Date().toISOString();
  const { error } = await sb.from("meeting_preps").update({ sheet_ready_at: now, updated_at: now }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateSheet(id);
  return { ok: true, readyAt: now };
}

/** Move an unattached sheet onto a meeting, fill its placeholders, and delete the holder row. */
export async function attachSheetToMeeting(input: {
  sheetId: string;
  prepId: string;
}): Promise<SheetResult<{ sheet: CallSheet }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sheetId = input.sheetId.trim();
  const prepId = input.prepId.trim();
  if (!sheetId || !prepId) return { ok: false, error: "Sheet or meeting not found." };

  const holder = await getLiveScript(sheetId);
  if (!holder.ok) return holder;
  if (holder.script.kind !== "plan") return { ok: false, error: "That is a playbook, not a sheet." };
  const blocks = await loadBlocks({ sheetId });
  if (!blocks.ok) return blocks;
  if (!blocks.blocks.length) return { ok: false, error: "This sheet has no blocks." };
  const existing = await loadBlocks({ prepId });
  if (!existing.ok) return existing;
  if (existing.blocks.length) return { ok: false, error: "This meeting already has a call sheet." };

  const prepResult = await getMeetingPrep(prepId);
  if (!prepResult.ok) return prepResult;
  let person: MeetingContextPerson | null = null;
  try {
    const context = await loadMeetingContext(prepId);
    person = primaryPerson(context.people, prepResult.prep.primaryContactId);
  } catch (err) {
    console.error("[attachSheetToMeeting] context", err);
  }
  const fill = await fillerFor(person);

  const sb = createServiceRoleClient();
  for (const block of blocks.blocks) {
    const { error } = await sb
      .from("call_sheet_blocks")
      .update({
        prep_id: prepId,
        sheet_id: null,
        body: cleanBody(fill(block.body)),
        lines: block.lines.map((line) => ({ ...line, text: fill(line.text) ?? "" })),
      })
      .eq("id", block.id);
    if (error) return { ok: false, error: error.message };
  }

  if (holder.items.length) {
    const { data: last } = await sb
      .from("meeting_points")
      .select("position")
      .eq("prep_id", prepId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = (typeof last?.position === "number" ? last.position : 0) + 1;
    const { error: pointError } = await sb.from("meeting_points").insert(
      holder.items.map((item, index) => ({
        prep_id: prepId,
        position: start + index,
        kind: item.kind,
        headline: fill(item.headline) || item.headline,
        detail: fill(item.detail),
        listen_for: item.listenFor,
        state: "open",
        source: "script",
        edited_by_user: false,
        prepare_reactions: item.prepareReactions,
        reactions: item.reactions.map((reaction) => ({
          shape: reaction.shape,
          soundsLike: fill(reaction.soundsLike) || reaction.soundsLike,
          pivot: fill(reaction.pivot) || reaction.pivot,
        })),
      }))
    );
    if (pointError) return { ok: false, error: pointError.message };
  }

  const { data: playbook } = await sb
    .from("live_scripts")
    .select("id")
    .eq("kind", "strategy")
    .eq("family", holder.script.family)
    .order("use_count", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: prepError } = await sb
    .from("meeting_preps")
    .update({
      script_id: (playbook?.id as string | undefined) ?? null,
      sheet_ready_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prepId);
  if (prepError) return { ok: false, error: prepError.message };

  const { error: deleteError } = await sb.from("live_scripts").delete().eq("id", sheetId);
  if (deleteError) return { ok: false, error: deleteError.message };

  const sheet = await getCallSheet({ prepId });
  if (!sheet.ok) return sheet;
  if (!sheet.sheet) return { ok: false, error: "Could not read the sheet." };
  revalidateSheet(prepId);
  return { ok: true, sheet: sheet.sheet };
}

/**
 * Put a sheet without a date on a meeting. Sheets with blocks move onto the meeting;
 * older point-only sheets copy their points onto it and replace what was there.
 */
export async function putSheetOnMeeting(input: {
  sheetId: string;
  prepId: string;
}): Promise<SheetResult<{ prepId: string; moved: "blocks" | "points"; added: number }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sheetId = input.sheetId.trim();
  const prepId = input.prepId.trim();
  if (!sheetId || !prepId) return { ok: false, error: "Sheet or meeting not found." };
  const blocks = await loadBlocks({ sheetId });
  if (!blocks.ok) return blocks;
  if (blocks.blocks.length) {
    const holder = await getLiveScript(sheetId);
    const added = holder.ok ? holder.items.length : 0;
    const attached = await attachSheetToMeeting({ sheetId, prepId });
    if (!attached.ok) return attached;
    return { ok: true, prepId, moved: "blocks", added };
  }
  const attached = await attachPlanToMeeting({ scriptId: sheetId, prepId, mode: "replace" });
  if (!attached.ok) return attached;
  revalidateSheet(prepId);
  return { ok: true, prepId, moved: "points", added: attached.added };
}

export type HomeSheetStatus = "ready" | "why_missing" | "not_ready" | "none";

export interface MeetingSheetStatus {
  prepId: string;
  status: HomeSheetStatus;
  /** "Call 2 of 3" when the person is in the networking pipeline or the playbook is Browning. */
  callLabel: string | null;
  /** This call's number with the person; null when the call is not tracked. */
  touchNumber: number | null;
  playbookName: string | null;
}

/** Sheet state and call number for each meeting on Live home. */
export async function getSheetStatuses(
  meetings: Array<{ id: string; primaryContactId: string | null; attendeeContactIds: string[] }>
): Promise<SheetResult<{ statuses: Record<string, MeetingSheetStatus> }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const statuses: Record<string, MeetingSheetStatus> = {};
  if (!meetings.length) return { ok: true, statuses };
  const prepIds = meetings.map((meeting) => meeting.id);
  const contactOf = new Map(
    meetings.map((meeting) => [meeting.id, meeting.primaryContactId ?? meeting.attendeeContactIds[0] ?? null])
  );
  const contactIds = [...new Set([...contactOf.values()].filter((id): id is string => Boolean(id)))];

  const sb = createServiceRoleClient();
  const [blocksRes, prepsRes, logsRes, contactsRes] = await Promise.all([
    sb.from("call_sheet_blocks").select("prep_id, key, kind, required, body, lines").in("prep_id", prepIds),
    sb.from("meeting_preps").select("id, script_id, sheet_ready_at").in("id", prepIds),
    sb.from("relationship_log").select("prep_id, touch_number").in("prep_id", prepIds),
    contactIds.length
      ? sb.from("contacts").select("id, networking_status, touch_count").in("id", contactIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
  ]);
  const failed = blocksRes.error || prepsRes.error || logsRes.error || contactsRes.error;
  if (failed) return { ok: false, error: failed.message };

  const scriptIds = [
    ...new Set(
      (prepsRes.data ?? []).map((row) => row.script_id as string | null).filter((id): id is string => Boolean(id))
    ),
  ];
  const scripts = new Map<string, { name: string; family: PlaybookFamily }>();
  if (scriptIds.length) {
    const { data } = await sb.from("live_scripts").select("id, name, family").in("id", scriptIds);
    for (const row of data ?? []) {
      scripts.set(String(row.id), { name: String(row.name ?? "").trim() || "Playbook", family: asFamily(row.family) });
    }
  }
  const blocksByPrep = new Map<string, Array<Record<string, unknown>>>();
  for (const row of (blocksRes.data ?? []) as Array<Record<string, unknown>>) {
    const id = String(row.prep_id);
    blocksByPrep.set(id, [...(blocksByPrep.get(id) ?? []), row]);
  }
  const prepById = new Map(((prepsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]));
  const loggedTouch = new Map(
    ((logsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.prep_id), row.touch_number])
  );
  const contactById = new Map(
    ((contactsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row])
  );

  for (const prepId of prepIds) {
    const prep = prepById.get(prepId);
    const script = prep?.script_id ? scripts.get(String(prep.script_id)) ?? null : null;
    const blocks = blocksByPrep.get(prepId) ?? [];
    let status: HomeSheetStatus = "none";
    if (blocks.length) {
      // Points are counted when the sheet is marked ready; here only written blocks gate the pill.
      const requiredEmpty = blocks.some((row) => {
        if (!row.required || row.kind === "points") return false;
        const kind = KIND_SET.has(String(row.kind)) ? (row.kind as BlockKind) : "text";
        return !blockIsFilled({
          kind,
          body: typeof row.body === "string" ? row.body : null,
          lines: parseSheetLines(row.lines),
        });
      });
      if (prep?.sheet_ready_at) status = "ready";
      else status = requiredEmpty ? "why_missing" : "not_ready";
    }
    const contactId = contactOf.get(prepId) ?? null;
    const contact = contactId ? contactById.get(contactId) : undefined;
    const touchCount = typeof contact?.touch_count === "number" ? contact.touch_count : 0;
    const logged = loggedTouch.get(prepId);
    const touchNumber = typeof logged === "number" ? logged : touchCount + 1;
    const tracked = Boolean(contact?.networking_status) || Boolean(script && BROWNING_FAMILIES.has(script.family));
    statuses[prepId] = {
      prepId,
      status,
      callLabel: contact && tracked ? callOfThree(touchNumber) : null,
      touchNumber: contact && tracked ? touchNumber : null,
      playbookName: script?.name ?? null,
    };
  }
  return { ok: true, statuses };
}
