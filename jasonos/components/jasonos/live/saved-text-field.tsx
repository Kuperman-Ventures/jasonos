"use client";

import { cn } from "@/lib/utils";
import { FieldSaveRow } from "./save-row";
import { useSavedField, type SaveOutcome } from "./use-saved-field";

/**
 * One line of text with the Save row under it. Enter or ⌘Enter saves, Esc cancels.
 * `validate` returns the refusal shown in the row, or null.
 */
export function SavedTextField({
  value,
  label,
  name,
  placeholder,
  maxLength,
  className,
  inputClassName,
  validate,
  onSave,
}: {
  value: string;
  /** Names the field in the leave guard. */
  label: string;
  /** Save button text: "point" gives "Save point". */
  name: string;
  placeholder: string;
  maxLength: number;
  className?: string;
  inputClassName?: string;
  validate?: (next: string) => string | null;
  onSave: (next: string) => Promise<SaveOutcome<string>>;
}) {
  const field = useSavedField<string>({
    saved: value,
    label,
    onSave: async (next) => {
      const trimmed = next.trim();
      const problem = validate?.(trimmed) ?? null;
      if (problem) return { ok: false, error: problem };
      return onSave(trimmed);
    },
  });
  return (
    <div className={cn("min-w-0", className)}>
      <input
        value={field.value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "w-full border-0 border-b-2 bg-transparent outline-none placeholder:font-normal placeholder:text-[var(--jos-muted)]",
          field.state === "clean"
            ? "border-transparent hover:border-[var(--jos-line)] focus:border-[var(--color-accent-700)]"
            : "border-[var(--color-accent-700)]",
          inputClassName
        )}
        onChange={(event) => field.setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void field.save();
            return;
          }
          field.onKeyDown(event);
        }}
      />
      {field.state !== "clean" ? <FieldSaveRow field={field} name={name} /> : null}
    </div>
  );
}
