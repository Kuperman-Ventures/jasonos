"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DotsSixVertical, Sparkle, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  KindIcon,
  KindLabel,
  LIVE_FIELD,
  LIVE_KIND,
  LIVE_SECTION_LABEL,
} from "@/components/jasonos/live";
import { Button } from "@/components/ui/button";
import { REACTION_LABELS, REACTION_SHAPES, type Reaction } from "@/lib/meeting-prep/reactions";
import { POINT_KINDS, type PointKind } from "@/lib/meeting-prep/points";
import type { PointResult } from "@/lib/server-actions/meeting-points";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<PointKind, string> = {
  agenda: "Agenda",
  point: "Point",
  question: "Question",
  ask: "Ask",
};

export type EditorPoint = {
  id: string;
  kind: PointKind;
  headline: string;
  detail: string | null;
  listenFor?: string | null;
  position: number;
  prepareReactions?: boolean;
  reactions?: Reaction[];
};

export type PointsEditorActions = {
  create: (input: {
    kind: PointKind;
    headline: string;
    detail?: string | null;
    listenFor?: string | null;
  }) => Promise<PointResult<{ id: string }>>;
  update: (
    id: string,
    patch: {
      kind?: PointKind;
      headline?: string;
      detail?: string | null;
      listenFor?: string | null;
      prepareReactions?: boolean;
      reactions?: Reaction[];
    }
  ) => Promise<PointResult<object>>;
  draftReactions?: (id: string) => Promise<PointResult<{ reactions: Reaction[] }>>;
  remove: (id: string) => Promise<PointResult<object>>;
  reorder: (orderedIds: string[]) => Promise<PointResult<object>>;
};

function pointSignature(points: EditorPoint[]): string {
  return points
    .map((point) =>
      [
        point.id,
        point.position,
        point.kind,
        point.headline,
        point.detail ?? "",
        point.listenFor ?? "",
        point.prepareReactions ? "1" : "0",
        JSON.stringify(point.reactions ?? []),
      ].join("\u001f")
    )
    .join("\u001e");
}

export function InlineField({
  value,
  placeholder,
  className,
  maxLength,
  emptyLabel,
  onSave,
}: {
  value: string;
  placeholder: string;
  className: string;
  maxLength: number;
  emptyLabel: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const cancel = useRef(false);

  if (!editing) {
    return (
      <button
        type="button"
        className={cn("block w-full text-left", className)}
        onClick={() => {
          cancel.current = false;
          setText(value);
          setEditing(true);
        }}
      >
        {value || <span className="font-normal text-[var(--jos-muted)]">{emptyLabel}</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={text}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(
        "w-full border-0 border-b-2 border-[var(--color-accent-700)] bg-transparent outline-none",
        className
      )}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        setEditing(false);
        if (cancel.current) {
          cancel.current = false;
          return;
        }
        if (text.trim() === value.trim()) return;
        onSave(text);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          cancel.current = true;
          setEditing(false);
        }
      }}
    />
  );
}

