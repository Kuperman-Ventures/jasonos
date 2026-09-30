"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncOutreachAll } from "@/lib/server-actions/outreach-sync";
import { checkBrowningHandoffs } from "@/lib/server-actions/browning-networking";
import { scanJobAlerts } from "@/lib/server-actions/job-opportunities";
import { captureEmailCandidates } from "@/lib/server-actions/contact-candidates";
import { captureMeetingFollowups } from "@/lib/server-actions/meeting-followups";
import { captureSentEmailFollowups } from "@/lib/server-actions/sent-followups";
import {
  SUGGESTED_SCAN_DAYS_BACK,
  SUGGESTED_SCAN_DAYS_FORWARD,
} from "@/lib/outreach/suggested-scan";
import { cn } from "@/lib/utils";
import type { OutreachSyncSnapshot } from "@/lib/outreach/data";

export interface SyncNowButtonProps {
  /** Initial sync state from server (used for the button tooltip). */
  initial?: OutreachSyncSnapshot[];
}

export function SyncNowButton({ initial = [] }: SyncNowButtonProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  // One click runs the full capture: Gmail sent + Calendar meetings, and the
  // suggested-contacts email scan — no confirmation modal.
  const handleSync = async () => {
    if (running) return;
    setRunning(true);
    try {
      const runId = crypto.randomUUID();
      const [result, suggested, meetingFollowups, sentFollowups, browning, jobAlerts] =
        await Promise.all([
        syncOutreachAll({
          daysBack: SUGGESTED_SCAN_DAYS_BACK,
          daysForward: SUGGESTED_SCAN_DAYS_FORWARD,
          runId,
        }),
        captureEmailCandidates({
          days: SUGGESTED_SCAN_DAYS_BACK,
          max: 250,
          runId,
        }),
        captureMeetingFollowups({
          runId,
        }),
        captureSentEmailFollowups({
          daysBack: SUGGESTED_SCAN_DAYS_BACK,
          runId,
        }),
        checkBrowningHandoffs(runId),
        scanJobAlerts(runId),
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
        if (result.gcal.ok) {
          messages.push(`Calendar +${result.gcal.inserted}`);
          if (result.gcal.warnings?.length) {
            messages.push(result.gcal.warnings.join(" · "));
          }
        } else {
          messages.push(`Calendar failed: ${result.gcal.error ?? "unknown"}`);
        }
      }
      if (result.gmail?.warnings?.length) {
        messages.push(result.gmail.warnings.join(" · "));
      }
      if (result.outlook) {
        if (result.outlook.unavailable) {
          messages.push(result.outlook.error ?? "Outlook not connected — skipped");
        } else if (result.outlook.ok) {
          messages.push(`Outlook +${result.outlook.inserted}`);
          if (result.outlook.warnings?.length) {
            messages.push(result.outlook.warnings.join(" · "));
          }
        } else {
          messages.push(`Outlook failed: ${result.outlook.error ?? "unknown"}`);
        }
      }
      if (result.beeper) {
        if (result.beeper.unavailable) {
          // Soft skip — Beeper Desktop closed, unreachable, or not configured.
          messages.push(result.beeper.error ?? "No Beeper data synced");
        } else if (result.beeper.ok) {
          if (result.beeper.inserted > 0) {
            messages.push(`Beeper +${result.beeper.inserted}`);
          } else if (result.beeper.error) {
            // Reachable but nothing useful imported — surface why.
            messages.push(result.beeper.error);
          } else {
            messages.push(`Beeper +0`);
          }
        } else {
          messages.push(`Beeper failed: ${result.beeper.error ?? "unknown"}`);
        }
      }
      // Gmail-not-connected is an expected soft state, not a failure.
      const suggestedFatal =
        !suggested.ok && !/not connected/i.test(suggested.error);
      if (suggested.ok) {
        const staged =
          (result.gmail?.candidatesStaged ?? 0) +
          (result.gcal?.candidatesStaged ?? 0) +
          (result.outlook?.ok && !result.outlook.unavailable
            ? (result.outlook.candidatesStaged ?? 0)
            : 0) +
          suggested.created;
        messages.push(`Suggested +${staged}`);
      } else if (suggestedFatal) {
        messages.push(`Suggested failed: ${suggested.error}`);
      }
      let jobAlertsFatal = false;
      if (jobAlerts.ok) {
        messages.push(`Job alerts +${jobAlerts.inserted}`);
      } else {
        jobAlertsFatal = true;
        messages.push(`Job alerts failed: ${jobAlerts.error}`);
      }

      let browningFatal = false;
      if (browning.ok) {
        const bits = [`+${browning.created} handoff${browning.created === 1 ? "" : "s"}`];
        if (browning.followUps) {
          bits.push(`${browning.followUps} follow-up${browning.followUps === 1 ? "" : "s"}`);
        }
        if (browning.preps) bits.push(`${browning.preps} meeting prep`);
        messages.push(`Browning ${bits.join(", ")}`);
      } else {
        browningFatal = true;
        messages.push(`Browning failed: ${browning.error}`);
      }

      let followUpFatal = false;
      if (meetingFollowups.ok) {
        const bits = [`+${meetingFollowups.created} meeting${meetingFollowups.created === 1 ? "" : "s"}`];
        if (meetingFollowups.resolved) {
          bits.push(`${meetingFollowups.resolved} cleared`);
        }
        messages.push(`Meeting Follow Up ${bits.join(", ")}`);
      } else if (meetingFollowups.unavailable) {
        messages.push(meetingFollowups.error);
      } else {
        followUpFatal = true;
        messages.push(`Meeting Follow Up failed: ${meetingFollowups.error}`);
      }

      if (sentFollowups.ok) {
        messages.push(
          `Sent Follow Up +${sentFollowups.created} to review · ${sentFollowups.scanned} threads`
        );
      } else if (sentFollowups.unavailable) {
        messages.push(sentFollowups.error);
      } else {
        followUpFatal = true;
        messages.push(`Sent Follow Up failed: ${sentFollowups.error}`);
      }

      const beeperFatal = Boolean(
        result.beeper && !result.beeper.ok && !result.beeper.unavailable
      );
      const outlookFatal = Boolean(
        result.outlook && !result.outlook.ok && !result.outlook.unavailable
      );
      const allOk =
        result.ok &&
        !suggestedFatal &&
        !beeperFatal &&
        !outlookFatal &&
        !followUpFatal &&
        !browningFatal &&
        !jobAlertsFatal;
      const mailboxWarning = Boolean(
        result.gcal?.warnings?.length ||
          result.gmail?.warnings?.length ||
          result.outlook?.warnings?.length
      );
      const anyMailboxOk =
        (result.gmail?.ok ?? false) ||
        (result.gcal?.ok ?? false) ||
        Boolean(result.outlook?.ok && !result.outlook.unavailable);
      // Beeper or Outlook soft-skip alone shouldn't flip a successful mailbox
      // sync into an error toast — surface it in the success line instead.
      const softOnlyMiss =
        (Boolean(result.beeper?.unavailable) || Boolean(result.outlook?.unavailable)) &&
        !beeperFatal &&
        !outlookFatal &&
        !suggestedFatal &&
        !followUpFatal &&
        !browningFatal &&
        !jobAlertsFatal &&
        anyMailboxOk;
      if ((allOk || softOnlyMiss) && mailboxWarning) {
        toast.warning(messages.join(" · ") || "Sync finished with a warning");
      } else if (allOk || softOnlyMiss) {
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
      className="h-10 gap-1.5"
      onClick={handleSync}
      disabled={running}
      title={
        lastSynced
          ? `Last synced ${fmtRelative(lastSynced)} — Gmail, Outlook, Calendar, Follow Up, job alerts, Browning handoffs, Beeper (when open) & suggested contacts`
          : "Sync Gmail, Outlook, Calendar, Follow Up, job alerts, Browning handoffs, Beeper (when Desktop is open) & suggested contacts"
      }
    >
      {running ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <RefreshCw className={cn("h-5 w-5")} />
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
