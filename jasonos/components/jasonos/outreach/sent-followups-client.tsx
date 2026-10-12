"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { SentFollowupControls } from "@/components/jasonos/outreach/sent-followup-controls";
import { SentThreadPanel } from "@/components/jasonos/outreach/sent-thread-panel";
import {
  completeSentEmailFollowup,
  dismissSentEmailFollowup,
  scheduleSentEmailFollowup,
  type SentEmailFollowup,
} from "@/lib/server-actions/sent-followups";

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
  if (email.includes("jasonkuperman") || email.includes("jskuperman")) return "Gmail";
  if (email.includes("outlook")) return "Outlook";
  return email;
}

export function SentFollowupsClient({
  rows,
  dueRows,
  mailConnected,
}: {
  rows: SentEmailFollowup[];
  dueRows: SentEmailFollowup[];
  mailConnected: boolean;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const visibleDue = dueRows.filter((row) => !hidden.has(row.id));
  const visiblePick = rows.filter((row) => !hidden.has(row.id));
  const totalVisible = visibleDue.length + visiblePick.length;

  const run = async (id: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
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
      toast.error(result.error ?? "Couldn't update that email.");
      return;
    }
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
    <div className="mx-auto max-w-3xl px-4">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 shrink-0" />
          <h2 className="text-lg font-semibold tracking-tight">Email follow-ups</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Outbound from Advisors Gmail, personal Gmail, and Outlook to a JasonOS
          contact. Due rows need a reply; new rows still need a follow-up day.
          Sync pulls new ones and clears threads that already got a reply. Home
          shows this same queue.
        </p>
      </header>

      {!mailConnected ? (
        <div className="mb-4 rounded-lg border border-[var(--jos-line)] bg-rung-2 px-4 py-3 text-xs text-rung-ink">
          Connect a mail account in Settings, then hit Sync to stage sent mail.
        </div>
      ) : null}

      <div className="rounded-lg border bg-card">
        {totalVisible === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {mailConnected
              ? "No sent emails waiting for a follow-up day. Hit Sync to look again."
              : "Connect mail, then hit Sync."}
          </div>
        ) : (
          <div>
            {visibleDue.length > 0 ? (
              <div>
                <h3 className="border-b bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Due to follow up · {visibleDue.length}
                </h3>
                <ul className="divide-y">
                  {visibleDue.map((row) => (
                    <li key={row.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
                                void run(row.id, () => scheduleSentEmailFollowup(row.id, days))
                              }
                              onDone={() =>
                                void run(row.id, () => completeSentEmailFollowup(row.id))
                              }
                              onDismiss={() =>
                                void run(row.id, () => dismissSentEmailFollowup(row.id))
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
                <h3 className="border-b bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Pick a follow-up day · {visiblePick.length}
                </h3>
                <ul className="divide-y">
                  {visiblePick.map((row) => (
                    <li key={row.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
                                void run(row.id, () => scheduleSentEmailFollowup(row.id, days))
                              }
                              onDismiss={() =>
                                void run(row.id, () => dismissSentEmailFollowup(row.id))
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
        )}
      </div>
    </div>
  );
}
