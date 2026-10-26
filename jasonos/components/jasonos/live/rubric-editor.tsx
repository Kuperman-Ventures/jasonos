"use client";

import { useCallback, useMemo, type KeyboardEvent } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, Plus, Trash } from "@phosphor-icons/react";
import { SaveRow } from "@/components/jasonos/live/save-row";
import { useSavedField } from "@/components/jasonos/live/use-saved-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EditorLine = { key: string; text: string };

let lineKeySeq = 0;
function newLineKey(): string {
  lineKeySeq += 1;
  return `rubric-line-${lineKeySeq}`;
}

function toEditorLines(lines: string[]): EditorLine[] {
  return lines.map((text) => ({ key: newLineKey(), text }));
}

function linesToStrings(rows: EditorLine[]): string[] {
  return rows.map((row) => row.text);
}

function sameLines(a: EditorLine[], b: EditorLine[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, index) => row.text.trim() === b[index].text.trim());
}

function SortableRubricRow({
  line,
  index,
  onChange,
  onDelete,
  onKeyDown,
}: {
  line: EditorLine;
  index: number;
  onChange: (text: string) => void;
  onDelete: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.key,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1 border-b border-[var(--jos-line)] bg-[var(--jos-surface)] py-1",
        isDragging && "z-10 opacity-90 shadow-sm"
      )}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-grab items-center px-1 text-[var(--jos-muted)] active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={16} />
      </button>
      <span className="w-6 shrink-0 text-center text-[11px] font-bold tabular-nums text-[var(--jos-muted)]">
        {index + 1}
      </span>
      <Input
        value={line.text}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        placeholder="Rubric line"
      />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100"
        aria-label="Delete line"
        onClick={onDelete}
      >
        <Trash size={14} />
      </Button>
    </li>
  );
}

export function RubricEditor({
  lines: savedLines,
  onSave,
  title = "Rubric",
  note,
}: {
  lines: string[];
  onSave: (lines: string[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  title?: string;
  note?: string;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const savedRows = useMemo(() => toEditorLines(savedLines), [savedLines]);

  const field = useSavedField({
    saved: savedRows,
    label: title,
    equals: sameLines,
    onSave: async (value) => {
      const result = await onSave(linesToStrings(value));
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, value };
    },
  });

  const displayRows = field.value;

  const setRows = useCallback(
    (next: EditorLine[]) => {
      field.setValue(next);
    },
    [field]
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayRows.findIndex((row) => row.key === active.id);
    const newIndex = displayRows.findIndex((row) => row.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setRows(arrayMove(displayRows, oldIndex, newIndex));
  };

  return (
    <section className="mt-10 border-t border-[var(--jos-line)] pt-8">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
        {title}
      </h2>
      {note ? <p className="mt-1 text-[13px] text-[var(--jos-muted)]">{note}</p> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={displayRows.map((row) => row.key)} strategy={verticalListSortingStrategy}>
          <ul className="mt-3 overflow-hidden rounded-[2px] border border-[var(--jos-line)]">
            {displayRows.map((line, index) => (
              <SortableRubricRow
                key={line.key}
                line={line}
                index={index}
                onKeyDown={field.onKeyDown}
                onChange={(text) => {
                  setRows(displayRows.map((row) => (row.key === line.key ? { ...row, text } : row)));
                }}
                onDelete={() => {
                  setRows(displayRows.filter((row) => row.key !== line.key));
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => {
          setRows([...displayRows, { key: newLineKey(), text: "" }]);
        }}
      >
        <Plus size={14} aria-hidden />
        Add line
      </Button>
      <SaveRow
        state={field.state}
        savedAt={field.savedAt}
        error={field.error}
        name="rubric"
        onSave={() => void field.save()}
        onCancel={field.cancel}
      />
    </section>
  );
}
