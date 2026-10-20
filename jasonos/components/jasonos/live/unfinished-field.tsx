"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { LIVE_FIELD, LIVE_FIELD_UNFINISHED } from "./tokens";

export function UnfinishedField({
  value,
  onSave,
  placeholder = "Add a sentence",
  emptyLabel = "Add a sentence",
  className,
  inputClassName,
  multiline = false,
  readOnly = false,
  style,
  "aria-label": ariaLabel,
}: {
  value: string | null | undefined;
  onSave?: (next: string) => void | Promise<void>;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  readOnly?: boolean;
  style?: CSSProperties;
  "aria-label"?: string;
}) {
  const trimmed = (value ?? "").trim();
  const empty = !trimmed;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(trimmed);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    ref.current?.focus();
    const el = ref.current;
    if (el && "setSelectionRange" in el) {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  const begin = () => {
    if (readOnly || !onSave) return;
    setDraft(trimmed);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next === trimmed) return;
    void onSave?.(next);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(trimmed);
      setEditing(false);
      return;
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };

  if (!editing) {
    if (empty) {
      return (
        <button
          type="button"
          onClick={begin}
          disabled={readOnly || !onSave}
          aria-label={ariaLabel ?? emptyLabel}
          className={cn(
            LIVE_FIELD,
            LIVE_FIELD_UNFINISHED,
            "min-h-11 text-left text-[17px] font-medium text-[var(--color-accent-2-text)]",
            readOnly && "cursor-default",
            className,
            inputClassName
          )}
          style={style}
        >
          {emptyLabel}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={begin}
        disabled={readOnly || !onSave}
        aria-label={ariaLabel}
        className={cn(
          "block w-full rounded-[2px] border-0 border-b-2 border-transparent bg-transparent px-0 text-left text-[var(--jos-ink)] outline-none hover:border-[#b5b2b2]",
          readOnly && "cursor-default hover:border-transparent",
          className,
          inputClassName
        )}
        style={style}
      >
        {trimmed}
      </button>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        aria-label={ariaLabel}
        placeholder={placeholder}
        rows={3}
        className={cn(
          LIVE_FIELD,
          empty && LIVE_FIELD_UNFINISHED,
          "min-h-24 resize-y py-2 text-[16px] leading-relaxed",
          className,
          inputClassName
        )}
        style={style}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
      />
    );
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={cn(
        LIVE_FIELD,
        empty && LIVE_FIELD_UNFINISHED,
        "min-h-11 text-[17px] font-medium",
        className,
        inputClassName
      )}
      style={style}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
    />
  );
}
