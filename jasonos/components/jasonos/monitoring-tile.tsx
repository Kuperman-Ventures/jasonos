"use client";

import { Sparkline } from "./sparkline";
import { TrackPill, Delta } from "./track-pill";
import { TRACK_META, type MonitoringTile as Tile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";

export function MonitoringTileCard({ tile }: { tile: Tile }) {
  const meta = TRACK_META[tile.track];
  return (
    <div
      className={cn(
        "jos-card-enter group relative flex flex-col rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20",
        tile.alert && "border-[var(--jos-line)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <TrackPill track={tile.track} />
        {tile.pinned ? (
          <Pin className="h-3 w-3 text-muted-foreground" />
        ) : null}
      </div>

      <div className="mt-1.5 truncate text-[11px] font-medium text-muted-foreground">
        {tile.label}
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <div
            className={cn(
              "num-mono text-xl font-semibold leading-none tracking-tight",
              tile.alert?.tone === "critical" && "text-rung-1"
            )}
          >
            {tile.value}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Delta value={tile.delta} />
            <span className="text-[10px] text-muted-foreground">
              {tile.deltaLabel ?? "vs prev"}
            </span>
          </div>
        </div>
        <Sparkline
          data={tile.series}
          width={84}
          height={28}
          className={meta.accent}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{tile.source}</span>
        <span title={tile.refreshedAt}>
          {formatDistanceToNowStrict(new Date(tile.refreshedAt), { addSuffix: true })}
        </span>
      </div>

      {tile.alert ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-[var(--jos-line)] bg-rung-2 px-2 py-1.5 text-[11px] ">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rung-ink" />
          <span className="flex-1 leading-snug">{tile.alert.message}</span>
          {tile.alert.verb ? (
            <Button
              size="sm"
              variant="ghost"
              className="-my-0.5 h-6 px-1.5 text-[10px]  hover:bg-rung-2 "
              onClick={() =>
                toast.success(tile.alert!.verb!, {
                  description: "Stub action — wire to integration in v1.",
                })
              }
            >
              {tile.alert.verb}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
