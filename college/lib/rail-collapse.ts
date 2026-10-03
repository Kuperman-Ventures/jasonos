/** Collapsible left rail: expanded (280px) ⇄ slim (84px). */

export type RailDensity = "expanded" | "slim";

export const RAIL_DENSITY_STORAGE_KEY = "track.rail";
export const RAIL_EXPANDED_WIDTH = 280;
export const RAIL_SLIM_WIDTH = 84;
/** Below this width, first visit defaults to slim unless the user chose expanded. */
export const RAIL_SLIM_DEFAULT_MAX_WIDTH = 1100;

export function isRailDensity(value: string): value is RailDensity {
  return value === "expanded" || value === "slim";
}

export function readStoredRailDensity(): RailDensity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RAIL_DENSITY_STORAGE_KEY);
    if (raw && isRailDensity(raw)) return raw;
  } catch {
    /* private mode */
  }
  return null;
}

export function writeStoredRailDensity(value: RailDensity): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RAIL_DENSITY_STORAGE_KEY, value);
  } catch {
    /* private mode */
  }
}

export function defaultRailDensity(viewportWidth: number): RailDensity {
  return viewportWidth < RAIL_SLIM_DEFAULT_MAX_WIDTH ? "slim" : "expanded";
}

export function resolveRailDensity(
  stored: RailDensity | null,
  viewportWidth: number,
): RailDensity {
  return stored ?? defaultRailDensity(viewportWidth);
}

/** Short labels for the slim rail (full labels stay on aria-label / tooltip). */
export const RAIL_SHORT_LABELS: Partial<Record<string, string>> = {
  dashboard: "Dashboard",
  projects: "Projects",
  notes: "Notes",
  log: "Log",
  colleges: "Colleges",
  apps: "Apps",
  finances: "Finances",
  ingest: "Ingest",
  guide: "Guide",
  consultants: "Consultants",
  faq: "FAQ",
  testing: "Testing",
  sources: "Data Sources",
};

/** Compact process-phase names for the slim rail dots. */
export function shortProcessPhaseName(phase: string): string {
  const map: Record<string, string> = {
    "Junior Fall": "Jr Fall",
    "Junior Winter/Spring": "Jr Spr",
    "End of Junior Year": "Jr End",
    "Summer Before Senior Year": "Summer",
    "Senior Fall": "Sr Fall",
    "Senior Winter": "Sr Win",
  };
  return map[phase] ?? phase.slice(0, 8);
}

/**
 * Inline boot script — set --rail-w before first paint so the shell doesn't jump.
 * Runs after color-mode boot; safe if localStorage is blocked.
 */
export const RAIL_DENSITY_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(RAIL_DENSITY_STORAGE_KEY)};var p=localStorage.getItem(k);if(p!=="expanded"&&p!=="slim"){p=window.innerWidth<${RAIL_SLIM_DEFAULT_MAX_WIDTH}?"slim":"expanded";}var w=p==="slim"?${RAIL_SLIM_WIDTH}:${RAIL_EXPANDED_WIDTH};document.documentElement.dataset.rail=p;document.documentElement.style.setProperty("--rail-w",w+"px");}catch(e){}})();`;
