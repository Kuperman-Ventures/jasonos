"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { SentFollowupControls } from "@/components/jasonos/outreach/sent-followup-controls";
import { SentThreadPanel } from "@/components/jasonos/outreach/sent-thread-panel";
import {
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

export function SentFollowupsClient({
  rows,
  advisorsConnected,
}: {
  rows: SentEmailFollowup[];
  advisorsConnected: boolean;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const visible = rows.filter((row) => !hidden.has(row.id));

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

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Sent mail</h1>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          Emails sent from jason@kupermanadvisors.com. Sync in the top bar
          pulls new ones. Open a row to read the thread, then set a follow-up
          for 1, 3, or 5 days, or type your own number. Home shows it on that day.
        </p>
      </header>

      {!advisorsConnected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs text-amber-200">
            Advisors Google isn&rsquo;t connected, so Sync can&rsquo;t read sent mail.
          </p>
          <a
            href="/api/auth/google"
            className="shrink-0 rounded-md border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-500/30"
          >
            Connect Advisors Google →
          </a>
        </div>
      ) : null}

      <div className="rounded-lg border bg-card">
        {visible.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {advisorsConnected
              ? "No sent emails waiting. Hit Sync in the top bar to look for new ones."
              : "Connect Advisors Google, then hit Sync to see sent mail."}
          </div>
        ) : (
          <ul className="divide-y">
            {visible.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.subject}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      To {row.toLine}
                      {row.sentAt ? ` · sent ${sentLabel(row.sentAt)}` : ""}
                    </p>
                    {row.snippet ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.snippet}</p>
                    ) : null}
                    <SentThreadPanel followupId={row.id} gmailUrl={row.gmailUrl} />
                    <div className="mt-2">
                      <SentFollowupControls
                        busy={busyId === row.id}
                        onSchedule={(days) =>
                          void run(row.id, () => scheduleSentEmailFollowup(row.id, days))
                        }
                        onDismiss={() => void run(row.id, () => dismissSentEmailFollowup(row.id))}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
