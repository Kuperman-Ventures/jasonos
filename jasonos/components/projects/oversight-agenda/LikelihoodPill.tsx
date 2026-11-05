import type { Likelihood } from "@/lib/projects/oversight-agenda/data";
import { cn } from "@/lib/utils";

const LABEL: Record<Likelihood, string> = {
  high: "High likelihood",
  medium: "Medium likelihood",
  low: "Low likelihood",
};

/** Green / amber / red from Done, to-do, and danger tokens. Not the cyan accent. */
const TONE: Record<Likelihood, string> = {
  high: "bg-[var(--color-done-100)] text-[var(--color-done-800)]",
  medium: "bg-[var(--color-todo-100)] text-[var(--color-todo-700)]",
  low: "bg-[var(--jos-danger-tint)] text-[var(--jos-danger-ink)]",
};

export function LikelihoodPill({ likelihood }: { likelihood: Likelihood }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium tracking-wide",
        TONE[likelihood]
      )}
    >
      {LABEL[likelihood]}
    </span>
  );
}
