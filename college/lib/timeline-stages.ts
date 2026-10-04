/**
 * Timeline stage drill-down — projects are ROADMAP_TRACKS; stages are dated work
 * items under each project (seeded in content/project-stages.json).
 */

import stagesFile from "@/content/project-stages.json";
import {
  ROADMAP_TRACKS,
  type RoadmapSegment,
  type RoadmapTrack,
} from "@/lib/roadmap";

export type TimelinePhase = {
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
};

export type TimelineProject = {
  id: string;
  name: string;
  start: string;
  end: string;
  phases?: TimelinePhase[];
};

export type TimelineStage = {
  id: string;
  projectId: string;
  name: string;
  start: string;
  end: string;
  phase: string | null;
  isMilestone: boolean;
  completedAt: string | null;
  /** True when the matching to-do is checked, even if completedAt was never stored. */
  done?: boolean;
};

export type StageStatus = "done" | "overdue" | "now" | "next";

export type StageTick = {
  start: Date;
  left: number;
  width: number;
  label: string;
  year: string;
  current: boolean;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const SEED_STAGES = stagesFile as TimelineStage[];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}


export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** First day of a roadmap month cell. */
export function monthStartIso(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}-01`;
}

/** Last day of a roadmap month cell. */
export function monthEndIso(year: number, month: number): string {
  const last = new Date(year, month + 1, 0).getDate();
  return `${year}-${pad2(month + 1)}-${pad2(last)}`;
}

function phaseFromSegment(segment: RoadmapSegment): TimelinePhase {
  return {
    name: segment.label,
    start: monthStartIso(segment.start.year, segment.start.month),
    end: monthEndIso(segment.end.year, segment.end.month),
  };
}

export function timelineProjectFromTrack(track: RoadmapTrack): TimelineProject {
  return {
    id: track.id,
    name: track.label,
    start: monthStartIso(track.start.year, track.start.month),
    end: monthEndIso(track.end.year, track.end.month),
    phases: track.segments?.map(phaseFromSegment),
  };
}

export const TIMELINE_PROJECTS: TimelineProject[] = ROADMAP_TRACKS.filter(
  (track) => track.kind === "bar",
).map(timelineProjectFromTrack);

export function timelineProjectById(id: string): TimelineProject | null {
  return TIMELINE_PROJECTS.find((project) => project.id === id) ?? null;
}

export function timelineProjectIndex(id: string): number {
  return TIMELINE_PROJECTS.findIndex((project) => project.id === id);
}

/** Seed stages for one project, optionally merged with live completion overrides. */
export function stagesForProject(
  projectId: string,
  overrides: Record<string, Pick<TimelineStage, "completedAt">> = {},
): TimelineStage[] {
  return SEED_STAGES.filter((stage) => stage.projectId === projectId).map((stage) => {
    const override = overrides[stage.id];
    return override ? { ...stage, completedAt: override.completedAt } : stage;
  });
}

/**
 * Seed stages for a project, overlaid with matching to-dos (same id).
 * A stage is done when `completions[stage.id]` is true; `completedAt` comes
 * from the to-do, not today's date.
 */
export function resolveProjectStages(
  projectId: string,
  todos: Array<{
    id: string;
    label: string;
    startDate: string | null;
    endDate: string | null;
    dueDate: string | null;
    completedAt?: string | null;
  }> = [],
  completions: Record<string, boolean> = {},
): TimelineStage[] {
  const byId = new Map(todos.map((row) => [row.id, row]));
  return stagesForProject(projectId).map((seed) => {
    const todo = byId.get(seed.id);
    const done = Boolean(completions[seed.id]);
    const start = todo?.startDate || seed.start;
    const end = todo ? todo.endDate || todo.dueDate || seed.end : seed.end;
    return {
      ...seed,
      name: todo?.label || seed.name,
      start,
      end: seed.isMilestone ? start : end,
      completedAt: done ? (todo?.completedAt ?? seed.completedAt ?? null) : null,
      done,
    };
  });
}

export function allTimelineStages(): TimelineStage[] {
  return SEED_STAGES.slice();
}

/**
 * Done only when the user confirmed completion (`completedAt`).
 * Past end date without confirmation is overdue — not done.
 */
export function stageStatus(stage: TimelineStage, today = new Date()): StageStatus {
  if (stage.completedAt || stage.done) return "done";
  const end = parseIsoDate(stage.end);
  const start = parseIsoDate(stage.start);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (end < todayStart) return "overdue";
  if (start <= todayStart) return "now";
  return "next";
}

export function stageStatusLabel(
  stage: TimelineStage,
  status: StageStatus,
): string {
  if (stage.isMilestone) {
    if (status === "done") return "passed";
    if (status === "overdue") return "overdue";
    return "upcoming";
  }
  if (status === "done") return "done";
  if (status === "overdue") return "overdue";
  if (status === "now") return "in progress";
  return "not started";
}

export function stageMark(stage: TimelineStage, status: StageStatus): string {
  if (stage.isMilestone) return "◆";
  if (status === "done") return "✓";
  if (status === "overdue") return "!";
  if (status === "now") return "●";
  return "○";
}

export function formatStageRange(startIso: string, endIso: string): string {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const fmt = (d: Date) => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  if (start.getTime() === end.getTime()) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatProjectRangeKicker(
  project: TimelineProject,
  index: number,
  total: number,
): string {
  const start = parseIsoDate(project.start);
  const end = parseIsoDate(project.end);
  return `${MONTH_SHORT[start.getMonth()]} ${start.getFullYear()} – ${MONTH_SHORT[end.getMonth()]} ${end.getFullYear()} · ${index + 1} of ${total}`;
}

export function summarizeStages(
  stages: TimelineStage[],
  today = new Date(),
): {
  total: number;
  done: number;
  overdue: number;
  now: number;
  next: number;
  label: string;
} {
  let done = 0;
  let overdue = 0;
  let now = 0;
  let next = 0;
  for (const stage of stages) {
    if (stage.isMilestone) continue;
    const status = stageStatus(stage, today);
    if (status === "done") done += 1;
    else if (status === "overdue") overdue += 1;
    else if (status === "now") now += 1;
    else next += 1;
  }
  const total = done + overdue + now + next;
  const overdueBit = overdue ? ` · ${overdue} overdue` : "";
  return {
    total,
    done,
    overdue,
    now,
    next,
    label: `${total} stages · ${done} done${overdueBit} · ${now} in progress · ${next} not started`,
  };
}

export function overdueStages(
  stages: TimelineStage[],
  today = new Date(),
): TimelineStage[] {
  return stages.filter(
    (stage) => !stage.isMilestone && stageStatus(stage, today) === "overdue",
  );
}

/** Inclusive end → exclusive day for width math. */
function exclusiveEnd(iso: string): Date {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + 1);
  return d;
}

export function projectChartWindow(project: TimelineProject): {
  rangeStart: Date;
  rangeEnd: Date;
  spanMs: number;
} {
  const start = parseIsoDate(project.start);
  const end = parseIsoDate(project.end);
  const rangeStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const rangeEnd = new Date(end.getFullYear(), end.getMonth() + 1, 1);
  return { rangeStart, rangeEnd, spanMs: rangeEnd.getTime() - rangeStart.getTime() };
}

export function positionInWindow(
  date: Date,
  rangeStart: Date,
  spanMs: number,
): number {
  if (spanMs <= 0) return 0;
  return (date.getTime() - rangeStart.getTime()) / spanMs;
}

/**
 * Month ticks, or week ticks when the project spans two months or less.
 * A trailing partial week shorter than 4 days merges into the previous week.
 */
export function buildStageTicks(
  project: TimelineProject,
  today = new Date(),
): StageTick[] {
  const { rangeStart, rangeEnd, spanMs } = projectChartWindow(project);
  const nMonths =
    (rangeEnd.getFullYear() - rangeStart.getFullYear()) * 12 +
    (rangeEnd.getMonth() - rangeStart.getMonth());
  const ticks: StageTick[] = [];
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (nMonths <= 2) {
    for (let t = new Date(rangeStart); t < rangeEnd; ) {
      const remainingDays = (rangeEnd.getTime() - t.getTime()) / 864e5;
      if (remainingDays < 4 && ticks.length) {
        const prev = ticks[ticks.length - 1]!;
        prev.width = (rangeEnd.getTime() - prev.start.getTime()) / spanMs;
        break;
      }
      const next = new Date(t);
      next.setDate(next.getDate() + 7);
      const end = next < rangeEnd ? next : rangeEnd;
      ticks.push({
        start: new Date(t),
        left: positionInWindow(t, rangeStart, spanMs),
        width: (end.getTime() - t.getTime()) / spanMs,
        label: `${MONTH_SHORT[t.getMonth()]} ${t.getDate()}`,
        year: ticks.length === 0 ? String(t.getFullYear()) : "",
        current: false,
      });
      t = next;
    }
    return ticks;
  }

  for (let i = 0; i < nMonths; i++) {
    const t = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
    const next = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i + 1, 1);
    ticks.push({
      start: t,
      left: positionInWindow(t, rangeStart, spanMs),
      width: (next.getTime() - t.getTime()) / spanMs,
      label: MONTH_SHORT[t.getMonth()]!,
      year: i === 0 || t.getMonth() === 0 ? String(t.getFullYear()) : "",
      current:
        t.getFullYear() === todayStart.getFullYear() &&
        t.getMonth() === todayStart.getMonth(),
    });
  }
  return ticks;
}

export function stageBarGeometry(
  stage: TimelineStage,
  project: TimelineProject,
): { left: number; width: number } {
  const { rangeStart, spanMs } = projectChartWindow(project);
  const start = parseIsoDate(stage.start);
  const endEx = exclusiveEnd(stage.end);
  const left = positionInWindow(start, rangeStart, spanMs);
  const right = positionInWindow(endEx, rangeStart, spanMs);
  return { left, width: Math.max(0.004, right - left) };
}

export function nowLinePosition(
  project: TimelineProject,
  today = new Date(),
): number | null {
  const { rangeStart, rangeEnd, spanMs } = projectChartWindow(project);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (todayStart < rangeStart || todayStart >= rangeEnd) return null;
  return positionInWindow(todayStart, rangeStart, spanMs);
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(3)}%`;
}

export function openStagesAriaLabel(
  projectName: string,
  phaseLabel: string | null,
  startIso: string,
  endIso: string,
  status: "in progress" | "not started" | "complete" | "overdue",
): string {
  const phase = phaseLabel ? ` · ${phaseLabel}` : "";
  return `${projectName}${phase} · ${formatStageRange(startIso, endIso)} · ${status} · open stages`;
}
