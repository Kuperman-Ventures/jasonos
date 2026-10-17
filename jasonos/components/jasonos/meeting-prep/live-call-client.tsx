"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  coveredTally,
  firstOpenIndex,
  formatElapsed,
  markableIndexAt,
  moveMarkableIndex,
  nextOpenIndex,
  type PointKind,
  type PointState,
} from "@/lib/meeting-prep/points";
import type { MeetingPoint, PointResult } from "@/lib/server-actions/meeting-points";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<PointKind, string> = {
  agenda: "Agenda",
  point: "Point",
  question: "Question",
  ask: "Ask",
};

export type LiveSession = {
  title: string;
  timeLabel: string | null;
  joinHref: string | null;
  backHref: string;
  badge: "live" | "rehearsal";
  startedAt: string | null;
};

export type LiveCallActions = {
  start?: () => Promise<PointResult<{ startedAt: string }>>;
  setState: (id: string, state: PointState) => Promise<PointResult<object>>;
  setNote: (id: string, note: string) => Promise<PointResult<object>>;
  end: () => Promise<PointResult<object>>;
};

function pointSignature(points: MeetingPoint[]): string {
  return points
    .map((point) =>
      [
        point.id,
        point.position,
        point.kind,
        point.headline,
        point.detail ?? "",
        point.state,
        point.note ?? "",
      ].join("\u001f")
    )
    .join("\u001e");
}

function StateMark({ state }: { state: PointState }) {
  if (state === "covered") {
    return <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-done)]" aria-hidden />;
  }
  if (state === "skipped") {
    return <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />;
  }
  return <span className="mt-0.5 size-3.5 shrink-0 rounded-full border-2 border-current" aria-hidden />;
}

function Elapsed({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!startedAt) return <span className="tabular-nums">00:00</span>;
  const seconds = (now - Date.parse(startedAt)) / 1000;
  return <span className="tabular-nums">{formatElapsed(Number.isNaN(seconds) ? 0 : seconds)}</span>;
}

