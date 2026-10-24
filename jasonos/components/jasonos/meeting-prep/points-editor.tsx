"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, CircleNotch, DotsSixVertical, Sparkle, Trash, WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  FieldSaveRow,
  KindIcon,
  KindLabel,
  LIVE_FIELD,
  LIVE_KIND,
  LIVE_SECTION_LABEL,
  useSavedField,
  type SaveOutcome,
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

export type PointPatch = {
  kind?: PointKind;
  headline?: string;
  detail?: string | null;
  listenFor?: string | null;
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
  update: (id: string, patch: PointPatch) => Promise<PointResult<object>>;
  draftReactions?: (id: string) => Promise<PointResult<{ reactions: Reaction[] }>>;
  remove: (id: string) => Promise<PointResult<object>>;
  reorder: (orderedIds: string[]) => Promise<PointResult<object>>;
};

type Commit = (patch: PointPatch) => Promise<SaveOutcome<unknown>>;

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

/** Kind saves the moment it changes; the state shows beside the select. */
function KindSelect({ kind, onCommit }: { kind: PointKind; onCommit: Commit }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Kind
      </label>
      <select
        id={id}
        value={kind}
        disabled={status === "saving"}
        className="h-8 border border-[var(--jos-line)] bg-[var(--jos-bg)] px-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-ink)]"
        onChange={(event) => {
          const next = event.target.value as PointKind;
          if (next === kind) return;
          setStatus("saving");
          setError(null);
          void onCommit({ kind: next }).then((result) => {
            if (result.ok) {
              setStatus("saved");
              return;
            }
            setStatus("failed");
            setError(result.error);
          });
        }}
      >
        {POINT_KINDS.map((option) => (
          <option key={option} value={option}>
            {KIND_LABEL[option]}
          </option>
        ))}
      </select>
      {status === "saving" ? (
        <span role="status" className="inline-flex items-center gap-1 text-[13px] text-[var(--jos-muted)]">
          <CircleNotch size={14} weight="bold" className="animate-spin" aria-hidden />
          Saving…
        </span>
      ) : status === "saved" ? (
        <span role="status" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-done)]">
          <CheckCircle size={16} weight="duotone" aria-hidden />
          Saved
        </span>
      ) : status === "failed" ? (
        <span role="alert" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-accent-2-text)]">
          <WarningCircle size={16} weight="duotone" aria-hidden />
          {error ? `Did not save. ${error}` : "Did not save."}
        </span>
      ) : null}
    </div>
  );
}

