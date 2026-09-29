"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MeetingFollowupControls } from "@/components/jasonos/outreach/meeting-followup-controls";
import {
  completeMeetingFollowup,
  dismissMeetingFollowup,
  draftMeetingFollowupMailto,
  snoozeMeetingFollowup,
  type MeetingFollowup,
} from "@/lib/server-actions/meeting-followups";

function agoLabel(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function MeetingFollowupsClient({
  rows,
  calendarConnected,
}: {
  rows: MeetingFollowup[];
  calendarConnected: boolean;
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
      toast.error(result.error ?? "Couldn't update that follow-up.");
      return;
    }
    router.refresh();
  };

  const openDraft = async (id: string) => {
    setBusyId(id);
    const result = await draftMeetingFollowupMailto(id);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    window.location.href = result.mailtoUrl;
    toast.success(
      result.granola
        ? "Draft ready from Granola — review in Apple Mail"
        : "Draft ready — add notes from the call, then send from Apple Mail"
    );
    router.refresh();
  };

  if (!calendarConnected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Mail className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Follow Up</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect Google Calendar in Settings, then hit Sync. Past meetings
          without a post-meeting email show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Follow Up</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Past calendar meetings where one or more attendees still need an
          email. Draft uses the Granola note when one exists.
        </p>
      </div>
      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No open meeting follow-ups. Sync again after your next call.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y">
          {visible.map((row) => (
            <li key={row.id} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{row.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {agoLabel(row.endsAt)}
                  {row.status === "snoozed" && row.snoozeUntil
                    ? ` · snoozed to ${row.snoozeUntil}`
                    : ""}
                </p>
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Needs email: {row.pendingLine || "attendees"}
              </p>
              {row.granolaSummary ? (
                <p className="mt-2 line-clamp-3 text-[12px] text-muted-foreground">
                  {row.granolaSummary}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => void openDraft(row.id)}
                >
                  Draft follow-up
                </Button>
                {row.calendarUrl ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    render={
                      <a href={row.calendarUrl} target="_blank" rel="noreferrer" />
                    }
                  >
                    Calendar
                  </Button>
                ) : null}
                {row.granolaUrl ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    render={
                      <a href={row.granolaUrl} target="_blank" rel="noreferrer" />
                    }
                  >
                    Granola
                  </Button>
                ) : null}
              </div>
              <div className="mt-2">
                <MeetingFollowupControls
                  busy={busyId === row.id}
                  onDone={() => void run(row.id, () => completeMeetingFollowup(row.id))}
                  onSnooze={(days) =>
                    void run(row.id, () => snoozeMeetingFollowup(row.id, days))
                  }
                  onDismiss={() => void run(row.id, () => dismissMeetingFollowup(row.id))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
