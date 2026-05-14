"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  persistTimerSession,
  addQuickLog,
  type TodayTask,
  type TimerSessionRow,
  type QuickLogInput,
} from "@/lib/server-actions/today";

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACKS = {
  advisors:    { key: "advisors",    label: "Kuperman Advisors",  color: "#1E6B3C" },
  jobSearch:   { key: "jobSearch",   label: "Job Search",         color: "#2E75B6" },
  ventures:    { key: "ventures",    label: "Kuperman Ventures",  color: "#9B6BAE" },
  networking:  { key: "networking",  label: "Shared Networking",  color: "#B8600B" },
  development: { key: "development", label: "Development",        color: "#7c3aed" },
  cosaAdmin:   { key: "cosaAdmin",   label: "Administration",     color: "#0891b2" },
} as const;

const TRACK_KPI_INPUTS: Record<
  string,
  { id: string; label: string; type: "count" | "boolean" | "venue"; quickCounts?: number[]; options?: string[] }[]
> = {
  advisors: [
    { id: "outreachSent",               label: "Outreach messages sent",      type: "count",   quickCounts: [1,2,3,4,5,6] },
    { id: "discoveryCallHeld",          label: "Discovery call held",          type: "boolean" },
    { id: "discoveryCallBooked",        label: "Discovery call booked",        type: "boolean" },
    { id: "networkingMeetingAttended",  label: "Networking meeting attended",  type: "venue",   options: ["The Connective", "Other"] },
  ],
  jobSearch: [
    { id: "companiesResearched",  label: "Companies researched",    type: "count", quickCounts: [1,2,3,4,5,6] },
    { id: "companyOutreaches",    label: "Company outreaches",      type: "count", quickCounts: [1,2,3,4,5,6] },
    { id: "rolesIdentified",      label: "Roles identified",        type: "count", quickCounts: [1,2,3,4,5,6] },
    { id: "applications",         label: "Applications",            type: "count", quickCounts: [1,2,3,4,5,6] },
    { id: "recruiterTouchpoints", label: "Recruiter touchpoints",   type: "count", quickCounts: [1,2,3,4,5,6] },
  ],
  ventures: [
    { id: "alphaTesterTouchpoints", label: "Alpha tester touchpoints", type: "count", quickCounts: [1,2,3,4,5,6] },
  ],
  networking: [
    { id: "warmReconnectComms", label: "Warm reconnect communications", type: "count", quickCounts: [1,2,3,4,5,6] },
    { id: "linkedinComments",   label: "LinkedIn comments posted",      type: "count", quickCounts: [1,2,3,4,5,6] },
    { id: "contentPosts",       label: "Content posts",                 type: "count", quickCounts: [1,2,3,4,5,6] },
  ],
};

const QUICK_LOG_ACTIVITY_TYPES = ["Call", "Coffee Chat", "Message", "Meeting", "Event", "Materials"];
const QUICK_LOG_DURATIONS = [15, 30, 45, 60, 90];

// ─── Timer helpers ────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const abs = Math.abs(Math.round(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

