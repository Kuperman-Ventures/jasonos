"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  confirmSession,
  dismissSession,
} from "@/lib/server-actions/webinars";
import type { WebinarSessionRow } from "@/lib/webinars/store";

function detectionLabel(row: WebinarSessionRow): string {
  if (row.status === "confirmed" && !row.published_at) {
    return "Confirmed, waiting for summary";
  }
  switch (row.detection) {
    case "calendar_and_note":
      return "On calendar with recording";
    case "calendar_only":
      return "On calendar, no recording";
    case "note_folder":
      return "Recorded, not on calendar";
    case "note_solo_long":
      return "Long solo recording";
    default:
      return row.detection;
  }
}

export function CandidateRow({ session }: { session: WebinarSessionRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"confirm" | "dismiss" | null>(null);
  const waiting = session.status === "confirmed" && !session.published_at;
  const calendarOnly = session.detection === "calendar_only";

  const run = (kind: "confirm" | "dismiss") => {
    setBusy(kind);
    startTransition(async () => {
      const result =
        kind === "confirm"
          ? await confirmSession(session.id)
          : await dismissSession(session.id);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(kind === "confirm" ? "Confirmed." : "Dismissed.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {session.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {session.session_date} · {detectionLabel(session)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {calendarOnly ? (
          <span className="text-xs text-muted-foreground">No recording</span>
        ) : waiting ? null : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("confirm")}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            {busy === "confirm" ? "…" : "Confirm"}
          </button>
        )}
        {!waiting ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("dismiss")}
            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy === "dismiss" ? "…" : "Dismiss"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
