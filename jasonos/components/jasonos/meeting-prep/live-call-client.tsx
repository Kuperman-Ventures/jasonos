"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { easternClock, joinHref } from "@/components/jasonos/meeting-prep/meeting-prep-bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  coveredTally,
  firstOpenIndex,
  formatElapsed,
  markableIndexAt,
  moveMarkableIndex,
  nextOpenIndex,
  type PointState,
} from "@/lib/meeting-prep/points";
import type { MeetingPrepDetail } from "@/lib/server-actions/meeting-prep";
import {
  endLiveMeeting,
  setMeetingPointNote,
  setMeetingPointState,
  startLiveMeeting,
  type MeetingPoint,
} from "@/lib/server-actions/meeting-points";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<MeetingPoint["kind"], string> = {
  agenda: "Agenda",
  point: "Point",
  question: "Question",
  ask: "Ask",
};

function pointSignature(points: MeetingPoint[]): string {
  return points
    .map((point) =>
      [point.id, point.position, point.kind, point.headline, point.detail ?? "", point.state, point.note ?? ""].join(
        "\u001f"
      )
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
  prep,
  points,
  liveStartedAt,
}: {
  prep: MeetingPrepDetail;
  points: MeetingPoint[];
  liveStartedAt: string | null;
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
  const [startedAt, setStartedAt] = useState(liveStartedAt);
  const [, startTransition] = useTransition();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const rowsRef = useRef(rows);
  const currentRef = useRef(currentId);
  const finishedRef = useRef(finished);

  if (signature !== seen) {
    setSeen(signature);
    setRows(points);
  }

  useEffect(() => {
    if (startedAt) return;
    let cancelled = false;
    void startLiveMeeting(prep.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStartedAt(result.liveStartedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [prep.id, startedAt]);

  useEffect(() => {
    if (!currentId) return;
    document.getElementById(`live-point-${currentId}`)?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  const join = joinHref(prep);
  const tally = coveredTally(rows);
  const currentIndex = rows.findIndex((point) => point.id === currentId);
  const current = currentIndex >= 0 ? rows[currentIndex] : null;
  const markable = rows.filter((point) => point.kind !== "agenda");
  const openLeft = markable.some((point) => point.state === "open");
  const showAllCovered = finished && !openLeft && markable.length > 0;
  const nextIndex = nextOpenIndex(rows, currentIndex);
  const nextPoint = nextIndex >= 0 ? rows[nextIndex] : null;

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
      const result = await setMeetingPointState(id, state);
      if (!result.ok) {
        setRows(previous);
        setCurrentId(previousId);
        setFinished(previousFinished);
        toast.error(result.error);
      }
    });
  };

  useEffect(() => {
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
      const result = await endLiveMeeting(prep.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/meetings/${prep.id}`);
    });
  };

  const pills = rows.flatMap((point, index) => {
    if (point.kind === "agenda") return [];
    const number = rows.slice(0, index + 1).filter((item) => item.kind !== "agenda").length;
    return [{ point, number }];
  });

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[var(--jos-bg)] text-[var(--jos-ink)]">
      <header className="flex h-[var(--jos-nav-h)] shrink-0 items-center gap-3 border-b border-[var(--jos-line)] px-4">
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight">{prep.title}</h1>
        <p className="shrink-0 text-[13px] font-medium text-[var(--jos-muted)]">
          {easternClock(prep.startsAt)}–{easternClock(prep.endsAt)} ET
        </p>
        <p className="shrink-0 text-[13px] font-semibold">
          <Elapsed startedAt={startedAt} />
        </p>
        {join ? (
          <a
            href={join}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "calendar", size: "sm" })}
          >
            Join the call
          </a>
        ) : null}
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

        <section className="flex min-h-0 min-w-0 flex-1 flex-col px-5 py-6 min-[900px]:px-10 min-[900px]:py-8">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {showAllCovered ? (
              <div className="max-w-[60ch]">
                <h2 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em]">
                  All points covered
                </h2>
                <Button type="button" variant="ok" className="mt-6" onClick={finish}>
                  Done
                </Button>
              </div>
            ) : current && current.kind !== "agenda" ? (
              <CurrentPoint
                key={current.id}
                point={current}
                noteRef={noteRef}
                nextPoint={nextPoint}
                onSelect={select}
                onMark={(state) => mark(current.id, state)}
                onNote={(note) => {
                  setRows((list) =>
                    list.map((row) => (row.id === current.id ? { ...row, note } : row))
                  );
                }}
              />
            ) : (
              <h2 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em]">
                No points to mark
              </h2>
            )}
          </div>
          <p className="pt-4 text-[12px] text-[var(--jos-muted)]">
            j/k move · Enter covered · s skip · u reopen · n note · 1-9 jump
          </p>
        </section>
      </div>
    </div>
  );
}

function CurrentPoint({
  point,
  noteRef,
  nextPoint,
  onSelect,
  onMark,
  onNote,
}: {
  point: MeetingPoint;
  noteRef: React.RefObject<HTMLTextAreaElement | null>;
  nextPoint: MeetingPoint | null;
  onSelect: (id: string) => void;
  onMark: (state: PointState) => void;
  onNote: (note: string | null) => void;
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
    void setMeetingPointNote(point.id, text).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        setText(stored);
        return;
      }
      onNote(result.note);
      setSaved(true);
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="max-w-[70ch]">
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">
        {KIND_LABEL[point.kind]}
      </p>
      <h2
        className={cn(
          "mt-2 text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em]",
          point.kind === "ask" && "text-[var(--color-accent-700)]"
        )}
      >
        {point.kind === "question" ? `? ${point.headline}` : point.headline}
      </h2>
      {point.detail ? (
        <p className="mt-4 max-w-[60ch] text-[20px] leading-snug text-[var(--jos-muted)]">{point.detail}</p>
      ) : null}
      <label className="mt-8 block max-w-[60ch]">
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--jos-muted)]">Note</span>
        <Textarea
          ref={noteRef}
          value={text}
          placeholder="What they said"
          className="mt-2 min-h-24 rounded-[2px] text-[16px]"
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
      {nextPoint ? (
        <button
          type="button"
          className="mt-6 block text-[14px] text-[var(--jos-muted)] hover:underline"
          onClick={() => onSelect(nextPoint.id)}
        >
          Next: {nextPoint.headline}
        </button>
      ) : null}
    </div>
  );
}
