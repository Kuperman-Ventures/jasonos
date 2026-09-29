import { cn } from "@/lib/utils";

export function ScoreChip({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "num-mono inline-flex h-7 items-center rounded-md border bg-background px-2 text-xs font-semibold",
        score >= 95
          ? "border-rung-1 text-rung-1"
          : score >= 90
          ? "border-[var(--jos-line)] text-rung-ink"
          : "border-border text-foreground",
        className
      )}
    >
      {score} / 100
    </span>
  );
}
