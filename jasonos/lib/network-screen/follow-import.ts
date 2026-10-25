// Two clicks on the same contact can create two screens a few seconds apart.
// The capture prompt carries the first screen id, and the page can end up
// showing the empty second one. Treat that pair as one import.

export const IMPORT_SIBLING_WINDOW_MS = 2 * 60 * 1000;

export type ScreenSnapshot = {
  id: string;
  createdAt: string;
  visibleCount: number;
  status: string;
};

export function importedSiblingId(
  current: ScreenSnapshot,
  others: ScreenSnapshot[]
): string | null {
  if (current.status !== "awaiting_capture" || current.visibleCount > 0) return null;
  const created = Date.parse(current.createdAt);
  if (Number.isNaN(created)) return null;

  let best: { id: string; at: number; visibleCount: number } | null = null;
  for (const other of others) {
    if (other.id === current.id) continue;
    if (other.status === "awaiting_capture" || other.status === "archived") continue;
    if (other.visibleCount <= current.visibleCount) continue;
    const at = Date.parse(other.createdAt);
    if (Number.isNaN(at) || Math.abs(at - created) > IMPORT_SIBLING_WINDOW_MS) continue;
    if (
      !best ||
      other.visibleCount > best.visibleCount ||
      (other.visibleCount === best.visibleCount && at > best.at)
    ) {
      best = { id: other.id, at, visibleCount: other.visibleCount };
    }
  }
  return best?.id ?? null;
}
