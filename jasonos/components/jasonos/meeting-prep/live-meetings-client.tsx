"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/jasonos/brand/page-header";
import type { MeetingPrepSummary } from "@/lib/server-actions/meeting-prep";
import { cn } from "@/lib/utils";

function easternTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function attendeeLabel(attendee: MeetingPrepSummary["attendees"][number]): string {
  return attendee.name || attendee.email.split("@")[0] || attendee.email;
}

function attendeeLine(attendees: MeetingPrepSummary["attendees"]): string {
  const labels = attendees.map(attendeeLabel);
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
}

export function LiveMeetingsClient({
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
  const visible = meetings.filter((row) => {
    const end = Date.parse(row.endsAt);
    const now = Date.parse(nowIso);
    if (Number.isNaN(end) || Number.isNaN(now)) return true;
    return end >= now;
  });
  const withPoints = visible.filter((row) => row.pointCount > 0);
  const withoutPoints = visible.filter((row) => row.pointCount === 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="Live"
        description="Open the call agenda for a meeting today. Add points on the prep page first."
      />

      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {warnings.length ? (
        <p className="text-[13px] text-[var(--jos-muted)]">{warnings.join(" · ")}</p>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">
          {meetings.length ? "No meetings left today." : "No meetings with other people today."}
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
              Ready to go live
            </h2>
            {withPoints.length === 0 ? (
              <p className="text-[15px] text-[var(--jos-muted)]">
                None yet. Open a meeting below, draft or add points, then come back here or use Start
                live on the prep page.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--jos-line)] border-t border-b border-[var(--jos-line)]">
                {withPoints.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold tracking-tight">
                        <span className="mr-2 font-medium text-[var(--jos-muted)]">
                          {easternTime(row.startsAt)}
                        </span>
                        {row.title}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-[var(--jos-muted)]">
                        {attendeeLine(row.attendees)}
                        {" · "}
                        {row.pointCount === 1 ? "1 point" : `${row.pointCount} points`}
                      </p>
                    </div>
                    <Link
                      href={`/meetings/${row.id}/live`}
                      className={buttonVariants({ variant: "calendar", size: "sm" })}
                    >
                      Live
                    </Link>
                    <Link
                      href={`/meetings/${row.id}`}
                      className="text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                    >
                      Prep
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {withoutPoints.length ? (
            <section className="space-y-3">
              <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">
                Needs points first
              </h2>
              <ul className="divide-y divide-[var(--jos-line)] border-t border-b border-[var(--jos-line)]">
                {withoutPoints.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold tracking-tight">
                        <span className="mr-2 font-medium text-[var(--jos-muted)]">
                          {easternTime(row.startsAt)}
                        </span>
                        {row.title}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-[var(--jos-muted)]">
                        {attendeeLine(row.attendees)}
                      </p>
                    </div>
                    <Link
                      href={`/meetings/${row.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Add points
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
