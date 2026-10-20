"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, Check, NotePencil } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  KindLabel,
  LIVE_HEADER_H,
  LIVE_RAIL_W,
  LIVE_SECTION_LABEL,
  OutcomeMarkButton,
  PointStateIcon,
  UnfinishedField,
  railRowClass,
  railStateFor,
  type OutcomeChoice,
} from "@/components/jasonos/live";
import {
  firstOpenIndex,
  formatElapsed,
  markableIndexAt,
  moveMarkableIndex,
  nextOpenIndex,
  type PointState,
} from "@/lib/meeting-prep/points";
import { REACTION_LABELS, REACTION_SHAPES, type ReactionShape } from "@/lib/meeting-prep/reactions";
import type { MeetingPoint, PointResult } from "@/lib/server-actions/meeting-points";
import { cn } from "@/lib/utils";

export type LiveWhoTheyAre = {
  name: string;
  title: string | null;
  company: string | null;
  highlights: string[];
  introReason: string | null;
};

export type LiveSession = {
  title: string;
  /** Strategy name in the header; falls back to title. */
  strategyName?: string | null;
  personLabel?: string | null;
  companyLabel?: string | null;
  timeLabel: string | null;
  joinHref: string | null;
  backHref: string;
  badge: "live" | "rehearsal";
  startedAt: string | null;
  outcomeSentence: string | null;
  onDone: "mark" | "none";
  whoTheyAre?: LiveWhoTheyAre | null;
};

export type LiveCallActions = {
  start?: () => Promise<PointResult<{ startedAt: string }>>;
  setState: (id: string, state: PointState) => Promise<PointResult<object>>;
  setNote: (id: string, note: string) => Promise<PointResult<object>>;
  end: () => Promise<PointResult<object>>;
  markOutcome?: (mark: OutcomeChoice, note: string) => Promise<PointResult<object>>;
  setObservedReaction?: (id: string, shape: ReactionShape | null) => Promise<PointResult<object>>;
};

function stableDrillIndex(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 33 + id.charCodeAt(index)) % REACTION_SHAPES.length;
  }
  return hash;
}

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
        point.sourceHint ?? "",
        point.observedReaction ?? "",
        String(point.reactions.length),
      ].join("\u001f")
    )
    .join("\u001e");
}

