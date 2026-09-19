import type { Plan, School } from "./types";
import { choiceRank, planLabel, selectivityRank } from "./types";

export type SortKey = "list" | "choice" | "name" | "selectivity" | "visited" | "date";

export function nextOpenStep(school: School): string {
  const open = [...school.steps]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((step) => !step.done);
  return open?.label ?? "";
}

export function nextDate(school: School): { date: string | null; label: string } {
  if (school.deadline) {
    return {
      date: school.deadline,
      label: school.deadlineLabel || planLabel(school.plan) || "Deadline",
    };
  }
  if (school.visitDate) return { date: school.visitDate, label: "Visit" };
  if (school.plan) return { date: null, label: planLabel(school.plan) };
  return { date: null, label: "" };
}

function dateValue(iso: string | null): number {
  return iso ? Date.parse(iso) : Number.POSITIVE_INFINITY;
}

export function compareSchools(a: School, b: School, sort: SortKey): number {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "choice") {
    const byChoice = choiceRank(a.choice) - choiceRank(b.choice);
    return byChoice || a.listOrder - b.listOrder;
  }
  if (sort === "selectivity") {
    const bySelectivity = selectivityRank(a.selectivity) - selectivityRank(b.selectivity);
    return bySelectivity || a.listOrder - b.listOrder;
  }
  if (sort === "visited") {
    if (a.visited !== b.visited) return a.visited ? -1 : 1;
    return a.listOrder - b.listOrder;
  }
  if (sort === "date") {
    const byDate = dateValue(nextDate(a).date) - dateValue(nextDate(b).date);
    return byDate || a.listOrder - b.listOrder;
  }
  return a.listOrder - b.listOrder;
}

export function planShort(plan: Plan): string {
  if (plan === "ed") return "ED";
  if (plan === "ea") return "EA";
  if (plan === "rd") return "RD";
  if (plan === "rolling") return "Rolling";
  return "";
}
