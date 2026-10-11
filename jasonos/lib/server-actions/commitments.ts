"use server";

import { revalidatePath } from "next/cache";
import { getCommitmentCheckForHome, setCommitmentItemState } from "@/lib/commitments/store";
import { etDate, nextDay } from "@/lib/commitments/logic";
import type { CommitmentCheckForHome } from "@/lib/commitments/types";

type ActionResult = { ok: true } | { ok: false; error: string };

function hasConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Home loader. Never throws, so a missing table or bad row cannot break Home. */
export async function getCommitmentCheckHome(): Promise<
  { ok: true; check: CommitmentCheckForHome } | { ok: false; error: string }
> {
  if (!hasConfig()) return { ok: false, error: "Supabase is not configured." };
  try {
    return { ok: true, check: await getCommitmentCheckForHome() };
  } catch (error) {
    console.error("[commitments.home]", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function markCommitmentDone(itemKey: string): Promise<ActionResult> {
  return run(() => setCommitmentItemState({ item_key: itemKey, state: "done", actor: "jasonos" }));
}

export async function dismissCommitment(itemKey: string): Promise<ActionResult> {
  return run(() => setCommitmentItemState({ item_key: itemKey, state: "dismissed", actor: "jasonos" }));
}

export async function snoozeCommitmentToTomorrow(itemKey: string): Promise<ActionResult> {
  return run(() =>
    setCommitmentItemState({
      item_key: itemKey,
      state: "snoozed",
      snoozed_until: nextDay(etDate()),
      actor: "jasonos",
    })
  );
}