function hasReactionTray(point: MeetingPoint | null): boolean {
  if (!point) return false;
  if (point.kind === "ask") return point.reactions.length === REACTION_SHAPES.length;
  return point.reactions.length === REACTION_SHAPES.length;
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
  onReset,
}: {
  session: LiveSession;
  points: MeetingPoint[];
  actions: LiveCallActions;
  extraControls?: ReactNode | ((controls: { drill: boolean; setDrill: (on: boolean) => void }) => ReactNode);
  onReset?: () => void;
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
  const trayRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef(rows);
  const currentRef = useRef(currentId);
  const finishedRef = useRef(finished);
  const actionsRef = useRef(actions);
  const markingRef = useRef(false);
  const chosenRef = useRef<OutcomeChoice | null>(null);
  const outcomeNoteRef = useRef("");
  const submittingRef = useRef(false);
  const [marking, setMarking] = useState(false);
  const [chosen, setChosen] = useState<OutcomeChoice | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [selectedReaction, setSelectedReaction] = useState<ReactionShape | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [drillOn, setDrillOn] = useState(false);
  const [drillIndex, setDrillIndex] = useState(0);
  const [pivotShown, setPivotShown] = useState(false);
  const selectedReactionRef = useRef<ReactionShape | null>(null);
  const drillOnRef = useRef(false);
  const pivotShownRef = useRef(false);
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

  const [panelFor, setPanelFor] = useState(currentId);
  if (panelFor !== currentId) {
    setPanelFor(currentId);
    const point = rows.find((row) => row.id === currentId);
    setSelectedReaction(point?.observedReaction ?? null);
    setNoteOpen(false);
    setPivotShown(false);
  }

  useEffect(() => {
    if (!currentId) return;
    document.getElementById(`live-point-${currentId}`)?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  const currentIndex = rows.findIndex((point) => point.id === currentId);
  const current = currentIndex >= 0 ? rows[currentIndex] : null;
  const markable = rows.filter((point) => point.kind !== "agenda");
  const openLeft = markable.some((point) => point.state === "open");
  const showAllCovered = finished && !openLeft && markable.length > 0;
  const trayActive = hasReactionTray(current);
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

  const pickReaction = (id: string, shape: ReactionShape | null) => {
    setSelectedReaction(shape);
    selectedReactionRef.current = shape;
    startTransition(async () => {
      const record = actionsRef.current.setObservedReaction;
      if (!record) return;
      const result = await record(id, shape);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows((list) =>
        list.map((row) => (row.id === id ? { ...row, observedReaction: shape } : row))
      );
    });
  };

  const toggleReaction = (id: string, shape: ReactionShape) => {
    const next = selectedReactionRef.current === shape ? null : shape;
    pickReaction(id, next);
  };

  const leave = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    startTransition(async () => {
      const result = await actionsRef.current.end();
      if (!result.ok) {
        submittingRef.current = false;
        toast.error(result.error);
        return;
      }
      router.push(session.backHref);
    });
  };

  const confirmOutcome = () => {
    const markChoice = chosenRef.current;
    if (!markChoice || submittingRef.current) return;
    submittingRef.current = true;
    startTransition(async () => {
      const marker = actionsRef.current.markOutcome;
      if (marker) {
        const result = await marker(markChoice, outcomeNoteRef.current);
        if (!result.ok) {
          submittingRef.current = false;
          toast.error(result.error);
          return;
        }
      }
      const ended = await actionsRef.current.end();
      if (!ended.ok) {
        submittingRef.current = false;
        toast.error(ended.error);
        return;
      }
      router.push(session.backHref);
    });
  };

  useEffect(() => {
    actionsRef.current = actions;
    rowsRef.current = rows;
    currentRef.current = currentId;
    finishedRef.current = finished;
    markingRef.current = marking;
    chosenRef.current = chosen;
    outcomeNoteRef.current = outcomeNote;
    selectedReactionRef.current = selectedReaction;
    drillOnRef.current = drillOn;
    pivotShownRef.current = pivotShown;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      if (markingRef.current) {
        const key = event.key.toLowerCase();
        if (key === "h" || key === "p" || key === "m") {
          event.preventDefault();
          const next = key === "h" ? "hit" : key === "p" ? "partial" : "missed";
          chosenRef.current = next;
          setChosen(next);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setMarking(false);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          confirmOutcome();
        }
        return;
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
      if ((event.key === "d" || event.key === "D") && session.badge === "rehearsal") {
        event.preventDefault();
        const next = !drillOnRef.current;
        if (next) {
          pivotShownRef.current = false;
          setPivotShown(false);
          setDrillIndex(Math.floor(Math.random() * REACTION_SHAPES.length));
        }
        drillOnRef.current = next;
        setDrillOn(next);
        return;
      }
      if (drillOnRef.current && point && hasReactionTray(point)) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (!pivotShownRef.current) {
            pivotShownRef.current = true;
            setPivotShown(true);
          } else {
            pivotShownRef.current = false;
            setPivotShown(false);
            setDrillIndex((currentDrill) => {
              const next = Math.floor(Math.random() * REACTION_SHAPES.length);
              return next === currentDrill ? (currentDrill + 1) % REACTION_SHAPES.length : next;
            });
          }
        }
        return;
      }
      if ((event.key === "r" || event.key === "R") && point && hasReactionTray(point)) {
        event.preventDefault();
        trayRef.current?.focus();
        return;
      }
      if (point && hasReactionTray(point) && /^[1-6]$/.test(event.key) && !event.shiftKey) {
        event.preventDefault();
        toggleReaction(point.id, REACTION_SHAPES[Number(event.key) - 1]);
        return;
      }
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
        setNoteOpen(true);
        window.setTimeout(() => noteRef.current?.focus(), 0);
        return;
      }
      const digitMatch = event.code.match(/^Digit([1-9])$/);
      if (digitMatch) {
        const digit = Number(digitMatch[1]);
        const tray = Boolean(point && hasReactionTray(point));
        if (tray && !event.shiftKey) return;
        if (tray && event.shiftKey) {
          const jump = markableIndexAt(list, digit);
          if (jump < 0) return;
          event.preventDefault();
          setFinished(false);
          setCurrentId(list[jump].id);
          return;
        }
        if (!tray) {
          const jump = markableIndexAt(list, digit);
          if (jump < 0) return;
          event.preventDefault();
          setFinished(false);
          setCurrentId(list[jump].id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const finish = () => {
    if (session.onDone === "mark") {
      setMarking(true);
      return;
    }
    leave();
  };

  const pills = rows.flatMap((point, index) => {
    if (point.kind === "agenda") return [];
    const number = rows.slice(0, index + 1).filter((item) => item.kind !== "agenda").length;
    return [{ point, number, index }];
  });
  const currentSlot = pills.find((item) => item.point.id === currentId) ?? null;
  const followingPoint = currentSlot
    ? (pills[pills.findIndex((item) => item.point.id === currentId) + 1]?.point ?? null)
    : null;

  const headerTitle = session.strategyName?.trim() || session.title;
  const personLine =
    session.badge === "rehearsal"
      ? "Rehearsal"
      : [session.personLabel, session.companyLabel].filter(Boolean).join(" · ") || session.timeLabel;

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[var(--jos-bg)] text-[var(--jos-ink)]">
      <header
        className="flex shrink-0 items-center gap-4 border-b border-[var(--jos-line)] px-5"
        style={{ height: LIVE_HEADER_H }}
      >
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-extrabold leading-tight tracking-tight">
            {headerTitle}
          </h1>
          <div className="flex items-center gap-3">
            <p className="truncate text-[15px] text-[var(--jos-muted)]">{personLine}</p>
            {session.badge === "rehearsal" && onReset ? (
              <button
                type="button"
                onClick={onReset}
                className="shrink-0 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
        <p className="shrink-0 text-[15px] text-[var(--jos-muted)] tabular-nums">
          <Elapsed startedAt={startedAt} />
        </p>
        {pills.length ? (
          <p className="shrink-0 text-[15px] text-[var(--jos-muted)]">
            {currentSlot ? currentSlot.number : 0} of {pills.length}
          </p>
        ) : null}
        <div className="flex shrink-0 items-center gap-2">
          {typeof extraControls === "function"
            ? extraControls({
                drill: drillOn,
                setDrill: (on) => {
                  setPivotShown(false);
                  if (on) setDrillIndex(stableDrillIndex(currentId ?? ""));
                  setDrillOn(on);
                },
              })
            : extraControls}
          {session.joinHref ? (
            <a
              href={session.joinHref}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Join the call
            </a>
          ) : null}
          <Button type="button" variant="done" size="sm" onClick={finish}>
            Done
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className="hidden shrink-0 flex-col border-r border-[var(--jos-line)] min-[1100px]:flex"
          style={{ width: LIVE_RAIL_W }}
        >
          {session.whoTheyAre ? (
            <div
              className="shrink-0 overflow-hidden border-b border-[var(--jos-line)] px-3 py-2"
              style={{ maxHeight: 140 }}
            >
              <p className="truncate text-[14px] font-bold leading-tight">
                {session.whoTheyAre.name}
                {session.whoTheyAre.title ? (
                  <span className="font-semibold text-[var(--jos-muted)]">
                    {" "}
                    · {session.whoTheyAre.title}
                  </span>
                ) : null}
              </p>
              {session.whoTheyAre.company ? (
                <p className="truncate text-[12px] text-[var(--jos-muted)]">
                  {session.whoTheyAre.company}
                </p>
              ) : null}
              {session.whoTheyAre.highlights.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] leading-snug">
                  {session.whoTheyAre.highlights.slice(0, 3).map((item) => (
                    <li key={item} className="line-clamp-1">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {session.whoTheyAre.introReason ? (
                <p className="mt-1 line-clamp-1 text-[11px] text-[var(--jos-muted)]">
                  Via Browning: {session.whoTheyAre.introReason.split(/\n/)[0]}
                </p>
              ) : null}
            </div>
          ) : null}
          <ul className="min-h-0 flex-1 overflow-y-auto py-2">
            {rows.map((point) => {
              if (point.kind === "agenda") {
                return (
                  <li key={point.id}>
                    <p className={cn(LIVE_SECTION_LABEL, "px-4 pt-4 pb-1")}>{point.headline}</p>
                  </li>
                );
              }
              const active = point.id === currentId;
              const rail = railStateFor(point, active && !finished);
              return (
                <li key={point.id} id={`live-point-${point.id}`}>
                  <button
                    type="button"
                    onClick={() => select(point.id)}
                    title={point.headline}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2.5 text-left text-[15px] leading-snug",
                      railRowClass(rail)
                    )}
                  >
                    <PointStateIcon kind={point.kind} state={point.state} current={rail === "current"} size={18} />
                    <span className="min-w-0">{point.headline}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Narrow rail: icon strip below 1100px */}
        <aside className="flex w-14 shrink-0 flex-col border-r border-[var(--jos-line)] min-[1100px]:hidden">
          {session.whoTheyAre ? (
            <div className="border-b border-[var(--jos-line)] px-1 py-2 text-center">
              <p className="truncate text-[10px] font-bold leading-tight">
                {session.whoTheyAre.name.split(/\s+/)[0]}
              </p>
              {session.whoTheyAre.title ? (
                <p className="truncate text-[9px] text-[var(--jos-muted)]">{session.whoTheyAre.title}</p>
              ) : null}
            </div>
          ) : null}
          <ul className="min-h-0 flex-1 overflow-y-auto py-2">
            {rows.map((point) => {
              if (point.kind === "agenda") return null;
              const active = point.id === currentId;
              const rail = railStateFor(point, active && !finished);
              return (
                <li key={point.id}>
                  <button
                    type="button"
                    onClick={() => select(point.id)}
                    title={point.headline}
                    className={cn(
                      "flex w-full items-center justify-center py-2.5",
                      rail === "current" && "bg-[var(--jos-surface)] border-l-4 border-[var(--color-accent-2)]"
                    )}
                  >
                    <PointStateIcon kind={point.kind} state={point.state} current={rail === "current"} size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8 min-[1100px]:px-12">
            {showAllCovered ? (
              <div className="flex h-full max-w-[780px] flex-col justify-center">
                <h2 className="text-[46px] font-extrabold leading-[1.05] tracking-[-0.02em]">
                  All points covered
                </h2>
                <Button type="button" variant="default" className="mt-8 h-12 w-fit" onClick={finish}>
                  Done
                </Button>
              </div>
            ) : current && current.kind !== "agenda" ? (
              <StagePoint
                point={current}
                trayActive={trayActive}
                selectedReaction={selectedReaction}
                drillOn={drillOn && session.badge === "rehearsal"}
                drillIndex={drillIndex}
                pivotShown={pivotShown}
                trayRef={trayRef}
                onSelectReaction={(shape) => toggleReaction(current.id, shape)}
              />
            ) : (
              <h2 className="text-[46px] font-extrabold leading-[1.05] tracking-[-0.02em]">
                No points to mark
              </h2>
            )}
          </div>

          {current && current.kind !== "agenda" && !showAllCovered ? (
            <ActionRow
              point={current}
              nextHeadline={followingPoint?.headline ?? null}
              noteOpen={noteOpen}
              noteRef={noteRef}
              onCovered={() => mark(current.id, current.state === "covered" ? "open" : "covered")}
              onSkip={() => mark(current.id, "skipped")}
              onToggleNote={() => {
                setNoteOpen((value) => !value);
                window.setTimeout(() => noteRef.current?.focus(), 0);
              }}
              onNote={(note) => {
                setRows((list) => list.map((row) => (row.id === current.id ? { ...row, note } : row)));
              }}
              saveNote={(note) => actions.setNote(current.id, note)}
            />
          ) : null}
        </section>
      </div>

      <Dialog open={marking} onOpenChange={(open) => !open && setMarking(false)}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">
              Outcome
            </DialogTitle>
          </DialogHeader>
          <OutcomeDialogBody
            sentence={session.outcomeSentence}
            chosen={chosen}
            note={outcomeNote}
            onChoose={(markChoice) => {
              chosenRef.current = markChoice;
              setChosen(markChoice);
            }}
            onNote={(value) => {
              outcomeNoteRef.current = value;
              setOutcomeNote(value);
            }}
            onConfirm={confirmOutcome}
            onSkip={leave}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StagePoint({
  point,
  trayActive,
  selectedReaction,
  drillOn,
  drillIndex,
  pivotShown,
  trayRef,
  onSelectReaction,
}: {
  point: MeetingPoint;
  trayActive: boolean;
  selectedReaction: ReactionShape | null;
  drillOn: boolean;
  drillIndex: number;
  pivotShown: boolean;
  trayRef: RefObject<HTMLDivElement | null>;
  onSelectReaction: (shape: ReactionShape) => void;
}) {
  const selected = selectedReaction
    ? point.reactions.find((reaction) => reaction.shape === selectedReaction) ?? null
    : null;
  const drill = drillOn ? point.reactions[drillIndex] ?? null : null;

  return (
    <div className="flex min-h-full flex-col">
      <KindLabel kind={point.kind} />
      <h2 className="mt-3 max-w-[780px] text-[46px] font-extrabold leading-[1.05] tracking-[-0.02em]">
        {point.headline}
      </h2>
      {point.detail ? (
        <p className="mt-4 max-w-[760px] whitespace-pre-wrap text-[22px] leading-[1.45] text-[#4a4747]">
          {point.detail}
        </p>
      ) : null}
      {point.sourceHint ? (
        <p className="mt-3 inline-flex max-w-[760px] items-start gap-1.5 text-[14px] text-[var(--jos-muted)]">
          <ArrowSquareOut size={14} weight="duotone" className="mt-0.5 shrink-0" aria-hidden />
          <span>{point.sourceHint}</span>
        </p>
      ) : null}

      {trayActive ? (
        <div
          ref={trayRef}
          tabIndex={-1}
          className="mt-auto outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--jos-focus)]"
        >
          <p className={cn(LIVE_SECTION_LABEL, "mt-10")}>If they say</p>
          <div className="mt-3 grid grid-cols-2 gap-2 min-[900px]:grid-cols-6">
            {REACTION_SHAPES.map((shape, index) => {
              const active = selectedReaction === shape;
              return (
                <button
                  key={shape}
                  type="button"
                  onClick={() => onSelectReaction(shape)}
                  className={cn(
                    "flex min-h-14 flex-col items-start justify-center gap-0.5 px-2.5 py-2 text-left",
                    active
                      ? "bg-[var(--jos-ink)] text-[var(--jos-bg)]"
                      : "bg-[var(--jos-surface)] text-[var(--jos-ink)]"
                  )}
                >
                  <span className="text-[15px] font-extrabold tabular-nums">{index + 1}</span>
                  <span className="text-[12px] font-bold uppercase tracking-[0.06em] leading-tight">
                    {REACTION_LABELS[shape]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 bg-[var(--jos-surface)] px-5 py-4">
            {drillOn && drill ? (
              <div className="grid gap-4 min-[900px]:grid-cols-2">
                <div>
                  <p className={LIVE_SECTION_LABEL}>Sounds like</p>
                  <p className="mt-2 text-[16px] leading-snug">{drill.soundsLike}</p>
                </div>
                <div>
                  <p className={LIVE_SECTION_LABEL}>Bring it back</p>
                  {pivotShown ? (
                    <p className="mt-2 text-[16px] font-bold leading-snug">{drill.pivot}</p>
                  ) : (
                    <p className="mt-2 text-[16px] text-[var(--jos-muted)]">Press Enter</p>
                  )}
                </div>
              </div>
            ) : selected ? (
              <div className="grid gap-4 min-[900px]:grid-cols-2">
                <div>
                  <p className={LIVE_SECTION_LABEL}>Sounds like</p>
                  <p className="mt-2 text-[16px] leading-snug">{selected.soundsLike}</p>
                </div>
                <div>
                  <p className={LIVE_SECTION_LABEL}>Bring it back</p>
                  <p className="mt-2 text-[16px] font-bold leading-snug">{selected.pivot}</p>
                </div>
              </div>
            ) : (
              <p className="text-[16px] text-[var(--jos-muted)]">Press 1 to 6</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-auto" />
      )}
    </div>
  );
}

function ActionRow({
  point,
  nextHeadline,
  noteOpen,
  noteRef,
  onCovered,
  onSkip,
  onToggleNote,
  onNote,
  saveNote,
}: {
  point: MeetingPoint;
  nextHeadline: string | null;
  noteOpen: boolean;
  noteRef: RefObject<HTMLTextAreaElement | null>;
  onCovered: () => void;
  onSkip: () => void;
  onToggleNote: () => void;
  onNote: (note: string | null) => void;
  saveNote: (note: string) => Promise<PointResult<object>>;
}) {
  const [text, setText] = useState(point.note ?? "");
  const stored = point.note ?? "";
  const isDone = point.state === "covered";

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
    });
  };

  return (
    <div className="shrink-0 border-t border-[var(--jos-line)] px-8 py-3 min-[1100px]:px-12">
      {noteOpen ? (
        <Textarea
          ref={noteRef}
          value={text}
          placeholder="What they said"
          className="mb-3 min-h-16 rounded-[2px] text-[16px]"
          onChange={(event) => setText(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isDone ? "secondary" : "default"}
          className="h-12 gap-2 px-5"
          onClick={onCovered}
        >
          <Check size={18} weight="bold" aria-hidden />
          {isDone ? "Reopen" : "Covered"}
          {!isDone ? <span className="ml-1 text-[12px] font-semibold opacity-80">Enter</span> : null}
        </Button>
        <Button type="button" variant="secondary" className="h-12 px-4" onClick={onSkip}>
          Skip
          <span className="ml-1 text-[12px] font-semibold opacity-70">s</span>
        </Button>
        <Button type="button" variant="secondary" className="h-12 gap-2 px-4" onClick={onToggleNote}>
          <NotePencil size={18} weight="duotone" aria-hidden />
          Note
          <span className="ml-1 text-[12px] font-semibold opacity-70">n</span>
        </Button>
        <p className="ml-auto max-w-[40%] truncate text-[14px] text-[var(--jos-muted)]">
          {nextHeadline ? `Next: ${nextHeadline}` : ""}
        </p>
      </div>
    </div>
  );
}

function OutcomeDialogBody({
  sentence,
  chosen,
  note,
  onChoose,
  onNote,
  onConfirm,
  onSkip,
}: {
  sentence: string | null;
  chosen: OutcomeChoice | null;
  note: string;
  onChoose: (mark: OutcomeChoice) => void;
  onNote: (note: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-5">
      {sentence?.trim() ? (
        <p className="text-[22px] font-semibold leading-snug">{sentence}</p>
      ) : (
        <UnfinishedField value="" readOnly emptyLabel="Add a sentence" />
      )}
      <div className="flex flex-wrap gap-2">
        {(["hit", "partial", "missed"] as const).map((mark) => (
          <OutcomeMarkButton
            key={mark}
            mark={mark}
            selected={chosen === mark}
            onClick={() => onChoose(mark)}
          />
        ))}
      </div>
      <input
        value={note}
        maxLength={400}
        placeholder="Optional note"
        aria-label="Optional note"
        className="w-full border-0 border-b-2 border-[#b5b2b2] bg-[var(--jos-surface)] px-3.5 py-2 text-[16px] outline-none"
        onChange={(event) => onNote(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onConfirm();
          }
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="default" disabled={!chosen} onClick={onConfirm}>
          Confirm
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
      <p className="text-[12px] text-[var(--jos-muted)]">
        h hit · p partial · m missed · Enter confirms · Escape closes
      </p>
    </div>
  );
}
