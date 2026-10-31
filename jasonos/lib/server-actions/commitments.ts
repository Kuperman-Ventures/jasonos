"use server";

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
import {
  getCommitmentCheckForHome,
  setCommitmentItemState,
  updateCommitmentItem,
} from "@/lib/commitments/store";
import type { CommitmentCheckForHome } from "@/lib/commitments/types";
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

/** Save an inline edit of the quoted promise (and to / due date) from Home. */
export async function saveCommitmentEdit(input: {
  itemKey: string;
  promise: string;
  to: string;
  dueDate: string | null;
}): Promise<ActionResult> {
  return run(() =>
    updateCommitmentItem({
      item_key: input.itemKey,
      promise: input.promise,
      to: input.to,
      due_date: input.dueDate,
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
  /** Calendar event title Jason typed (or accepted from the suggested default). */
  title: string;
  startIso: string;
  endIso: string;
};

/**
 * Put a work block (typically 30 or 60 minutes) on the Advisors primary calendar
 * for a Commitment Check item, then mark the item scheduled on Home.
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

  const titleInput: CommitmentTitleInput = {
    promise: input.promise,
    to: input.to,
    due_date: input.due_date,
    context: input.context,
  };
  const title = sanitizeCommitmentEventTitle(
    input.title,
    fallbackCommitmentEventTitle(titleInput)
  );
  if (!title.trim()) {
    return { ok: false, error: "Enter a calendar title." };
  }

  const tokens = await listGoogleAccessTokens();
  const token =
    tokens.find((account) => account.accountEmail === ADVISORS_ACCOUNT_EMAIL)?.token ??
    tokens[0]?.token;
  if (!token) {
    return { ok: false, error: "Advisors Google is not connected." };
  }

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

  try {
    await setCommitmentItemState({
      item_key: input.itemKey,
      state: "scheduled",
      actor: "jasonos",
    });
  } catch (error) {
    console.error("[commitments.schedule-state]", error);
    return {
      ok: false,
      error:
        "Calendar event was created, but the commitment could not be marked scheduled. Refresh and try marking it again.",
    };
  }

  revalidatePath("/");
  return { ok: true, title, htmlLink: created.htmlLink };
}