function CallPreview({ kind, headline, detail }: { kind: PointKind; headline: string; detail: string }) {
  const band = LIVE_KIND[kind].band;
  const spoken = detail.trim().split("\n")[0] || "";
  return (
    <div className="mt-4 overflow-hidden border border-[var(--jos-line)]">
      <div className="h-1.5" style={{ backgroundColor: band }} />
      <div className="bg-[var(--jos-bg)] px-4 py-3">
        <KindLabel kind={kind} />
        <p className="mt-1 text-[18px] font-extrabold leading-snug tracking-tight">{headline || "Headline"}</p>
        {spoken ? <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-[#4a4747]">{spoken}</p> : null}
      </div>
    </div>
  );
}

type PointText = { headline: string; detail: string; listenFor: string };

function pointText(point: EditorPoint): PointText {
  return { headline: point.headline, detail: point.detail ?? "", listenFor: point.listenFor ?? "" };
}

function sameText(a: PointText, b: PointText): boolean {
  return a.headline.trim() === b.headline.trim() && a.detail.trim() === b.detail.trim() && a.listenFor.trim() === b.listenFor.trim();
}

/** Headline, spoken line and listen-for edit together under one Save point row. */
function PointFields({
  point,
  compact = false,
  preview = false,
  onCommit,
}: {
  point: EditorPoint;
  compact?: boolean;
  preview?: boolean;
  onCommit: Commit;
}) {
  const field = useSavedField<PointText>({
    saved: pointText(point),
    label: point.headline.trim() || "Point",
    equals: sameText,
    onSave: async (value) => {
      const headline = value.headline.trim();
      if (!headline || headline.length > 80) return { ok: false, error: "Write a headline under 80 characters." };
      const next: PointText = { headline, detail: value.detail.trim(), listenFor: value.listenFor.trim() };
      const result = await onCommit({
        headline: next.headline,
        detail: next.detail || null,
        listenFor: next.listenFor || null,
      });
      return result.ok ? { ok: true, value: next } : result;
    },
  });
  const set = (patch: Partial<PointText>) => field.setValue({ ...field.value, ...patch });

  return (
    <div onKeyDown={field.onKeyDown}>
      <input
        value={field.value.headline}
        maxLength={80}
        placeholder="Headline"
        aria-label="Headline"
        className={cn(
          "w-full border-0 border-b-2 border-transparent bg-transparent font-bold tracking-tight text-[var(--jos-ink)] outline-none hover:border-[var(--jos-line)] focus:border-[var(--color-accent-700)]",
          compact ? "text-[16px] font-semibold" : "mt-4 text-[20px]"
        )}
        onChange={(event) => set({ headline: event.target.value })}
      />
      <label className={cn("block", compact ? "mt-2" : "mt-4")}>
        <span className={LIVE_SECTION_LABEL}>What you want to say</span>
        <textarea
          value={field.value.detail}
          maxLength={400}
          rows={compact ? 3 : 6}
          placeholder="What you want to say"
          aria-label="What you want to say"
          className={cn(
            LIVE_FIELD,
            "mt-2 resize-y py-3 leading-relaxed",
            compact ? "min-h-20 text-[15px]" : "min-h-32 text-[16px]"
          )}
          onChange={(event) => set({ detail: event.target.value })}
        />
      </label>
      <label className="mt-3 block">
        <span className={LIVE_SECTION_LABEL}>Listen for</span>
        <input
          value={field.value.listenFor}
          maxLength={160}
          placeholder="What to listen for in the answer"
          aria-label="Listen for"
          className={cn(LIVE_FIELD, "mt-2 py-2 text-[15px]")}
          onChange={(event) => set({ listenFor: event.target.value })}
        />
      </label>
      {field.state !== "clean" ? <FieldSaveRow field={field} name="point" /> : null}
      {preview ? (
        <>
          <p className={cn(LIVE_SECTION_LABEL, "mt-5")}>Preview</p>
          <CallPreview kind={point.kind} headline={field.value.headline} detail={field.value.detail} />
        </>
      ) : null}
    </div>
  );
}

function blankReactions(): Reaction[] {
  return REACTION_SHAPES.map((shape) => ({ shape, soundsLike: "", pivot: "" }));
}

function ReactionsTable({
  point,
  onPatch,
  onCommit,
  onDraft,
}: {
  point: EditorPoint;
  onPatch: (patch: PointPatch) => void;
  onCommit: Commit;
  onDraft: () => Promise<PointResult<{ reactions: Reaction[] }>>;
}) {
  const reactions = point.reactions ?? [];
  const prepared = reactions.length === REACTION_SHAPES.length;
  const showTable = point.kind === "ask" || Boolean(point.prepareReactions);
  const [confirmRedo, setConfirmRedo] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const field = useSavedField<Reaction[]>({
    saved: prepared ? reactions : blankReactions(),
    label: `Reactions for ${point.headline.trim() || "this point"}`,
    onSave: async (value) => {
      const next = value.map((row) => ({ ...row, soundsLike: row.soundsLike.trim(), pivot: row.pivot.trim() }));
      const result = await onCommit({ reactions: next, prepareReactions: true });
      return result.ok ? { ok: true, value: next } : result;
    },
  });

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

  const edit = (shape: Reaction["shape"], key: "soundsLike" | "pivot", value: string) =>
    field.setValue(field.value.map((row) => (row.shape === shape ? { ...row, [key]: value } : row)));

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

  return (
    <div className="mt-6" onKeyDown={field.onKeyDown}>
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
            disabled={drafting || field.dirty}
            onClick={() => (prepared ? setConfirmRedo(true) : draft())}
          >
            {prepared ? "Regenerate all" : "Generate with AI"}
          </button>
        )}
      </div>
      <div className="mt-3 border-t-2 border-[var(--jos-ink)]">
        {field.value.map((reaction, index) => (
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
            <input
              value={reaction.soundsLike}
              maxLength={159}
              placeholder="Sounds like"
              aria-label={`${REACTION_LABELS[reaction.shape]}: sounds like`}
              className="w-full border-0 border-b border-[var(--jos-line)] bg-transparent text-[14px] text-[var(--jos-ink)] outline-none focus:border-[var(--color-accent-700)]"
              onChange={(event) => edit(reaction.shape, "soundsLike", event.target.value)}
            />
            <input
              value={reaction.pivot}
              maxLength={159}
              placeholder="Bring it back"
              aria-label={`${REACTION_LABELS[reaction.shape]}: bring it back`}
              className="w-full border-0 border-b border-[var(--jos-line)] bg-transparent text-[14px] font-bold text-[var(--jos-ink)] outline-none focus:border-[var(--color-accent-700)]"
              onChange={(event) => edit(reaction.shape, "pivot", event.target.value)}
            />
          </div>
        ))}
      </div>
      {field.state !== "clean" ? <FieldSaveRow field={field} name="reactions" /> : null}
    </div>
  );
}

