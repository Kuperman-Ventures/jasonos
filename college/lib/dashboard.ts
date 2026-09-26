import type { Phase, School, SelectivityTier } from "./types";
import { SELECTIVITY_TIERS, tierLabel } from "./types";
import type { PhaseStatus } from "./phases";
import { US_STATE_CENTROIDS } from "./us-state-paths";

export type SelectivitySlice = {
  id: SelectivityTier;
  label: string;
  count: number;
  percent: number;
};

export type StateCount = {
  state: string;
  count: number;
};

/** Ordered most → least selective for the snapshot meter. */
export const SELECTIVITY_SPECTRUM = SELECTIVITY_TIERS.filter((tier) => tier.id);

export { US_STATE_PATHS, US_MAP_VIEWBOX, US_STATE_CENTROIDS } from "./us-state-paths";

/** Fill strength 0–1 for choropleth intensity from school count. */
export function stateFillStrength(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.max(0.22, count / max);
}

const STATE_RE = /,\s*([A-Z]{2})\s*$/;

export function stateFromLocation(location: string): string | null {
  const match = location.trim().match(STATE_RE);
  return match?.[1] ?? null;
}

export function stateCentroid(state: string): { x: number; y: number } | null {
  return US_STATE_CENTROIDS[state] ?? null;
}

/**
 * Position on the selectivity spectrum from 0 (extremely) to 1 (less competitive).
 * Returns null when the tier is unset.
 */
export function selectivitySpectrumPosition(tier: SelectivityTier): number | null {
  const index = SELECTIVITY_SPECTRUM.findIndex((item) => item.id === tier);
  if (index < 0) return null;
  const last = SELECTIVITY_SPECTRUM.length - 1;
  return last <= 0 ? 0 : index / last;
}

export function selectivityBreakdown(schools: School[]): SelectivitySlice[] {
  const total = schools.length || 1;
  return SELECTIVITY_TIERS.map((tier) => {
    const count = schools.filter((school) => school.selectivityTier === tier.id).length;
    return {
      id: tier.id,
      label: tierLabel(tier.id) || "Not set",
      count,
      percent: Math.round((count / total) * 1000) / 10,
    };
  });
}

export function schoolsByState(schools: School[]): StateCount[] {
  const counts = new Map<string, number>();
  for (const school of schools) {
    const state = stateFromLocation(school.location);
    if (!state) continue;
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));
}

export function phaseProgress(statuses: PhaseStatus[]): { done: number; total: number; percent: number }[] {
  return statuses.map((status) => ({
    done: status.doneCount,
    total: status.total,
    percent: status.total ? Math.round((status.doneCount / status.total) * 100) : 0,
  }));
}

export function dashboardPhaseCards(phases: Phase[], statuses: PhaseStatus[]) {
  return phases.map((phase, index) => ({
    phase: phase.phase,
    window: phase.window,
    status: statuses[index]?.status ?? "upcoming",
    done: statuses[index]?.doneCount ?? 0,
    total: statuses[index]?.total ?? phase.items.length,
    percent: statuses[index]?.total
      ? Math.round(((statuses[index]?.doneCount ?? 0) / statuses[index].total) * 100)
      : 0,
  }));
}
