import type { Criterion } from "./types";

export function weightedTotal(
  scores: Record<string, number> | undefined,
  criteria: Criterion[],
): number {
  let total = 0;
  for (const criterion of criteria) {
    total += (Number(scores?.[criterion.id]) || 0) * criterion.weight;
  }
  return total;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(5, Math.max(1, Math.round(value)));
}
