"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRACK_META, type Track as RepoTrack } from "@/lib/types";
import {
  PLAN90,
  PLAN90_STATS,
  PLAN_TRACK_TO_REPO,
  STORAGE_KEY,
  formatWeekLabel,
  getDisplayWeek,
  getWeekRange,
  type PlanMilestone,
  type PlanTrack,
} from "@/lib/dashboard/plan90";

type TaskState = {
  done?: boolean;
  week?: number;
  pushedFrom?: number;
};

type PersistedState = {
  tasks: Record<string, TaskState>;
  weekNotes: Record<number, string>;
  disruptedWeeks: number[];
};

const TRACK_STYLES: Record<
  RepoTrack,
  { ringPrimary: string; ringParallel: string; bg: string; accent: string; bar: string; checkbox: string; pill: string; pillText: string }
> = {
  venture: {
    ringPrimary: "border-2 border-emerald-400/50",
    ringParallel: "border border-emerald-400/30",
    bg: "bg-emerald-400/[0.03]",
    accent: "text-emerald-300",
    bar: "bg-emerald-400/80",
    checkbox: "accent-emerald-400",
    pill: "bg-emerald-400/10 border-emerald-400/30",
    pillText: "text-emerald-300",
  },
  advisors: {
    ringPrimary: "border-2 border-sky-400/50",
    ringParallel: "border border-sky-400/30",
    bg: "bg-sky-400/[0.05]",
    accent: "text-sky-300",
    bar: "bg-sky-400/80",
    checkbox: "accent-sky-400",
    pill: "bg-sky-400/10 border-sky-400/30",
    pillText: "text-sky-300",
  },
  job_search: {
    ringPrimary: "border-2 border-violet-400/50",
    ringParallel: "border border-violet-400/30",
    bg: "bg-violet-400/[0.03]",
    accent: "text-violet-300",
    bar: "bg-violet-400/80",
    checkbox: "accent-violet-400",
    pill: "bg-violet-400/10 border-violet-400/30",
    pillText: "text-violet-300",
  },
  personal: {
    ringPrimary: "border-2 border-amber-400/50",
    ringParallel: "border border-amber-400/30",
    bg: "bg-amber-400/[0.03]",
    accent: "text-amber-300",
    bar: "bg-amber-400/80",
    checkbox: "accent-amber-400",
    pill: "bg-amber-400/10 border-amber-400/30",
    pillText: "text-amber-300",
  },
};

function emptyState(): PersistedState {
  return { tasks: {}, weekNotes: {}, disruptedWeeks: [] };
}

function load(): PersistedState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      tasks: parsed.tasks ?? {},
      weekNotes: parsed.weekNotes ?? {},
      disruptedWeeks: parsed.disruptedWeeks ?? [],
    };
  } catch {
    return emptyState();
  }
}

function save(s: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota / disabled */
  }
}

const GRID_TEMPLATE = "160px repeat(12, minmax(96px, 1fr))";

