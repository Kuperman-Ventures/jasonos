/** Persist Visit Planning start/end addresses + optional manual school order. */

export const VISIT_PLAN_STORAGE_KEY = "track-visit-plan-v1";
export const DEFAULT_VISIT_START_ADDRESS = "Maplewood, NJ 07040";
export const DEFAULT_VISIT_END_ADDRESS = "Maplewood, NJ 07040";

export type VisitPlanUiState = {
  startAddress: string;
  endAddress: string;
  /** When set, use this order instead of the optimized route. */
  manualOrder: string[] | null;
};

export function defaultVisitPlanUiState(): VisitPlanUiState {
  return {
    startAddress: DEFAULT_VISIT_START_ADDRESS,
    endAddress: DEFAULT_VISIT_END_ADDRESS,
    manualOrder: null,
  };
}

export function parseVisitPlanUiState(raw: unknown): VisitPlanUiState | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const startAddress =
    typeof row.startAddress === "string" ? row.startAddress : DEFAULT_VISIT_START_ADDRESS;
  const endAddress =
    typeof row.endAddress === "string" ? row.endAddress : DEFAULT_VISIT_END_ADDRESS;
  let manualOrder: string[] | null = null;
  if (Array.isArray(row.manualOrder)) {
    manualOrder = row.manualOrder.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    if (!manualOrder.length) manualOrder = null;
  }
  return { startAddress, endAddress, manualOrder };
}

export function readVisitPlanUiState(): VisitPlanUiState {
  if (typeof window === "undefined") return defaultVisitPlanUiState();
  try {
    const raw = window.localStorage.getItem(VISIT_PLAN_STORAGE_KEY);
    if (!raw) return defaultVisitPlanUiState();
    return parseVisitPlanUiState(JSON.parse(raw)) ?? defaultVisitPlanUiState();
  } catch {
    return defaultVisitPlanUiState();
  }
}

export function writeVisitPlanUiState(state: VisitPlanUiState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VISIT_PLAN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}