export function LiveCallClient({
  session,
  points,
  actions,
  extraControls,
}: {
  session: LiveSession;
  points: MeetingPoint[];
  actions: LiveCallActions;
  extraControls?: ReactNode;
}) {
  const router = useRouter();
  const signature = pointSignature(points);
  const [seen, setSeen] = useState(signature);
  const [rows, setRows] = useState(points);
  const initialOpen = firstOpenIndex(points);
  const [currentId, setCurrentId] = useState<string | null>(
    initialOpen >= 0 ? points[initialOpen].id : (points.find((point) => point.kind !== "agenda")?.id ?? null)
  );
  const [finished, setFinished] = useState(initialOpen < 0 && points.some((point) => point.kind !== "agenda"));
  const [startedAt, setStartedAt] = useState(session.startedAt);
  const [, startTransition] = useTransition();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const rowsRef = useRef(rows);
  const currentRef = useRef(currentId);
  const finishedRef = useRef(finished);
  const actionsRef = useRef(actions);
  const hasStart = Boolean(actions.start);

  if (signature !== seen) {
    setSeen(signature);
    setRows(points);
  }

  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    if (startedAt || !hasStart) return;
    let cancelled = false;
    void actionsRef.current.start?.().then((result) => {
      if (cancelled || !result) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStartedAt(result.startedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [hasStart, startedAt]);

  useEffect(() => {
    if (startedAt || hasStart || session.startedAt) return;
    // Rehearsal has no saved start. The clock begins when this screen mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartedAt(new Date().toISOString());
  }, [hasStart, session.startedAt, startedAt]);

  useEffect(() => {
    if (!currentId) return;
    document.getElementById(`live-point-${currentId}`)?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  const tally = coveredTally(rows);
  const currentIndex = rows.findIndex((point) => point.id === currentId);
  const current = currentIndex >= 0 ? rows[currentIndex] : null;
  const markable = rows.filter((point) => point.kind !== "agenda");
  const openLeft = markable.some((point) => point.state === "open");
  const showAllCovered = finished && !openLeft && markable.length > 0;
  const select = (id: string) => {
    setFinished(false);
    setCurrentId(id);
  };

  const mark = (id: string, state: PointState) => {
    const previous = rowsRef.current;
    const previousId = currentRef.current;
    const previousFinished = finishedRef.current;
    const nextRows = previous.map((point) =>
      point.id === id
        ? {
            ...point,
            state,
            stateChangedAt: state === "open" ? null : new Date().toISOString(),
          }
        : point
    );
    setRows(nextRows);
    if (state === "covered" || state === "skipped") {
      const from = nextRows.findIndex((point) => point.id === id);
      const advance = nextOpenIndex(nextRows, from);
      if (advance < 0) {
        setFinished(true);
        setCurrentId(id);
      } else {
        setFinished(false);
        setCurrentId(nextRows[advance].id);
      }
    } else {
      setFinished(false);
      setCurrentId(id);
    }
    startTransition(async () => {
      const result = await actionsRef.current.setState(id, state);
      if (!result.ok) {
        setRows(previous);
        setCurrentId(previousId);
        setFinished(previousFinished);
        toast.error(result.error);
      }
    });
  };

  useEffect(() => {
    actionsRef.current = actions;
    rowsRef.current = rows;
    currentRef.current = currentId;
    finishedRef.current = finished;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      const list = rowsRef.current;
      const index = list.findIndex((point) => point.id === currentRef.current);
      const go = (direction: 1 | -1) => {
        const next = moveMarkableIndex(list, index, direction);
        if (next < 0) return;
        event.preventDefault();
        setFinished(false);
        setCurrentId(list[next].id);
      };
      if (event.key === "j" || event.key === "J" || event.key === "ArrowDown") {
        go(1);
        return;
      }
      if (event.key === "k" || event.key === "K" || event.key === "ArrowUp") {
        go(-1);
        return;
      }
      if (event.repeat) return;
      const point = index >= 0 ? list[index] : null;
      if (event.key === "Enter" || event.key === " ") {
        if (!point || point.kind === "agenda" || finishedRef.current) return;
        event.preventDefault();
        mark(point.id, "covered");
        return;
      }
      if (event.key === "s" || event.key === "S") {
        if (!point || point.kind === "agenda" || finishedRef.current) return;
        event.preventDefault();
        mark(point.id, "skipped");
        return;
      }
      if (event.key === "u" || event.key === "U") {
        if (!point || point.kind === "agenda") return;
        event.preventDefault();
        mark(point.id, "open");
        return;
      }
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        noteRef.current?.focus();
        return;
      }
      if (/^[1-9]$/.test(event.key)) {
        const jump = markableIndexAt(list, Number(event.key));
        if (jump < 0) return;
        event.preventDefault();
        setFinished(false);
        setCurrentId(list[jump].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const finish = () => {
    startTransition(async () => {
      const result = await actions.end();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(session.backHref);
    });
  };

  const pills = rows.flatMap((point, index) => {
    if (point.kind === "agenda") return [];
    const number = rows.slice(0, index + 1).filter((item) => item.kind !== "agenda").length;
    return [{ point, number, index }];
  });
  const currentSlot = pills.find((item) => item.point.id === currentId) ?? null;
  const previousPoint = currentSlot
    ? (pills[pills.findIndex((item) => item.point.id === currentId) - 1]?.point ?? null)
    : null;
  const followingPoint = currentSlot
    ? (pills[pills.findIndex((item) => item.point.id === currentId) + 1]?.point ?? null)
    : null;
  const progress =
    currentSlot && pills.length ? Math.round((currentSlot.number / pills.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[var(--jos-bg)] text-[var(--jos-ink)]">
      <header className="grid shrink-0 grid-cols-1 items-center gap-2 border-b border-[var(--jos-line)] px-4 py-2 min-[900px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[900px]:gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[14px] font-medium text-[var(--jos-muted)]">{session.title}</h1>
          {session.badge === "rehearsal" ? (
            <p className="text-[12px] font-semibold text-[var(--color-accent-2-text)]">Rehearsal</p>
          ) : session.timeLabel ? (
            <p className="text-[12px] font-medium text-[var(--jos-muted)]">{session.timeLabel}</p>
          ) : null}
        </div>
        <p className="justify-self-start bg-[var(--color-done-100)] px-4 py-1 text-[32px] font-semibold leading-none tracking-tight text-[var(--color-done)] tabular-nums min-[900px]:justify-self-center">
          <Elapsed startedAt={startedAt} />
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {pills.length ? (
            <p className="text-[13px] font-medium text-[var(--jos-muted)]">
              <span className="font-semibold text-[var(--color-accent-700)]">
                {currentSlot ? currentSlot.number : 0}
              </span>
              {" of "}
              {pills.length}
            </p>
          ) : null}
          {session.joinHref ? (
            <a
              href={session.joinHref}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "calendar", size: "sm" })}
            >
              Join the call
            </a>
          ) : null}
          {extraControls}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col min-[900px]:flex-row">
        <aside className="flex shrink-0 flex-col border-[var(--jos-line)] max-[900px]:border-b min-[900px]:w-[var(--jos-rail-w)] min-[900px]:border-r">
          <div className="flex min-h-0 flex-1 flex-col max-[900px]:hidden">
            <p className="px-4 py-3 text-[13px] font-semibold">
              {tally.covered} of {tally.total} covered
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {rows.map((point) => {
                if (point.kind === "agenda") {
                  return (
                    <li key={point.id}>
                      <p className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">
                        {point.headline}
                      </p>
                    </li>
                  );
                }
                const active = point.id === currentId;
                const muted = point.state !== "open";
                return (
                  <li key={point.id} id={`live-point-${point.id}`}>
                    <button
                      type="button"
                      onClick={() => select(point.id)}
                      className={cn(
                        "flex w-full items-start gap-2 border-l-4 px-3 py-2 text-left",
                        active
                          ? "border-[var(--color-calendar-700)] bg-[var(--jos-surface)]"
                          : "border-transparent",
                        muted ? "text-[var(--jos-muted)]" : "text-[var(--jos-ink)]"
                      )}
                    >
                      <StateMark state={point.state} />
                      <span
                        className={cn(
                          "text-[14px] font-semibold leading-snug",
                          muted && "line-through",
                          point.kind === "ask" && !muted && "text-[var(--color-accent-700)]"
                        )}
                      >
                        {point.kind === "question" ? "? " : ""}
                        {point.headline}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="p-3">
              <Button type="button" variant="outline" className="w-full" onClick={finish}>
                Done
              </Button>
            </div>
          </div>

          <div className="hidden items-center gap-2 px-3 py-2 max-[900px]:flex">
            <p className="shrink-0 text-[12px] font-semibold">
              {tally.covered} of {tally.total} covered
            </p>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              {pills.map(({ point, number }) => {
                const active = point.id === currentId;
                const muted = point.state !== "open";
                return (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => select(point.id)}
                    className={cn(
                      "max-w-[180px] shrink-0 truncate rounded-full border px-3 py-1 text-[13px] font-semibold",
                      active
                        ? "border-[var(--color-calendar-700)] bg-[var(--jos-surface)]"
                        : "border-[var(--jos-line)]",
                      muted && "text-[var(--jos-muted)] line-through",
                      point.kind === "ask" && !muted && "text-[var(--color-accent-700)]"
                    )}
                  >
                    {number} {point.kind === "question" ? "?" : ""} {point.headline}
                  </button>
                );
              })}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={finish}>
              Done
            </Button>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col px-5 py-6 min-[900px]:px-14 min-[900px]:py-8">
              {showAllCovered ? (
                <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col justify-center">
                  <h2 className="text-[44px] font-extrabold leading-[0.98] tracking-[-0.03em] min-[900px]:text-[76px]">
                    All points covered
                  </h2>
                  <Button type="button" variant="ok" className="mt-8" onClick={finish}>
                    Done
                  </Button>
                </div>
              ) : current && current.kind !== "agenda" ? (
                <CurrentPoint
                  key={current.id}
                  point={current}
                  noteRef={noteRef}
                  onMark={(state) => mark(current.id, state)}
                  onNote={(note) => {
                    setRows((list) => list.map((row) => (row.id === current.id ? { ...row, note } : row)));
                  }}
                  saveNote={(note) => actions.setNote(current.id, note)}
                />
              ) : (
                <h2 className="my-auto text-[44px] font-extrabold leading-[0.98] tracking-[-0.03em] min-[900px]:text-[76px]">
                  No points to mark
                </h2>
              )}
            </div>
          </div>
          <div>
            <div className="h-1 bg-[var(--jos-line)]">
              <div className="h-full bg-[var(--color-accent)]" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Button
                type="button"
                variant="outline"
                disabled={!previousPoint}
                onClick={() => previousPoint && select(previousPoint.id)}
              >
                <ChevronLeft />
                Previous
              </Button>
              <div className="min-w-0 flex-1 text-center text-[12px] text-[var(--jos-muted)]">
                <p>
                  {currentSlot ? `${currentSlot.number} of ${pills.length}` : "No points"}
                  <span className="hidden sm:inline">
                    {" "}
                    · j/k move · Enter covered · s skip · u reopen · n note · 1-9 jump
                  </span>
                </p>
                {session.badge === "rehearsal" ? <p>Nothing here is saved.</p> : null}
              </div>
              <Button
                type="button"
                variant="calendar"
                disabled={!followingPoint}
                onClick={() => followingPoint && select(followingPoint.id)}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CurrentPoint({
  point,
  noteRef,
  onMark,
  onNote,
  saveNote,
}: {
  point: MeetingPoint;
  noteRef: React.RefObject<HTMLTextAreaElement | null>;
  onMark: (state: PointState) => void;
  onNote: (note: string | null) => void;
  saveNote: (note: string) => Promise<PointResult<object>>;
}) {
  const [text, setText] = useState(point.note ?? "");
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);
  const stored = point.note ?? "";

  useEffect(() => {
    return () => {
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
    };
  }, []);

  const save = () => {
    const next = text.trim() ? text.trim() : null;
    const previous = stored.trim() ? stored.trim() : null;
    if (next === previous) return;
    void saveNote(text).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        setText(stored);
        return;
      }
      onNote(next);
      setSaved(true);
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 2000);
    });
  };

  const spoken = point.kind === "question" || point.kind === "ask";

  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center">
      <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent-700)]">
        {KIND_LABEL[point.kind]}
      </p>
      {spoken ? (
        <>
          {point.detail ? (
            <p className="mt-5 max-w-[46rem] text-[22px] leading-snug text-[var(--color-accent-800)] italic min-[900px]:text-[26px]">
              {point.detail}
            </p>
          ) : null}
          <div
            className={cn(
              "mt-8 border-l-4 px-6 py-5",
              point.kind === "ask"
                ? "border-[var(--color-calendar)] bg-[var(--color-calendar-100)]"
                : "border-[var(--color-accent)] bg-[var(--color-accent-100)]"
            )}
          >
            <h2 className="text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] min-[900px]:text-[54px]">
              {point.kind === "question" ? `? ${point.headline}` : point.headline}
            </h2>
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-[44px] font-extrabold leading-[0.98] tracking-[-0.03em] min-[900px]:text-[76px]">
            {point.headline}
          </h2>
          {point.detail ? (
            <p className="mt-8 max-w-[46rem] text-[24px] leading-snug text-[var(--jos-ink)] min-[900px]:text-[30px]">
              {point.detail}
            </p>
          ) : null}
        </>
      )}
      </div>
      <label className="mt-6 block max-w-[40rem]">
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--jos-muted)]">Note</span>
        <Textarea
          ref={noteRef}
          value={text}
          placeholder="What they said"
          className="mt-2 min-h-16 rounded-[2px] text-[16px]"
          onChange={(event) => setText(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.blur();
              return;
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              save();
            }
          }}
        />
      </label>
      <p className="mt-1 h-4 text-[12px] font-semibold text-[var(--color-done)]">{saved ? "Saved" : ""}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="ok" onClick={() => onMark("covered")}>
          Covered
        </Button>
        <Button type="button" variant="outline" onClick={() => onMark("skipped")}>
          Skip
        </Button>
        {point.state !== "open" ? (
          <Button type="button" variant="ghost" onClick={() => onMark("open")}>
            Reopen
          </Button>
        ) : null}
      </div>
    </div>
  );
}
