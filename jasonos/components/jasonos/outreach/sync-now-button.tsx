"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncOutreachAll } from "@/lib/server-actions/outreach-sync";
import { captureEmailCandidates } from "@/lib/server-actions/contact-candidates";
import { cn } from "@/lib/utils";
import type { OutreachSyncSnapshot } from "@/lib/outreach/data";

export interface SyncNowButtonProps {
  /** Initial sync state from server (used for the button tooltip). */
  initial: OutreachSyncSnapshot[];
}

export function SyncNowButton({ initial }: SyncNowButtonProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  // One click runs the full capture: Gmail sent + Calendar meetings, and the
  // suggested-contacts email scan — no confirmation modal.
  const handleSync = async () => {
    if (running) return;
    setRunning(true);
    try {
      const [result, suggested] = await Promise.all([
        syncOutreachAll({ daysBack: 7 }),
        captureEmailCandidates({ days: 30 }),
      ]);

      const messages: string[] = [];
      if (result.gmail) {
        messages.push(
          result.gmail.ok
            ? `Gmail +${result.gmail.inserted}${
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
            ? `Calendar +${result.gcal.inserted}`
            : `Calendar failed: ${result.gcal.error ?? "unknown"}`
        );
      }
      // Gmail-not-connected is an expected soft state, not a failure.
      const suggestedFatal =
        !suggested.ok && !/not connected/i.test(suggested.error);
      if (suggested.ok) {
        messages.push(`Suggested +${suggested.created}`);
      } else if (suggestedFatal) {
        messages.push(`Suggested failed: ${suggested.error}`);
      }

      const allOk = result.ok && !suggestedFatal;
      if (allOk) {
        toast.success(messages.join(" · ") || "Sync complete");
      } else {
        toast.error(messages.join(" · ") || "Sync failed");
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setRunning(false);
    }
  };

  const lastSynced = initial
    .map((s) => s.last_synced_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5"
      onClick={handleSync}
      disabled={running}
      title={
        lastSynced
          ? `Last synced ${fmtRelative(lastSynced)} — Gmail, Calendar & suggested contacts`
          : "Sync Gmail, Calendar & suggested contacts"
      }
    >
      {running ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className={cn("h-3.5 w-3.5")} />
      )}
      {running ? "Syncing…" : "Sync"}
    </Button>
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
