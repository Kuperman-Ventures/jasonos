"use client";

import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SaveState } from "./use-saved-field";

const ET = "America/New_York";

function etDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: ET });
}

/** "Saved 2:14 PM" today, "Saved Oct 21, 2:14 PM" before today. */
export function savedLabel(savedAt: string | null, now: number = Date.now()): string {
  if (!savedAt) return "Saved";
  const at = Date.parse(savedAt);
  if (Number.isNaN(at)) return "Saved";
  const time = new Date(at).toLocaleTimeString("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit" });
  if (etDay(at) === etDay(now)) return `Saved ${time}`;
  const day = new Date(at).toLocaleDateString("en-US", { timeZone: ET, month: "short", day: "numeric" });
  return `Saved ${day}, ${time}`;
}

export function SaveRow({
  state,
  savedAt,
  error,
  name,
  onSave,
  onCancel,
  onRetry,
  now,
  className,
}: {
  state: SaveState;
  savedAt: string | null;
  error?: string | null;
  /** What the Save button names: "Why" gives "Save Why". */
  name: string;
  onSave: () => void;
  onCancel: () => void;
  onRetry?: () => void;
  now?: number;
  className?: string;
}) {
  const row = cn("flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2 pt-3 text-[14px]", className);

  if (state === "clean") {
    return (
      <div className={row} data-save-state="clean" role="status">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-done)]">
          <CheckCircle size={18} weight="duotone" aria-hidden />
          <span suppressHydrationWarning>{savedLabel(savedAt, now)}</span>
        </span>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className={row} data-save-state="failed" role="alert">
        <button
          type="button"
          className={buttonVariants({ variant: "urgent", size: "sm" })}
          onClick={onRetry ?? onSave}
        >
          Retry
        </button>
        <button type="button" className={buttonVariants({ variant: "ghost", size: "sm" })} onClick={onCancel}>
          Cancel
        </button>
        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-accent-2-text)]">
          <WarningCircle size={18} weight="duotone" aria-hidden />
          {error ? `Did not save. ${error}` : "Did not save."}
        </span>
      </div>
    );
  }

  const saving = state === "saving";
  return (
    <div className={row} data-save-state={state}>
      <button
        type="button"
        disabled={saving}
        className={buttonVariants({ variant: "default", size: "sm" })}
        onClick={onSave}
      >
        {saving ? (
          <>
            <CircleNotch size={14} weight="bold" className="animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          `Save ${name}`
        )}
      </button>
      <button
        type="button"
        disabled={saving}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        onClick={onCancel}
      >
        Cancel
      </button>
      <span className="text-[13px] text-[var(--jos-muted)]">
        {saving ? "Saving" : "Unsaved changes · ⌘Enter saves, Esc cancels"}
      </span>
    </div>
  );
}

/** SaveRow wired to a `useSavedField` result. */
export function FieldSaveRow({
  field,
  name,
  className,
}: {
  field: {
    state: SaveState;
    savedAt: string | null;
    error: string | null;
    save: () => Promise<boolean>;
    cancel: () => void;
  };
  name: string;
  className?: string;
}) {
  return (
    <SaveRow
      state={field.state}
      savedAt={field.savedAt}
      error={field.error}
      name={name}
      className={className}
      onSave={() => void field.save()}
      onCancel={field.cancel}
    />
  );
}