export function Plan90Roadmap() {
  const [state, setState] = useState<PersistedState>(emptyState());
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [today] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setTimeout(() => {
      setState(load());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const currentWeek = useMemo(() => getDisplayWeek(today), [today]);
  const weeks = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const update = useCallback(
    (mutator: (s: PersistedState) => PersistedState) => {
      setState((prev) => {
        const next = mutator(prev);
        save(next);
        return next;
      });
    },
    []
  );

  const toggleTask = useCallback(
    (id: string) => {
      update((s) => {
        const cur = s.tasks[id] ?? {};
        const nextTask: TaskState = { ...cur, done: !cur.done };
        if (!nextTask.done) delete nextTask.done;
        const nextTasks = { ...s.tasks, [id]: nextTask };
        if (Object.keys(nextTask).length === 0) delete nextTasks[id];
        return { ...s, tasks: nextTasks };
      });
    },
    [update]
  );

  const pushTask = useCallback(
    (taskId: string, fromWeek: number) => {
      if (fromWeek >= 12) return;
      update((s) => {
        const cur = s.tasks[taskId] ?? {};
        return {
          ...s,
          tasks: {
            ...s.tasks,
            [taskId]: { ...cur, week: fromWeek + 1, pushedFrom: fromWeek },
          },
        };
      });
    },
    [update]
  );

  const toggleDisrupted = useCallback(
    (week: number) => {
      update((s) => {
        const has = s.disruptedWeeks.includes(week);
        return {
          ...s,
          disruptedWeeks: has
            ? s.disruptedWeeks.filter((w) => w !== week)
            : [...s.disruptedWeeks, week],
        };
      });
    },
    [update]
  );

  const setWeekNote = useCallback(
    (week: number, note: string) => {
      update((s) => {
        const notes = { ...s.weekNotes };
        if (note.trim() === "") delete notes[week];
        else notes[week] = note;
        return { ...s, weekNotes: notes };
      });
    },
    [update]
  );

  const handleWeekClick = useCallback(
    (w: number) => {
      const isDisrupted = state.disruptedWeeks.includes(w);
      const note = state.weekNotes[w] ?? "";
      const next = window.prompt(
        `Week ${w} note (e.g. "Wyatt tournament", "conference travel").\nLeave blank to clear.\nPrefix with ! to mark week disrupted.`,
        (isDisrupted ? "!" : "") + note
      );
      if (next === null) return;
      const disrupt = next.startsWith("!");
      const clean = disrupt ? next.slice(1) : next;
      setWeekNote(w, clean);
      if (disrupt !== isDisrupted) toggleDisrupted(w);
    },
    [setWeekNote, toggleDisrupted, state.disruptedWeeks, state.weekNotes]
  );

  const totals = useMemo(() => {
    let total = 0;
    let done = 0;
    if (!hydrated) {
      for (const t of PLAN90.tracks)
        for (const p of t.phases)
          for (const m of p.milestones) total += m.tasks.length;
      return { total, done: 0 };
    }
    for (const t of PLAN90.tracks) {
      for (const p of t.phases) {
        for (const m of p.milestones) {
          for (const task of m.tasks) {
            total += 1;
            if (state.tasks[task.id]?.done) done += 1;
          }
        }
      }
    }
    return { total, done };
  }, [state, hydrated]);

  const progressPct =
    totals.total === 0 ? 0 : Math.round((totals.done / totals.total) * 100);

  const inWindow = currentWeek >= 1 && currentWeek <= 12;
  const isPreview = inWindow && getDisplayWeek(today) > 0 && today.getTime() < new Date(PLAN90.startDate + "T00:00:00").getTime();

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <MapIcon className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold tracking-tight">90-Day Plan</h2>
        <span className="text-[11px] text-muted-foreground">
          · {PLAN90.startDate} → {PLAN90.endDate} · {PLAN90_STATS.tracks} tracks ·{" "}
          {PLAN90_STATS.milestones} milestones ·{" "}
          <span className="num-mono">
            {totals.done}/{totals.total}
          </span>{" "}
          tasks · Week {inWindow ? currentWeek : "—"} of 12
          {inWindow ? ` · ${formatWeekLabel(currentWeek)}` : ""}
          {isPreview ? " · preview (plan starts Mon)" : ""}
        </span>
      </header>

      <div className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-amber-400/80 transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="num-mono text-[11px] text-muted-foreground">
            {progressPct}%
          </span>
        </div>
        {PLAN90.primaryMetric ? (
          <p className="mt-1.5 text-[11px] italic text-muted-foreground">
            North-star metric: {PLAN90.primaryMetric}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto px-4 pb-4">
        <div className="min-w-[1200px] space-y-2">
          {/* Phase band */}
          <div
            className="grid gap-px overflow-hidden rounded-md bg-border"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            <div className="bg-card px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Phase
            </div>
            {weeks.map((w) => {
              const phase = PLAN90.phaseDefinitions.find(
                (p) => w >= p.weekRange[0] && w <= p.weekRange[1]
              );
              return (
                <div
                  key={`phase-${w}`}
                  className={cn(
                    "bg-card px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-widest",
                    w === currentWeek ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {phase?.name ?? ""}
                </div>
              );
            })}
          </div>

          {/* Week header */}
          <div
            className="grid gap-px overflow-hidden rounded-md bg-border"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            <div className="bg-card px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Week
            </div>
            {weeks.map((w) => {
              const { start } = getWeekRange(w);
              const isCurrent = w === currentWeek;
              const isDisrupted = state.disruptedWeeks.includes(w);
              const note = state.weekNotes[w];
              return (
                <button
                  key={`week-${w}`}
                  type="button"
                  onClick={() => handleWeekClick(w)}
                  title={note || "click to add week note (prefix with ! to mark disrupted)"}
                  className={cn(
                    "group relative px-2 py-1 text-center text-[11px] transition hover:bg-muted/40",
                    isCurrent
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                    isDisrupted ? "bg-amber-400/10" : "bg-card"
                  )}
                >
                  W{w}
                  <div className="mt-0.5 text-[9px] font-normal text-muted-foreground/70">
                    {start.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  {(note || isDisrupted) && (
                    <div className="truncate text-[9px] text-amber-300">
                      {isDisrupted ? "⚠ " : ""}
                      {note}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Track swim lanes */}
          <div className="space-y-2 pt-1">
            {PLAN90.tracks.map((track) => (
              <TrackLane
                key={track.id}
                track={track}
                weeks={weeks}
                currentWeek={currentWeek}
                state={state}
                expanded={expanded}
                onToggleExpand={(id) =>
                  setExpanded((p) => ({ ...p, [id]: !p[id] }))
                }
                onToggleTask={toggleTask}
                onPushTask={pushTask}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="px-4 pb-3 text-[11px] text-muted-foreground">
        Click a week header to add a note (prefix <span className="num-mono">!</span> to mark
        disrupted). Click a milestone to expand its tasks. Use the <span className="num-mono">→</span>
        button to push a task to the next week.
      </p>
    </section>
  );
}

function TrackLane({
  track,
  weeks,
  currentWeek,
  state,
  expanded,
  onToggleExpand,
  onToggleTask,
  onPushTask,
}: {
  track: PlanTrack;
  weeks: number[];
  currentWeek: number;
  state: PersistedState;
  expanded: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onToggleTask: (id: string) => void;
  onPushTask: (id: string, fromWeek: number) => void;
}) {
  const repoTrack = PLAN_TRACK_TO_REPO[track.id] ?? "personal";
  const styles = TRACK_STYLES[repoTrack];
  const meta = TRACK_META[repoTrack];
  const isPrimary = track.priority === "primary";

  // Index milestones by their effective week so user-pushed milestones could
  // (in future) move; for now, milestone weeks are static. We index by m.week.
  const allMilestones: PlanMilestone[] = track.phases.flatMap((p) => p.milestones);
  const byWeek = new Map<number, PlanMilestone[]>();
  for (const m of allMilestones) {
    const list = byWeek.get(m.week) ?? [];
    list.push(m);
    byWeek.set(m.week, list);
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg",
        isPrimary ? styles.ringPrimary : styles.ringParallel,
        styles.bg
      )}
    >
      <div
        className="grid gap-px bg-border/60"
        style={{ gridTemplateColumns: GRID_TEMPLATE }}
      >
        {/* Track label cell */}
        <div className="flex flex-col justify-center gap-1 bg-card/60 px-3 py-3">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                meta.tint,
                meta.accent
              )}
            >
              <span className="h-1 w-1 rounded-full bg-current" />
              {meta.short}
            </span>
          </div>
          <div className={cn("text-[12px] font-semibold tracking-tight", styles.accent)}>
            {track.name}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {isPrimary ? "Primary" : "Parallel"}
          </div>
          <div className="text-[10px] italic leading-snug text-muted-foreground">
            {track.tagline}
          </div>
        </div>

        {/* Week columns */}
        {weeks.map((w) => {
          const ms = byWeek.get(w) ?? [];
          const isCurrent = w === currentWeek;
          return (
            <div
              key={`${track.id}-w${w}`}
              className={cn(
                "min-h-[72px] bg-card/40 p-1",
                isCurrent && "bg-card/70 ring-1 ring-inset ring-foreground/40"
              )}
            >
              {ms.map((m) => {
                const totalT = m.tasks.length;
                const doneT = m.tasks.filter((t) => state.tasks[t.id]?.done).length;
                const allDone = totalT > 0 && doneT === totalT;
                const isExpanded = !!expanded[m.id];
                return (
                  <div key={m.id} className="mb-1 last:mb-0">
                    <button
                      type="button"
                      onClick={() => onToggleExpand(m.id)}
                      title={m.metric ?? m.name}
                      className={cn(
                        "flex w-full items-start gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition",
                        allDone
                          ? "border-border/60 bg-muted/40 text-muted-foreground line-through"
                          : "border-border bg-background/60 hover:bg-muted/30"
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          "mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">
                          {m.name}
                        </span>
                        <span className="num-mono mt-0.5 block text-[9px] text-muted-foreground">
                          {doneT}/{totalT}
                        </span>
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="mt-1 rounded-md border border-border/60 bg-background/40 p-1.5">
                        {m.metric ? (
                          <div className="mb-1 text-[10px] italic text-muted-foreground">
                            Signal: {m.metric}
                          </div>
                        ) : null}
                        <ul className="space-y-0.5">
                          {m.tasks.map((t) => {
                            const ts = state.tasks[t.id] ?? {};
                            const effectiveWeek = ts.week ?? t.week;
                            const pushed = effectiveWeek !== t.week;
                            return (
                              <li
                                key={t.id}
                                className="flex items-start gap-1.5 rounded px-1 py-0.5"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!ts.done}
                                  onChange={() => onToggleTask(t.id)}
                                  className={cn(
                                    "mt-0.5 h-3 w-3 cursor-pointer",
                                    styles.checkbox
                                  )}
                                  aria-label={t.text}
                                />
                                <span
                                  className={cn(
                                    "flex-1 text-[10px] leading-snug",
                                    ts.done
                                      ? "text-muted-foreground line-through"
                                      : "text-foreground"
                                  )}
                                >
                                  {t.text}
                                  {pushed ? (
                                    <span className="ml-1 text-amber-300">
                                      (moved to W{effectiveWeek})
                                    </span>
                                  ) : null}
                                </span>
                                {!ts.done && effectiveWeek < 12 ? (
                                  <button
                                    type="button"
                                    onClick={() => onPushTask(t.id, effectiveWeek)}
                                    title="Push to next week"
                                    className="text-[10px] text-muted-foreground hover:text-foreground"
                                  >
                                    →
                                  </button>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
