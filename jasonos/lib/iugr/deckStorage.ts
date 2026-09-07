const CARD_INDEX_KEY = "iugr-deck-card-index";
const HINT_KEY = "iugr-deck-hint-seen";
const COPIED_TOWNS_KEY = "iugr-deck-copied-towns";

export function readDeckCardIndex(deckLength: number): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(CARD_INDEX_KEY);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, Math.max(0, deckLength - 1));
  } catch {
    return 0;
  }
}

export function writeDeckCardIndex(index: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CARD_INDEX_KEY, String(index));
  } catch {
    /* ignore quota */
  }
}

export function readHintSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHintSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function readCopiedTowns(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(COPIED_TOWNS_KEY);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeCopiedTowns(n: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COPIED_TOWNS_KEY, String(n));
  } catch {
    /* ignore */
  }
}
