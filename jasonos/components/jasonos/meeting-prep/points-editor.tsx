"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BlockTitle } from "@/components/jasonos/meeting-prep/meeting-prep-bits";
import { Button } from "@/components/ui/button";
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
  position: number;
};

export type PointsEditorActions = {
  create: (input: {
    kind: PointKind;
    headline: string;
    detail?: string | null;
  }) => Promise<PointResult<{ id: string }>>;
  update: (
    id: string,
    patch: { kind?: PointKind; headline?: string; detail?: string | null }
  ) => Promise<PointResult<object>>;
  remove: (id: string) => Promise<PointResult<object>>;
  reorder: (orderedIds: string[]) => Promise<PointResult<object>>;
};

function pointSignature(points: EditorPoint[]): string {
  return points
    .map((point) =>
      [point.id, point.position, point.kind, point.headline, point.detail ?? ""].join("\u001f")
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
        "w-full border-0 border-b-2 border-[var(--color-calendar-700)] bg-transparent outline-none",
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

function DetailBox({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => void;
}) {
  const [seen, setSeen] = useState(value);
  const [text, setText] = useState(value);

  if (value !== seen) {
    setSeen(value);
    setText(value);
  }

  return (
    <label className="mt-2 block">
      <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
        What you want to say
      </span>
      <textarea
        value={text}
        maxLength={400}
        rows={8}
        placeholder="What you want to say"
        aria-label="What you want to say"
        className="mt-1 min-h-40 w-full resize-y rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-surface)] px-3.5 py-3 text-[16px] leading-relaxed text-[var(--jos-ink)] outline-none placeholder:text-[var(--jos-muted)] focus:border-[var(--color-calendar-700)]"
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (text.trim() === value.trim()) return;
          onSave(text);
        }}
      />
    </label>
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

  if (signature !== seen) {
    setSeen(signature);
    setRows(points);
  }

  const savePatch = (
    point: EditorPoint,
    patch: { kind?: PointKind; headline?: string; detail?: string | null }
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
    const headline = draftHeadline.trim();
    if (!headline) return;
    startTransition(async () => {
      const result = await actions.create({ kind: draftKind, headline });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraftHeadline("");
      setRows((current) => [
        ...current,
        {
          id: result.id,
          kind: draftKind,
          headline,
          detail: null,
          position: current.length + 1,
        },
      ]);
      router.refresh();
    });
  };

  const removePoint = (point: EditorPoint) => {
    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== point.id));
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

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BlockTitle>Points to make</BlockTitle>
          {note ? <div className="mt-1 text-[13px] text-[var(--jos-muted)]">{note}</div> : null}
          {belowTitle}
        </div>
        {draft ? (
          <div className="space-y-1 text-right">
            <Button type="button" variant="outline" disabled={drafting} onClick={runDraft}>
              <Sparkles />
              {draftLabel}
            </Button>
            {contextUsed ? (
              <p className="text-[13px] text-[var(--jos-muted)]">Used: {contextUsed.join(" · ")}</p>
            ) : null}
            {contextMissing?.length ? (
              <p className="text-[13px] text-[var(--jos-muted)]">Missing: {contextMissing.join(" · ")}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}

      {rows.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-[var(--jos-muted)]">
          No points yet. Draft them from the prep, or add your own.
        </p>
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
                <GripVertical className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <label className="block">
                  <span className="sr-only">Kind</span>
                  <select
                    aria-label="Kind"
                    value={point.kind}
                    className="bg-transparent text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--jos-muted)] outline-none"
                    onChange={(event) =>
                      savePatch(point, { kind: event.target.value as PointKind })
                    }
                  >
                    {POINT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {KIND_LABEL[kind]}
                      </option>
                    ))}
                  </select>
                </label>
                <InlineField
                  value={point.headline}
                  placeholder="Headline"
                  emptyLabel="Headline"
                  maxLength={80}
                  className="text-[16px] font-semibold tracking-tight text-[var(--jos-ink)]"
                  onSave={(next) => {
                    if (!next.trim() || next.trim().length > 80) {
                      toast.error("Write a headline under 80 characters.");
                      return;
                    }
                    savePatch(point, { headline: next });
                  }}
                />
                {detailBox ? (
                  <DetailBox
                    value={point.detail ?? ""}
                    onSave={(next) => savePatch(point, { detail: next.trim() ? next : null })}
                  />
                ) : (
                  <InlineField
                    value={point.detail ?? ""}
                    placeholder="What you want to say"
                    emptyLabel="What you want to say"
                    maxLength={400}
                    className="text-[14px] font-medium text-[var(--jos-muted)]"
                    onSave={(next) => savePatch(point, { detail: next.trim() ? next : null })}
                  />
                )}
              </div>
              <button
                type="button"
                aria-label="Delete point"
                className="mt-1 text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
                onClick={() => removePoint(point)}
              >
                <Trash2 className="size-4" />
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
          className="h-8 min-w-0 flex-1 border-0 border-b-2 border-[var(--jos-line)] bg-transparent text-[15px] outline-none placeholder:text-[var(--jos-muted)] focus:border-[var(--color-calendar-700)]"
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
