"use client";

import Link from "next/link";
import { CalendarBlank, ListChecks, Play } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { LIVE_SECTION_LABEL } from "@/components/jasonos/live";
import { MeetingTitleField } from "@/components/jasonos/meeting-prep/live-rename-field";
import type { MeetingPrepSummary } from "@/lib/server-actions/meeting-prep";
import { cn } from "@/lib/utils";

function easternWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayName(meeting: MeetingPrepSummary): string {
  return (
    meeting.primaryContactName?.trim() ||
    meeting.primaryCompanyName?.trim() ||
    meeting.title
  );
}

export function LiveBeforeClient({
  meetings,
  nowIso,
  error,
  warnings,
}: {
  meetings: MeetingPrepSummary[];
  nowIso: string;
  error: string | null;
  warnings: string[];
}) {
  const now = Date.parse(nowIso);
  const upcoming = meetings
    .filter((row) => !row.liveEndedAt && Date.parse(row.endsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return (
    <div className="px-10 py-8">
      <header>
        <p className={cn(LIVE_SECTION_LABEL, "text-[var(--color-accent-700)]")}>Live</p>
        <h1 className="mt-1 text-[36px] font-extrabold tracking-tight">Before</h1>
        <p className="mt-2 max-w-[50ch] text-[15px] text-[var(--jos-muted)]">
          Upcoming calls to prepare. Click a name to retitle it.
        </p>
      </header>

      {error ? <p className="mt-4 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {warnings.length ? (
        <p className="mt-2 text-[13px] text-[var(--jos-muted)]">{warnings.join(" · ")}</p>
      ) : null}

      {upcoming.length === 0 ? (
        <p className="mt-8 text-[16px] text-[var(--jos-muted)]">No upcoming calls in the next two weeks.</p>
      ) : (
        <ul className="mt-8">
          {upcoming.map((meeting) => {
            const needsPoints = meeting.pointCount <= 0;
            return (
              <li
                key={meeting.id}
                className="flex flex-wrap items-center gap-3 border-t border-[var(--jos-line)] py-4 first:border-t-0"
              >
                <div className="w-[11rem] shrink-0">
                  <p className="inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums text-[var(--jos-ink)]">
                    <CalendarBlank
                      size={14}
                      weight="duotone"
                      className="text-[var(--color-calendar)]"
                      aria-hidden
                    />
                    {easternWhen(meeting.startsAt)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <MeetingTitleField
                    prepId={meeting.id}
                    title={meeting.title}
                    className="text-[17px] font-bold"
                  />
                  {displayName(meeting) !== meeting.title ? (
                    <p className="mt-0.5 truncate text-[13px] text-[var(--jos-muted)]">
                      {displayName(meeting)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {!needsPoints ? (
                    <Link
                      href={`/meetings/${meeting.id}/live`}
                      className={cn(buttonVariants({ variant: "default", size: "sm" }), "h-8 gap-1")}
                    >
                      <Play size={14} weight="fill" aria-hidden />
                      Go live
                    </Link>
                  ) : null}
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-8 gap-1")}
                  >
                    <ListChecks size={14} weight="duotone" aria-hidden />
                    {needsPoints ? "Prepare" : "Open"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