function getInitialSession(task: TodayTask): TimerSessionRow {
  const estimateSeconds = task.estimateMinutes * 60;
  return {
    sessionId: crypto.randomUUID(),
    taskId: task.id,
    timerState: "notStarted",
    estimateSeconds,
    remainingSeconds: estimateSeconds,
    elapsedSeconds: 0,
    pauseCount: 0,
    pauseDurationSeconds: 0,
    cancelledSeconds: 0,
    startedAtISO: null,
    completionType: null,
    completionLoggedAtISO: null,
    kpiValues: {},
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialTasks: TodayTask[];
  initialSessions: Record<string, TimerSessionRow>;
  date: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TodayClient({ initialTasks, initialSessions, date }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Task & session state ──────────────────────────────────────────────────
  const [tasks] = useState<TodayTask[]>(initialTasks);
  const [sessions, setSessions] = useState<Record<string, TimerSessionRow>>(() => {
    const result: Record<string, TimerSessionRow> = {};
    for (const task of initialTasks) {
      result[task.id] = initialSessions[task.id] ?? getInitialSession(task);
    }
    return result;
  });
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [kpiValues, setKpiValues] = useState<Record<string, Record<string, unknown>>>({});
  const [completionNote, setCompletionNote] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // ── Quick Log ─────────────────────────────────────────────────────────────
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [quickLogSubmitting, startQuickLog] = useTransition();
  const [quickLogToast, setQuickLogToast] = useState(false);
  const [quickLogForm, setQuickLogForm] = useState<{
    who: string; activityType: string; track: string; subTrack: string;
    durationMinutes: number | null; kpiCredits: string[]; note: string;
  }>({ who: "", activityType: "", track: "", subTrack: "", durationMinutes: null, kpiCredits: [], note: "" });
  const [quickLogErrors, setQuickLogErrors] = useState<Record<string, string>>({});

  // ── Timer interval ────────────────────────────────────────────────────────
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null;
  const activeSession = activeTaskId ? sessions[activeTaskId] ?? null : null;

  const isRunning = activeSession?.timerState === "running";
  const isCompleted = activeSession?.timerState === "completed";
  const isCancelled = activeSession?.timerState === "cancelled";
  const isTerminal = isCompleted || isCancelled;

  // Start countdown
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    const runningTaskId = Object.keys(sessions).find((id) => sessions[id].timerState === "running");
    if (!runningTaskId) return;

    tickRef.current = setInterval(() => {
      setSessions((prev) => {
        const s = prev[runningTaskId];
        if (!s || s.timerState !== "running") return prev;
        const newElapsed = s.elapsedSeconds + 1;
        const newRemaining = Math.max(0, s.estimateSeconds - newElapsed);
        return { ...prev, [runningTaskId]: { ...s, elapsedSeconds: newElapsed, remainingSeconds: newRemaining } };
      });
    }, 1000);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isRunning, activeTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Select task ───────────────────────────────────────────────────────────
  function setActiveTask(taskId: string) {
    setActiveTaskId(taskId);
    setCompletionNote("");
    setStatusMessage("");
  }

  // ── Start / Resume ────────────────────────────────────────────────────────
  function handleStart() {
    if (!activeTask || !activeSession || isTerminal) return;
    const current = sessions[activeTask.id];
    const pauseDelta =
      current.timerState === "paused" && current.pauseDurationSeconds != null
        ? 0 // pause duration already accumulated
        : 0;

    const next: TimerSessionRow = {
      ...current,
      timerState: "running",
      pauseDurationSeconds: current.pauseDurationSeconds + pauseDelta,
      startedAtISO: current.startedAtISO ?? new Date().toISOString(),
    };
    setSessions((prev) => ({ ...prev, [activeTask.id]: next }));
    startTransition(async () => {
      await persistTimerSession(next, activeTask);
    });
  }

  // ── Pause ─────────────────────────────────────────────────────────────────
  function handlePause() {
    if (!activeTask || activeSession?.timerState !== "running") return;
    const current = sessions[activeTask.id];
    const next: TimerSessionRow = {
      ...current,
      timerState: "paused",
      pauseCount: current.pauseCount + 1,
    };
    setSessions((prev) => ({ ...prev, [activeTask.id]: next }));
    startTransition(async () => {
      await persistTimerSession(next, activeTask);
    });
  }

  // ── Complete (task + optional note) ──────────────────────────────────────
  const handleCompleteTask = useCallback(
    (taskId: string, note = "", fullCredit = false) => {
      const task = tasks.find((t) => t.id === taskId);
      const current = sessions[taskId];
      if (!task || !current) return;

      const elapsedSeconds = fullCredit
        ? current.estimateSeconds
        : current.elapsedSeconds > 0
        ? current.elapsedSeconds
        : current.estimateSeconds;

      const now = new Date().toISOString();
      const kpis = kpiValues[taskId] ?? {};
      const nextSession: TimerSessionRow = {
        ...current,
        timerState: "completed",
        completionType: "Done",
        elapsedSeconds,
        completionLoggedAtISO: now,
        kpiValues: kpis,
      };

      setSessions((prev) => ({ ...prev, [taskId]: nextSession }));
      setKpiValues((prev) => { const n = { ...prev }; delete n[taskId]; return n; });
      setStatusMessage(`"${task.name}" complete.`);

      startTransition(async () => {
        await persistTimerSession({ ...nextSession }, task);
      });
    },
    [tasks, sessions, kpiValues]
  );

  function handleComplete() {
    if (!activeTask) return;
    handleCompleteTask(activeTask.id, completionNote);
  }

  function handleFullCredit() {
    if (!activeTask) return;
    handleCompleteTask(activeTask.id, completionNote, true);
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  function handleCancel() {
    if (!activeTask || !activeSession) return;
    const current = sessions[activeTask.id];
    const now = new Date().toISOString();
    const next: TimerSessionRow = {
      ...current,
      timerState: "cancelled",
      completionType: "Cancelled",
      cancelledSeconds: current.remainingSeconds,
      completionLoggedAtISO: now,
    };
    setSessions((prev) => ({ ...prev, [activeTask.id]: next }));
    setStatusMessage("Task cancelled.");
    startTransition(async () => {
      await persistTimerSession(next, activeTask);
    });
  }

  // ── Quick Log Submit ──────────────────────────────────────────────────────
  function handleQuickLogSubmit() {
    const errors: Record<string, string> = {};
    if (!quickLogForm.who.trim()) errors.who = "Required";
    if (!quickLogForm.activityType) errors.activityType = "Required";
    if (!quickLogForm.track) errors.track = "Required";
    if (!quickLogForm.durationMinutes) errors.durationMinutes = "Required";
    if (Object.keys(errors).length > 0) { setQuickLogErrors(errors); return; }

    const input: QuickLogInput = {
      who: quickLogForm.who,
      activityType: quickLogForm.activityType,
      track: quickLogForm.track,
      subTrack: quickLogForm.subTrack,
      durationMinutes: quickLogForm.durationMinutes!,
      kpiCredits: quickLogForm.kpiCredits,
      kpiQuantities: {},
      note: quickLogForm.note,
    };

    startQuickLog(async () => {
      const result = await addQuickLog(input);
      if (result.ok) {
        setShowQuickLog(false);
        setQuickLogToast(true);
        setTimeout(() => setQuickLogToast(false), 2500);
        router.refresh();
      }
    });
  }

  // ── KPI Value Setter ──────────────────────────────────────────────────────
  function setKpiVal(taskId: string, kpiId: string, value: unknown) {
    setKpiValues((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] ?? {}), [kpiId]: value },
    }));
  }

  // ── Task groups by track ──────────────────────────────────────────────────
  const tasksByTrack = (() => {
    const groups: { track: typeof TRACKS[keyof typeof TRACKS]; tasks: TodayTask[] }[] = [];
    const seen = new Map<string, typeof groups[0]>();
    for (const task of tasks) {
      const trackKey = task.track as keyof typeof TRACKS;
      const trackMeta = TRACKS[trackKey] ?? { key: trackKey, label: trackKey, color: "#94a3b8" };
      if (!seen.has(task.track)) {
        const entry = { track: trackMeta as typeof TRACKS[keyof typeof TRACKS], tasks: [] };
        seen.set(task.track, entry);
        groups.push(entry);
      }
      seen.get(task.track)!.tasks.push(task);
    }
    return groups;
  })();

  const trackMeta = activeTask
    ? (TRACKS[activeTask.track as keyof typeof TRACKS] ?? { key: activeTask.track, label: activeTask.track, color: "#94a3b8" })
    : null;

  const kpiInputs = activeTask
    ? (TRACK_KPI_INPUTS[activeTask.track] ?? TRACK_KPI_INPUTS[activeTask.track === "jobsearch" ? "jobSearch" : ""] ?? [])
    : [];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <section className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
      {/* ── Main panel: active task timer ─────────────────────────────────── */}
      {tasks.length === 0 ? (
        <article className="rounded-xl border border-border bg-card p-10 shadow-sm flex flex-col items-center justify-center text-center">
          <h2 className="text-xl font-semibold text-foreground">You&apos;re all clear</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            No tasks in today&apos;s queue. Tag calendar events with a track in the{" "}
            <a href="/calendar" className="underline text-foreground">Calendar</a> view to get started.
          </p>
        </article>
      ) : !activeTask ? (
        <article className="rounded-xl border border-border bg-card p-10 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-foreground">Select a task from the queue →</p>
          <p className="mt-1 text-xs text-muted-foreground">Pick a task to start the timer.</p>
        </article>
      ) : (
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          {/* Task header */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Active Task</p>
              <h2 className="text-lg font-semibold text-foreground">{activeTask.name}</h2>
              {activeTask.subTrack && (
                <p className="text-xs text-muted-foreground">{activeTask.subTrack}</p>
              )}
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: trackMeta?.color }}
            >
              {trackMeta?.label}
            </span>
          </div>

          {/* Timer stats */}
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Estimate</p>
              <p className="font-medium text-foreground">{formatDuration(activeSession?.estimateSeconds ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium text-foreground capitalize">{activeSession?.timerState ?? "Not Started"}</p>
            </div>
          </div>

          {/* Countdown */}
          <div className="mb-4 rounded-xl bg-foreground p-4 text-center text-background">
            <p className="text-xs uppercase tracking-wide opacity-60">
              {(activeSession?.remainingSeconds ?? 0) <= 0 && activeSession?.timerState !== "notStarted"
                ? "Time Up"
                : "Remaining"}
            </p>
            <p className="text-4xl font-semibold tabular-nums">
              {formatDuration(activeSession?.remainingSeconds ?? activeSession?.estimateSeconds ?? 0)}
            </p>
            {(activeSession?.elapsedSeconds ?? 0) > 0 && (
              <p className="mt-1 text-xs opacity-50">
                {formatDuration(activeSession?.elapsedSeconds ?? 0)} elapsed
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="mb-4 grid gap-2 grid-cols-2 sm:grid-cols-5">
            <button
              type="button"
              onClick={handleStart}
              disabled={isTerminal}
              className="flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              ▶ Start
            </button>
            <button
              type="button"
              onClick={handlePause}
              disabled={isTerminal || !isRunning}
              className="flex items-center justify-center gap-1 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40"
            >
              ⏸ Pause
            </button>
            <button
              type="button"
              onClick={handleComplete}
              disabled={isTerminal || activeSession?.timerState === "notStarted"}
              className="flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              ✓ Done
            </button>
            <button
              type="button"
              onClick={handleFullCredit}
              disabled={isTerminal || activeSession?.timerState === "notStarted"}
              className="flex items-center justify-center gap-1 rounded-md border border-blue-600/40 bg-blue-900/30 px-3 py-2 text-sm font-medium text-blue-300 hover:bg-blue-900/60 disabled:opacity-40"
              title="Credit full estimate regardless of elapsed time"
            >
              ✓ Full
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isTerminal || activeSession?.timerState === "notStarted"}
              className="flex items-center justify-center gap-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40"
            >
              ✕ Cancel
            </button>
          </div>

          {/* KPI inputs */}
          {kpiInputs.length > 0 && !isTerminal && (
            <div className="mb-4 rounded-lg border border-border p-3">
              <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">KPIs THIS SESSION</p>
              <div className="space-y-3">
                {kpiInputs.map((kpi) => {
                  const val = (kpiValues[activeTask.id] ?? {})[kpi.id] ?? null;
                  if (kpi.type === "count") {
                    return (
                      <div key={kpi.id}>
                        <p className="mb-1 text-xs text-muted-foreground">{kpi.label}</p>
                        <div className="flex flex-wrap items-center gap-1">
                          {(kpi.quickCounts ?? []).map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setKpiVal(activeTask.id, kpi.id, val === n ? null : n)}
                              className={`h-7 w-7 rounded text-xs font-semibold transition ${val === n ? "bg-foreground text-background" : "border border-border bg-muted text-foreground hover:bg-muted/80"}`}
                            >{n}</button>
                          ))}
                          <input
                            type="number"
                            min={1}
                            value={typeof val === "number" && !(kpi.quickCounts ?? []).includes(val) ? val : ""}
                            placeholder="other"
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10);
                              setKpiVal(activeTask.id, kpi.id, isNaN(n) || n < 1 ? null : n);
                            }}
                            className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                          />
                          {val != null && (
                            <button type="button" onClick={() => setKpiVal(activeTask.id, kpi.id, null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (kpi.type === "boolean") {
                    return (
                      <div key={kpi.id} className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{kpi.label}</p>
                        <button
                          type="button"
                          onClick={() => setKpiVal(activeTask.id, kpi.id, val === true ? null : true)}
                          className={`rounded px-3 py-1 text-xs font-semibold transition ${val === true ? "bg-emerald-600 text-white" : "border border-border bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        >YES</button>
                      </div>
                    );
                  }
                  if (kpi.type === "venue") {
                    return (
                      <div key={kpi.id} className="flex items-center justify-between gap-2">
                        <p className="shrink-0 text-xs text-muted-foreground">{kpi.label}</p>
                        <select
                          value={(val as string) ?? ""}
                          onChange={(e) => setKpiVal(activeTask.id, kpi.id, e.target.value || null)}
                          className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">— none —</option>
                          {(kpi.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}

          {/* Completion note */}
          {!isTerminal && (
            <div className="mb-4 rounded-lg border border-border p-3">
              <label className="mb-1 block text-sm font-medium text-foreground">Note (optional)</label>
              <textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring placeholder-muted-foreground"
                placeholder="What did you accomplish? Any blockers?"
              />
            </div>
          )}

          {statusMessage && (
            <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground">{statusMessage}</p>
          )}
        </article>
      )}

      {/* ── Sidebar: task queue ───────────────────────────────────────────── */}
      <aside className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              Today&apos;s Queue
            </h3>
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>

          {tasksByTrack.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No tasks in queue.</p>
          ) : (
            tasksByTrack.map((group) => (
              <div key={group.track.key} className="mb-3">
                <p className="mb-1 text-xs font-semibold" style={{ color: group.track.color }}>
                  {group.track.label}
                </p>
                <ul className="space-y-1">
                  {group.tasks.map((task) => {
                    const session = sessions[task.id];
                    const selected = task.id === activeTaskId;
                    const isDone = session?.timerState === "completed";
                    const isCxled = session?.timerState === "cancelled";
                    const isTaskRunning = session?.timerState === "running";

                    const cardCls = selected
                      ? "border-foreground bg-foreground text-background"
                      : isDone
                      ? "border-emerald-800 bg-emerald-950/30 text-muted-foreground"
                      : isCxled
                      ? "border-border/50 bg-muted/20 text-muted-foreground/50"
                      : isTaskRunning
                      ? "border-emerald-600/60 bg-card text-foreground"
                      : "border-border bg-card hover:bg-muted/30";

                    return (
                      <li key={task.id}>
                        <div className="flex items-stretch gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveTask(task.id)}
                            className={`min-w-0 flex-1 rounded-md border px-2 py-2 text-left text-sm ${cardCls} transition-colors`}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className={`truncate flex-1 ${isDone || isCxled ? "line-through" : ""}`}>{task.name}</span>
                              {isTaskRunning && !selected && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                              )}
                              {!isTaskRunning && !selected && (
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.track.color }} />
                              )}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs opacity-70">
                              <span className={isTaskRunning && !selected ? "text-emerald-400 font-semibold" : ""}>
                                {isTaskRunning && !selected ? "● Running" : (session?.timerState ?? "Not Started")}
                              </span>
                              <span>{task.estimateMinutes}m</span>
                            </div>
                          </button>

                          {/* Quick-complete button */}
                          {!isDone && !isCxled && (
                            <button
                              type="button"
                              onClick={() => handleCompleteTask(task.id)}
                              title="Mark complete"
                              className="shrink-0 rounded-md border border-border bg-card px-2 text-emerald-500 hover:bg-emerald-950/30 hover:border-emerald-700 text-base"
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}

          {activeTaskId && (
            <button
              type="button"
              onClick={() => setActiveTaskId(null)}
              className="mt-2 w-full cursor-pointer rounded border border-dashed border-border/50 py-2 text-center text-[11px] text-muted-foreground hover:border-border transition-colors"
            >
              click to deselect
            </button>
          )}
        </section>

        {/* Go to Calendar link */}
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Tasks come from your calendar schedule.
          </p>
          <a
            href="/calendar"
            className="text-xs font-medium text-foreground underline underline-offset-2 hover:opacity-80"
          >
            Open Calendar →
          </a>
        </div>
      </aside>

      {/* ── Quick Log FAB ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setQuickLogForm({ who: "", activityType: "", track: "", subTrack: "", durationMinutes: null, kpiCredits: [], note: "" });
          setQuickLogErrors({});
          setShowQuickLog(true);
        }}
        title="Quick Log"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition hover:opacity-90 active:scale-95"
        aria-label="Open Quick Log"
      >
        ⚡
      </button>

      {/* ── Quick Log Toast ───────────────────────────────────────────────── */}
      {quickLogToast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          Logged ✓
        </div>
      )}

      {/* ── Quick Log Modal ───────────────────────────────────────────────── */}
      {showQuickLog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setShowQuickLog(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Quick Log</h2>
              <button type="button" onClick={() => setShowQuickLog(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto space-y-4 pr-1">
              {/* Who */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Who was this with?</label>
                <input
                  type="text"
                  value={quickLogForm.who}
                  onChange={(e) => setQuickLogForm((f) => ({ ...f, who: e.target.value }))}
                  placeholder="Name or company"
                  className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring ${quickLogErrors.who ? "border-destructive" : "border-border"}`}
                />
                {quickLogErrors.who && <p className="mt-1 text-[11px] text-destructive">{quickLogErrors.who}</p>}
              </div>

              {/* Type */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Type</label>
                {quickLogErrors.activityType && <p className="text-[11px] text-destructive">{quickLogErrors.activityType}</p>}
                <div className="flex flex-wrap gap-2">
                  {QUICK_LOG_ACTIVITY_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQuickLogForm((f) => ({ ...f, activityType: t }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${quickLogForm.activityType === t ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:bg-muted/60"}`}
                    >{t}</button>
                  ))}
                </div>
              </div>

              {/* Track */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Track</label>
                {quickLogErrors.track && <p className="text-[11px] text-destructive">{quickLogErrors.track}</p>}
                <div className="flex flex-wrap gap-2">
                  {Object.values(TRACKS).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setQuickLogForm((f) => ({ ...f, track: t.key, subTrack: "", kpiCredits: [] }))}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition text-white`}
                      style={{ backgroundColor: quickLogForm.track === t.key ? t.color : t.color + "66" }}
                    >{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Duration</label>
                {quickLogErrors.durationMinutes && <p className="text-[11px] text-destructive">{quickLogErrors.durationMinutes}</p>}
                <div className="flex flex-wrap gap-2">
                  {QUICK_LOG_DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setQuickLogForm((f) => ({ ...f, durationMinutes: f.durationMinutes === d ? null : d }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${quickLogForm.durationMinutes === d ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:bg-muted/60"}`}
                    >{d}m</button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Note (optional)</label>
                <textarea
                  rows={2}
                  value={quickLogForm.note}
                  onChange={(e) => setQuickLogForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="What happened?"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring placeholder-muted-foreground resize-none"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowQuickLog(false)}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted/60"
              >Cancel</button>
              <button
                type="button"
                onClick={handleQuickLogSubmit}
                disabled={quickLogSubmitting}
                className="flex-1 rounded-lg bg-foreground py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >{quickLogSubmitting ? "Logging…" : "Log It"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
