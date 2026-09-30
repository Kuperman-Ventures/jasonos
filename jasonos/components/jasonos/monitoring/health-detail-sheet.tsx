"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import { ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { HealthSummaryEntry } from "./types";

export function HealthDetailSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: HealthSummaryEntry | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  if (!entry) return null;
  const t = entry.target;
  const okCount = entry.history24h.filter((r) => r.ok).length;
  const failCount = entry.history24h.length - okCount;
  const uptime =
    entry.history24h.length > 0
      ? ((okCount / entry.history24h.length) * 100).toFixed(1) + "%"
      : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {t.label}
            <a
              href={t.url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open URL"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </SheetTitle>
          <SheetDescription>
            <span className="break-all">{t.url}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 px-4">
          <Stat label="24h uptime" value={uptime} />
          <Stat label="P95 / hour" value={entry.p95Hour != null ? `${entry.p95Hour}ms` : "—"} />
          <Stat
            label="Checks"
            value={entry.history24h.length.toString()}
            sub={failCount > 0 ? `${failCount} failed` : "all ok"}
          />
        </div>

        <div className="px-4 pt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          Last 24h · {entry.history24h.length} checks
        </div>

        <ScrollArea className="mx-4 h-[calc(100vh-260px)] rounded-md border">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-popover">
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">When</th>
                <th className="px-2 py-1.5 font-medium">Code</th>
                <th className="px-2 py-1.5 font-medium text-right">Time</th>
                <th className="px-2 py-1.5 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {entry.history24h.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    No checks recorded yet. Cron runs every 2 minutes once
                    deployed.
                  </td>
                </tr>
              ) : (
                entry.history24h.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                      <div title={r.checked_at}>
                        {format(new Date(r.checked_at), "HH:mm:ss")}
                      </div>
                      <div className="text-[9px]">
                        {formatDistanceToNowStrict(new Date(r.checked_at))} ago
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 num-mono text-[10px]",
                          r.ok
                            ? "bg-rung-ok "
                            : "bg-rung-1 "
                        )}
                      >
                        {r.status_code ?? "—"}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "num-mono whitespace-nowrap px-2 py-1.5 text-right",
                        r.response_time_ms != null && r.response_time_ms > 2000
                          ? "text-rung-ink"
                          : "text-muted-foreground"
                      )}
                    >
                      {r.response_time_ms != null ? `${r.response_time_ms}ms` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {r.error_message ?? (r.ok ? "" : "non-200")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-card px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="num-mono mt-0.5 text-sm font-semibold">{value}</div>
      {sub ? <div className="text-[9px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
