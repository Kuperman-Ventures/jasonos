import { cn } from "@/lib/utils";
import { TRACK_META, type Track } from "@/lib/types";

export function TrackPill({
  track,
  className,
  compact = false,
}: {
  track: Track;
  className?: string;
  /** Webinar pages use the smaller fully-rounded pill with a 6px dot. */
  compact?: boolean;
}) {
  const meta = TRACK_META[track];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border uppercase",
        compact
          ? "rounded-full px-2 py-[3px] text-[11px] font-semibold tracking-[0.04em]"
          : "rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wider",
        meta.tint,
        meta.accent,
        className
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full bg-current",
          compact ? "h-1.5 w-1.5" : "h-1 w-1"
        )}
      />
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
