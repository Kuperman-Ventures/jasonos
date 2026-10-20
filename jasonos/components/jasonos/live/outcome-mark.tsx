import { cn } from "@/lib/utils";
import { LIVE_OUTCOME, LIVE_REVIEW_STATUS } from "./tokens";

export type OutcomeChoice = keyof typeof LIVE_OUTCOME;
export type ReviewStatusKey = keyof typeof LIVE_REVIEW_STATUS;

export function OutcomeMarkButton({
  mark,
  selected,
  onClick,
  className,
}: {
  mark: OutcomeChoice;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  const meta = LIVE_OUTCOME[mark];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 min-w-[5.5rem] px-4 text-[15px] font-bold",
        selected
          ? "text-[var(--color-on-action)]"
          : "border-2 border-[var(--jos-line)] bg-transparent text-[var(--jos-ink)]",
        className
      )}
      style={selected ? { backgroundColor: meta.fill, color: meta.text } : undefined}
    >
      {meta.label}
    </button>
  );
}

export function ReviewStatusChip({
  status,
  className,
}: {
  status: ReviewStatusKey;
  className?: string;
}) {
  const meta = LIVE_REVIEW_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-7 w-[100px] items-center justify-center text-[12px] font-bold uppercase tracking-[0.08em]",
        className
      )}
      style={{ backgroundColor: meta.fill, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}
