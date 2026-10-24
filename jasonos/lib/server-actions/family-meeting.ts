"use server";

import { revalidatePath } from "next/cache";
import type { PresentationOverride } from "@/lib/family-meeting/edits";
import { withEventKeys } from "@/lib/family-meeting/edits";
import type { FamilyMeetingEvent } from "@/lib/family-meeting/types";
import {
  archiveSeries,
  setSeriesPresentation,
  unarchiveSeries,
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

/** Unhide one occurrence (undo hide). */
export async function unhideFamilyMeetingOccurrence(
  event: FamilyMeetingEvent
): Promise<ActionResult> {
  return run(() =>
    upsertOccurrenceEdit({ event: asEvent(event), hidden: false })
  );
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
