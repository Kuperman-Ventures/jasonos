"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { CaretDown, HandHeart, NotePencil } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  LIVE_HEADER_H,
  LIVE_RAIL_W,
  LIVE_SECTION_LABEL,
  PointStateIcon,
  SaveRow,
  railRowClass,
  railStateFor,
  useSavedField,
} from "@/components/jasonos/live";
import { formatElapsed } from "@/lib/meeting-prep/points";
import { budgetProgress, type BudgetSegment, type LiveSheetFeed, type ReferenceItem } from "@/lib/meeting-prep/live-sheet";
import { REACTION_LABELS, REACTION_SHAPES, type ReactionShape } from "@/lib/meeting-prep/reactions";
import type { MeetingPoint, PointResult } from "@/lib/server-actions/meeting-points";
import { cn } from "@/lib/utils";

function useTick(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

function elapsedSeconds(startedAt: string | null, now: number): number {
  if (!startedAt) return 0;
  const seconds = (now - Date.parse(startedAt)) / 1000;
  return Number.isNaN(seconds) ? 0 : Math.max(0, seconds);
}

/** Height from the element's top to the bottom of the window, for Live inside the sheet page. */
export function useFillHeight(ref: RefObject<HTMLElement | null>, enabled: boolean): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    const measure = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      setHeight(Math.max(520, Math.round(window.innerHeight - Math.max(0, top))));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [enabled, ref]);
  return height;
}

export function SheetLiveHeader({
  feed,
  badge,
  startedAt,
  position,
  total,
  joinHref,
  extra,
  onReset,
  onEnd,
}: {
  feed: LiveSheetFeed;
  badge: "live" | "rehearsal";
  startedAt: string | null;
  position: number;
  total: number;
  joinHref: string | null;
  extra?: ReactNode;
  onReset?: () => void;
  onEnd: () => void;
}) {
  const now = useTick(1000);
  const meta = [feed.playbookName, feed.callLabel, badge === "rehearsal" ? "Rehearsal" : null].filter(Boolean);
  return (
    <header
      className="flex shrink-0 items-center gap-4 border-b border-[var(--jos-line)] px-5"
      style={{ minHeight: LIVE_HEADER_H }}
    >
      <div className="min-w-0 flex-1 py-1.5">
        <h1 className="truncate text-[17px] font-extrabold leading-tight tracking-tight">{feed.personName}</h1>
        <p className="flex items-center gap-3 text-[14px] text-[var(--jos-muted)]">
          <span className="truncate">{meta.join(" · ")}</span>
          {badge === "rehearsal" && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="shrink-0 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
            >
              Reset
            </button>
          ) : null}
        </p>
      </div>
      <p className="inline-flex shrink-0 items-center gap-2 text-[15px] font-semibold tabular-nums">
        {badge === "live" ? (
          <span className="size-2.5 rounded-full bg-[var(--color-accent-2)]" role="img" aria-label="Recording live" />
        ) : null}
        {formatElapsed(elapsedSeconds(startedAt, now))}
      </p>
      {total ? (
        <p className="shrink-0 text-[15px] tabular-nums text-[var(--jos-muted)]">
          {position} of {total}
        </p>
      ) : null}
      <div className="flex shrink-0 items-center gap-2">
        {extra}
        {joinHref ? (
          <a
            href={joinHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center px-2.5 text-[13px] font-bold text-[var(--color-accent-700)] hover:underline"
          >
            Join the call
          </a>
        ) : null}
        <Button type="button" variant="done" size="sm" onClick={onEnd}>
          {badge === "live" ? "End call" : "Done"}
        </Button>
      </div>
    </header>
  );
}

