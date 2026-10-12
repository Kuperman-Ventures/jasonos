/**
 * Fuck You Batman story data access. Service-role, MCP-safe (no Next.js imports),
 * so the project pages, server actions and the JasonOS MCP share it.
 */
import { jasonosDb } from "../mcp/db";
import {
  asDecision,
  asEntry,
  buildSnapshotMarkdown,
  parseDecisionInput,
  parseEntryInput,
} from "./logic";
import { currentPhase, weekNumber } from "./plan";
import type {
  FybActor,
  FybDecision,
  FybEntry,
  FybEntryKind,
  FybSnapshot,
} from "./types";

const DECISION_COLS =
  "id,decision_key,week,phase,question,context,options,status,chosen_option_key,custom_answer,jason_note,decided_at,decided_by,sort_order,created_at,updated_at";
const ENTRY_COLS =
  "id,kind,entry_key,title,body_md,data,links,status,approved_at,sort_order,updated_by,created_at,updated_at";

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

async function getDecision(decision_key: string): Promise<FybDecision | null> {
  const { data, error } = await jasonosDb()
    .from("fyb_decisions")
    .select(DECISION_COLS)
    .eq("decision_key", decision_key)
    .maybeSingle();
  if (error) fail(error);
  return data ? asDecision(data as Record<string, unknown>) : null;
}

export async function listDecisions(filter: { status?: "open" | "decided" } = {}): Promise<FybDecision[]> {
  let query = jasonosDb()
    .from("fyb_decisions")
    .select(DECISION_COLS)
    .order("sort_order", { ascending: true })
    .order("week", { ascending: true })
    .order("created_at", { ascending: true });
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query;
  if (error) fail(error);
  return (data ?? []).map((row) => asDecision(row as Record<string, unknown>));
}

export async function upsertDecision(raw: unknown): Promise<{ ok: true; decision: FybDecision }> {
  const input = parseDecisionInput(raw);
  const existing = await getDecision(input.decision_key);
  const decidedLocked = existing?.status === "decided" && !input.reopen;

  const payload: Record<string, unknown> = {
    decision_key: input.decision_key,
    week: input.week,
    phase: input.phase,
    question: input.question,
    context: input.context ?? null,
    options: input.options,
    sort_order: input.sort_order ?? existing?.sort_order ?? 0,
  };

  if (!decidedLocked) {
    if (input.reopen) {
      payload.status = "open";
      payload.chosen_option_key = null;
      payload.custom_answer = null;
      payload.jason_note = null;
      payload.decided_at = null;
      payload.decided_by = null;
    } else if (!existing) {
      payload.status = "open";
    }
  }

  const { data, error } = await jasonosDb()
    .from("fyb_decisions")
    .upsert(payload, { onConflict: "decision_key" })
    .select(DECISION_COLS)
    .single();
  if (error) fail(error);
  return { ok: true, decision: asDecision(data as Record<string, unknown>) };
}

export async function recordDecision(input: {
  decision_key: string;
  chosen_option_key: string;
  custom_answer?: string | null;
  jason_note?: string | null;
  actor: FybActor;
}): Promise<{ ok: true; decision: FybDecision }> {
  const key = input.decision_key.trim();
  if (!key) throw new Error("decision_key is required.");
  const chosen = input.chosen_option_key.trim();
  if (!chosen) throw new Error("Pick an option, or write your own answer.");

  const existing = await getDecision(key);
  if (!existing) {
    throw new Error(`No decision with key "${key}". Publish it first with upsert_fyb_decision.`);
  }
  if (existing.status === "decided") {
    throw new Error("This decision is already recorded. Reopen it first if Jason changed his mind.");
  }

  const custom = input.custom_answer?.trim() || null;
  if (chosen === "custom") {
    if (!custom) throw new Error("Write your own answer, or pick one of the options.");
  } else if (!existing.options.some((option) => option.key === chosen)) {
    throw new Error(`"${chosen}" is not one of the options for ${key}.`);
  }

  const { data, error } = await jasonosDb()
    .from("fyb_decisions")
    .update({
      status: "decided",
      chosen_option_key: chosen,
      custom_answer: chosen === "custom" ? custom : null,
      jason_note: input.jason_note?.trim() || null,
      decided_at: new Date().toISOString(),
      decided_by: input.actor,
    })
    .eq("decision_key", key)
    .select(DECISION_COLS)
    .single();
  if (error) fail(error);
  return { ok: true, decision: asDecision(data as Record<string, unknown>) };
}

export async function reopenDecision(decision_key: string): Promise<{ ok: true; decision: FybDecision }> {
  const key = decision_key.trim();
  if (!key) throw new Error("decision_key is required.");
  const existing = await getDecision(key);
  if (!existing) throw new Error(`No decision with key "${key}".`);
  const { data, error } = await jasonosDb()
    .from("fyb_decisions")
    .update({
      status: "open",
      chosen_option_key: null,
      custom_answer: null,
      jason_note: null,
      decided_at: null,
      decided_by: null,
    })
    .eq("decision_key", key)
    .select(DECISION_COLS)
    .single();
  if (error) fail(error);
  return { ok: true, decision: asDecision(data as Record<string, unknown>) };
}

export async function listEntries(filter: { kind?: FybEntryKind } = {}): Promise<FybEntry[]> {
  let query = jasonosDb()
    .from("fyb_entries")
    .select(ENTRY_COLS)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  if (filter.kind) query = query.eq("kind", filter.kind);
  const { data, error } = await query;
  if (error) fail(error);
  return (data ?? []).map((row) => asEntry(row as Record<string, unknown>));
}

export async function upsertEntry(
  raw: unknown,
  actor: FybActor = "claude"
): Promise<{ ok: true; entry: FybEntry }> {
  const input = parseEntryInput(raw);
  const payload = {
    kind: input.kind,
    entry_key: input.entry_key,
    title: input.title,
    body_md: input.body_md ?? "",
    data: input.data ?? {},
    links: input.links ?? [],
    sort_order: input.sort_order ?? 0,
    updated_by: actor,
  };
  const { data, error } = await jasonosDb()
    .from("fyb_entries")
    .upsert(payload, { onConflict: "kind,entry_key" })
    .select(ENTRY_COLS)
    .single();
  if (error) fail(error);
  return { ok: true, entry: asEntry(data as Record<string, unknown>) };
}

export async function approveEntry(input: {
  kind: FybEntryKind;
  entry_key: string;
  actor: FybActor;
}): Promise<{ ok: true; entry: FybEntry }> {
  const entry_key = input.entry_key.trim();
  if (!entry_key) throw new Error("entry_key is required.");
  const { data, error } = await jasonosDb()
    .from("fyb_entries")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      updated_by: input.actor,
    })
    .eq("kind", input.kind)
    .eq("entry_key", entry_key)
    .select(ENTRY_COLS)
    .maybeSingle();
  if (error) fail(error);
  if (!data) throw new Error(`No ${input.kind} entry with key "${entry_key}".`);
  return { ok: true, entry: asEntry(data as Record<string, unknown>) };
}

export async function getSnapshot(filter: { kind?: FybEntryKind } = {}): Promise<FybSnapshot> {
  const week = weekNumber();
  const [decisions, entries] = await Promise.all([listDecisions(), listEntries({ kind: filter.kind })]);
  return {
    week,
    phase: currentPhase(week),
    decisions,
    entries,
    markdown: buildSnapshotMarkdown(decisions, entries),
  };
}
