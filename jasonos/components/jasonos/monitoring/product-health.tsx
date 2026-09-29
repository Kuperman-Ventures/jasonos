"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HealthTile, StatusDotCompact } from "./health-tile";
import { HealthDetailSheet } from "./health-detail-sheet";
import type { HealthSummaryEntry, HealthSummaryPayload } from "./types";
import type { HealthStatus } from "@/lib/monitoring/targets";

const FEATURE_FLAG = process.env.NEXT_PUBLIC_PRODUCT_HEALTH_ENABLED;
const ENABLED = FEATURE_FLAG === undefined ? true : FEATURE_FLAG !== "false";

const POLL_INTERVAL_MS = 60_000;

const STATUS_RANK: Record<HealthStatus, number> = {
  red: 0,
  yellow: 1,
  unknown: 2,
  green: 3,
};

const CRIT_RANK: Record<"critical" | "high" | "normal", number> = {
  critical: 0,
  high: 1,
  normal: 2,
};

const KIND_RANK: Record<"internal_tool" | "public_site", number> = {
  internal_tool: 0,
  public_site: 1,
};

function sortEntries(a: HealthSummaryEntry, b: HealthSummaryEntry): number {
  const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (s !== 0) return s;
  const c = CRIT_RANK[a.target.criticality] - CRIT_RANK[b.target.criticality];
  if (c !== 0) return c;
  const k = KIND_RANK[a.target.kind] - KIND_RANK[b.target.kind];
  if (k !== 0) return k;
  return a.target.label.localeCompare(b.target.label);
}

export function ProductHealth() {
  const [payload, setPayload] = useState<HealthSummaryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [forceExpanded, setForceExpanded] = useState(false);
  const [sheetEntry, setSheetEntry] = useState<HealthSummaryEntry | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/monitoring/health-summary", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as HealthSummaryPayload;
      setPayload(j);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(timeoutId);
      clearInterval(id);
    };
  }, [load]);

  const entries = useMemo(() => {
    if (!payload) return [];
    return [...payload.targets].sort(sortEntries);
  }, [payload]);

  const counts = useMemo(() => {
    const acc: Record<HealthStatus, number> = {
      green: 0,
      yellow: 0,
      red: 0,
      unknown: 0,
    };
    for (const e of entries) acc[e.status] += 1;
    return acc;
  }, [entries]);

  if (!ENABLED) return null;

  const allGreen =
    entries.length > 0 && counts.green + counts.unknown === entries.length && counts.unknown === 0;
  const collapsed = allGreen && !forceExpanded;

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Activity className="h-3.5 w-3.5 text-rung-ink" />
        <h2 className="text-sm font-semibold tracking-tight">Product Health</h2>
        <span className="text-[11px] text-muted-foreground">
          · {entries.length} target{entries.length === 1 ? "" : "s"}
        </span>
        {payload && !payload.configured ? (
          <span className="rounded border border-[var(--jos-line)] bg-rung-2 px-1.5 py-0 text-[9px] uppercase tracking-wider ">
            Supabase pending
          </span>
        ) : null}
        {error ? (
          <span className="text-[10px] text-rung-1">· {error}</span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {allGreen && !forceExpanded ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setForceExpanded(true)}
            >
              <ChevronDown className="h-3 w-3" />
              Expand
            </Button>
          ) : allGreen && forceExpanded ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setForceExpanded(false)}
            >
              <ChevronDown className="h-3 w-3 -rotate-180" />
              Collapse
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => void load()}
          >
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </header>

      {collapsed ? (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          <span className="text-[11px] font-medium text-rung-ink">
            All systems green
          </span>
          <span className="text-[10px] text-muted-foreground">
            · {counts.green}/{entries.length}
          </span>
          <div className="ml-2 flex flex-wrap items-center gap-1">
            {entries.map((e) => (
              <StatusDotCompact key={e.target.id} status={e.status} label={e.target.label} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-3">
          {payload === null ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[110px] animate-pulse rounded-lg border bg-muted/30" />
              ))}
            </div>
          ) : (
            <>
              {(counts.red > 0 || counts.yellow > 0) && (
                <div className="rounded-md border border-[var(--jos-line)] bg-rung-2 px-3 py-2 text-[11px] ">
                  {counts.red > 0
                    ? `${counts.red} target${counts.red === 1 ? "" : "s"} down`
                    : null}
                  {counts.red > 0 && counts.yellow > 0 ? " · " : null}
                  {counts.yellow > 0
                    ? `${counts.yellow} degraded`
                    : null}
                  . Click a tile for the last-24h log.
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {entries.map((entry) => (
                  <HealthTile
                    key={entry.target.id}
                    entry={entry}
                    onOpen={() => setSheetEntry(entry)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <HealthDetailSheet
        entry={sheetEntry}
        open={!!sheetEntry}
        onOpenChange={(o) => {
          if (!o) setSheetEntry(null);
        }}
      />
    </section>
  );
}
