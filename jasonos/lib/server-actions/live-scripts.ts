"use server";

import { revalidatePath } from "next/cache";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { callClaude } from "@/lib/ai/models";
import { loadMeetingContext } from "@/lib/meeting-prep/context";
import {
  clampDetail,
  clampHeadline,
  fillScriptPlaceholders,
  meetingPointsSystemPrompt,
  newDrafts,
  parseDraftPoints,
  type PointKind,
} from "@/lib/meeting-prep/points";
import {
  REACTION_SHAPES,
  buildReactionsUserMessage,
  parseReactions,
  reactionsSystemPrompt,
  type Reaction,
  type ReactionShape,
} from "@/lib/meeting-prep/reactions";
import type { PointResult } from "@/lib/server-actions/meeting-points";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface LiveScript {
  id: string;
  name: string;
  description: string | null;
  situation: string | null;
  successSentence: string | null;
  rubric: string[];
  methodologySource: string | null;
  itemCount: number;
  useCount: number;
  lastUsedAt: string | null;
  updatedAt: string;
}

export interface LiveScriptItem {
  id: string;
  scriptId: string;
  position: number;
  kind: PointKind;
  headline: string;
  detail: string | null;
  prepareReactions: boolean;
  reactions: Reaction[];
}

interface ScriptRow {
  id: string;
  name: string;
  description: string | null;
  situation?: string | null;
  success_sentence?: string | null;
  rubric?: unknown;
  methodology_source?: string | null;
  use_count: number;
  last_used_at: string | null;
  updated_at: string;
}

interface ItemRow {
  id: string;
  script_id: string;
  position: number;
  kind: string;
  headline: string;
  detail: string | null;
  prepare_reactions?: boolean | null;
  reactions?: unknown;
}

const KINDS = new Set<PointKind>(["agenda", "point", "question", "ask"]);
const SHAPE_SET = new Set<string>(REACTION_SHAPES);
const SCRIPT_COLUMNS =
  "id, name, description, situation, success_sentence, rubric, methodology_source, use_count, last_used_at, updated_at";
const ITEM_COLUMNS =
  "id, script_id, position, kind, headline, detail, prepare_reactions, reactions";

function rubricLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const lines: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim().replace(/\s+/g, " ");
    if (!text) continue;
    lines.push(text.length <= 240 ? text : text.slice(0, 240).trim());
    if (lines.length === 12) break;
  }
  return lines;
}

function cleanLine(value: string | null | undefined, max = 400): string | null {
  const text = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!text) return null;
  return text.length <= max ? text : text.slice(0, max).trim();
}

function asReactions(value: unknown): Reaction[] {
  if (!Array.isArray(value)) return [];
  const out: Reaction[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const shape = (item as { shape?: unknown }).shape;
    const soundsLike = (item as { soundsLike?: unknown }).soundsLike;
    const pivot = (item as { pivot?: unknown }).pivot;
    if (typeof shape !== "string" || !SHAPE_SET.has(shape) || seen.has(shape)) continue;
    if (typeof soundsLike !== "string" || typeof pivot !== "string") continue;
    const sound = soundsLike.trim().replace(/\s+/g, " ");
    const line = pivot.trim().replace(/\s+/g, " ");
    if (!sound || !line || sound.length >= 160 || line.length >= 160) continue;
    seen.add(shape);
    out.push({ shape: shape as ReactionShape, soundsLike: sound, pivot: line });
  }
  return out;
}

function filledReactions(
  reactions: Reaction[],
  person: { name?: string | null; company?: string | null; title?: string | null } | null
): Reaction[] {
  return reactions.map((reaction) => ({
    shape: reaction.shape,
    soundsLike: fillScriptPlaceholders(reaction.soundsLike, person) || reaction.soundsLike,
    pivot: fillScriptPlaceholders(reaction.pivot, person) || reaction.pivot,
  }));
}

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function revalidateScripts(scriptId?: string, prepId?: string) {
  revalidatePath("/live");
  if (scriptId) {
    revalidatePath(`/live/scripts/${scriptId}`);
    revalidatePath(`/live/scripts/${scriptId}/rehearse`);
  }
  revalidatePath("/live/scripts/[id]", "page");
  if (prepId) {
    revalidatePath(`/meetings/${prepId}`);
    revalidatePath(`/meetings/${prepId}/live`);
    revalidatePath("/meetings/[id]", "page");
    revalidatePath("/meetings/[id]/live", "page");
  }
}

