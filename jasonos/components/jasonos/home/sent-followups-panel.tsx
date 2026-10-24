"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Mail } from "lucide-react";
import { DomainBand, StatusPill } from "@/components/jasonos/brand/status";
import { toast } from "sonner";
import { SentFollowupControls } from "@/components/jasonos/outreach/sent-followup-controls";
import { SentThreadPanel } from "@/components/jasonos/outreach/sent-thread-panel";
import {
  completeSentEmailFollowup,
  dismissSentEmailFollowup,
  scheduleSentEmailFollowup,
  type SentEmailFollowup,
} from "@/lib/server-actions/sent-followups";

const STORAGE_KEY = "jasonos.sent-followups.collapsed";

function sentLabel(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function dueLabel(ymd: string | null): string {
  if (!ymd) return "";
  const t = Date.parse(`${ymd}T12:00:00`);
  if (!Number.isFinite(t)) return ymd;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function accountShort(email: string): string {
  if (email.includes("kupermanadvisors")) return "Advisors";
  if (email.includes("jskuperman")) return "Gmail";
  if (email.includes("outlook")) return "Outlook";
  return email;
}

/**
 * Home mirror of Networking → Follow Up email queue.
 * Two groups: scheduled rows that are due ("Due to follow up"), and new rows
 * waiting for a day ("Pick a follow-up day"). Same Done / schedule / dismiss
 * actions as the Follow Up page.
 */
export function SentFollowupsPanel({
  rows,
  dueRows,
}: {
  rows: SentEmailFollowup[];
  dueRows: SentEmailFollowup[];
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const visibleDue = dueRows.filter((row) => !hidden.has(row.id));
  const visiblePick = rows.filter((row) => !hidden.has(row.id));
  const totalVisible = visibleDue.length + visiblePick.length;

  useEffect(() => {
    // Keep the queue open when either group has items so Home matches Follow Up.
    if (rows.length > 0 || dueRows.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(false);
      return;
    }
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // private mode / quota
    }
  }, [rows.length, dueRows.length]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const run = async (
    id: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string
  ) => {
    setBusyId(id);
    setHidden((prev) => new Set(prev).add(id));
    const result = await action();
    setBusyId(null);
    if (!result.ok) {
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.error(result.error ?? "Couldn't update that follow-up.");
      return;
    }
    toast.success(success);
    router.refresh();
  };

  const metaLine = (row: SentEmailFollowup) => (
    <p className="truncate text-[11px] text-muted-foreground">
      To {row.toLine}
      {row.sentAt ? ` · sent ${sentLabel(row.sentAt)}` : ""}
      {row.accountEmail ? ` · ${accountShort(row.accountEmail)}` : ""}
    </p>
  );

  return (
    <section className="overflow-hidden">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={
          collapsed ? "Expand Email follow-ups" : "Collapse Email follow-ups"
        }
        className="w-full text-left"
      >
        <DomainBand domain="email">
          <Mail className="h-5 w-5" />
          <h2 className="text-[17px] font-bold tracking-tight">Email follow-ups</h2>
          <StatusPill rung={4} className="ml-auto">
            {totalVisible}
          </StatusPill>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
        </DomainBand>
      </button>

      {!collapsed ? (
        totalVisible === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No sent emails waiting for a follow-up day.
          </p>
        ) : (
          <div className="max-h-[calc(10*5.5rem)] overflow-y-auto overscroll-contain">
            {visibleDue.length > 0 ? (
              <div>
                <h3 className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Due to follow up · {visibleDue.length}
                </h3>
                <ul className="divide-y divide-border">
                  {visibleDue.map((row) => (
                    <li key={row.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-domain-email" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.subject}</p>
                          {metaLine(row)}
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Due {dueLabel(row.followUpDue)}
                            {row.daysOverdue > 0
                              ? ` · ${row.daysOverdue} day${row.daysOverdue === 1 ? "" : "s"} overdue`
                              : ""}
                          </p>
                          {row.snippet ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {row.snippet}
                            </p>
                          ) : null}
                          <SentThreadPanel
                            followupId={row.id}
                            appleMailUrl={row.appleMailUrl}
                          />
                          <div className="mt-2">
                            <SentFollowupControls
                              busy={busyId === row.id}
                              onSchedule={(days) =>
                                void run(
                                  row.id,
                                  () => scheduleSentEmailFollowup(row.id, days),
                                  `Snoozed ${days} day${days === 1 ? "" : "s"}`
                                )
                              }
                              onDone={() =>
                                void run(
                                  row.id,
                                  () => completeSentEmailFollowup(row.id),
                                  "Marked done"
                                )
                              }
                              onDismiss={() =>
                                void run(
                                  row.id,
                                  () => dismissSentEmailFollowup(row.id),
                                  "Dismissed"
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {visiblePick.length > 0 ? (
              <div>
                <h3 className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Pick a follow-up day · {visiblePick.length}
                </h3>
                <ul className="divide-y divide-border">
                  {visiblePick.map((row) => (
                    <li key={row.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-domain-email" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.subject}</p>
                          {metaLine(row)}
                          {row.snippet ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {row.snippet}
                            </p>
                          ) : null}
                          <SentThreadPanel
                            followupId={row.id}
                            appleMailUrl={row.appleMailUrl}
                          />
                          <div className="mt-2">
                            <SentFollowupControls
                              busy={busyId === row.id}
                              onSchedule={(days) =>
                                void run(
                                  row.id,
                                  () => scheduleSentEmailFollowup(row.id, days),
                                  `Follow-up set for ${days} day${days === 1 ? "" : "s"}`
                                )
                              }
                              onDismiss={() =>
                                void run(
                                  row.id,
                                  () => dismissSentEmailFollowup(row.id),
                                  "No follow-up"
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </section>
  );
}
