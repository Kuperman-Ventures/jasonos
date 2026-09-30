/** Freeform About Jason blurb from Settings. Empty means unset. */

export function normalizeAboutJason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
