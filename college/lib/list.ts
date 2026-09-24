import type { Plan, School } from "./types";
import { interestRank, planLabel, tierRank, trackLabel } from "./types";

export type SortKey = "list" | "name" | "status" | "selectivity" | "interest" | "action";

export function nextOpenStep(school: School): string {
  const open = [...school.steps]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((step) => !step.done);
  return open?.label ?? "";
}

export function primaryDeadline(school: School): { date: string | null; title: string } {
  const open = school.deadlines
    .filter((item) => !item.completed && item.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.sortOrder - b.sortOrder);
  if (open[0]) return { date: open[0].dueDate, title: open[0].title };
  if (school.deadline) return { date: school.deadline, title: school.deadlineLabel };
  return { date: null, title: "" };
}

export function nextAction(school: School): { title: string; dueDate: string | null } {
  const deadline = primaryDeadline(school);
  if (deadline.date || deadline.title) return { title: deadline.title || "Deadline", dueDate: deadline.date };
  const undated = school.deadlines
    .filter((item) => !item.completed)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (undated[0]) return { title: undated[0].title, dueDate: null };
  const step = nextOpenStep(school);
  if (step) return { title: step, dueDate: null };
  return { title: "", dueDate: null };
}

export function nextDate(school: School): { date: string | null; label: string } {
  const action = nextAction(school);
  if (action.dueDate || action.title) return { date: action.dueDate, label: action.title };
  if (school.visitDate) return { date: school.visitDate, label: "Visit" };
  if (school.admissionTrack) return { date: null, label: trackLabel(school.admissionTrack) };
  if (school.plan) return { date: null, label: planLabel(school.plan) };
  return { date: null, label: "" };
}

function dateValue(iso: string | null): number {
  return iso ? Date.parse(iso) : Number.POSITIVE_INFINITY;
}

export function compareSchools(a: School, b: School, sort: SortKey): number {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "interest") {
    const byInterest = interestRank(a.interestLevel) - interestRank(b.interestLevel);
    return byInterest || a.listOrder - b.listOrder;
  }
  if (sort === "selectivity") {
    const byTier = tierRank(a.selectivityTier) - tierRank(b.selectivityTier);
    return byTier || a.listOrder - b.listOrder;
  }
  if (sort === "status") {
    const byStatus = a.applicationStatus.localeCompare(b.applicationStatus);
    return byStatus || a.listOrder - b.listOrder;
  }
  if (sort === "action") {
    const byDate = dateValue(nextAction(a).dueDate) - dateValue(nextAction(b).dueDate);
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