function CallPreview({ point }: { point: EditorPoint }) {
  const band = LIVE_KIND[point.kind].band;
  const spoken = (point.detail ?? "").trim().split("\n")[0] || "";
  return (
    <div className="mt-4 overflow-hidden border border-[var(--jos-line)]">
      <div className="h-1.5" style={{ backgroundColor: band }} />
      <div className="bg-[var(--jos-bg)] px-4 py-3">
        <KindLabel kind={point.kind} />
        <p className="mt-1 text-[18px] font-extrabold leading-snug tracking-tight">{point.headline || "Headline"}</p>
        {spoken ? <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-[#4a4747]">{spoken}</p> : null}
      </div>
    </div>
  );
}

function ReactionsTable({
  point,
  onPatch,
  onDraft,
}: {
  point: EditorPoint;
  onPatch: (patch: { prepareReactions?: boolean; reactions?: Reaction[] }) => void;
  onDraft: () => Promise<PointResult<{ reactions: Reaction[] }>>;
}) {
  const reactions = point.reactions ?? [];
  const prepared = reactions.length === REACTION_SHAPES.length;
  const showTable = point.kind === "ask" || Boolean(point.prepareReactions);
  const [confirmRedo, setConfirmRedo] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const draft = () => {
    setDrafting(true);
    void onDraft().then((result) => {
      setDrafting(false);
      setConfirmRedo(false);
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  };

  const editReaction = (shape: Reaction["shape"], field: "soundsLike" | "pivot", value: string) => {
    const base = prepared
      ? reactions
      : REACTION_SHAPES.map((item) => ({
          shape: item,
          soundsLike: "",
          pivot: "",
        }));
    const next = base.map((reaction) =>
      reaction.shape === shape ? { ...reaction, [field]: value } : reaction
    );
    onPatch({ reactions: next as Reaction[], prepareReactions: true });
  };

  if (!showTable) {
    return (
      <label className="mt-6 flex items-center gap-2 text-[14px] text-[var(--jos-muted)]">
        <input
          type="checkbox"
          checked={Boolean(point.prepareReactions)}
          onChange={(event) => onPatch({ prepareReactions: event.target.checked })}
        />
        Prepare reactions
      </label>
    );
  }

  const rows = prepared
    ? reactions
    : REACTION_SHAPES.map((shape) => ({ shape, soundsLike: "", pivot: "" }));

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px] font-semibold text-[var(--jos-ink)]">
          Reactions · what they might say and how you bring it back
        </p>
        {confirmRedo ? (
          <p className="text-[13px]">
            Replace all six?{" "}
            <button
              type="button"
              className="font-semibold text-[var(--color-accent-700)] hover:underline"
              disabled={drafting}
              onClick={draft}
            >
              Confirm
            </button>
            {" · "}
            <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmRedo(false)}>
              Cancel
            </button>
          </p>
        ) : (
          <button
            type="button"
            className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
            disabled={drafting}
            onClick={() => (prepared ? setConfirmRedo(true) : draft())}
          >
            {prepared ? "Regenerate all" : "Generate with AI"}
          </button>
        )}
      </div>
      <div className="mt-3 border-t-2 border-[var(--jos-ink)]">
        {rows.map((reaction, index) => (
          <div
            key={reaction.shape}
            className="grid grid-cols-[2.5rem_7rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-[var(--jos-line)] py-3"
          >
            <span className="flex size-8 items-center justify-center bg-[var(--jos-surface)] text-[14px] font-extrabold tabular-nums">
              {index + 1}
            </span>
            <span className="self-center text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
              {REACTION_LABELS[reaction.shape]}
            </span>
            <InlineField
              value={reaction.soundsLike}
              placeholder="Sounds like"
              emptyLabel="Sounds like"
              maxLength={159}
              className="text-[14px] text-[var(--jos-ink)]"
              onSave={(next) => editReaction(reaction.shape, "soundsLike", next.trim())}
            />
            <InlineField
              value={reaction.pivot}
              placeholder="Bring it back"
              emptyLabel="Bring it back"
              maxLength={159}
              className="text-[14px] font-bold text-[var(--jos-ink)]"
              onSave={(next) => editReaction(reaction.shape, "pivot", next.trim())}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardEditor({
  point,
  index,
  total,
  onPatch,
  onRemove,
  draftReactions,
}: {
  point: EditorPoint;
  index: number;
  total: number;
  onPatch: (patch: {
    kind?: PointKind;
    headline?: string;
    detail?: string | null;
    listenFor?: string | null;
    prepareReactions?: boolean;
    reactions?: Reaction[];
  }) => void;
  onRemove: () => void;
  draftReactions?: (id: string) => Promise<PointResult<{ reactions: Reaction[] }>>;
}) {
  const [detail, setDetail] = useState(point.detail ?? "");
  const [seenDetail, setSeenDetail] = useState(point.detail ?? "");
  if ((point.detail ?? "") !== seenDetail) {
    setSeenDetail(point.detail ?? "");
    setDetail(point.detail ?? "");
  }
  const [listenFor, setListenFor] = useState(point.listenFor ?? "");
  const [seenListen, setSeenListen] = useState(point.listenFor ?? "");
  if ((point.listenFor ?? "") !== seenListen) {
    setSeenListen(point.listenFor ?? "");
    setListenFor(point.listenFor ?? "");
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-3">
        <p className={LIVE_SECTION_LABEL}>
          Card {index} of {total}
        </p>
        <div className="flex flex-wrap gap-1">
          {POINT_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onPatch({ kind })}
              className={cn(
                "px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.08em]",
                point.kind === kind
                  ? "bg-[var(--jos-ink)] text-[var(--jos-bg)]"
                  : "bg-[var(--jos-surface)] text-[var(--jos-ink)]"
              )}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ml-auto text-[13px] font-semibold text-[var(--jos-muted)] hover:text-[var(--color-accent-2-text)]"
          onClick={onRemove}
        >
          Delete card
        </button>
      </div>

      <InlineField
        value={point.headline}
        placeholder="Headline"
        emptyLabel="Add a headline"
        maxLength={80}
        className="mt-4 text-[20px] font-bold tracking-tight text-[var(--jos-ink)]"
        onSave={(next) => {
          if (!next.trim() || next.trim().length > 80) {
            toast.error("Write a headline under 80 characters.");
            return;
          }
          onPatch({ headline: next });
        }}
      />

      <label className="mt-4 block">
        <span className={LIVE_SECTION_LABEL}>What you want to say</span>
        <textarea
          value={detail}
          maxLength={400}
          rows={6}
          placeholder="What you want to say"
          aria-label="What you want to say"
          className={cn(LIVE_FIELD, "mt-2 min-h-32 resize-y py-3 text-[16px] leading-relaxed")}
          onChange={(event) => setDetail(event.target.value)}
          onBlur={() => {
            const next = detail.trim() ? detail : null;
            if ((next ?? "") === (point.detail ?? "")) return;
            onPatch({ detail: next });
          }}
        />
      </label>

      <label className="mt-3 block">
        <span className={LIVE_SECTION_LABEL}>Listen for</span>
        <input
          value={listenFor}
          maxLength={160}
          placeholder="What to listen for in the answer"
          aria-label="Listen for"
          className={cn(LIVE_FIELD, "mt-2 py-2 text-[15px]")}
          onChange={(event) => setListenFor(event.target.value)}
          onBlur={() => {
            const next = listenFor.trim() ? listenFor.trim() : null;
            if ((next ?? "") === (point.listenFor ?? "")) return;
            onPatch({ listenFor: next });
          }}
        />
      </label>

      <p className={cn(LIVE_SECTION_LABEL, "mt-5")}>Preview</p>
      <CallPreview point={{ ...point, detail }} />

      {draftReactions ? (
        <ReactionsTable
          point={point}
          onPatch={onPatch}
          onDraft={() => draftReactions(point.id)}
        />
      ) : null}
    </div>
  );
}

function OutlineList({
  rows,
  selectedId,
  dragId,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
  onAdd,
  draftLabel,
  onDraft,
  drafting,
}: {
  rows: EditorPoint[];
  selectedId: string | null;
  dragId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (targetId: string) => void;
  onAdd: () => void;
  draftLabel?: string;
  onDraft?: () => void;
  drafting?: boolean;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-[var(--jos-line)] min-[1100px]:w-[380px]">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-[20px] font-extrabold tracking-tight">Plan</h2>
        <button
          type="button"
          className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
          onClick={onAdd}
        >
          Add point
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
        {rows.map((point) => {
          if (point.kind === "agenda") {
            return (
              <li key={point.id}>
                <div
                  className={cn(
                    "flex items-center gap-1 px-3 py-2",
                    selectedId === point.id && "border-l-4 border-[var(--color-accent-2)] bg-[var(--jos-surface)]"
                  )}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    onDrop(point.id);
                  }}
                >
                  <span
                    draggable
                    role="button"
                    tabIndex={0}
                    aria-label="Drag to reorder"
                    className="cursor-grab text-[var(--jos-muted)] active:cursor-grabbing"
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", point.id);
                      event.dataTransfer.effectAllowed = "move";
                      onDragStart(point.id);
                    }}
                    onDragEnd={onDragEnd}
                  >
                    <DotsSixVertical size={16} weight="bold" aria-hidden />
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]"
                    onClick={() => onSelect(point.id)}
                  >
                    {point.headline || "Section"}
                  </button>
                </div>
              </li>
            );
          }
          const selected = selectedId === point.id;
          return (
            <li key={point.id}>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2",
                  selected && "border-l-4 border-[var(--color-accent-2)] bg-[var(--jos-surface)]",
                  dragId === point.id && "opacity-50"
                )}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  onDrop(point.id);
                }}
              >
                <span
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label="Drag to reorder"
                  className="cursor-grab text-[var(--jos-muted)] active:cursor-grabbing"
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", point.id);
                    event.dataTransfer.effectAllowed = "move";
                    onDragStart(point.id);
                  }}
                  onDragEnd={onDragEnd}
                >
                  <DotsSixVertical size={16} weight="bold" aria-hidden />
                </span>
                <KindIcon kind={point.kind} size={16} />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-[15px] leading-snug"
                  onClick={() => onSelect(point.id)}
                >
                  {point.headline || "Untitled"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {onDraft && draftLabel ? (
        <button
          type="button"
          disabled={drafting}
          onClick={onDraft}
          className="flex items-center gap-1.5 border-t border-[var(--jos-line)] px-4 py-3 text-left text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline disabled:opacity-50"
        >
          <Sparkle size={14} weight="duotone" aria-hidden />
          {draftLabel}
        </button>
      ) : null}
    </aside>
  );
}