function CardEditor({
  point,
  index,
  total,
  onPatch,
  onCommit,
  onRemove,
  draftReactions,
}: {
  point: EditorPoint;
  index: number;
  total: number;
  onPatch: (patch: PointPatch) => void;
  onCommit: Commit;
  onRemove: () => void;
  draftReactions?: (id: string) => Promise<PointResult<{ reactions: Reaction[] }>>;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-3">
        <p className={LIVE_SECTION_LABEL}>
          Card {index} of {total}
        </p>
        <KindSelect kind={point.kind} onCommit={onCommit} />
        <button
          type="button"
          className="ml-auto text-[13px] font-semibold text-[var(--jos-muted)] hover:text-[var(--color-accent-2-text)]"
          onClick={onRemove}
        >
          Delete card
        </button>
      </div>

      <PointFields point={point} preview onCommit={onCommit} />

      {draftReactions ? (
        <ReactionsTable
          point={point}
          onPatch={onPatch}
          onCommit={onCommit}
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
        <h2 className="text-[20px] font-extrabold tracking-tight">Points</h2>
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
  layout = "list",
  title = "Points to make",
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
  layout?: "list" | "split" | "outline";
  /** List layout heading. Null hides it. */
  title?: string | null;
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

  /** Immediate, optimistic write for toggles. */
  const savePatch = (point: EditorPoint, patch: PointPatch) => {
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

  /** Write behind a Save row: rows change only once the server accepts. */
  const commitPatch = async (point: EditorPoint, patch: PointPatch): Promise<SaveOutcome<unknown>> => {
    const result = await actions.update(point.id, patch);
    if (!result.ok) return { ok: false, error: result.error };
    setRows((current) => current.map((row) => (row.id === point.id ? { ...row, ...patch } : row)));
    router.refresh();
    return { ok: true };
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

  const draftLabel = draft && rows.length > 0 ? "Add more with AI" : draft?.label;

  const markable = rows.filter((point) => point.kind !== "agenda");
  const markableIndex = (point: EditorPoint) => markable.findIndex((row) => row.id === point.id) + 1;

  const card = (point: EditorPoint) => (
    <CardEditor
      point={point}
      index={Math.max(1, markableIndex(point))}
      total={Math.max(1, markable.length)}
      onPatch={(patch) => savePatch(point, patch)}
      onCommit={(patch) => commitPatch(point, patch)}
      onRemove={() => removePoint(point)}
      draftReactions={actions.draftReactions}
    />
  );

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
          {/* Every card stays mounted so unsaved edits survive switching cards. */}
          {rows.map((point) => (
            <div key={point.id} hidden={point.id !== selectedId}>
              {card(point)}
            </div>
          ))}
          {!rows.some((point) => point.id === selectedId) ? (
            <p className="text-[15px] text-[var(--jos-muted)]">Add a point to edit the card.</p>
          ) : null}
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
                  aria-expanded={open}
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
                <div hidden={!open} className="border-t border-[var(--jos-line)] bg-[var(--jos-surface)] px-4 py-4">
                  {card(point)}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2 border-t border-[var(--jos-line)] pt-3">
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

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {title ? <h2 className="text-[20px] font-extrabold tracking-tight">{title}</h2> : null}
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
                <KindSelect kind={point.kind} onCommit={(patch) => commitPatch(point, patch)} />
                <PointFields point={point} compact onCommit={(patch) => commitPatch(point, patch)} />
                {actions.draftReactions ? (
                  <ReactionsTable
                    point={point}
                    onPatch={(patch) => savePatch(point, patch)}
                    onCommit={(patch) => commitPatch(point, patch)}
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