function asKind(value: string): PointKind {
  return KINDS.has(value as PointKind) ? (value as PointKind) : "point";
}

function toItem(row: ItemRow): LiveScriptItem {
  return {
    id: row.id,
    scriptId: row.script_id,
    position: row.position,
    kind: asKind(row.kind),
    headline: row.headline,
    detail: row.detail?.trim() || null,
    prepareReactions: Boolean(row.prepare_reactions),
    reactions: asReactions(row.reactions),
  };
}

function toScript(row: ScriptRow, itemCount: number): LiveScript {
  return {
    id: row.id,
    name: row.name,
    description: row.description?.trim() || null,
    situation: row.situation?.trim() || null,
    successSentence: row.success_sentence?.trim() || null,
    rubric: rubricLines(row.rubric),
    methodologySource: row.methodology_source?.trim() || null,
    itemCount,
    useCount: row.use_count ?? 0,
    lastUsedAt: row.last_used_at,
    updatedAt: row.updated_at,
  };
}

function nameTaken(message: string, code?: string) {
  return code === "23505" || /live_scripts_name_key|duplicate key/i.test(message);
}

function cleanName(value: string): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  return text || null;
}

export async function listLiveScripts(): Promise<PointResult<{ scripts: LiveScript[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("live_scripts")
    .select(SCRIPT_COLUMNS)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as ScriptRow[];
  const counts = new Map<string, number>();
  if (rows.length) {
    const { data: items, error: itemError } = await sb
      .from("live_script_items")
      .select("script_id")
      .in(
        "script_id",
        rows.map((row) => row.id)
      );
    if (itemError) return { ok: false, error: itemError.message };
    for (const item of items ?? []) {
      const id = item.script_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return { ok: true, scripts: rows.map((row) => toScript(row, counts.get(row.id) ?? 0)) };
}

export async function getLiveScript(
  scriptId: string
): Promise<PointResult<{ script: LiveScript; items: LiveScriptItem[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = scriptId.trim();
  if (!id) return { ok: false, error: "Strategy not found." };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("live_scripts")
    .select(SCRIPT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Strategy not found." };

  const { data: itemRows, error: itemError } = await sb
    .from("live_script_items")
    .select(ITEM_COLUMNS)
    .eq("script_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (itemError) return { ok: false, error: itemError.message };
  const items = ((itemRows ?? []) as ItemRow[]).map(toItem);
  return { ok: true, script: toScript(data as ScriptRow, items.length), items };
}

export async function createLiveScript(input: {
  name: string;
  description?: string | null;
}): Promise<PointResult<{ script: LiveScript }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Name the strategy." };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("live_scripts")
    .insert({
      name,
      description: input.description?.trim() ? input.description.trim() : null,
    })
    .select(SCRIPT_COLUMNS)
    .single();
  if (error) {
    if (nameTaken(error.message, error.code)) {
      return { ok: false, error: "A strategy with that name already exists." };
    }
    return { ok: false, error: error.message };
  }
  revalidateScripts(data.id as string);
  return { ok: true, script: toScript(data as ScriptRow, 0) };
}

export async function updateLiveScript(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    situation?: string | null;
    successSentence?: string | null;
    rubric?: string[];
    methodologySource?: string | null;
  }
): Promise<PointResult<{ script: LiveScript }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const scriptId = id.trim();
  if (!scriptId) return { ok: false, error: "Strategy not found." };
  const update: Record<string, unknown> = {};
  if (patch.name != null) {
    const name = cleanName(patch.name);
    if (!name) return { ok: false, error: "Name the strategy." };
    update.name = name;
  }
  if (patch.description !== undefined) {
    update.description = patch.description?.trim() ? patch.description.trim() : null;
  }
  if (patch.situation !== undefined) update.situation = cleanLine(patch.situation);
  if (patch.successSentence !== undefined) update.success_sentence = cleanLine(patch.successSentence);
  if (patch.methodologySource !== undefined) {
    update.methodology_source = cleanLine(patch.methodologySource, 200);
  }
  if (patch.rubric !== undefined) update.rubric = rubricLines(patch.rubric);
  if (!Object.keys(update).length) return { ok: false, error: "Nothing to change." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("live_scripts")
    .update(update)
    .eq("id", scriptId)
    .select(SCRIPT_COLUMNS)
    .maybeSingle();
  if (error) {
    if (nameTaken(error.message, error.code)) {
      return { ok: false, error: "A strategy with that name already exists." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Strategy not found." };
  const items = await sb
    .from("live_script_items")
    .select("id", { count: "exact", head: true })
    .eq("script_id", scriptId);
  revalidateScripts(scriptId);
  return { ok: true, script: toScript(data as ScriptRow, items.count ?? 0) };
}

export async function deleteLiveScript(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const scriptId = id.trim();
  if (!scriptId) return { ok: false, error: "Strategy not found." };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("live_scripts")
    .delete()
    .eq("id", scriptId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Strategy not found." };
  revalidateScripts(scriptId);
  return { ok: true };
}

async function nextItemPosition(
  sb: ReturnType<typeof createServiceRoleClient>,
  scriptId: string
): Promise<PointResult<{ position: number }>> {
  const { data, error } = await sb
    .from("live_script_items")
    .select("position")
    .eq("script_id", scriptId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, position: (typeof data?.position === "number" ? data.position : 0) + 1 };
}

export async function createLiveScriptItem(input: {
  scriptId: string;
  kind: PointKind;
  headline: string;
  detail?: string | null;
  position?: number;
}): Promise<PointResult<{ item: LiveScriptItem }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const scriptId = input.scriptId.trim();
  if (!scriptId) return { ok: false, error: "Strategy not found." };
  if (!KINDS.has(input.kind)) return { ok: false, error: "Pick a kind." };
  const headline = clampHeadline(input.headline);
  if (!headline) return { ok: false, error: "Write a headline." };

  const sb = createServiceRoleClient();
  let position = input.position;
  if (position == null || !Number.isInteger(position) || position < 1) {
    const appended = await nextItemPosition(sb, scriptId);
    if (!appended.ok) return appended;
    position = appended.position;
  }
  const { data, error } = await sb
    .from("live_script_items")
    .insert({
      script_id: scriptId,
      position,
      kind: input.kind,
      headline,
      detail: input.detail ? clampDetail(input.detail) : null,
    })
    .select(ITEM_COLUMNS)
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateScripts(scriptId);
  return { ok: true, item: toItem(data as ItemRow) };
}

export async function updateLiveScriptItem(
  id: string,
  patch: {
    kind?: PointKind;
    headline?: string;
    detail?: string | null;
    prepareReactions?: boolean;
    reactions?: Reaction[];
  }
): Promise<PointResult<{ item: LiveScriptItem }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const itemId = id.trim();
  if (!itemId) return { ok: false, error: "Point not found." };
  const update: Record<string, unknown> = {};
  if (patch.kind != null) {
    if (!KINDS.has(patch.kind)) return { ok: false, error: "Pick a kind." };
    update.kind = patch.kind;
  }
  if (patch.headline != null) {
    const headline = clampHeadline(patch.headline);
    if (!headline) return { ok: false, error: "Write a headline." };
    update.headline = headline;
  }
  if (patch.detail !== undefined) update.detail = patch.detail ? clampDetail(patch.detail) : null;
  if (patch.prepareReactions !== undefined) update.prepare_reactions = Boolean(patch.prepareReactions);
  if (patch.reactions !== undefined) {
    const stored = parseReactions(JSON.stringify(patch.reactions));
    if (!stored) return { ok: false, error: "Reactions need all six shapes." };
    update.reactions = stored;
  }
  if (!Object.keys(update).length) return { ok: false, error: "Nothing to change." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("live_script_items")
    .update(update)
    .eq("id", itemId)
    .select(ITEM_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Point not found." };
  revalidateScripts((data as ItemRow).script_id);
  return { ok: true, item: toItem(data as ItemRow) };
}

export async function deleteLiveScriptItem(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const itemId = id.trim();
  if (!itemId) return { ok: false, error: "Point not found." };
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("live_script_items")
    .delete()
    .eq("id", itemId)
    .select("script_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Point not found." };
  revalidateScripts(data.script_id as string);
  return { ok: true };
}

export async function reorderLiveScriptItems(
  scriptId: string,
  orderedIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = scriptId.trim();
  if (!id) return { ok: false, error: "Strategy not found." };
  const ids = orderedIds.map((item) => item.trim()).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Point order does not match this strategy." };
  }
  const sb = createServiceRoleClient();
  const { error } = await sb.rpc("reorder_live_script_items", {
    p_script_id: id,
    p_ids: ids,
  });
  if (error) return { ok: false, error: error.message };
  revalidateScripts(id);
  return { ok: true };
}

export async function draftLiveScriptItems(
  scriptId: string,
  brief: string
): Promise<PointResult<{ added: number }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = scriptId.trim();
  const note = brief.trim();
  if (!id) return { ok: false, error: "Strategy not found." };
  if (!note) return { ok: false, error: "Write a brief first." };

  const loaded = await getLiveScript(id);
  if (!loaded.ok) return loaded;

  let text: string;
  try {
    text = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 1200,
      system: `${meetingPointsSystemPrompt(NO_AI_SLOP_WRITING_RULES)}
This is a reusable strategy, not a specific meeting, so use {{name}}, {{company}} and {{title}} where the line would otherwise name the person or company.`,
      messages: [
        {
          role: "user",
          content: [
            `Strategy: ${loaded.script.name}`,
            loaded.script.description ? `Description: ${loaded.script.description}` : null,
            `Brief: ${note}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not draft points." };
  }

  const drafted = parseDraftPoints(text);
  if (!drafted) return { ok: false, error: "Could not read the draft." };
  const fresh = newDrafts(
    loaded.items.map((item) => item.headline),
    drafted
  );
  if (!fresh.length) return { ok: true, added: 0 };

  const start = loaded.items.reduce((max, item) => Math.max(max, item.position), 0) + 1;
  const sb = createServiceRoleClient();
  const { error } = await sb.from("live_script_items").insert(
    fresh.map((item, index) => ({
      script_id: id,
      position: start + index,
      kind: item.kind,
      headline: item.headline,
      detail: item.detail,
    }))
  );
  if (error) return { ok: false, error: error.message };
  revalidateScripts(id);
  return { ok: true, added: fresh.length };
}

export async function applyLiveScript(input: {
  scriptId: string;
  prepId: string;
  mode: "add" | "replace";
}): Promise<PointResult<{ added: number }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const scriptId = input.scriptId.trim();
  const prepId = input.prepId.trim();
  if (!scriptId || !prepId) return { ok: false, error: "Strategy or meeting not found." };
  if (input.mode !== "add" && input.mode !== "replace") {
    return { ok: false, error: "Pick add or replace." };
  }

  const loaded = await getLiveScript(scriptId);
  if (!loaded.ok) return loaded;
  if (!loaded.items.length) return { ok: false, error: "This strategy has no points." };

  let context;
  try {
    context = await loadMeetingContext(prepId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const person = context.people[0] ?? null;

  const sb = createServiceRoleClient();
  const { data: existing, error: existingError } = await sb
    .from("meeting_points")
    .select("*")
    .eq("prep_id", prepId)
    .order("position", { ascending: true });
  if (existingError) return { ok: false, error: existingError.message };
  const previous = existing ?? [];

  if (input.mode === "replace" && previous.length) {
    const { error: deleteError } = await sb.from("meeting_points").delete().eq("prep_id", prepId);
    if (deleteError) return { ok: false, error: deleteError.message };
  }

  const start =
    input.mode === "replace"
      ? 1
      : previous.reduce((max, row) => Math.max(max, Number(row.position) || 0), 0) + 1;
  const rows = loaded.items.map((item, index) => ({
    prep_id: prepId,
    position: start + index,
    kind: item.kind,
    headline: fillScriptPlaceholders(item.headline, person) || item.headline,
    detail: fillScriptPlaceholders(item.detail, person),
    state: "open",
    source: "script",
    script_id: scriptId,
    edited_by_user: false,
    prepare_reactions: item.prepareReactions,
    reactions: filledReactions(item.reactions, person),
  }));

  const { error: insertError } = await sb.from("meeting_points").insert(rows);
  if (insertError) {
    if (input.mode === "replace" && previous.length) {
      await sb.from("meeting_points").insert(previous);
    }
    return { ok: false, error: insertError.message };
  }

  const success = loaded.script.successSentence
    ? fillScriptPlaceholders(loaded.script.successSentence, person)
    : null;
  const { data: prepRow } = await sb
    .from("meeting_preps")
    .select("outcome_sentence")
    .eq("id", prepId)
    .maybeSingle();
  const existingOutcome =
    typeof prepRow?.outcome_sentence === "string" ? prepRow.outcome_sentence.trim() : "";
  const prepUpdate: { script_id: string; outcome_sentence?: string } = { script_id: scriptId };
  if (!existingOutcome && success) prepUpdate.outcome_sentence = success;

  const { error: prepError } = await sb.from("meeting_preps").update(prepUpdate).eq("id", prepId);
  if (prepError) return { ok: false, error: prepError.message };

  const { data: scriptRow } = await sb
    .from("live_scripts")
    .select("use_count")
    .eq("id", scriptId)
    .maybeSingle();
  await sb
    .from("live_scripts")
    .update({
      use_count: (typeof scriptRow?.use_count === "number" ? scriptRow.use_count : 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", scriptId);

  revalidateScripts(scriptId, prepId);
  return { ok: true, added: rows.length };
}

export async function saveMeetingPointsAsScript(input: {
  prepId: string;
  name: string;
  description?: string | null;
}): Promise<PointResult<{ scriptId: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const prepId = input.prepId.trim();
  const name = cleanName(input.name);
  if (!prepId) return { ok: false, error: "Meeting prep not found." };
  if (!name) return { ok: false, error: "Name the strategy." };

  const sb = createServiceRoleClient();
  const { data: points, error: pointError } = await sb
    .from("meeting_points")
    .select("kind, headline, detail, position, prepare_reactions, reactions")
    .eq("prep_id", prepId)
    .order("position", { ascending: true });
  if (pointError) return { ok: false, error: pointError.message };
  if (!points?.length) return { ok: false, error: "Add at least one point first." };

  const created = await createLiveScript({ name, description: input.description });
  if (!created.ok) return created;

  const { error } = await sb.from("live_script_items").insert(
    points.map((point, index) => ({
      script_id: created.script.id,
      position: index + 1,
      kind: asKind(String(point.kind)),
      headline: clampHeadline(String(point.headline)) || String(point.headline).trim(),
      detail: point.detail ? clampDetail(String(point.detail)) : null,
      prepare_reactions: Boolean(point.prepare_reactions),
      reactions: asReactions(point.reactions),
    }))
  );
  if (error) {
    await sb.from("live_scripts").delete().eq("id", created.script.id);
    return { ok: false, error: error.message };
  }
  revalidateScripts(created.script.id, prepId);
  return { ok: true, scriptId: created.script.id };
}

export async function draftScriptItemReactions(
  itemId: string
): Promise<PointResult<{ reactions: Reaction[] }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = itemId.trim();
  if (!id) return { ok: false, error: "Point not found." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("live_script_items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Point not found." };
  const item = toItem(data as ItemRow);

  const loaded = await getLiveScript(item.scriptId);
  if (!loaded.ok) return loaded;

  let text: string;
  try {
    text = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 1200,
      system: reactionsSystemPrompt(NO_AI_SLOP_WRITING_RULES),
      messages: [
        {
          role: "user",
          content: buildReactionsUserMessage({
            headline: item.headline,
            detail: item.detail,
            kind: item.kind,
            situation: loaded.script.situation,
            successSentence: loaded.script.successSentence,
            person: null,
          }),
        },
      ],
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not draft reactions." };
  }

  const reactions = parseReactions(text);
  if (!reactions) return { ok: false, error: "Could not read the reactions." };

  const { error: writeError } = await sb
    .from("live_script_items")
    .update({ reactions, prepare_reactions: true })
    .eq("id", id);
  if (writeError) return { ok: false, error: writeError.message };

  revalidateScripts(item.scriptId);
  return { ok: true, reactions };
}
