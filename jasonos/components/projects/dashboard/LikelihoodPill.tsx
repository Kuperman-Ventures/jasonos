import type { Likelihood } from "@/lib/dashboard/schema";

const LABEL: Record<Likelihood, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STYLE: Record<Likelihood, string> = {
  high: "bg-[var(--color-done-100)] text-[var(--color-done-800)]",
  medium: "bg-[var(--color-todo-100)] text-[var(--color-todo-700)]",
  low: "bg-[var(--jos-danger-tint)] text-[var(--jos-danger-ink)]",
};

export function LikelihoodPill({ likelihood }: { likelihood: Likelihood }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STYLE[likelihood]}`}
    >
      {LABEL[likelihood]}
    </span>
  );
}