/** Segments sized by minutes. Past: ink. Current: grey with cyan fill and a 3px marker. Ahead: surface. */
export function BudgetBar({ segments, startedAt }: { segments: BudgetSegment[]; startedAt: string | null }) {
  const now = useTick(5000);
  const progress = budgetProgress(segments, elapsedSeconds(startedAt, now));
  const pct = `${Math.round(Math.min(1, Math.max(0, progress.fraction)) * 1000) / 10}%`;
  return (
    <div className="shrink-0 border-b border-[var(--jos-line)] px-5 pb-2 pt-2.5" aria-label="Time budget">
      <div className="flex gap-[3px]">
        {segments.map((segment, index) => {
          const done = index < progress.index;
          const current = index === progress.index;
          return (
            <div key={segment.key} className="min-w-0" style={{ flexGrow: segment.minutes, flexBasis: 0 }}>
              <div
                className={cn(
                  "relative h-2",
                  done
                    ? "bg-[var(--jos-ink)]"
                    : current
                      ? "bg-[var(--color-neutral-300)]"
                      : "bg-[var(--jos-surface)]"
                )}
              >
                {current ? (
                  <>
                    <div className="absolute inset-y-0 left-0 bg-[var(--color-accent)]" style={{ width: pct }} />
                    <div
                      className="absolute -bottom-1 -top-1 w-[3px] bg-[var(--jos-ink)]"
                      style={{ left: `calc(${pct} - 1.5px)` }}
                      aria-hidden
                    />
                  </>
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-1.5 truncate text-[12px] tabular-nums",
                  current ? "font-bold text-[var(--jos-ink)]" : "font-medium text-[var(--jos-muted)]"
                )}
              >
                {segment.label} · {segment.minutes} min
              </p>
            </div>
          );
        })}
      </div>
      {progress.overMinutes > 0 ? (
        <p className="mt-0.5 text-[12px] font-bold tabular-nums text-[var(--color-accent-2-text)]">
          {progress.overMinutes} min past the {progress.totalMinutes}-minute budget
        </p>
      ) : null}
    </div>
  );
}

