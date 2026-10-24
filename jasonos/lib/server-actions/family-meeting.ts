"use server";

import { revalidatePath } from "next/cache";
import type { PresentationOverride } from "@/lib/family-meeting/edits";
import { withEventKeys } from "@/lib/family-meeting/edits";
import { freezeFamilyMeetingPrintPack } from "@/lib/family-meeting/freeze";
import type { FamilyMeetingEvent } from "@/lib/family-meeting/types";
import {
  archiveSeries,
  listArchivedSeries,
  listHiddenOccurrences,
  setSeriesPresentation,
  unarchiveSeries,
  unhideOccurrenceKey,
  upsertOccurrenceEdit,
} from "@/lib/family-meeting/store";

type ActionResult = { ok: true } | { ok: false; error: string };

function hasConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function asEvent(raw: FamilyMeetingEvent): FamilyMeetingEvent {
  return withEventKeys(raw);
}

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  if (!hasConfig()) return { ok: false, error: "Supabase is not configured." };
  try {
    await fn();
    revalidatePath("/projects/family-meeting");
    revalidatePath("/projects/family-meeting/print");
    return { ok: true };
  } catch (error) {
    console.error("[family-meeting.action]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Hide this calendar showing only. A later occurrence can reappear. */
export async function hideFamilyMeetingOccurrence(
  event: FamilyMeetingEvent
): Promise<ActionResult> {
  return run(() => upsertOccurrenceEdit({ event: asEvent(event), hidden: true }));
}

/** Unhide one occurrence by key (undo hide). */
export async function unhideFamilyMeetingOccurrenceKey(
  occurrenceKey: string
): Promise<ActionResult> {
  return run(() => unhideOccurrenceKey(occurrenceKey));
}

/** Archive every occurrence of this series until unarchived. */
export async function archiveFamilyMeetingSeries(input: {
  seriesKey: string;
  title: string;
  events: FamilyMeetingEvent[];
}): Promise<ActionResult> {
  return run(() =>
    archiveSeries({
      seriesKey: input.seriesKey,
      title: input.title,
      events: input.events.map(asEvent),
    })
  );
}

export async function unarchiveFamilyMeetingSeries(
  seriesKey: string
): Promise<ActionResult> {
  return run(() => unarchiveSeries(seriesKey));
}

/** Promote weekly-rhythm series → regular spotlight cards. */
export async function promoteFamilyMeetingSeries(input: {
  seriesKey: string;
  events: FamilyMeetingEvent[];
}): Promise<ActionResult> {
  return run(() =>
    setSeriesPresentation({
      seriesKey: input.seriesKey,
      presentation: "spotlight" satisfies PresentationOverride,
      events: input.events.map(asEvent),
    })
  );
}

/** Demote regular events → weekly rhythm. */
export async function demoteFamilyMeetingSeries(input: {
  seriesKey: string;
  events: FamilyMeetingEvent[];
}): Promise<ActionResult> {
  return run(() =>
    setSeriesPresentation({
      seriesKey: input.seriesKey,
      presentation: "routine" satisfies PresentationOverride,
      events: input.events.map(asEvent),
    })
  );
}

/** Long Term Heads Up — shows on every print sheet as a shared reminder. */
export async function markFamilyMeetingHeadsUp(input: {
  seriesKey: string;
  events: FamilyMeetingEvent[];
}): Promise<ActionResult> {
  return run(() =>
    setSeriesPresentation({
      seriesKey: input.seriesKey,
      presentation: "heads_up",
      events: input.events.map(asEvent),
    })
  );
}

/** Clear presentation override back to auto detection. */
export async function resetFamilyMeetingPresentation(input: {
  seriesKey: string;
  events: FamilyMeetingEvent[];
}): Promise<ActionResult> {
  return run(() =>
    setSeriesPresentation({
      seriesKey: input.seriesKey,
      presentation: "auto",
      events: input.events.map(asEvent),
    })
  );
}

export async function loadFamilyMeetingUndoLists(): Promise<
  | {
      ok: true;
      hidden: Awaited<ReturnType<typeof listHiddenOccurrences>>;
      archived: Awaited<ReturnType<typeof listArchivedSeries>>;
    }
  | { ok: false; error: string }
> {
  if (!hasConfig()) return { ok: false, error: "Supabase is not configured." };
  try {
    const [hidden, archived] = await Promise.all([
      listHiddenOccurrences(),
      listArchivedSeries(),
    ]);
    return { ok: true, hidden, archived };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Manual freeze (editor) — same path as Friday cron. */
export async function freezeFamilyMeetingPrintNow(): Promise<
  | { ok: true; packId: string; printPath: string; label: string }
  | { ok: false; error: string }
> {
  if (!hasConfig()) return { ok: false, error: "Supabase is not configured." };
  const result = await freezeFamilyMeetingPrintPack({ force: true });
  if (!result.ok) return { ok: false, error: result.error };
  if (!result.packId || !result.printPath) {
    return { ok: false, error: result.reason || "freeze_failed" };
  }
  revalidatePath("/projects/family-meeting");
  revalidatePath("/projects/family-meeting/print");
  return {
    ok: true,
    packId: result.packId,
    printPath: result.printPath,
    label: result.label || "",
  };
}
