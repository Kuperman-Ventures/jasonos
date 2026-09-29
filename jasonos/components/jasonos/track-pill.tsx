import { cn } from "@/lib/utils";
import { TRACK_META, type Track } from "@/lib/types";

export function TrackPill({ track, className }: { track: Track; className?: string }) {
  const meta = TRACK_META[track];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        meta.tint,
        meta.accent,
        className
      )}
    >
      <span className={cn("h-1 w-1 rounded-full bg-current")} />
      {meta.short}
    </span>
  );
}

export function Delta({ value, className }: { value?: number; className?: string }) {
  if (value === undefined || value === null) return null;
  const up = value >= 0;
  return (
    <span
      className={cn(
        "num-mono text-[11px] font-medium",
        up ? "text-rung-ink" : "text-rung-1",
        className
      )}
    >
      {up ? "▲" : "▼"} {(Math.abs(value) * 100).toFixed(0)}%
    </span>
  );
}
