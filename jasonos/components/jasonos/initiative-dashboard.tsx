"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRACK_META, type Track } from "@/lib/types";
import {
  INITIATIVES,
  INITIATIVE_STATS,
  STORAGE_KEY,
  countInitiativeTasks,
  countThemeTasks,
  getAllTaskIds,
  type Initiative,
  type Theme,
} from "@/lib/dashboard/initiatives";

type DoneMap = Record<string, boolean>;

// Per-track class strings kept explicit so Tailwind can statically discover them.
const THEME_CARD_STYLES: Record<
  Track,
  { ring: string; bg: string; accent: string; progressBar: string; checkbox: string }
> = {
  venture: {
    ring: "border-[var(--jos-line)]",
    bg: "bg-rung-4/[0.03]",
    accent: "text-rung-ink",
    progressBar: "bg-rung-4",
    checkbox: "accent-emerald-400",
  },
  advisors: {
    ring: "border-rung-3",
    bg: "bg-rung-3/[0.03]",
    accent: "text-rung-3",
    progressBar: "bg-rung-3",
    checkbox: "accent-sky-400",
  },
  job_search: {
    ring: "border-[var(--jos-line)]",
    bg: "bg-rung-idle/[0.03]",
    accent: "text-rung-ink",
    progressBar: "bg-rung-idle",
    checkbox: "accent-violet-400",
  },
  personal: {
    ring: "border-[var(--jos-line)]",
    bg: "bg-rung-2/[0.03]",
    accent: "text-rung-ink",
    progressBar: "bg-rung-2",
    checkbox: "accent-amber-400",
  },
};

function safeReadDone(): DoneMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as DoneMap) : {};
  } catch {
    return {};
  }
}

function safeWriteDone(next: DoneMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage quota / disabled — non-fatal.
  }
}

