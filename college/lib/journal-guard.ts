import type { ActivitiesJournal } from "./activities-journal";

/**
 * True when an incoming journal write would replace a loaded student journal
 * with an empty-looking one (fewer activities, no profile) - the failure mode
 * that wiped production on a direct Application Prep load.
 */
export function isDestructiveJournalWrite(
  stored: ActivitiesJournal,
  incoming: ActivitiesJournal,
): boolean {
  const storedHasProfile = Boolean(stored.profile);
  const incomingHasProfile = Boolean(incoming.profile);
  return (
    storedHasProfile &&
    !incomingHasProfile &&
    incoming.activities.length < stored.activities.length
  );
}

export const JOURNAL_LOAD_WARN =
  "Refusing to save activities journal before it has loaded.";

/**
 * Client-side gate used by Portal.changeJournal. When false, do not update
 * local state or call patchState.
 */
export function allowJournalClientWrite(loaded: boolean): boolean {
  return loaded;
}

/**
 * Apply a journal change only after load. Returns whether the write proceeded.
 * Extracted so tests can assert patchState is never scheduled before load.
 */
export function applyJournalClientWrite(opts: {
  loaded: boolean;
  next: ActivitiesJournal;
  applyLocal: (next: ActivitiesJournal) => void;
  scheduleSave: (next: ActivitiesJournal) => void;
  warn?: (message: string) => void;
}): boolean {
  if (!allowJournalClientWrite(opts.loaded)) {
    (opts.warn ?? console.warn)(JOURNAL_LOAD_WARN);
    return false;
  }
  opts.applyLocal(opts.next);
  opts.scheduleSave(opts.next);
  return true;
}
