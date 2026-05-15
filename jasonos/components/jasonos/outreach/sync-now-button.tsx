"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { syncOutreachAll } from "@/lib/server-actions/outreach-sync";
import { cn } from "@/lib/utils";
import type { OutreachSyncSnapshot } from "@/lib/outreach/data";

export interface SyncNowButtonProps {
  /** Initial sync state from server. */
  initial: OutreachSyncSnapshot[];
}

export function SyncNowButton({ initial }: SyncNowButtonProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<OutreachSyncSnapshot[]>(initial);

  const handleSync = async () => {
    setRunning(true);
    try {
      const result = await syncOutreachAll({ daysBack: 7 });
      const messages: string[] = [];
      if (result.gmail) {
        messages.push(
          result.gmail.ok
            ? `Gmail: +${result.gmail.inserted} new${
                result.gmail.cadenceUpdates
                  ? `, advanced ${result.gmail.cadenceUpdates}`
                  : ""
              }`
            : `Gmail failed: ${result.gmail.error ?? "unknown"}`
        );
      }
      if (result.gcal) {
        messages.push(
          result.gcal.ok
            ? `Calendar: +${result.gcal.inserted} new${
                result.gcal.cadenceUpdates
                  ? `, advanced ${result.gcal.cadenceUpdates}`
                  : ""
              }`
            : `Calendar failed: ${result.gcal.error ?? "unknown"}`
        );
      }
      if (result.ok) {
        toast.success(messages.join(" · "));
      } else {
        toast.error(messages.join(" · ") || "Sync failed");
      }

      // Patch snapshot locally for instant feedback.
      const now = new Date().toISOString();
      const next = [...snapshot];
      for (const src of ["gmail", "gcal"] as const) {
        const idx = next.findIndex((s) => s.source === src);
        const apiResult = src === "gmail" ? result.gmail : result.gcal;
        if (!apiResult) continue;
        const row: OutreachSyncSnapshot = {
          source: src,
          last_synced_at: now,
          last_result: {
            ok: apiResult.ok,
            matched: apiResult.matched,
            inserted: apiResult.inserted,
            duplicates: apiResult.duplicates,
            cadenceUpdates: apiResult.cadenceUpdates,
            skipped: apiResult.skipped,
            error: apiResult.error,
          },
        };
        if (idx >= 0) next[idx] = row;
        else next.push(row);
      }
      setSnapshot(next);

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => setOpen(true)}
        title="Recent sync state + run sync now"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", running && "animate-spin")} />
        Sync
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Outreach capture
            </DialogTitle>
            <DialogDescription>
              Pulls Gmail sent + Calendar meetings from the last 7 days, then
              auto-advances cadence on any contact you reached.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2">
            {snapshot.length === 0 ? (
              <li className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                Apply migration{" "}
                <code className="font-mono">0014_contact_touches.sql</code> to
                start tracking sync state.
              </li>
            ) : (
              snapshot.map((s) => <SyncRow key={s.source} snap={s} />)
            )}
          </ul>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSync} disabled={running}>
              {running ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {running ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SyncRow({ snap }: { snap: OutreachSyncSnapshot }) {
  const last = snap.last_result ?? null;
  const errored = typeof last?.error === "string";
  const labelByCode: Record<string, string> = {
    gmail: "Gmail (sent emails)",
    gcal: "Calendar (meetings)",
    hubspot: "HubSpot (engagements)",
  };
  const label = labelByCode[snap.source] ?? snap.source;
  return (
    <li className="rounded-md border bg-card/40 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">{label}</div>
        {snap.last_synced_at ? (
          errored ? (
            <span className="inline-flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {fmtRelative(snap.last_synced_at)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {fmtRelative(snap.last_synced_at)}
            </span>
          )
        ) : (
          <span className="text-muted-foreground/70 italic">never</span>
        )}
      </div>
      {last ? (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {errored ? (
            <span className="text-amber-300">
              error: {String(last.error).slice(0, 120)}
            </span>
          ) : (
            <>
              {typeof last.matched === "number" ? `matched ${last.matched} · ` : ""}
              {typeof last.inserted === "number" ? `+${last.inserted} new · ` : ""}
              {typeof last.duplicates === "number" ? `${last.duplicates} dupes · ` : ""}
              {typeof last.cadenceUpdates === "number"
                ? `advanced ${last.cadenceUpdates}`
                : ""}
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

function fmtRelative(iso: string) {
  const t = new Date(iso).getTime();
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
