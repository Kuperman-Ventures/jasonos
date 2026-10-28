"use server";

import { generateText } from "ai";
import { revalidatePath } from "next/cache";
import { loadBusy } from "@/lib/browning-networking/data";
import type { BusyBlock } from "@/lib/browning-networking/types";
import {
  commitmentEventDescription,
  fallbackCommitmentEventTitle,
  sanitizeCommitmentEventTitle,
  type CommitmentTitleInput,
} from "@/lib/commitments/calendar-title";
import { etDate, nextDay } from "@/lib/commitments/logic";
import { getCommitmentCheckForHome, setCommitmentItemState } from "@/lib/commitments/store";
import type { CommitmentCheckForHome } from "@/lib/commitments/types";
import { hasDirectAnthropicKey, heavyModel } from "@/lib/ai/models";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { createPrimaryCalendarEvent } from "@/lib/integrations/google-calendar";
import {
  ADVISORS_ACCOUNT_EMAIL,
  listGoogleAccessTokens,
} from "@/lib/integrations/google-tokens";
import { etYmd } from "@/lib/dates";

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

/** Busy blocks for the Commitment schedule calendar (same source as Browning). */
export async function loadCommitmentCalendarBusy(
  fromYmd: string,
  toYmd: string
): Promise<BusyBlock[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    return [];
  }
  try {
    return await loadBusy(fromYmd, toYmd);
  } catch (error) {
    console.error("[commitments.calendar-busy]", error);
    return [];
  }
}

export type ScheduleCommitmentInput = CommitmentTitleInput & {
  itemKey: string;
  source_url?: string | null;
  startIso: string;
  endIso: string;
};

/**
 * Put a 30-minute work block on the Advisors primary calendar for a Commitment
 * Check item. Title comes from AI (fallback if the model fails).
 */
export async function scheduleCommitmentOnCalendar(
  input: ScheduleCommitmentInput
): Promise<
  | { ok: true; title: string; htmlLink: string | null }
  | { ok: false; error: string }
> {
  const start = Date.parse(input.startIso);
  const end = Date.parse(input.endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { ok: false, error: "That time range is not valid." };
  }
  if (end - start > 4 * 60 * 60_000) {
    return { ok: false, error: "Keep the block under four hours." };
  }
  const day = etYmd(input.startIso);
  if (day < etYmd(new Date(Date.now() - 86_400_000))) {
    return { ok: false, error: "Pick a time from today onward." };
  }

  const tokens = await listGoogleAccessTokens();
  const token =
    tokens.find((account) => account.accountEmail === ADVISORS_ACCOUNT_EMAIL)?.token ??
    tokens[0]?.token;
  if (!token) {
    return { ok: false, error: "Advisors Google is not connected." };
  }

  const titleInput: CommitmentTitleInput = {
    promise: input.promise,
    to: input.to,
    due_date: input.due_date,
    context: input.context,
  };
  const title = await titleForCommitmentEvent(titleInput);
  const description = commitmentEventDescription({
    ...titleInput,
    source_url: input.source_url,
  });

  const created = await createPrimaryCalendarEvent({
    token,
    summary: title,
    description,
    startIso: new Date(start).toISOString(),
    endIso: new Date(end).toISOString(),
  });
  if (!created.ok) return { ok: false, error: created.error };

  revalidatePath("/");
  return { ok: true, title, htmlLink: created.htmlLink };
}

async function titleForCommitmentEvent(input: CommitmentTitleInput): Promise<string> {
  const fallback = fallbackCommitmentEventTitle(input);
  try {
    const { text } = await generateText({
      model: heavyModel(),
      maxOutputTokens: 60,
      system: `You write Google Calendar event titles for Jason Kuperman's personal work blocks.
Return ONLY the title text. No quotes. No "Title:" prefix. Max 60 characters.
Active voice. Concrete. Name the work, not the process.
Do not start with Commitment, Task, Todo, or Work block.
${NO_AI_SLOP_WRITING_RULES}`,
      messages: [
        {
          role: "user",
          content: `Promise: ${input.promise || "(none)"}
Promised to: ${input.to || "(unknown)"}
Due: ${input.due_date || "none"}
Context: ${input.context || "none"}

Write the calendar title.`,
        },
      ],
      providerOptions: hasDirectAnthropicKey()
        ? { anthropic: { thinking: { type: "disabled" as const } } }
        : undefined,
    });
    return sanitizeCommitmentEventTitle(text, fallback);
  } catch (error) {
    console.error("[commitments.calendar-title]", error);
    return fallback;
  }
}