export function PointsEditor({
  points,
  error,
  actions,
  draft,
  footer,
  note,
  belowTitle,
  detailBox = false,
  layout = "list",
  selectedId: controlledSelectedId,
  onSelectedIdChange,
}: {
  points: EditorPoint[];
  error?: string | null;
  actions: PointsEditorActions;
  draft?: {
    label: string;
    run: () => Promise<
      PointResult<{ added: number; quiet?: boolean; contextUsed?: string[]; contextMissing?: string[] }>
    >;
  };
  footer?: ReactNode | ((pointCount: number) => ReactNode);
  note?: ReactNode;
  belowTitle?: ReactNode;
  detailBox?: boolean;
  layout?: "list" | "split" | "outline";
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
}) {
  const router = useRouter();
  const signature = pointSignature(points);
  const [seen, setSeen] = useState(signature);
  const [rows, setRows] = useState(points);
  const [draftKind, setDraftKind] = useState<PointKind>("point");
  const [draftHeadline, setDraftHeadline] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [drafting, setDrafting] = useState(false);
  const [contextUsed, setContextUsed] = useState<string[] | null>(null);
  const [contextMissing, setContextMissing] = useState<string[] | null>(null);
  const addId = useId();

  const firstAsk = points.find((point) => point.kind === "ask")?.id ?? points[0]?.id ?? null;
  const [internalSelected, setInternalSelected] = useState<string | null>(firstAsk);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelected;
  const setSelectedId = (id: string | null) => {
    if (onSelectedIdChange) onSelectedIdChange(id);
    else setInternalSelected(id);
  };

  if (signature !== seen) {
    setSeen(signature);
    setRows(points);
    if (selectedId && !points.some((point) => point.id === selectedId)) {
      setSelectedId(points.find((point) => point.kind === "ask")?.id ?? points[0]?.id ?? null);
    }
  }

  const savePatch = (
    point: EditorPoint,
    patch: {
      kind?: PointKind;
      headline?: string;
      detail?: string | null;
      listenFor?: string | null;
      prepareReactions?: boolean;
      reactions?: Reaction[];
    }
  ) => {
    const previous = rows;
    setRows((current) => current.map((row) => (row.id === point.id ? { ...row, ...patch } : row)));
    startTransition(async () => {
      const result = await actions.update(point.id, patch);
      if (!result.ok) {
        setRows(previous);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const addPoint = () => {
    const headline = draftHeadline.trim() || "New point";
    startTransition(async () => {
      const result = await actions.create({ kind: draftKind, headline });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraftHeadline("");
      const created = {
        id: result.id,
        kind: draftKind,
        headline,
        detail: null,
        position: rows.length + 1,
      };
      setRows((current) => [...current, created]);
      setSelectedId(result.id);
      router.refresh();
    });
  };

  const removePoint = (point: EditorPoint) => {
    const previous = rows;
    const next = rows.filter((row) => row.id !== point.id);
    setRows(next);
    if (selectedId === point.id) {
      setSelectedId(next.find((row) => row.kind === "ask")?.id ?? next[0]?.id ?? null);
    }
    startTransition(async () => {
      const result = await actions.remove(point.id);
      if (!result.ok) {
        setRows(previous);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const dropOn = (targetId: string) => {
    const sourceId = dragId;
    setDragId(null);
    if (!sourceId || sourceId === targetId) return;
    const previous = rows;
    const next = [...rows];
    const from = next.findIndex((row) => row.id === sourceId);
    const to = next.findIndex((row) => row.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const ordered = next.map((row, index) => ({ ...row, position: index + 1 }));
    setRows(ordered);
    startTransition(async () => {
      const result = await actions.reorder(ordered.map((row) => row.id));
      if (!result.ok) {
        setRows(previous);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const runDraft = () => {
    if (!draft) return;
    setDrafting(true);
    void draft.run().then((result) => {
      setDrafting(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.contextUsed) setContextUsed(result.contextUsed);
      if (result.contextMissing) setContextMissing(result.contextMissing);
      if (result.quiet) return;
      toast.success(result.added === 1 ? "Added 1 point" : `Added ${result.added} points`);
      router.refresh();
    });
  };

  const draftLabel =
    draft && draft.label === "Draft points" && rows.length > 0 ? "Add more with AI" : draft?.label;

  const markable = rows.filter((point) => point.kind !== "agenda");
  const selected = rows.find((point) => point.id === selectedId) ?? null;
  const selectedMarkableIndex = selected
    ? markable.findIndex((point) => point.id === selected.id) + 1
    : 0;

  if (layout === "split") {
    return (
      <section className="flex min-h-0 flex-1 flex-col min-[1100px]:flex-row">
        <OutlineList
          rows={rows}
          selectedId={selectedId}
          dragId={dragId}
          onSelect={setSelectedId}
          onDragStart={setDragId}
          onDragEnd={() => setDragId(null)}
          onDrop={dropOn}
          onAdd={addPoint}
          draftLabel={draftLabel}
          onDraft={draft ? runDraft : undefined}
          drafting={drafting}
        />
        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? <p className="mb-3 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
          {selected ? (
            <CardEditor
              point={selected}
              index={Math.max(1, selectedMarkableIndex)}
              total={Math.max(1, markable.length)}
              onPatch={(patch) => savePatch(selected, patch)}
              onRemove={() => removePoint(selected)}
              draftReactions={actions.draftReactions}
            />
          ) : (
            <p className="text-[15px] text-[var(--jos-muted)]">Add a point to edit the card.</p>
          )}
          {contextUsed ? (
            <p className="mt-4 text-[13px] text-[var(--jos-muted)]">Used: {contextUsed.join(" · ")}</p>
          ) : null}
          {contextMissing?.length ? (
            <p className="text-[13px] text-[var(--jos-muted)]">Missing: {contextMissing.join(" · ")}</p>
          ) : null}
          {typeof footer === "function" ? footer(rows.length) : footer}
        </div>
      </section>
    );
  }

  if (layout === "outline") {
    return (
      <section className="space-y-1">
        {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
        <ul>
          {rows.map((point) => {
            if (point.kind === "agenda") {
              return (
                <li key={point.id} className="pt-4 pb-1">
                  <p className={LIVE_SECTION_LABEL}>{point.headline}</p>
                </li>
              );
            }
            const open = selectedId === point.id;
            return (
              <li key={point.id} className="border-b border-[var(--jos-line)]">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-left"
                  onClick={() => setSelectedId(open ? null : point.id)}
                >
                  <KindIcon kind={point.kind} size={18} />
                  <span className="min-w-0 flex-1 text-[17px] leading-snug">{point.headline}</span>
                  <span
                    className="shrink-0 text-[12px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: LIVE_KIND[point.kind].text }}
                  >
                    {KIND_LABEL[point.kind]}
                  </span>
                </button>
                {open ? (
                  <div className="border-t border-[var(--jos-line)] bg-[var(--jos-surface)] px-4 py-4">
                    <CardEditor
                      point={point}
                      index={markable.findIndex((row) => row.id === point.id) + 1}
                      total={markable.length}
                      onPatch={(patch) => savePatch(point, patch)}
                      onRemove={() => removePoint(point)}
                      draftReactions={actions.draftReactions}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {typeof footer === "function" ? footer(rows.length) : footer}
      </section>
    );
  }

  // Legacy stacked list (meeting page may still pass this until before-mode lands).
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight">Points to make</h2>
          {note ? <div className="mt-1 text-[13px] text-[var(--jos-muted)]">{note}</div> : null}
          {belowTitle}
        </div>
        {draft ? (
          <div className="space-y-1 text-right">
            <Button type="button" variant="secondary" disabled={drafting} onClick={runDraft}>
              <Sparkle size={16} weight="duotone" aria-hidden />
              {draftLabel}
            </Button>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">No points yet.</p>
      ) : (
        <ul>
          {rows.map((point) => (
            <li
              key={point.id}
              className={cn(
                "flex items-start gap-2 border-t border-[var(--jos-line)] py-3 first:border-t-0",
                dragId === point.id && "opacity-50"
              )}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                dropOn(point.id);
              }}
            >
              <span
                draggable
                role="button"
                tabIndex={0}
                aria-label="Drag to reorder"
                className="mt-1 cursor-grab text-[var(--jos-muted)] active:cursor-grabbing"
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", point.id);
                  event.dataTransfer.effectAllowed = "move";
                  setDragId(point.id);
                }}
                onDragEnd={() => setDragId(null)}
              >
                <DotsSixVertical size={16} weight="bold" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <KindLabel kind={point.kind} />
                <InlineField
                  value={point.headline}
                  placeholder="Headline"
                  emptyLabel="Headline"
                  maxLength={80}
                  className="text-[16px] font-semibold tracking-tight"
                  onSave={(next) => {
                    if (!next.trim()) {
                      toast.error("Write a headline under 80 characters.");
                      return;
                    }
                    savePatch(point, { headline: next });
                  }}
                />
                {detailBox ? (
                  <textarea
                    defaultValue={point.detail ?? ""}
                    maxLength={400}
                    rows={4}
                    className={cn(LIVE_FIELD, "mt-1 min-h-24 py-2 text-[16px]")}
                    onBlur={(event) => {
                      const next = event.target.value.trim() ? event.target.value : null;
                      if ((next ?? "") === (point.detail ?? "")) return;
                      savePatch(point, { detail: next });
                    }}
                  />
                ) : (
                  <InlineField
                    value={point.detail ?? ""}
                    placeholder="What you want to say"
                    emptyLabel="What you want to say"
                    maxLength={400}
                    className="text-[14px] text-[var(--jos-muted)]"
                    onSave={(next) => savePatch(point, { detail: next.trim() ? next : null })}
                  />
                )}
                <InlineField
                  value={point.listenFor ?? ""}
                  placeholder="Listen for"
                  emptyLabel="Listen for"
                  maxLength={160}
                  className="text-[13px] text-[var(--jos-muted)]"
                  onSave={(next) => savePatch(point, { listenFor: next.trim() ? next.trim() : null })}
                />
                {actions.draftReactions ? (
                  <ReactionsTable
                    point={point}
                    onPatch={(patch) => savePatch(point, patch)}
                    onDraft={() => actions.draftReactions!(point.id)}
                  />
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Delete point"
                className="mt-1 text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
                onClick={() => removePoint(point)}
              >
                <Trash size={16} weight="duotone" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 border-t border-[var(--jos-line)] pt-3">
        <label className="sr-only" htmlFor={addId}>
          Kind for the new point
        </label>
        <select
          id={addId}
          aria-label="Kind for the new point"
          value={draftKind}
          className="h-8 bg-transparent text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--jos-muted)] outline-none"
          onChange={(event) => setDraftKind(event.target.value as PointKind)}
        >
          {POINT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABEL[kind]}
            </option>
          ))}
        </select>
        <input
          value={draftHeadline}
          maxLength={80}
          placeholder="Add point"
          aria-label="Add point"
          disabled={pending}
          className="h-8 min-w-0 flex-1 border-0 border-b-2 border-[var(--jos-line)] bg-transparent text-[15px] outline-none"
          onChange={(event) => setDraftHeadline(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addPoint();
          }}
        />
      </div>
      {typeof footer === "function" ? footer(rows.length) : footer}
    </section>
  );
}
