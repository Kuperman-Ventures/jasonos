"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Mail } from "lucide-react";
import { StatusBand, StatusPill } from "@/components/jasonos/brand/status";
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

function statusText(row: SentEmailFollowup): string {
  if (row.status === "new") return "pick a follow-up day";
  if (row.daysOverdue <= 0) return "due today";
  if (row.daysOverdue === 1) return "1 day overdue";
  return `${row.daysOverdue} days overdue`;
}

export function SentFollowupsPanel({ rows }: { rows: SentEmailFollowup[] }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const visible = rows.filter((row) => !hidden.has(row.id));

  useEffect(() => {
    // Read after mount so SSR and first paint match (expanded).
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // private mode / quota
    }
  }, []);

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
        <StatusBand rung={3}>
          <Mail className="h-5 w-5" />
          <h2 className="text-[17px] font-bold tracking-tight">Email follow-ups</h2>
          <StatusPill rung={4} className="ml-auto">
            {visible.length}
          </StatusPill>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
        </StatusBand>
      </button>

      {!collapsed ? (
        <>
          <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
            New sends waiting for a follow-up day, plus ones whose day has
            arrived. Open the thread, set 1 / 3 / 5 days, mark done, or skip.
            Sync clears rows when a reply is detected.
          </p>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No sent emails waiting for a follow-up.
            </p>
          ) : (
            <ul className="max-h-[calc(10*5.5rem)] divide-y divide-border overflow-y-auto overscroll-contain">
              {visible.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <p className="truncate text-sm font-medium">{row.subject}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    To {row.toLine}
                    <span
                      className={
                        row.status !== "new" && row.daysOverdue > 0
                          ? "ml-1.5 text-rung-1"
                          : "ml-1.5 text-rung-ink"
                      }
                    >
                      {statusText(row)}
                    </span>
                  </p>
                  <SentThreadPanel
                    followupId={row.id}
                    appleMailUrl={row.appleMailUrl}
                  />
                  <div className="mt-2">
                    <SentFollowupControls
                      busy={busyId === row.id}
                      onDone={() =>
                        void run(
                          row.id,
                          () => completeSentEmailFollowup(row.id),
                          "Follow-up marked done"
                        )
                      }
                      onDismiss={
                        row.status === "new"
                          ? () =>
                              void run(
                                row.id,
                                () => dismissSentEmailFollowup(row.id),
                                "No follow-up"
                              )
                          : undefined
                      }
                      onSchedule={(days) =>
                        void run(
                          row.id,
                          () => scheduleSentEmailFollowup(row.id, days),
                          row.status === "new"
                            ? `Follow-up set for ${days} day${days === 1 ? "" : "s"}`
                            : `Follow-up moved to ${days} day${days === 1 ? "" : "s"}`
                        )
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
