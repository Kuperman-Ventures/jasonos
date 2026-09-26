import type { Phase } from "./types";

export type PhaseStatus = {
  doneCount: number;
  total: number;
  status: "done" | "current" | "upcoming";
};

export function phaseStatuses(
  phases: Phase[],
  checklist: Record<string, boolean>,
): PhaseStatus[] {
  const statuses: PhaseStatus[] = [];
  let currentSet = false;
  for (const phase of phases) {
    const doneCount = phase.items.filter((item) => checklist[item.id]).length;
    let status: PhaseStatus["status"] = "upcoming";
    if (doneCount === phase.items.length) status = "done";
    else if (!currentSet) {
      status = "current";
      currentSet = true;
    }
    statuses.push({ doneCount, total: phase.items.length, status });
  }
  if (!currentSet && statuses.length) statuses[statuses.length - 1].status = "current";
  return statuses;
}

export function currentPhaseIndex(statuses: PhaseStatus[]): number {
  const idx = statuses.findIndex((status) => status.status === "current");
  return idx === -1 ? Math.max(0, statuses.length - 1) : idx;
}
