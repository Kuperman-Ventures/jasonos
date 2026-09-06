import type {
  ConsciousnessPremise,
  DetailLevel,
  GuideId,
  IugrPreferences,
} from "./types";
import { DEFAULT_GUIDE_ID } from "./guides";

const STORAGE_KEY = "iugr:preferences:v1";

export const DEFAULT_PREFERENCES: IugrPreferences = {
  guideId: DEFAULT_GUIDE_ID,
  detailLevel: "balanced",
  reducedMotion: false,
  highContrast: false,
  consciousnessPremise: null,
};

function isGuideId(value: unknown): value is GuideId {
  return value === "guide" || value === "mira" || value === "dr-maybe";
}

function isDetailLevel(value: unknown): value is DetailLevel {
  return value === "story" || value === "balanced" || value === "machinery";
}

function isConsciousnessPremise(
  value: unknown,
): value is ConsciousnessPremise {
  return value === "yes" || value === "unsure" || value === "no";
}

export function readPreferences(): IugrPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<IugrPreferences>;
    return {
      // Locked guides cannot remain selected across sessions.
      guideId:
        isGuideId(parsed.guideId) && parsed.guideId === "guide"
          ? parsed.guideId
          : DEFAULT_GUIDE_ID,
      detailLevel: isDetailLevel(parsed.detailLevel)
        ? parsed.detailLevel
        : DEFAULT_PREFERENCES.detailLevel,
      reducedMotion:
        typeof parsed.reducedMotion === "boolean"
          ? parsed.reducedMotion
          : DEFAULT_PREFERENCES.reducedMotion,
      highContrast:
        typeof parsed.highContrast === "boolean"
          ? parsed.highContrast
          : DEFAULT_PREFERENCES.highContrast,
      consciousnessPremise: isConsciousnessPremise(parsed.consciousnessPremise)
        ? parsed.consciousnessPremise
        : null,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(prefs: IugrPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore private-mode / blocked storage.
  }
}

export function systemPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
