/**
 * Per-school link-out URL overrides set in Reference › Data Sources.
 * Shape: { [sourceId]: { [schoolId]: "https://..." } }. Pure helpers plus a tiny
 * client-side store that Portal fills from /api/state.
 */

export type LinkOverrides = Record<string, Record<string, string>>;

export const OVERRIDE_SOURCE_IDS = ["npc", "virtual-tours"] as const;
export type OverrideSourceId = (typeof OVERRIDE_SOURCE_IDS)[number];

export function isOverrideSourceId(id: string): id is OverrideSourceId {
  return (OVERRIDE_SOURCE_IDS as readonly string[]).includes(id);
}

/** Empty string clears. Anything else must be an absolute https URL. */
export function validateOverrideUrl(
  raw: unknown,
): { ok: true; url: string | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, url: null };
  if (typeof raw !== "string") return { ok: false, error: "URL must be a string" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, url: null };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Enter a full URL starting with https://" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "URL must start with https://" };
  if (!parsed.hostname.includes(".")) return { ok: false, error: "URL needs a real hostname" };
  return { ok: true, url: parsed.toString() };
}

export function normalizeLinkOverrides(value: unknown): LinkOverrides {
  const out: LinkOverrides = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const sourceId of OVERRIDE_SOURCE_IDS) {
    const bySchool = (value as Record<string, unknown>)[sourceId];
    if (!bySchool || typeof bySchool !== "object" || Array.isArray(bySchool)) continue;
    const clean: Record<string, string> = {};
    for (const [schoolId, url] of Object.entries(bySchool as Record<string, unknown>)) {
      const checked = validateOverrideUrl(url);
      if (checked.ok && checked.url && schoolId.trim()) clean[schoolId] = checked.url;
    }
    if (Object.keys(clean).length > 0) out[sourceId] = clean;
  }
  return out;
}

export function withLinkOverride(
  current: LinkOverrides,
  sourceId: OverrideSourceId,
  schoolId: string,
  url: string | null,
): LinkOverrides {
  const bySchool = { ...(current[sourceId] ?? {}) };
  if (url) bySchool[schoolId] = url;
  else delete bySchool[schoolId];
  const next: LinkOverrides = { ...current };
  if (Object.keys(bySchool).length > 0) next[sourceId] = bySchool;
  else delete next[sourceId];
  return next;
}

let clientOverrides: LinkOverrides = {};

export function setClientLinkOverrides(value: unknown): void {
  clientOverrides = normalizeLinkOverrides(value);
}

export function linkOverrideFor(sourceId: OverrideSourceId, schoolId: string | null | undefined): string | null {
  if (!schoolId) return null;
  return clientOverrides[sourceId]?.[schoolId] ?? null;
}

/** Finance record with the NPC override applied. Returns the same object when there is no override. */
export function withNpcOverride<T extends { netPriceCalculatorUrl: string | null }>(
  record: T | null,
  schoolId: string,
): T | null {
  const url = linkOverrideFor("npc", schoolId);
  return record && url ? { ...record, netPriceCalculatorUrl: url } : record;
}
