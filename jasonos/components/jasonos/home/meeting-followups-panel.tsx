"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown } from "lucide-react";
import { StatusBand, StatusPill } from "@/components/jasonos/brand/status";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MeetingFollowupControls } from "@/components/jasonos/outreach/meeting-followup-controls";
import {
  completeMeetingFollowup,
  draftMeetingFollowupMailto,
  snoozeMeetingFollowup,
  type MeetingFollowup,
} from "@/lib/server-actions/meeting-followups";

const STORAGE_KEY = "jasonos.meeting-followups.collapsed";

function agoText(row: MeetingFollowup): string {
  if (row.daysAgo <= 0) return "earlier today";
  if (row.daysAgo === 1) return "1 day ago";
  return `${row.daysAgo} days ago`;
}

export function MeetingFollowupsPanel({ rows }: { rows: MeetingFollowup[] }) {
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
        ? "Draft ready from the Granola note — review in Apple Mail"
        : "Draft ready — review in Apple Mail before you send"
    );
    router.refresh();
  };

  return (
    <section className="overflow-hidden">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={
          collapsed ? "Expand Meeting follow-ups" : "Collapse Meeting follow-ups"
        }
        className="w-full text-left"
      >
        {/* Green, not the teal on Email follow-ups. */}
        <StatusBand rung="ok">
          <Calendar className="h-5 w-5" />
          <h2 className="text-[17px] font-bold tracking-tight">
            Meeting follow-ups
          </h2>
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
            Past meetings with a JasonOS contact where you have not emailed one
            or more attendees since. Draft pulls Granola and opens Apple Mail —
            nothing sends itself.
          </p>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No meeting follow-ups waiting.
            </p>
          ) : (
            <ul className="max-h-[calc(10*5.5rem)] divide-y divide-border overflow-y-auto overscroll-contain">
              {visible.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    With {row.pendingLine || "attendees"}
                    <span className="ml-1.5 text-rung-ink">{agoText(row)}</span>
                  </p>
                  {row.granolaSummary ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {row.granolaSummary}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ok"
                      disabled={busyId === row.id}
                      onClick={() => void openDraft(row.id)}
                    >
                      Draft follow-up
                    </Button>
                    {row.calendarUrl ? (
                      <Button
                        size="sm"
                        variant="okGhost"
                        render={
                          <a
                            href={row.calendarUrl}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        Calendar
                      </Button>
                    ) : null}
                    {row.granolaUrl ? (
                      <Button
                        size="sm"
                        variant="okGhost"
                        render={
                          <a
                            href={row.granolaUrl}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        Granola
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <MeetingFollowupControls
                      busy={busyId === row.id}
                      onDone={() =>
                        void run(
                          row.id,
                          () => completeMeetingFollowup(row.id),
                          "Follow-up marked done"
                        )
                      }
                      onSnooze={(days) =>
                        void run(
                          row.id,
                          () => snoozeMeetingFollowup(row.id, days),
                          `Remind again in ${days} day${days === 1 ? "" : "s"}`
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
