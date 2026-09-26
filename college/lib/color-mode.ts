/** Appearance mode for The Track (System / Light / Dark). */

export type ColorModePreference = "system" | "light" | "dark";
export type ResolvedColorMode = "light" | "dark";

export const COLOR_MODE_STORAGE_KEY = "track-theme";

export function isColorModePreference(value: string): value is ColorModePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readStoredColorMode(): ColorModePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (raw && isColorModePreference(raw)) return raw;
  } catch {
    /* private mode */
  }
  return "system";
}

export function resolveColorMode(
  preference: ColorModePreference,
  prefersDark = false,
): ResolvedColorMode {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

export function applyResolvedColorMode(mode: ResolvedColorMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.mode = mode;
  document.documentElement.style.colorScheme = mode;
}

/** Inline boot script — set data-mode before first paint to avoid a white flash. */
export const COLOR_MODE_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(COLOR_MODE_STORAGE_KEY)};var p=localStorage.getItem(k);if(p!=="light"&&p!=="dark"&&p!=="system")p="system";var dark=window.matchMedia("(prefers-color-scheme: dark)").matches;var m=p==="system"?(dark?"dark":"light"):p;document.documentElement.dataset.mode=m;document.documentElement.style.colorScheme=m;}catch(e){}})();`;