export function InitiativeDashboard() {
  const [done, setDone] = useState<DoneMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [collapsedThemes, setCollapsedThemes] = useState<Record<string, boolean>>({});
  const [collapsedInits, setCollapsedInits] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDone(safeReadDone());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setDone((prev) => {
      const next: DoneMap = { ...prev };
      if (next[taskId]) delete next[taskId];
      else next[taskId] = true;
      safeWriteDone(next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback((id: string) => {
    setCollapsedThemes((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const toggleInit = useCallback((id: string) => {
    setCollapsedInits((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const totalTasks = INITIATIVE_STATS.tasks;
  const completedTotal = useMemo(() => {
    if (!hydrated) return 0;
    const ids = getAllTaskIds();
    let n = 0;
    for (const id of ids) if (done[id]) n++;
    return n;
  }, [done, hydrated]);

  const progressPct =
    totalTasks === 0 ? 0 : Math.round((completedTotal / totalTasks) * 100);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <Target className="h-4 w-4 text-rung-ink" />
          <h2 className="text-sm font-semibold tracking-tight">Initiative Dashboard</h2>
          <span className="text-[11px] text-muted-foreground">
            · {INITIATIVE_STATS.themes} themes · {INITIATIVE_STATS.initiatives} initiatives ·{" "}
            <span className="num-mono">
              {completedTotal}/{INITIATIVE_STATS.tasks}
            </span>{" "}
            tasks · updated {INITIATIVE_STATS.lastUpdated}
          </span>
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              className="h-3 w-3 accent-amber-400"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            Hide completed
          </label>
        </header>
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-rung-2 transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="num-mono text-[11px] text-muted-foreground">
              {progressPct}%
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {INITIATIVES.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            done={done}
            hideCompleted={hideCompleted}
            collapsed={!!collapsedThemes[theme.id]}
            onToggleTheme={() => toggleTheme(theme.id)}
            collapsedInits={collapsedInits}
            onToggleInit={toggleInit}
            onToggleTask={toggleTask}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  done,
  hideCompleted,
  collapsed,
  onToggleTheme,
  collapsedInits,
  onToggleInit,
  onToggleTask,
}: {
  theme: Theme;
  done: DoneMap;
  hideCompleted: boolean;
  collapsed: boolean;
  onToggleTheme: () => void;
  collapsedInits: Record<string, boolean>;
  onToggleInit: (id: string) => void;
  onToggleTask: (id: string) => void;
}) {
  const styles = THEME_CARD_STYLES[theme.track];
  const trackMeta = TRACK_META[theme.track];
  const total = countThemeTasks(theme);
  const completed = useMemo(() => {
    let n = 0;
    for (const ini of theme.initiatives) {
      for (const g of ini.groups) {
        for (const t of g.tasks) if (done[t.id]) n++;
      }
    }
    return n;
  }, [theme, done]);
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border-2 bg-card",
        styles.ring,
        styles.bg
      )}
    >
      <button
        type="button"
        onClick={onToggleTheme}
        className="flex items-center gap-2 border-b px-4 py-2.5 text-left transition hover:bg-muted/30"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            !collapsed && "rotate-90"
          )}
        />
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            trackMeta.tint,
            trackMeta.accent
          )}
        >
          <span className="h-1 w-1 rounded-full bg-current" />
          {trackMeta.short}
        </span>
        <h3 className={cn("text-sm font-semibold tracking-tight", styles.accent)}>
          {theme.title}
        </h3>
        <span className="ml-auto num-mono text-[11px] text-muted-foreground">
          {completed}/{total}
        </span>
      </button>

      <div className="px-4 pt-2">
        <div className="relative h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", styles.progressBar)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!collapsed ? (
        <div className="flex-1 space-y-3 p-3">
          {theme.initiatives.map((ini) => (
            <InitiativeBlock
              key={ini.id}
              initiative={ini}
              done={done}
              hideCompleted={hideCompleted}
              collapsed={!!collapsedInits[ini.id]}
              onToggleCollapsed={() => onToggleInit(ini.id)}
              onToggleTask={onToggleTask}
              checkboxClass={styles.checkbox}
              accentClass={styles.accent}
              progressBarClass={styles.progressBar}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function InitiativeBlock({
  initiative,
  done,
  hideCompleted,
  collapsed,
  onToggleCollapsed,
  onToggleTask,
  checkboxClass,
  accentClass,
  progressBarClass,
}: {
  initiative: Initiative;
  done: DoneMap;
  hideCompleted: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onToggleTask: (id: string) => void;
  checkboxClass: string;
  accentClass: string;
  progressBarClass: string;
}) {
  const total = countInitiativeTasks(initiative);
  const completed = useMemo(() => {
    let n = 0;
    for (const g of initiative.groups) {
      for (const t of g.tasks) if (done[t.id]) n++;
    }
    return n;
  }, [initiative, done]);
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = total > 0 && completed === total;

  return (
    <div className="rounded-lg border bg-background/40">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex w-full items-center gap-2 rounded-t-lg px-3 py-2 text-left transition hover:bg-muted/40"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            !collapsed && "rotate-90"
          )}
        />
        <span
          className={cn(
            "text-[13px] font-medium",
            allDone ? "text-muted-foreground line-through" : accentClass
          )}
        >
          {initiative.title}
        </span>
        <span className="ml-auto num-mono text-[11px] text-muted-foreground">
          {completed}/{total}
        </span>
      </button>

      <div className="px-3">
        <div className="relative h-0.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", progressBarClass)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!collapsed ? (
        <div className="space-y-3 px-3 pb-3 pt-2">
          {initiative.groups.map((group, gi) => {
            const visibleTasks = hideCompleted
              ? group.tasks.filter((t) => !done[t.id])
              : group.tasks;
            if (visibleTasks.length === 0) return null;
            return (
              <div key={gi} className="space-y-1">
                {group.label ? (
                  <div className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </div>
                ) : null}
                <ul className="space-y-0.5">
                  {visibleTasks.map((t) => {
                    const isDone = !!done[t.id];
                    return (
                      <li key={t.id} className="flex items-start gap-2.5 rounded px-1.5 py-1 hover:bg-muted/30">
                        <input
                          type="checkbox"
                          className={cn("mt-0.5 h-3.5 w-3.5 cursor-pointer", checkboxClass)}
                          checked={isDone}
                          onChange={() => onToggleTask(t.id)}
                          aria-label={t.text}
                        />
                        <label
                          className={cn(
                            "flex-1 cursor-pointer text-[13px] leading-snug",
                            isDone
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          )}
                          onClick={() => onToggleTask(t.id)}
                        >
                          {t.text}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
