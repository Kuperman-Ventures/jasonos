"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Mail } from "lucide-react";
import { StatusBand, StatusPill } from "@/components/jasonos/brand/status";
import { toast } from "sonner";
import { SentFollowupControls } from "@/components/jasonos/outreach/sent-followup-controls";
import { SentThreadPanel } from "@/components/jasonos/outreach/sent-thread-panel";
import {
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

function accountShort(email: string): string {
  if (email.includes("kupermanadvisors")) return "Advisors";
  if (email.includes("jasonkuperman") || email.includes("jskuperman")) return "Gmail";
  if (email.includes("outlook")) return "Outlook";
  return email;
}

/**
 * Home mirror of Networking → Follow Up email queue.
 * Same rows (status=new), same schedule / dismiss actions.
 */
export function SentFollowupsPanel({ rows }: { rows: SentEmailFollowup[] }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const visible = rows.filter((row) => !hidden.has(row.id));

  useEffect(() => {
    // Keep the queue open when there are items so Home matches Follow Up.
    if (rows.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(false);
      return;
    }
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // private mode / quota
    }
  }, [rows.length]);

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
        {/* Dark teal. Meeting banners on Home use green. */}
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
            Same queue as Networking → Follow Up. Set 1 / 3 / 5 days, or skip.
            Sync clears threads that already got a reply.
          </p>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No sent emails waiting for a follow-up day.
            </p>
          ) : (
            <ul className="max-h-[calc(10*5.5rem)] divide-y divide-border overflow-y-auto overscroll-contain">
              {visible.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.subject}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        To {row.toLine}
                        {row.sentAt ? ` · sent ${sentLabel(row.sentAt)}` : ""}
                        {row.accountEmail
                          ? ` · ${accountShort(row.accountEmail)}`
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
          )}
        </>
      ) : null}
    </section>
  );
}
