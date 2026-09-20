import type { Phase, School, SelectivityTier } from "./types";
import { SELECTIVITY_TIERS, tierLabel } from "./types";
import type { PhaseStatus } from "./phases";

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

/** Approximate contiguous-US state centroids in a 1000×620 viewBox. */
export const STATE_CENTROIDS: Record<string, { x: number; y: number }> = {
  WA: { x: 120, y: 60 },
  OR: { x: 100, y: 120 },
  CA: { x: 90, y: 230 },
  NV: { x: 140, y: 200 },
  ID: { x: 180, y: 110 },
  MT: { x: 260, y: 70 },
  WY: { x: 270, y: 150 },
  UT: { x: 210, y: 210 },
  AZ: { x: 200, y: 300 },
  CO: { x: 290, y: 230 },
  NM: { x: 270, y: 310 },
  ND: { x: 370, y: 70 },
  SD: { x: 370, y: 140 },
  NE: { x: 380, y: 200 },
  KS: { x: 400, y: 250 },
  OK: { x: 420, y: 300 },
  TX: { x: 400, y: 380 },
  MN: { x: 460, y: 90 },
  IA: { x: 470, y: 180 },
  MO: { x: 490, y: 250 },
  AR: { x: 500, y: 320 },
  LA: { x: 510, y: 400 },
  WI: { x: 530, y: 110 },
  IL: { x: 540, y: 200 },
  MS: { x: 550, y: 360 },
  MI: { x: 590, y: 120 },
  IN: { x: 590, y: 200 },
  KY: { x: 610, y: 250 },
  TN: { x: 610, y: 300 },
  AL: { x: 600, y: 360 },
  OH: { x: 640, y: 190 },
  GA: { x: 660, y: 360 },
  FL: { x: 700, y: 440 },
  SC: { x: 700, y: 330 },
  NC: { x: 720, y: 290 },
  VA: { x: 730, y: 250 },
  WV: { x: 690, y: 230 },
  PA: { x: 740, y: 180 },
  NY: { x: 780, y: 130 },
  VT: { x: 800, y: 90 },
  NH: { x: 820, y: 90 },
  ME: { x: 850, y: 60 },
  MA: { x: 840, y: 130 },
  RI: { x: 850, y: 150 },
  CT: { x: 830, y: 155 },
  NJ: { x: 800, y: 185 },
  DE: { x: 790, y: 210 },
  MD: { x: 770, y: 220 },
  DC: { x: 760, y: 235 },
};

const STATE_RE = /,\s*([A-Z]{2})\s*$/;

export function stateFromLocation(location: string): string | null {
  const match = location.trim().match(STATE_RE);
  return match?.[1] ?? null;
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
