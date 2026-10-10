"use client";

import { cn } from "@/lib/utils";

/** Surface field with 2px field-edge bottom. Used inside the contact modal. */
export const modalFieldClass =
  "w-full rounded-[2px] border-0 border-b-2 border-[var(--color-field-edge)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[15px] text-[var(--color-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]";

export const modalLabelClass =
  "block text-[14px] font-semibold text-[var(--color-text)]";

export const modalHelperClass =
  "mt-1 text-[13px] font-normal text-[var(--jos-muted)]";

export const modalKickerClass =
  "text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--jos-muted)]";

export const modalSectionTitleClass =
  "text-[20px] font-extrabold tracking-tight text-[var(--color-text)]";

export const modalGhostLinkClass =
  "inline-flex items-center gap-1 font-bold text-[var(--color-accent-700)] underline underline-offset-2 hover:text-[var(--color-accent-800)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]";

export const modalSecondaryClass =
  "h-9 border border-[var(--color-text)] bg-transparent font-bold text-[var(--color-text)] shadow-none hover:bg-[var(--color-surface)]";

export const modalEmptyClass = "text-[var(--color-empty)]";

export const modalListRowClass =
  "flex items-baseline justify-between gap-3 border-b border-[var(--color-divider)] py-3 last:border-b-0";

export function ModalSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn(modalSectionTitleClass, className)}>{children}</h3>
  );
}

export function ChoiceCard({
  title,
  description,
  selected,
  onClick,
  disabled,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-[2px] p-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)] disabled:opacity-[0.45]",
        selected
          ? "bg-[var(--color-text)] text-[var(--color-bg)]"
          : "bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-neutral-300)]"
      )}
    >
      <span className="block text-[16px] font-bold">{title}</span>
      {description ? (
        <span
          className={cn(
            "mt-0.5 block text-[13px] font-normal",
            selected ? "text-[var(--color-bg)]/75" : "text-[var(--jos-muted)]"
          )}
        >
          {description}
        </span>
      ) : null}
    </button>
  );
}

export function PillChip({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-[7px] text-[14px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)] disabled:opacity-[0.45]",
        selected
          ? "bg-[var(--color-text)] font-bold text-[var(--color-bg)]"
          : "bg-[var(--color-surface)] font-medium text-[var(--color-text)] hover:bg-[var(--color-neutral-300)]"
      )}
    >
      {children}
    </button>
  );
}

export function CadenceBlock({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-[2px] px-3 py-1.5 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)] disabled:opacity-[0.45]",
        selected
          ? "bg-[var(--color-text)] font-bold text-[var(--color-bg)]"
          : "bg-[var(--color-surface)] font-semibold text-[var(--color-text)] hover:bg-[var(--color-neutral-300)]"
      )}
    >
      {children}
    </button>
  );
}

export function StepChip({
  done,
  onClick,
  children,
}: {
  done: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] px-2 py-1 text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jos-focus)]",
        done
          ? "bg-[var(--color-text)] text-[var(--color-bg)]"
          : "bg-[var(--color-surface)] text-[var(--jos-muted)]"
      )}
    >
      <span aria-hidden>{done ? "✓" : "○"}</span>
      {children}
    </button>
  );
}

export type WordPillTone = "cyan" | "yellow" | "magenta" | "ink" | "surface";

export function WordPill({
  tone,
  children,
  className,
}: {
  tone: WordPillTone;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass =
    tone === "cyan"
      ? "bg-rung-3"
      : tone === "yellow"
        ? "bg-rung-2"
        : tone === "magenta"
          ? "bg-rung-1"
          : tone === "ink"
            ? "bg-rung-4"
            : "bg-[var(--color-surface)] text-[var(--jos-muted)]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2px] px-3 py-[5px] text-[13px] font-bold uppercase tracking-[0.06em]",
        toneClass,
        className
      )}
    >
      {children}
    </span>
  );
}

export function RequiredMark() {
  return (
    <span className="ml-0.5 text-[var(--color-accent-2)]" aria-hidden>
      *
    </span>
  );
}
