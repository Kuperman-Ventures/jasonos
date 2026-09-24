"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { SentFollowupControls } from "@/components/jasonos/outreach/sent-followup-controls";
import { SentThreadPanel } from "@/components/jasonos/outreach/sent-thread-panel";
import {
  completeSentEmailFollowup,
  scheduleSentEmailFollowup,
  type SentEmailFollowup,
} from "@/lib/server-actions/sent-followups";

function dueText(row: SentEmailFollowup): string {
  if (row.daysOverdue <= 0) return "due today";
  if (row.daysOverdue === 1) return "1 day overdue";
  return `${row.daysOverdue} days overdue`;
}

export function SentFollowupsPanel({ rows }: { rows: SentEmailFollowup[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const visible = rows.filter((row) => !hidden.has(row.id));

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
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 bg-sky-700/80 px-4 py-2.5 text-white">
        <Mail className="h-4 w-4" />
        <h2 className="text-sm font-semibold tracking-tight">Email follow-ups</h2>
        <span className="ml-auto rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-medium tabular-nums">
          {visible.length}
        </span>
      </div>
      <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
        Sent from jason@kupermanadvisors.com and due for a follow-up. Open the
        thread, mark it done, or push the date.
      </p>
      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No sent emails due for a follow-up.
        </p>
      ) : (
        <ul className="max-h-[calc(10*5.5rem)] divide-y divide-border overflow-y-auto overscroll-contain">
          {visible.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <p className="truncate text-sm font-medium">{row.subject}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                To {row.toLine}
                <span className={row.daysOverdue > 0 ? "ml-1.5 text-red-300" : "ml-1.5 text-amber-300"}>
                  {dueText(row)}
                </span>
              </p>
              <SentThreadPanel followupId={row.id} gmailUrl={row.gmailUrl} />
              <div className="mt-2">
                <SentFollowupControls
                  busy={busyId === row.id}
                  onDone={() =>
                    void run(row.id, () => completeSentEmailFollowup(row.id), "Follow-up marked done")
                  }
                  onSchedule={(days) =>
                    void run(
                      row.id,
                      () => scheduleSentEmailFollowup(row.id, days),
                      `Follow-up moved to ${days} day${days === 1 ? "" : "s"}`
                    )
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
