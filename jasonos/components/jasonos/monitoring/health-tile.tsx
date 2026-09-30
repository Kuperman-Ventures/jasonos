"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Sparkline } from "@/components/jasonos/sparkline";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/lib/monitoring/targets";
import type { HealthSummaryEntry } from "./types";

const STATUS_TONE: Record<HealthStatus, { dot: string; ring: string; text: string }> = {
  green: { dot: "bg-rung-ok", ring: "ring-[var(--jos-focus)]", text: "text-rung-ink" },
  yellow: { dot: "bg-rung-2", ring: "ring-[var(--jos-focus)]", text: "text-rung-ink" },
  red: { dot: "bg-rung-1", ring: "ring-[var(--jos-focus)]", text: "text-rung-1" },
  unknown: { dot: "bg-muted-foreground/40", ring: "ring-muted/30", text: "text-muted-foreground" },
};

export function HealthTile({
  entry,
  onOpen,
}: {
  entry: HealthSummaryEntry;
  onOpen: () => void;
}) {
  const tone = STATUS_TONE[entry.status];
  const { latest, target } = entry;
  const checkedAt = latest.checkedAt ? new Date(latest.checkedAt) : null;
  const p95Display = entry.p95Hour != null ? `${entry.p95Hour}ms` : "—";
  const isFailing = entry.status === "red" || entry.status === "yellow";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "jos-card-enter group relative flex flex-col rounded-lg border bg-card p-3 text-left transition-colors hover:border-foreground/20",
        isFailing && entry.status === "red" && "border-rung-1",
        isFailing && entry.status === "yellow" && "border-[var(--jos-line)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block h-2 w-2 shrink-0 rounded-full ring-2",
              tone.dot,
              tone.ring,
              entry.status === "red" && "animate-pulse"
            )}
            aria-hidden
          />
          <span className="truncate text-[11px] font-medium text-foreground">
            {target.label}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {target.kind === "internal_tool" ? "tool" : "site"}
        </span>
      </div>

      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div>
          <div className={cn("num-mono text-xl font-semibold leading-none tracking-tight", tone.text)}>
            {p95Display}
          </div>
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            p95 · last hour
            {latest.statusCode ? <> · {latest.statusCode}</> : null}
          </div>
        </div>
        {entry.series.length > 1 ? (
          <Sparkline data={entry.series} width={84} height={28} className={tone.text} />
        ) : (
          <div className="h-[28px] w-[84px] rounded-sm bg-muted/40" aria-hidden />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="truncate" title={target.url}>
          {target.url.replace(/^https?:\/\//, "")}
        </span>
        <span title={latest.checkedAt ?? "never"}>
          {checkedAt ? `${formatDistanceToNowStrict(checkedAt)} ago` : "no checks yet"}
        </span>
      </div>

      {isFailing && latest.errorMessage ? (
        <div
          className={cn(
            "mt-2 flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px]",
            entry.status === "red"
              ? "border-rung-1 bg-rung-1 "
              : "border-[var(--jos-line)] bg-rung-2 "
          )}
        >
          <AlertTriangle
            className={cn(
              "mt-0.5 h-3 w-3 shrink-0",
              entry.status === "red" ? "text-rung-1" : "text-rung-ink"
            )}
          />
          <span className="flex-1 leading-snug">
            {latest.errorMessage}
            {entry.consecutiveFailures > 1 ? (
              <> · {entry.consecutiveFailures} consecutive</>
            ) : null}
          </span>
        </div>
      ) : null}
    </button>
  );
}

export function StatusDotCompact({ status, label }: { status: HealthStatus; label: string }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground"
      title={label}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full ring-2", tone.dot, tone.ring)} aria-hidden />
      <span className="truncate max-w-[120px]">{label}</span>
    </span>
  );
}
