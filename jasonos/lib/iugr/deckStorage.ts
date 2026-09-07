/**
 * Persist deck position and entry interaction state.
 */

import type {
  CivilizationReach,
  ConsciousnessStance,
  HistoryInterest,
} from "@/lib/iugr/scenarioEngine";
import type { ConsciousnessPremise } from "@/lib/iugr/types";

const KEY = "iugr-deck-v2";

export type DeckPersisted = {
  index: number;
  hintSeen: boolean;
  readerFigureIndex: number | null;
  copiesAreConscious: ConsciousnessPremise | null;
  chosenDoor: string | null;
  copiedTowns: number;
  civilizations: CivilizationReach | null;
  history: HistoryInterest | null;
  consciousness: ConsciousnessStance | null;
};

export const DEFAULT_PERSISTED: DeckPersisted = {
  index: 0,
  hintSeen: false,
  readerFigureIndex: null,
  copiesAreConscious: null,
  chosenDoor: null,
  copiedTowns: 0,
  civilizations: null,
  history: null,
  consciousness: null,
};

export function readPersisted(deckLength: number): DeckPersisted {
  if (typeof window === "undefined") return { ...DEFAULT_PERSISTED };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PERSISTED };
    const parsed = JSON.parse(raw) as Partial<DeckPersisted>;
    const index = Number(parsed.index ?? 0);
    return {
      ...DEFAULT_PERSISTED,
      ...parsed,
      index: Math.max(0, Math.min(deckLength - 1, Number.isFinite(index) ? index : 0)),
      hintSeen: Boolean(parsed.hintSeen),
      readerFigureIndex:
        typeof parsed.readerFigureIndex === "number"
          ? parsed.readerFigureIndex
          : null,
      copiedTowns:
        typeof parsed.copiedTowns === "number" && parsed.copiedTowns >= 0
          ? parsed.copiedTowns
          : 0,
    };
  } catch {
    return { ...DEFAULT_PERSISTED };
  }
}

export function writePersisted(next: DeckPersisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
