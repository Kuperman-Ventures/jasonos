"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RefreshCw,
  Loader2,
  Check,
  X,
  Minus,
  Mail,
  Calendar,
  MessageSquare,
  Users,
  Briefcase,
  Handshake,
  Send,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  syncOutreachFromGmail,
  syncOutreachFromCalendar,
  syncOutreachFromBeeper,
  syncOutreachFromOutlook,
  listSyncTargets,
  type SyncResult,
} from "@/lib/server-actions/outreach-sync";
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

type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

type SyncStep = {
  id: string;
  label: string;
  detail?: string;
  group: "mail" | "other";
  icon: ComponentType<{ className?: string }>;
  status: StepStatus;
  resultText?: string;
};

function stepFromResult(
  result: SyncResult | null | undefined,
  opts?: { softUnavailable?: boolean }
): { status: StepStatus; resultText?: string } {
  if (!result) return { status: "failed", resultText: "No response" };
  if (result.unavailable || opts?.softUnavailable) {
    return {
      status: "skipped",
      resultText: result.error ?? "Skipped",
    };
  }
  if (!result.ok) {
    return { status: "failed", resultText: result.error ?? "Failed" };
  }
  const bits: string[] = [];
  if (typeof result.inserted === "number") bits.push(`+${result.inserted}`);
  if (result.cadenceUpdates) bits.push(`advanced ${result.cadenceUpdates}`);
  if (result.candidatesStaged) bits.push(`${result.candidatesStaged} staged`);
  if (result.warnings?.length) bits.push(result.warnings[0]!);
  return {
    status: "done",
    resultText: bits.join(" · ") || "Up to date",
  };
}

