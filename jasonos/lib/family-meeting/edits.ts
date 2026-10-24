import type { FamilyMeetingEvent } from "./types";
import {
  dayKeyForEvent,
  occurrenceKeyForEvent,
  seriesKeyForEvent,
} from "./keys";

export type PresentationOverride =
  | "auto"
  | "spotlight"
  | "routine"
  | "heads_up";

export interface OccurrenceEdit {
  occurrence_key: string;
  series_key: string;
  group_id: string;
  day_key: string;
  title: string;
  starts_at: string;
  hidden: boolean;
  presentation: PresentationOverride;
}

export interface SeriesEdit {
  series_key: string;
  title: string;
  archived: boolean;
}

export interface FamilyMeetingEdits {
  occurrences: OccurrenceEdit[];
  series: SeriesEdit[];
}

/** Attach stable keys used by the editor + store. */
export function withEventKeys(ev: FamilyMeetingEvent): FamilyMeetingEvent {
  const seriesKey = seriesKeyForEvent(ev);
  const occurrenceKey = occurrenceKeyForEvent(ev);
  const dayKey = dayKeyForEvent(ev.startsAt);
  if (
    ev.seriesKey === seriesKey &&
    ev.occurrenceKey === occurrenceKey &&
    ev.dayKey === dayKey
  ) {
    return ev;
  }
  return { ...ev, seriesKey, occurrenceKey, dayKey };
}

/**
 * Apply persisted edits: drop archived series + hidden occurrences,
 * then force presentation (spotlight/routine) when overridden.
 */
export function applyFamilyMeetingEdits(
  events: FamilyMeetingEvent[],
  edits: FamilyMeetingEdits
): FamilyMeetingEvent[] {
  const archived = new Set(
    edits.series.filter((s) => s.archived).map((s) => s.series_key)
  );
  const byOccurrence = new Map(
    edits.occurrences.map((o) => [o.occurrence_key, o])
  );

  const out: FamilyMeetingEvent[] = [];
  for (const raw of events) {
    const ev = withEventKeys(raw);
    const seriesKey = ev.seriesKey!;
    const occurrenceKey = ev.occurrenceKey!;
    if (archived.has(seriesKey)) continue;
    const occ = byOccurrence.get(occurrenceKey);
    if (occ?.hidden) continue;

    let routine = Boolean(ev.routine);
    let presentation: PresentationOverride = "auto";
    if (occ?.presentation === "spotlight") {
      routine = false;
      presentation = "spotlight";
    } else if (occ?.presentation === "routine") {
      routine = true;
      presentation = "routine";
    } else if (occ?.presentation === "heads_up") {
      routine = false;
      presentation = "heads_up";
    }
    out.push({ ...ev, routine, presentation });
  }
  return out;
}
