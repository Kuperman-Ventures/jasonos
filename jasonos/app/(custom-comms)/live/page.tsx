import type { Metadata } from "next";
import { LiveBreadcrumb } from "@/components/jasonos/live/live-breadcrumb";
import { LiveSectionNav } from "@/components/jasonos/live/live-section-nav";
import { NewDeckDialog } from "@/components/jasonos/live/new-deck-dialog";
import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";
import { listDecks, listPlaybooks } from "@/lib/server-actions/decks";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Meetings · Live · JasonOS" };
export const dynamic = "force-dynamic";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function LiveMeetingsPage() {
  const [meetingsResult, decksResult, playbooksResult] = await Promise.all([
    getUpcomingMeetingPreps(14),
    listDecks(),
    listPlaybooks(),
  ]);
  const playbooks = playbooksResult.ok ? playbooksResult.playbooks : [];
  const decks = decksResult.ok ? decksResult.decks : [];
  const byPrep = new Map(
    decks.filter((row) => row.meetingPrepId).map((row) => [row.meetingPrepId as string, row])
  );
  const meetings = meetingsResult.ok ? meetingsResult.meetings : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LiveBreadcrumb crumbs={[{ label: "Live" }]} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
            Live
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Meetings</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LiveSectionNav current="meetings" />
          <NewDeckDialog playbooks={playbooks} />
        </div>
      </div>

      {!meetingsResult.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{meetingsResult.error}</p>
      ) : null}

      <ul className="mt-8 divide-y divide-[var(--jos-line)] border border-[var(--jos-line)] bg-[var(--jos-surface)]">
        {meetings.length === 0 ? (
          <li className="px-4 py-3 text-sm text-[var(--jos-muted)]">No upcoming meetings.</li>
        ) : (
          meetings.map((meeting) => {
            const linked = byPrep.get(meeting.id);
            const attendees = meeting.attendees
              .map((person) => person.name || person.email)
              .filter(Boolean)
              .join(", ");
            return (
              <li
                key={meeting.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[12px] text-[var(--jos-muted)]">{formatWhen(meeting.startsAt)}</p>
                  <p className="truncate text-sm font-semibold text-[var(--jos-ink)]">{meeting.title}</p>
                  {attendees ? (
                    <p className="truncate text-[12px] text-[var(--jos-muted)]">{attendees}</p>
                  ) : null}
                </div>
                {linked ? (
                  <Link
                    href={`/live/decks/${linked.id}`}
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    Open deck
                  </Link>
                ) : (
                  <NewDeckDialog
                    playbooks={playbooks}
                    meetingPrepId={meeting.id}
                    meetingTitle={meeting.title}
                    triggerLabel="New deck"
                  />
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
