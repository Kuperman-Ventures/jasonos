"use client";

import Link from "next/link";
import { LIVE_SECTION_LABEL } from "@/components/jasonos/live";
import { MeetingTitleField } from "@/components/jasonos/meeting-prep/live-rename-field";
import type { OutcomeMark, RecentLiveMeeting } from "@/lib/server-actions/meeting-prep";
import { cn } from "@/lib/utils";

function easternDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function OutcomePill({ mark }: { mark: OutcomeMark | null }) {
  const base =
    "inline-flex h-7 w-[84px] items-center justify-center text-[12px] font-bold uppercase tracking-[0.08em]";
  if (!mark) {
    return (
      <span className={base} style={{ backgroundColor: "#d8d6d6", color: "var(--jos-muted)" }}>
        Unmarked
      </span>
    );
  }
  if (mark === "hit") {
    return (
      <span className={base} style={{ backgroundColor: "var(--color-done)", color: "#fff" }}>
        Hit
      </span>
    );
  }
  if (mark === "partial") {
    return (
      <span className={base} style={{ backgroundColor: "var(--color-process-yellow)", color: "var(--jos-ink)" }}>
        Partial
      </span>
    );
  }
  return (
    <span className={base} style={{ backgroundColor: "var(--color-accent-2)", color: "#fff" }}>
      Missed
    </span>
  );
}

export function LiveAfterClient({
  meetings,
  error,
}: {
  meetings: RecentLiveMeeting[];
  error: string | null;
}) {
  return (
    <div className="px-10 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={cn(LIVE_SECTION_LABEL, "text-[var(--color-accent-700)]")}>Live</p>
          <h1 className="mt-1 text-[36px] font-extrabold tracking-tight">After</h1>
          <p className="mt-2 max-w-[50ch] text-[15px] text-[var(--jos-muted)]">
            Finished calls to review. Click a name to retitle it.
          </p>
        </div>
        <Link
          href="/live/library"
          className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
        >
          All meetings
        </Link>
      </header>

      {error ? <p className="mt-4 text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}

      {meetings.length === 0 ? (
        <p className="mt-8 text-[16px] text-[var(--jos-muted)]">No finished live meetings yet.</p>
      ) : (
        <ul className="mt-8">
          {meetings.map((row) => {
            const needsReview = !row.reviewed || !row.outcomeMark;
            const meta = [row.attendeeName, row.companyName, row.strategyName]
              .filter((value): value is string => Boolean(value && value !== row.title))
              .filter((value, index, all) => all.indexOf(value) === index);
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 border-t border-[var(--jos-line)] py-4 first:border-t-0"
              >
                <span className="w-[6.5rem] shrink-0 text-[15px] font-bold tabular-nums text-[var(--jos-ink)]">
                  {easternDate(row.startsAt)}
                </span>
                <div className="min-w-0 flex-1">
                  <MeetingTitleField
                    prepId={row.id}
                    title={row.title}
                    className="text-[17px] font-semibold"
                  />
                  {meta.length ? (
                    <p className="mt-0.5 truncate text-[13px] text-[var(--jos-muted)]">{meta.join(" · ")}</p>
                  ) : null}
                </div>
                {needsReview ? (
                  <span className="text-[13px] text-[var(--jos-muted)]">Needs review</span>
                ) : null}
                <OutcomePill mark={row.outcomeMark} />
                <Link
                  href={`/meetings/${row.id}`}
                  className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                >
                  Open
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
