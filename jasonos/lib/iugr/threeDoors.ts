/**
 * Three Doors chapter — Bostrom simulation-argument trilemma as a
 * thought-experiment hub. Content is illustrative philosophy, not evidence.
 */

import { THREE_DOORS_SCRIPT } from "./script";

export type DoorId = "road-ends" | "archive-closed" | "copy-warehouse";

export type DoorDefinition = {
  id: DoorId;
  number: 1 | 2 | 3;
  label: string;
  title: string;
  /** Bostrom's proposition in his words. */
  bostromQuote: string;
  /** Plain-language translation under the quote. */
  plainTranslation: string;
  /** Supporting body paragraphs. */
  body: readonly string[];
  /** Sci-fi / culture anchors. */
  sciFiAnchors: readonly string[];
  takeaway: string;
  /** Door 3 only — explicit unmet assumptions (inline in body for Door 3). */
  caveat?: string;
  accentVar: "--iugr-door-1" | "--iugr-door-2" | "--iugr-door-3";
};

export const THREE_DOOR_IDS: DoorId[] = [
  "road-ends",
  "archive-closed",
  "copy-warehouse",
];

const SCRIPT_DOORS = THREE_DOORS_SCRIPT.doors;

export const THREE_DOORS_DATA: Record<DoorId, DoorDefinition> = {
  "road-ends": {
    id: "road-ends",
    number: 1,
    label: "DOOR 1",
    title: SCRIPT_DOORS["road-ends"].title,
    bostromQuote: SCRIPT_DOORS["road-ends"].bostromQuote,
    plainTranslation: SCRIPT_DOORS["road-ends"].plainTranslation,
    body: SCRIPT_DOORS["road-ends"].body,
    sciFiAnchors: SCRIPT_DOORS["road-ends"].sciFiAnchors,
    takeaway: SCRIPT_DOORS["road-ends"].takeaway,
    accentVar: "--iugr-door-1",
  },
  "archive-closed": {
    id: "archive-closed",
    number: 2,
    label: "DOOR 2",
    title: SCRIPT_DOORS["archive-closed"].title,
    bostromQuote: SCRIPT_DOORS["archive-closed"].bostromQuote,
    plainTranslation: SCRIPT_DOORS["archive-closed"].plainTranslation,
    body: SCRIPT_DOORS["archive-closed"].body,
    sciFiAnchors: SCRIPT_DOORS["archive-closed"].sciFiAnchors,
    takeaway: SCRIPT_DOORS["archive-closed"].takeaway,
    accentVar: "--iugr-door-2",
  },
  "copy-warehouse": {
    id: "copy-warehouse",
    number: 3,
    label: "DOOR 3",
    title: SCRIPT_DOORS["copy-warehouse"].title,
    bostromQuote: SCRIPT_DOORS["copy-warehouse"].bostromQuote,
    plainTranslation: SCRIPT_DOORS["copy-warehouse"].plainTranslation,
    body: SCRIPT_DOORS["copy-warehouse"].body,
    sciFiAnchors: SCRIPT_DOORS["copy-warehouse"].sciFiAnchors,
    takeaway: SCRIPT_DOORS["copy-warehouse"].takeaway,
    accentVar: "--iugr-door-3",
  },
};

export function allDoorsExplored(explored: readonly DoorId[]): boolean {
  return THREE_DOOR_IDS.every((id) => explored.includes(id));
}

export function markDoorExplored(
  explored: readonly DoorId[],
  id: DoorId,
): DoorId[] {
  if (explored.includes(id)) return [...explored];
  return [...explored, id];
}