export function SyncNowButton({ initial = [] }: SyncNowButtonProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [steps, setSteps] = useState<SyncStep[]>([]);
  const [focusLabel, setFocusLabel] = useState("Syncing…");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // Cycle the button label through whichever lanes are still running.
  useEffect(() => {
    if (!running) return;
    const active = steps.filter((s) => s.status === "running");
    if (active.length === 0) {
      setFocusLabel("Finishing…");
      return;
    }
    let i = 0;
    setFocusLabel(active[0]!.label);
    if (active.length === 1) return;
    const id = setInterval(() => {
      i = (i + 1) % active.length;
      setFocusLabel(active[i]!.label);
    }, 1100);
    return () => clearInterval(id);
  }, [running, steps]);

  const progress = useMemo(() => {
    if (steps.length === 0) return 0;
    const finished = steps.filter((s) => s.status !== "pending" && s.status !== "running")
      .length;
    return Math.round((finished / steps.length) * 100);
  }, [steps]);

  const patchStep = (
    id: string,
    patch: Partial<Pick<SyncStep, "status" | "resultText" | "detail">>
  ) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const handleSync = async () => {
    if (running) return;
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setRunning(true);
    setPanelOpen(true);
    setFocusLabel("Starting…");

    try {
      const targets = await listSyncTargets();
      const runId = crypto.randomUUID();

      const mailSteps: SyncStep[] = [
        ...targets.gmailAccounts.map((a) => ({
          id: `gmail:${a.email}`,
          label: a.label,
          detail: a.email,
          group: "mail" as const,
          icon: Mail,
          status: "running" as const,
        })),
        ...(targets.outlook
          ? [
              {
                id: "outlook",
                label: "Outlook",
                detail: targets.outlook.email,
                group: "mail" as const,
                icon: Mail,
                status: "running" as const,
              },
            ]
          : []),
      ];
      if (mailSteps.length === 0) {
        mailSteps.push({
          id: "gmail:none",
          label: "Gmail",
          detail: "No mailbox connected",
          group: "mail",
          icon: Mail,
          status: "running",
        });
      }

      const otherSteps: SyncStep[] = [
        {
          id: "gcal",
          label: "Calendar",
          group: "other",
          icon: Calendar,
          status: "running",
        },
        {
          id: "beeper",
          label: "Beeper",
          group: "other",
          icon: MessageSquare,
          status: "running",
        },
        {
          id: "sent-followups",
          label: "Sent Follow Up",
          group: "other",
          icon: Send,
          status: "running",
        },
        {
          id: "meeting-followups",
          label: "Meeting Follow Up",
          group: "other",
          icon: CalendarClock,
          status: "running",
        },
        {
          id: "suggested",
          label: "Suggested contacts",
          group: "other",
          icon: Users,
          status: "running",
        },
        {
          id: "job-alerts",
          label: "Job alerts",
          group: "other",
          icon: Briefcase,
          status: "running",
        },
        {
          id: "browning",
          label: "Browning handoffs",
          group: "other",
          icon: Handshake,
          status: "running",
        },
      ];

      setSteps([...mailSteps, ...otherSteps]);

      const gmailJobs =
        targets.gmailAccounts.length > 0
          ? targets.gmailAccounts.map(async (account) => {
              const result = await syncOutreachFromGmail({
                daysBack: SUGGESTED_SCAN_DAYS_BACK,
                runId,
                accountEmail: account.email,
              });
              const next = stepFromResult(result);
              patchStep(`gmail:${account.email}`, next);
              return result;
            })
          : [
              (async () => {
                const result = await syncOutreachFromGmail({
                  daysBack: SUGGESTED_SCAN_DAYS_BACK,
                  runId,
                });
                const next = stepFromResult(result);
                patchStep("gmail:none", next);
                return result;
              })(),
            ];

      const outlookJob = targets.outlook
        ? (async () => {
            const result = await syncOutreachFromOutlook({
              daysBack: SUGGESTED_SCAN_DAYS_BACK,
              runId,
            });
            patchStep("outlook", stepFromResult(result));
            return result;
          })()
        : Promise.resolve(null);

      const gcalJob = (async () => {
        const result = await syncOutreachFromCalendar({
          daysBack: SUGGESTED_SCAN_DAYS_BACK,
          daysForward: SUGGESTED_SCAN_DAYS_FORWARD,
          runId,
        });
        patchStep("gcal", stepFromResult(result));
        return result;
      })();

      const beeperJob = (async () => {
        const result = await syncOutreachFromBeeper({ runId });
        patchStep("beeper", stepFromResult(result));
        return result;
      })();

      const suggestedJob = (async () => {
        const result = await captureEmailCandidates({
          days: SUGGESTED_SCAN_DAYS_BACK,
          max: 250,
          runId,
        });
        if (result.ok) {
          patchStep("suggested", {
            status: "done",
            resultText: `+${result.created}`,
          });
        } else if (/not connected/i.test(result.error)) {
          patchStep("suggested", {
            status: "skipped",
            resultText: result.error,
          });
        } else {
          patchStep("suggested", {
            status: "failed",
            resultText: result.error,
          });
        }
        return result;
      })();

      const meetingJob = (async () => {
        const result = await captureMeetingFollowups({ runId });
        if (result.ok) {
          const bits = [
            `+${result.created} follow-up${result.created === 1 ? "" : "s"}`,
          ];
          if (result.resolved) bits.push(`${result.resolved} cleared`);
          patchStep("meeting-followups", {
            status: "done",
            resultText: bits.join(", "),
          });
        } else if (result.unavailable) {
          patchStep("meeting-followups", {
            status: "skipped",
            resultText: result.error,
          });
        } else {
          patchStep("meeting-followups", {
            status: "failed",
            resultText: result.error,
          });
        }
        return result;
      })();

      const sentJob = (async () => {
        const result = await captureSentEmailFollowups({
          daysBack: SUGGESTED_SCAN_DAYS_BACK,
          runId,
        });
        if (result.ok) {
          const bits = [
            `+${result.created} to review`,
            `${result.scanned} threads`,
          ];
          if ("resolved" in result && result.resolved) {
            bits.push(`${result.resolved} cleared`);
          }
          patchStep("sent-followups", {
            status: "done",
            resultText: bits.join(" · "),
          });
        } else if (result.unavailable) {
          patchStep("sent-followups", {
            status: "skipped",
            resultText: result.error,
          });
        } else {
          patchStep("sent-followups", {
            status: "failed",
            resultText: result.error,
          });
        }
        return result;
      })();

      const browningJob = (async () => {
        const result = await checkBrowningHandoffs(runId);
        if (result.ok) {
          const bits = [
            `+${result.created} handoff${result.created === 1 ? "" : "s"}`,
          ];
          if (result.followUps) {
            bits.push(
              `${result.followUps} follow-up${result.followUps === 1 ? "" : "s"}`
            );
          }
          if (result.preps) bits.push(`${result.preps} meeting prep`);
          patchStep("browning", {
            status: "done",
            resultText: bits.join(", "),
          });
        } else {
          patchStep("browning", {
            status: "failed",
            resultText: result.error,
          });
        }
        return result;
      })();

      const jobAlertsJob = (async () => {
        const result = await scanJobAlerts(runId);
        if (result.ok) {
          patchStep("job-alerts", {
            status: "done",
            resultText: `+${result.inserted}`,
          });
        } else {
          patchStep("job-alerts", {
            status: "failed",
            resultText: result.error,
          });
        }
        return result;
      })();

      const [
        gmailResults,
        outlook,
        gcal,
        beeper,
        suggested,
        meetingFollowups,
        sentFollowups,
        browning,
        jobAlerts,
      ] = await Promise.all([
        Promise.all(gmailJobs),
        outlookJob,
        gcalJob,
        beeperJob,
        suggestedJob,
        meetingJob,
        sentJob,
        browningJob,
        jobAlertsJob,
      ]);

      const gmailOk = gmailResults.some((r) => r.ok);
      const gmailInserted = gmailResults.reduce((n, r) => n + (r.inserted ?? 0), 0);
      const gmailCadence = gmailResults.reduce(
        (n, r) => n + (r.cadenceUpdates ?? 0),
        0
      );
      const gmailStaged = gmailResults.reduce(
        (n, r) => n + (r.candidatesStaged ?? 0),
        0
      );
      const gmailWarnings = gmailResults.flatMap((r) => r.warnings ?? []);
      const gmailErrors = gmailResults
        .filter((r) => !r.ok)
        .map((r) => r.error)
        .filter(Boolean) as string[];

      const messages: string[] = [];
      if (gmailResults.length) {
        if (gmailOk) {
          messages.push(
            `Gmail +${gmailInserted}${
              gmailCadence ? `, advanced ${gmailCadence}` : ""
            }`
          );
        } else {
          messages.push(
            `Gmail failed: ${gmailErrors[0] ?? "unknown"}`
          );
        }
      }
      if (gcal) {
        if (gcal.ok) {
          messages.push(`Calendar +${gcal.inserted}`);
          if (gcal.warnings?.length) {
            messages.push(gcal.warnings.join(" · "));
          }
        } else {
          messages.push(`Calendar failed: ${gcal.error ?? "unknown"}`);
        }
      }
      if (gmailWarnings.length) {
        messages.push(gmailWarnings.join(" · "));
      }
      if (outlook) {
        if (outlook.unavailable) {
          messages.push(outlook.error ?? "Outlook not connected — skipped");
        } else if (outlook.ok) {
          messages.push(`Outlook +${outlook.inserted}`);
          if (outlook.warnings?.length) {
            messages.push(outlook.warnings.join(" · "));
          }
        } else {
          messages.push(`Outlook failed: ${outlook.error ?? "unknown"}`);
        }
      }
      if (beeper) {
        if (beeper.unavailable) {
          messages.push(beeper.error ?? "No Beeper data synced");
        } else if (beeper.ok) {
          if (beeper.inserted > 0) {
            messages.push(`Beeper +${beeper.inserted}`);
          } else if (beeper.error) {
            messages.push(beeper.error);
          } else {
            messages.push(`Beeper +0`);
          }
        } else {
          messages.push(`Beeper failed: ${beeper.error ?? "unknown"}`);
        }
      }
      const suggestedFatal =
        !suggested.ok && !/not connected/i.test(suggested.error);
      if (suggested.ok) {
        const staged =
          gmailStaged +
          (gcal?.candidatesStaged ?? 0) +
          (outlook?.ok && !outlook.unavailable
            ? (outlook.candidatesStaged ?? 0)
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
        const bits = [
          `+${browning.created} handoff${browning.created === 1 ? "" : "s"}`,
        ];
        if (browning.followUps) {
          bits.push(
            `${browning.followUps} follow-up${browning.followUps === 1 ? "" : "s"}`
          );
        }
        if (browning.preps) bits.push(`${browning.preps} meeting prep`);
        messages.push(`Browning ${bits.join(", ")}`);
      } else {
        browningFatal = true;
        messages.push(`Browning failed: ${browning.error}`);
      }

      let meetingFollowUpFatal = false;
      if (meetingFollowups.ok) {
        const bits = [
          `+${meetingFollowups.created} follow-up${
            meetingFollowups.created === 1 ? "" : "s"
          }`,
        ];
        if (meetingFollowups.resolved) {
          bits.push(`${meetingFollowups.resolved} cleared`);
        }
        messages.push(`Meeting Follow Up ${bits.join(", ")}`);
      } else if (meetingFollowups.unavailable) {
        messages.push(meetingFollowups.error);
      } else {
        meetingFollowUpFatal = true;
        messages.push(`Meeting Follow Up failed: ${meetingFollowups.error}`);
      }

      let sentFollowUpFatal = false;
      if (sentFollowups.ok) {
        const bits = [
          `+${sentFollowups.created} to review`,
          `${sentFollowups.scanned} threads`,
        ];
        if ("resolved" in sentFollowups && sentFollowups.resolved) {
          bits.push(`${sentFollowups.resolved} cleared`);
        }
        messages.push(`Sent Follow Up ${bits.join(" · ")}`);
      } else if (sentFollowups.unavailable) {
        messages.push(sentFollowups.error);
      } else {
        sentFollowUpFatal = true;
        messages.push(`Sent Follow Up failed: ${sentFollowups.error}`);
      }

      const beeperFatal = Boolean(beeper && !beeper.ok && !beeper.unavailable);
      const outlookFatal = Boolean(
        outlook && !outlook.ok && !outlook.unavailable
      );
      const mailboxOk =
        gmailOk ||
        (gcal?.ok ?? false) ||
        Boolean(outlook?.ok && !outlook.unavailable);
      const allOk =
        mailboxOk &&
        !suggestedFatal &&
        !beeperFatal &&
        !outlookFatal &&
        !meetingFollowUpFatal &&
        !sentFollowUpFatal &&
        !browningFatal &&
        !jobAlertsFatal;
      const mailboxWarning = Boolean(
        gcal?.warnings?.length || gmailWarnings.length || outlook?.warnings?.length
      );
      const softOnlyMiss =
        (Boolean(beeper?.unavailable) || Boolean(outlook?.unavailable)) &&
        !beeperFatal &&
        !outlookFatal &&
        !suggestedFatal &&
        !meetingFollowUpFatal &&
        !sentFollowUpFatal &&
        !browningFatal &&
        !jobAlertsFatal &&
        mailboxOk;

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
      setFocusLabel("Sync");
      hideTimer.current = setTimeout(() => {
        setPanelOpen(false);
      }, 2800);
    }
  };

  const lastSynced = initial
    .map((s) => s.last_synced_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  const mailSteps = steps.filter((s) => s.group === "mail");
  const otherSteps = steps.filter((s) => s.group === "other");

  return (
    <div className="relative">
      <Button
        variant="outline"
        className="h-10 gap-1.5"
        onClick={handleSync}
        disabled={running}
        title={
          lastSynced
            ? `Last synced ${fmtRelative(lastSynced)} — Gmail, Outlook, Calendar, Meeting Follow Up, Sent Follow Up, job alerts, Browning handoffs, Beeper (when open) & suggested contacts`
            : "Sync Gmail, Outlook, Calendar, Meeting Follow Up, Sent Follow Up, job alerts, Browning handoffs, Beeper (when Desktop is open) & suggested contacts"
        }
      >
        {running ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <RefreshCw className="h-5 w-5" />
        )}
        <span className="max-w-[9.5rem] truncate">
          {running ? focusLabel : "Sync"}
        </span>
      </Button>

      {panelOpen && steps.length > 0 && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[22rem] origin-top-right animate-in fade-in-0 zoom-in-95 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          role="status"
          aria-live="polite"
        >
          <style>{`
            @keyframes jos-sync-slide {
              0% { transform: translateX(-120%); }
              100% { transform: translateX(240%); }
            }
          `}</style>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold tracking-tight">
                {running ? "Syncing accounts & sources" : "Sync complete"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {running
                  ? "Working through each mailbox and capture lane"
                  : "Latest results from this run"}
              </p>
            </div>
            <span className="tabular-nums text-[11px] text-muted-foreground">
              {progress}%
            </span>
          </div>

          <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/80 transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {mailSteps.length > 0 && (
            <StepGroup title="Emails & accounts" steps={mailSteps} />
          )}
          {otherSteps.length > 0 && (
            <StepGroup
              title="Also capturing"
              steps={otherSteps}
              className="mt-2.5"
            />
          )}
        </div>
      )}
    </div>
  );
}

function StepGroup({
  title,
  steps,
  className,
}: {
  title: string;
  steps: SyncStep[];
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {steps.map((step) => (
          <SyncStepRow key={step.id} step={step} />
        ))}
      </ul>
    </div>
  );
}

function SyncStepRow({ step }: { step: SyncStep }) {
  const Icon = step.icon;
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors",
        step.status === "running" && "bg-muted/60",
        step.status === "done" && "bg-transparent",
        step.status === "failed" && "bg-destructive/5"
      )}
    >
      <StatusGlyph status={step.status} />
      <Icon
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          step.status === "running"
            ? "text-foreground"
            : "text-muted-foreground"
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs font-medium",
              step.status === "pending" && "text-muted-foreground"
            )}
          >
            {step.label}
          </p>
          {step.resultText && step.status !== "running" && (
            <p
              className={cn(
                "shrink-0 text-[10px]",
                step.status === "failed"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {truncate(step.resultText, 28)}
            </p>
          )}
        </div>
        {step.detail && (
          <p className="truncate text-[10px] text-muted-foreground">
            {step.detail}
          </p>
        )}
        {step.status === "running" && (
          <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-[jos-sync-slide_1.1s_ease-in-out_infinite] rounded-full bg-foreground/50" />
          </div>
        )}
      </div>
      <style>{`
        @keyframes jos-sync-slide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(240%); }
        }
      `}</style>
    </li>
  );
}

function StatusGlyph({ status }: { status: StepStatus }) {
  if (status === "running") {
    return (
      <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center">
        <span className="h-2 w-2 animate-pulse rounded-full bg-foreground" />
      </span>
    );
  }
  if (status === "done") {
    return <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  }
  if (status === "failed") {
    return <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />;
  }
  if (status === "skipped") {
    return <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }
  return (
    <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
    </span>
  );
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
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
