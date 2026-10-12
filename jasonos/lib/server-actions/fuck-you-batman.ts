"use server";

import { revalidatePath } from "next/cache";
import {
  approveEntry,
  listDecisions,
  listEntries,
  recordDecision,
  reopenDecision as reopenDecisionRow,
  requestEntryChanges,
} from "@/lib/fuck-you-batman/store";
import type { FybDecision, FybEntry, FybEntryKind } from "@/lib/fuck-you-batman/types";

type ActionResult = { ok: true } | { ok: false; error: string };

function hasConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function revalidate() {
  revalidatePath("/projects/fuck-you-batman", "layout");
}

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidate();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Page loader. Never throws, so a missing table cannot break the project page. */
export async function loadFybDecisions(): Promise<FybDecision[]> {
  if (!hasConfig()) return [];
  try {
    return await listDecisions();
  } catch (error) {
    console.error("[fuck-you-batman.decisions]", error);
    return [];
  }
}

export async function loadFybEntries(kind?: FybEntryKind): Promise<FybEntry[]> {
  if (!hasConfig()) return [];
  try {
    return await listEntries(kind ? { kind } : {});
  } catch (error) {
    console.error("[fuck-you-batman.entries]", error);
    return [];
  }
}

export async function chooseOption(
  decisionKey: string,
  optionKey: string,
  note: string
): Promise<ActionResult> {
  return run(() =>
    recordDecision({
      decision_key: decisionKey,
      chosen_option_key: optionKey,
      jason_note: note,
      actor: "jasonos",
    })
  );
}

export async function chooseCustom(
  decisionKey: string,
  answer: string,
  note: string
): Promise<ActionResult> {
  return run(() =>
    recordDecision({
      decision_key: decisionKey,
      chosen_option_key: "custom",
      custom_answer: answer,
      jason_note: note,
      actor: "jasonos",
    })
  );
}

export async function reopenDecision(decisionKey: string): Promise<ActionResult> {
  return run(() => reopenDecisionRow(decisionKey));
}

export async function approveFybEntry(kind: FybEntryKind, entryKey: string): Promise<ActionResult> {
  return run(() => approveEntry({ kind, entry_key: entryKey, actor: "jasonos" }));
}

export async function requestFybEntryChanges(
  kind: FybEntryKind,
  entryKey: string,
  note: string
): Promise<ActionResult> {
  return run(() => requestEntryChanges({ kind, entry_key: entryKey, note, actor: "jasonos" }));
}