function ReferenceEntry({ item }: { item: ReferenceItem }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-[var(--jos-line)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[15px] font-semibold hover:bg-[color-mix(in_srgb,var(--jos-surface)_50%,transparent)]"
      >
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        <CaretDown
          size={14}
          weight="bold"
          className={cn("shrink-0 text-[var(--jos-muted)] transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-2 px-4 pb-3 text-[14px] leading-snug">
          {item.body ? <p className="whitespace-pre-wrap">{item.body}</p> : null}
          {item.lines.map((line) => (
            <div key={`${line.label}-${line.text.slice(0, 20)}`}>
              {line.label ? <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">{line.label}</p> : null}
              <p className="whitespace-pre-wrap">{line.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function RailPoint({
  point,
  current,
  onSelect,
}: {
  point: MeetingPoint;
  current: boolean;
  onSelect: (id: string) => void;
}) {
  const rail = railStateFor(point, current);
  return (
    <li id={`live-point-${point.id}`}>
      <button
        type="button"
        onClick={() => onSelect(point.id)}
        title={point.headline}
        aria-current={rail === "current" ? "step" : undefined}
        className={cn("flex w-full items-start gap-2 px-3 py-2.5 text-left text-[15px] leading-snug", railRowClass(rail))}
      >
        <PointStateIcon kind={point.kind} state={point.state} current={rail === "current"} size={18} />
        <span className="min-w-0">{point.headline}</span>
      </button>
    </li>
  );
}

export function LiveSheetRail({
  rows,
  thenIds,
  reference,
  currentId,
  finished,
  referenceLabel = "Reference",
  onSelect,
}: {
  rows: MeetingPoint[];
  thenIds: Set<string>;
  reference: ReferenceItem[];
  currentId: string | null;
  finished: boolean;
  referenceLabel?: string;
  onSelect: (id: string) => void;
}) {
  const conversation = rows.filter((row) => !thenIds.has(row.id));
  const then = rows.filter((row) => thenIds.has(row.id));
  const heading = (label: string) => <p className={cn(LIVE_SECTION_LABEL, "px-4 pb-1 pt-4")}>{label}</p>;
  return (
    <>
      <aside
        className="hidden shrink-0 flex-col border-r border-[var(--jos-line)] min-[1100px]:flex"
        style={{ width: LIVE_RAIL_W }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          {heading("The conversation")}
          {conversation.length ? (
            <ul>
              {conversation.map((point) =>
                point.kind === "agenda" ? (
                  <li key={point.id}>
                    <p className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                      {point.headline}
                    </p>
                  </li>
                ) : (
                  <RailPoint key={point.id} point={point} current={point.id === currentId && !finished} onSelect={onSelect} />
                )
              )}
            </ul>
          ) : (
            <p className="px-4 py-2 text-[14px] text-[var(--jos-muted)]">No points on this sheet.</p>
          )}
          {then.length ? (
            <>
              {heading("Then")}
              <ul>
                {then.map((point) => (
                  <RailPoint key={point.id} point={point} current={point.id === currentId && !finished} onSelect={onSelect} />
                ))}
              </ul>
            </>
          ) : null}
          {reference.length ? (
            <>
              {heading(referenceLabel)}
              <ul className="border-t border-[var(--jos-line)]">
                {reference.map((item) => (
                  <ReferenceEntry key={item.key} item={item} />
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </aside>
      <aside className="flex w-14 shrink-0 flex-col border-r border-[var(--jos-line)] min-[1100px]:hidden">
        <ul className="min-h-0 flex-1 overflow-y-auto py-2">
          {rows.map((point) => {
            if (point.kind === "agenda") return null;
            const rail = railStateFor(point, point.id === currentId && !finished);
            return (
              <li key={point.id}>
                <button
                  type="button"
                  onClick={() => onSelect(point.id)}
                  title={point.headline}
                  className={cn(
                    "flex w-full items-center justify-center py-2.5",
                    rail === "current" && "border-l-4 border-[var(--color-accent-2)] bg-[var(--jos-surface)]"
                  )}
                >
                  <PointStateIcon kind={point.kind} state={point.state} current={rail === "current"} size={20} />
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}

export function SheetStage({ point, kicker }: { point: MeetingPoint; kicker: string }) {
  return (
    <div className="max-w-[860px]">
      <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent-700)]">{kicker}</p>
      <h2 className="mt-3 text-[48px] font-extrabold leading-[1.04] tracking-[-0.025em]">{point.headline}</h2>
      {point.detail ? (
        <p className="mt-5 whitespace-pre-wrap text-[26px] font-medium leading-[1.4] text-[var(--color-neutral-800)]">
          {point.detail}
        </p>
      ) : null}
      {point.listenFor?.trim() ? (
        <div className="mt-7">
          <p className={LIVE_SECTION_LABEL}>Listen for</p>
          <p className="mt-1.5 text-[18px] font-semibold leading-snug">{point.listenFor}</p>
        </div>
      ) : null}
    </div>
  );
}

export function PinnedHelp({ text }: { text: string }) {
  return (
    <div className="flex shrink-0 items-start gap-2.5 bg-[var(--jos-surface)] px-8 py-2.5 min-[1100px]:px-12">
      <HandHeart size={20} weight="duotone" className="mt-0.5 shrink-0 text-[var(--color-accent)]" aria-hidden />
      <p className="min-w-0 text-[14px] leading-snug text-[var(--jos-muted)]">
        <span className="font-semibold">How I can help them:</span> {text}
      </p>
    </div>
  );
}

/** Six reaction buttons and the sounds-like / bring-it-back panel. */
export function ReactionTray({
  point,
  trayActive,
  selectedReaction,
  drillOn,
  drillIndex,
  pivotShown,
  label = "If they say",
  emptyHint,
  onSelectReaction,
}: {
  point: MeetingPoint;
  trayActive: boolean;
  selectedReaction: ReactionShape | null;
  drillOn: boolean;
  drillIndex: number;
  pivotShown: boolean;
  label?: string;
  emptyHint?: string;
  onSelectReaction: (shape: ReactionShape) => void;
}) {
  const selected = selectedReaction
    ? point.reactions.find((reaction) => reaction.shape === selectedReaction) ?? null
    : null;
  const drill = drillOn ? point.reactions[drillIndex] ?? null : null;
  const pair = (soundsLike: string, pivot: ReactNode) => (
    <div className="grid gap-4 min-[900px]:grid-cols-2">
      <div>
        <p className={LIVE_SECTION_LABEL}>Sounds like</p>
        <p className="mt-2 text-[16px] leading-snug">{soundsLike}</p>
      </div>
      <div>
        <p className={LIVE_SECTION_LABEL}>Bring it back</p>
        {pivot}
      </div>
    </div>
  );
  return (
    <>
      <p className={LIVE_SECTION_LABEL}>{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 min-[900px]:grid-cols-6">
        {REACTION_SHAPES.map((shape, index) => {
          const active = selectedReaction === shape;
          return (
            <button
              key={shape}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectReaction(shape)}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center gap-0.5 px-2.5 py-2 text-left",
                active ? "bg-[var(--jos-ink)] text-[var(--jos-bg)]" : "bg-[var(--jos-surface)] text-[var(--jos-ink)]"
              )}
            >
              <span className="text-[15px] font-extrabold tabular-nums">{index + 1}</span>
              <span className="text-[12px] font-bold uppercase leading-tight tracking-[0.06em]">{REACTION_LABELS[shape]}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 bg-[var(--jos-surface)] px-5 py-4">
        {drillOn && drill ? (
          pair(
            drill.soundsLike,
            pivotShown ? (
              <p className="mt-2 text-[16px] font-bold leading-snug">{drill.pivot}</p>
            ) : (
              <p className="mt-2 text-[16px] text-[var(--jos-muted)]">Press Enter</p>
            )
          )
        ) : selected ? (
          pair(selected.soundsLike, <p className="mt-2 text-[16px] font-bold leading-snug">{selected.pivot}</p>)
        ) : (
          <p className="text-[16px] text-[var(--jos-muted)]">
            {trayActive ? "Press 1 to 6" : emptyHint ?? "No prepared reactions. Tap what they said to record it."}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Live point note. The one field that saves without a Save click: on blur and on Next.
 * It still shows SaveRow states, then Clean.
 */
export function useLiveNote({
  point,
  saveNote,
  onNoted,
}: {
  point: MeetingPoint;
  saveNote: (note: string) => Promise<PointResult<object>>;
  onNoted: (note: string | null) => void;
}) {
  const field = useSavedField<string>({
    saved: point.note ?? "",
    label: "Point note",
    onSave: async (value) => {
      const result = await saveNote(value);
      if (!result.ok) return result;
      const next = value.trim() || null;
      onNoted(next);
      return { ok: true, value: next ?? "" };
    },
  });
  const pending = useRef<Promise<boolean> | null>(null);
  const flush = () => {
    if (!pending.current) {
      pending.current = field.save().finally(() => {
        pending.current = null;
      });
    }
    return pending.current;
  };
  return { field, flush };
}

export function LiveNoteField({
  note,
  noteRef,
}: {
  note: ReturnType<typeof useLiveNote>;
  noteRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const { field, flush } = note;
  const showRow = field.state !== "clean" || Boolean(field.savedAt) || Boolean(field.savedValue.trim());
  return (
    <div>
      <label className="flex items-start gap-2.5">
        <NotePencil size={20} weight="duotone" className="mt-2.5 shrink-0 text-[var(--jos-muted)]" aria-hidden />
        <span className="sr-only">Point note</span>
        <textarea
          ref={noteRef}
          value={field.value}
          rows={2}
          placeholder="What they said (n)"
          className="block min-h-14 w-full resize-y rounded-[2px] border-0 border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] px-3.5 py-2 text-[16px] leading-snug outline-none placeholder:text-[var(--jos-muted)] focus-visible:border-[var(--color-accent-700)]"
          onChange={(event) => field.setValue(event.target.value)}
          onBlur={() => void flush()}
          onKeyDown={(event) => {
            if (event.key === "Escape" && field.state === "clean") {
              event.currentTarget.blur();
              return;
            }
            field.onKeyDown(event);
          }}
        />
      </label>
      {showRow ? (
        <SaveRow
          state={field.state}
          savedAt={field.savedAt}
          error={field.error}
          name="note"
          className="pl-[30px] pt-1.5"
          onSave={() => void flush()}
          onCancel={field.cancel}
        />
      ) : null}
    </div>
  );
}
