"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmSession, dismissSession } from "@/lib/server-actions/webinars";
import { durationLabel, sourceInitials, weekdayDate } from "@/lib/webinars/display";
import type { WebinarSessionRow } from "@/lib/webinars/store";

function sourceName(session: WebinarSessionRow): string | null {
  if (session.transcript_source === "granola") return "Granola";
  if (session.transcript_source === "wispr") return "Wispr";
  return null;
}

function candidateLine(session: WebinarSessionRow): string {
  if (session.status === "confirmed" && !session.published_at) {
    return "Confirmed, waiting for summary";
  }
  if (session.detection === "calendar_only") {
    return `On calendar for ${weekdayDate(session.session_date)} · no recording yet`;
  }
  const source = sourceName(session);
  let phrase = "Recorded";
  if (session.detection === "note_folder") {
    phrase = source ? `Recorded in ${source}, not on calendar` : "Recorded, not on calendar";
  } else if (session.detection === "note_solo_long") {
    phrase = source ? `Long solo recording in ${source}` : "Long solo recording";
  } else if (session.detection === "calendar_and_note") {
    phrase = "On calendar with a recording";
  }
  const duration = durationLabel(session.duration_minutes);
  return [phrase, weekdayDate(session.session_date), duration].filter(Boolean).join(" · ");
}

export function CandidateRow({ session }: { session: WebinarSessionRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"confirm" | "dismiss" | null>(null);
  const waiting = session.status === "confirmed" && !session.published_at;
  const calendarOnly = session.detection === "calendar_only";
  const showButtons = !waiting && !calendarOnly;

  const run = (kind: "confirm" | "dismiss") => {
    setBusy(kind);
    startTransition(async () => {
      const result =
        kind === "confirm" ? await confirmSession(session.id) : await dismissSession(session.id);
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
    <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff] px-5 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] bg-[#eae7e7] text-[12px] font-semibold text-[#444141]">
        {sourceInitials(session)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-[1.5] text-[#201e1d]">
          {session.title}
        </p>
        <p className="text-[13px] text-[#605d5d]">{candidateLine(session)}</p>
      </div>
      {showButtons ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run("confirm")}
            className="rounded-[6px] bg-[#006786] px-3 py-1.5 text-[13px] font-semibold text-[#ffffff] disabled:opacity-50"
          >
            {busy === "confirm" ? "…" : "Confirm webinar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("dismiss")}
            className="rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff] px-3 py-1.5 text-[13px] text-[#201e1d] disabled:opacity-50"
          >
            {busy === "dismiss" ? "…" : "Dismiss"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
