/**
 * Illustrative accounting for the IUGR Original Town copy sandbox.
 * These numbers describe a made-up town scenario — not a measurement of our universe.
 */

export const PEOPLE_PER_TOWN = 100;

export const COPY_SNAP_POINTS = [0, 1, 9, 99, 999] as const;
export type CopySnapPoint = (typeof COPY_SNAP_POINTS)[number];

export type TownScenarioCensus = {
  copiedTowns: number;
  originalTowns: 1;
  totalTowns: number;
  originalResidents: number;
  copiedResidents: number;
  totalResidents: number;
  /** Share of residents living in copied towns; 0 when totalResidents is 0. */
  copiedShare: number;
};

export function clampCopiedTowns(copies: number): number {
  if (!Number.isFinite(copies) || copies < 0) return 0;
  return Math.min(999, Math.floor(copies));
}

export function computeTownScenario(copiedTownsInput: number): TownScenarioCensus {
  const copiedTowns = clampCopiedTowns(copiedTownsInput);
  const originalTowns = 1 as const;
  const originalResidents = PEOPLE_PER_TOWN;
  const copiedResidents = copiedTowns * PEOPLE_PER_TOWN;
  const totalTowns = originalTowns + copiedTowns;
  const totalResidents = originalResidents + copiedResidents;
  const copiedShare =
    totalResidents <= 0 ? 0 : copiedResidents / totalResidents;

  return {
    copiedTowns,
    originalTowns,
    totalTowns,
    originalResidents,
    copiedResidents,
    totalResidents,
    copiedShare,
  };
}

/** Because every town has the same population, share simplifies to copies / (1 + copies). */
export function simplifiedCopiedShare(copiedTownsInput: number): number {
  const copies = clampCopiedTowns(copiedTownsInput);
  return copies / (1 + copies);
}

export function formatWholeNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function formatSharePercent(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return "0%";
  if (share >= 1) return "100%";
  const pct = share * 100;
  // Keep a decimal when whole-number rounding would falsely read as 100%.
  if (pct >= 99.5 && pct < 100) return `${pct.toFixed(1)}%`;
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${pct.toFixed(1).replace(/\.0$/, "")}%`;
  return `${pct.toFixed(2)}%`;
}

export type ScenarioNarration = {
  headline: string;
  detail: string;
};

export function narrationForCopies(copiedTownsInput: number): ScenarioNarration {
  const copies = clampCopiedTowns(copiedTownsInput);

  if (copies === 0) {
    return {
      headline: "Every resident in this scenario is in Original Town.",
      detail:
        "No copies yet. The accounting problem has not started. It is merely warming up.",
    };
  }

  if (copies === 1) {
    return {
      headline: "There are two equally sized towns: one original and one copied.",
      detail:
        "If you selected a random resident from these two towns, 1 out of 2 would be in a copied town.",
    };
  }

  if (copies === 9) {
    return {
      headline: "There are 10 towns total: 1 original and 9 copies.",
      detail:
        "In this scenario, 9 out of 10 residents would be in copied towns.",
    };
  }

  if (copies === 99) {
    return {
      headline: "There are 100 towns total: 1 original and 99 copies.",
      detail:
        "In this scenario, 99 out of 100 residents would be in copied towns.",
    };
  }

  if (copies === 999) {
    return {
      headline: "There are 1,000 towns total: 1 original and 999 copies.",
      detail:
        "In this scenario, 999 out of 1,000 residents would be in copied towns.",
    };
  }

  const census = computeTownScenario(copies);
  return {
    headline: `There are ${formatWholeNumber(census.totalTowns)} towns total: 1 original and ${formatWholeNumber(copies)} copies.`,
    detail: `In this scenario, about ${formatSharePercent(census.copiedShare)} of residents would be in copied towns.`,
  };
}

/** Snap a free value to the nearest designed teaching snap when close enough. */
export function nearestSnapPoint(value: number): number {
  const copies = clampCopiedTowns(value);
  let best: number = COPY_SNAP_POINTS[0];
  let bestDist = Math.abs(copies - best);
  for (const snap of COPY_SNAP_POINTS) {
    const dist = Math.abs(copies - snap);
    if (dist < bestDist) {
      best = snap;
      bestDist = dist;
    }
  }
  return best;
}
