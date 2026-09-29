"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Target, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRACK_META, type Track as RepoTrack } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  PLAN90,
  PLAN_TRACK_TO_REPO,
  STORAGE_KEY,
  allTasks,
  formatWeekLabel,
  getCurrentWeek,
  getDisplayWeek,
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

const CHECKBOX_BY_TRACK: Record<RepoTrack, string> = {
  venture: "accent-emerald-400",
  advisors: "accent-sky-400",
  job_search: "accent-violet-400",
  personal: "accent-amber-400",
};

const ACCENT_BY_TRACK: Record<RepoTrack, string> = {
  venture: "text-rung-ink",
  advisors: "text-rung-3",
  job_search: "text-rung-ink",
  personal: "text-rung-ink",
};

export function ThisWeekCard() {
  const [state, setState] = useState<PersistedState>(emptyState());
  const [hydrated, setHydrated] = useState(false);
  const [today] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setTimeout(() => {
      setState(load());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const trueWeek = useMemo(() => getCurrentWeek(today), [today]);
  const displayWeek = useMemo(() => getDisplayWeek(today), [today]);
  const isPreview = trueWeek < 1 && displayWeek === 1;

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

  const toggleDone = useCallback(
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

  const pushNext = useCallback(
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

  const rollAllForward = useCallback(() => {
    update((s) => {
      const nextTasks: Record<string, TaskState> = { ...s.tasks };
      for (const t of allTasks()) {
        const ts = nextTasks[t.id] ?? {};
        const eff = ts.week ?? t.week;
        if (eff === displayWeek && !ts.done && displayWeek < 12) {
          nextTasks[t.id] = {
            ...ts,
            week: displayWeek + 1,
            pushedFrom: displayWeek,
          };
        }
      }
      return {
        ...s,
        tasks: nextTasks,
        disruptedWeeks: s.disruptedWeeks.includes(displayWeek)
          ? s.disruptedWeeks
          : [...s.disruptedWeeks, displayWeek],
      };
    });
  }, [update, displayWeek]);

  const tasksThisWeek = useMemo(() => {
    if (!hydrated && displayWeek < 1) return [];
    const out: Array<{
      id: string;
      text: string;
      week: number;
      trackId: string;
      trackName: string;
      trackPriority: "primary" | "parallel";
      repoTrack: RepoTrack;
      pushedFrom?: number;
      done: boolean;
    }> = [];
    for (const track of PLAN90.tracks) {
      for (const phase of track.phases) {
        for (const m of phase.milestones) {
          for (const t of m.tasks) {
            const ts = state.tasks[t.id] ?? {};
            const effectiveWeek = ts.week ?? t.week;
            if (effectiveWeek !== displayWeek) continue;
            out.push({
              id: t.id,
              text: t.text,
              week: effectiveWeek,
              trackId: track.id,
              trackName: track.name,
              trackPriority: track.priority,
              repoTrack: PLAN_TRACK_TO_REPO[track.id] ?? "personal",
              pushedFrom: ts.pushedFrom,
              done: !!ts.done,
            });
          }
        }
      }
    }
    return out.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.trackPriority !== b.trackPriority)
        return a.trackPriority === "primary" ? -1 : 1;
      return 0;
    });
  }, [state, displayWeek, hydrated]);

  const byTrack = useMemo(() => {
    const groups = new Map<string, typeof tasksThisWeek>();
    for (const t of tasksThisWeek) {
      const list = groups.get(t.trackId) ?? [];
      list.push(t);
      groups.set(t.trackId, list);
    }
    return groups;
  }, [tasksThisWeek]);

  const doneCount = tasksThisWeek.filter((t) => t.done).length;
  const total = tasksThisWeek.length;
  const disrupted = state.disruptedWeeks.includes(displayWeek);
  const note = state.weekNotes[displayWeek];
  const progressPct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  // Outside the plan window entirely (>14 days before, or after end)
  if (displayWeek < 1 || displayWeek > 12) {
    return (
      <section className="rounded-xl border bg-card">
        <header className="flex items-center gap-2 border-b px-4 py-2.5">
          <Target className="h-4 w-4 text-rung-ink" />
          <h2 className="text-sm font-semibold tracking-tight">This Week</h2>
        </header>
        <div className="px-4 py-3 text-[12px] text-muted-foreground">
          {displayWeek < 1
            ? `Plan starts ${PLAN90.startDate}.`
            : `Plan window ended ${PLAN90.endDate}. Time for the retro and the next 90.`}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border-2 border-rung-3 bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Target className="h-4 w-4 text-rung-3" />
        <h2 className="text-sm font-semibold tracking-tight">
          This Week · W{displayWeek} of 12
        </h2>
        <span className="text-[11px] text-muted-foreground">
          · {formatWeekLabel(displayWeek)} ·{" "}
          <span className="num-mono">
            {doneCount}/{total}
          </span>{" "}
          done
          {isPreview ? " · preview (plan starts Mon)" : ""}
        </span>
        {!disrupted && displayWeek < 12 && total > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (
                window.confirm(
                  `Roll all incomplete tasks from W${displayWeek} forward to W${displayWeek + 1} and mark this week disrupted?`
                )
              ) {
                rollAllForward();
              }
            }}
          >
            <ArrowRight className="h-3 w-3" />
            Roll forward
          </Button>
        ) : null}
      </header>

      {(disrupted || note) ? (
        <div className="border-b bg-rung-2 px-4 py-1.5 text-[11px] font-medium ">
          {disrupted ? "⚠ Week marked disrupted" : ""}
          {disrupted && note ? " · " : ""}
          {note}
        </div>
      ) : null}

      <div className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-rung-3 transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="num-mono text-[11px] text-muted-foreground">
            {progressPct}%
          </span>
        </div>
      </div>

      {total === 0 ? (
        <div className="px-4 pb-4 text-[12px] text-muted-foreground">
          No tasks scheduled for this week. Either a quiet week by design, or worth
          opening the full plan to scan.
        </div>
      ) : (
        <div className="space-y-3 px-3 pb-3">
          {Array.from(byTrack.entries()).map(([trackId, tasks]) => {
            const trackName = tasks[0].trackName;
            const isPrimary = tasks[0].trackPriority === "primary";
            const repoTrack = tasks[0].repoTrack;
            const meta = TRACK_META[repoTrack];
            return (
              <div key={trackId} className="rounded-lg border bg-background/40">
                <div className="flex items-center gap-2 border-b px-3 py-1.5">
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
                  <h3 className={cn("text-[12px] font-semibold tracking-tight", ACCENT_BY_TRACK[repoTrack])}>
                    {trackName}
                  </h3>
                  {isPrimary ? (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      · primary
                    </span>
                  ) : null}
                  <span className="num-mono ml-auto text-[11px] text-muted-foreground">
                    {tasks.filter((t) => t.done).length}/{tasks.length}
                  </span>
                </div>
                <ul className="space-y-0.5 p-1.5">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <div className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/30">
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => toggleDone(task.id)}
                          className={cn(
                            "mt-0.5 h-3.5 w-3.5 cursor-pointer",
                            CHECKBOX_BY_TRACK[task.repoTrack]
                          )}
                          aria-label={task.text}
                          id={`tw-${task.id}`}
                        />
                        <label
                          htmlFor={`tw-${task.id}`}
                          className={cn(
                            "flex-1 cursor-pointer text-[13px] leading-snug",
                            task.done
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          )}
                        >
                          {task.text}
                          {task.pushedFrom != null ? (
                            <span className="ml-1 text-[11px] text-rung-ink">
                              (pushed from W{task.pushedFrom})
                            </span>
                          ) : null}
                        </label>
                        {!task.done && displayWeek < 12 ? (
                          <button
                            type="button"
                            onClick={() => pushNext(task.id, displayWeek)}
                            title="Push to next week"
                            className="num-mono shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            push →
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
