import type { Plan, School } from "./types";
import { interestRank, planLabel, tierRank, trackLabel } from "./types";
import { campusSettingRank } from "./campus-size";
import { scoirNewJerseyPct } from "./scoir";
import { parseSchoolLocation } from "./visit-planning";

export type SortKey =
  | "list"
  | "name"
  | "location"
  | "status"
  | "selectivity"
  | "interest"
  | "action"
  | "drive"
  | "setting"
  | "size"
  | "newJerseyPct";

export const SORT_KEYS: readonly SortKey[] = [
  "list",
  "name",
  "location",
  "status",
  "selectivity",
  "interest",
  "action",
  "drive",
  "setting",
  "size",
  "newJerseyPct",
] as const;

export function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

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
  if (sort === "location") {
    const aLoc = parseSchoolLocation(a.location);
    const bLoc = parseSchoolLocation(b.location);
    const aState = aLoc.state.toUpperCase();
    const bState = bLoc.state.toUpperCase();
    if (!aState && !bState) {
      return aLoc.city.localeCompare(bLoc.city) || a.listOrder - b.listOrder;
    }
    if (!aState) return 1;
    if (!bState) return -1;
    return (
      aState.localeCompare(bState) ||
      aLoc.city.localeCompare(bLoc.city) ||
      a.name.localeCompare(b.name) ||
      a.listOrder - b.listOrder
    );
  }
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
  if (sort === "drive") {
    const am = a.driveMinutes;
    const bm = b.driveMinutes;
    if (am == null && bm == null) return a.listOrder - b.listOrder;
    if (am == null) return 1;
    if (bm == null) return -1;
    return am - bm || a.listOrder - b.listOrder;
  }
  if (sort === "setting") {
    const bySetting = campusSettingRank(a.campusSetting) - campusSettingRank(b.campusSetting);
    const aPop = a.metroPopulation ?? -1;
    const bPop = b.metroPopulation ?? -1;
    return bySetting || bPop - aPop || a.listOrder - b.listOrder;
  }
  if (sort === "size") {
    const ae = a.undergradEnrollment;
    const be = b.undergradEnrollment;
    if (ae == null && be == null) return a.listOrder - b.listOrder;
    if (ae == null) return 1;
    if (be == null) return -1;
    return ae - be || a.listOrder - b.listOrder;
  }
  if (sort === "newJerseyPct") {
    const aj = scoirNewJerseyPct(a);
    const bj = scoirNewJerseyPct(b);
    if (aj == null && bj == null) return a.listOrder - b.listOrder;
    if (aj == null) return 1;
    if (bj == null) return -1;
    return bj - aj || a.listOrder - b.listOrder;
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

/** Previous / next neighbors for school detail modal browsing. */
export function adjacentInList<T extends { id: string }>(
  items: T[],
  currentId: string,
): { index: number; previous: T | null; next: T | null; total: number } {
  const index = items.findIndex((item) => item.id === currentId);
  if (index < 0) {
    return { index: -1, previous: null, next: null, total: items.length };
  }
  return {
    index,
    previous: index > 0 ? (items[index - 1] ?? null) : null,
    next: index < items.length - 1 ? (items[index + 1] ?? null) : null,
    total: items.length,
  };
}
