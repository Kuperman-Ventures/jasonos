import type { Metadata } from "next";
import Link from "next/link";
import { NewSlidesDialog } from "@/components/jasonos/live/new-deck-dialog";
import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";
import { listPlaybooks, listSlides } from "@/lib/server-actions/decks";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Live · JasonOS" };
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

export default async function LiveHomePage() {
  const [meetingsResult, slidesResult, playbooksResult] = await Promise.all([
    getUpcomingMeetingPreps(14),
    listSlides(),
    listPlaybooks(),
  ]);

  const playbooks = playbooksResult.ok ? playbooksResult.playbooks : [];
  const slides = slidesResult.ok ? slidesResult.slides : [];
  const slidesByPrep = new Map(
    slides.filter((row) => row.meetingPrepId).map((row) => [row.meetingPrepId as string, row])
  );
  const meetings = meetingsResult.ok ? meetingsResult.meetings : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
            Live
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--jos-ink)]">
            Slides
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/live/playbooks"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Playbooks
          </Link>
          <NewSlidesDialog playbooks={playbooks} />
        </div>
      </div>

      {!meetingsResult.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{meetingsResult.error}</p>
      ) : null}
      {!slidesResult.ok ? (
        <p className="mt-2 text-sm text-[var(--jos-danger-text)]">{slidesResult.error}</p>
      ) : null}

      <section className="mt-8">
        <h2 className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
          Meetings
        </h2>
        <ul className="mt-3 divide-y divide-[var(--jos-line)] border border-[var(--jos-line)] bg-[var(--jos-surface)]">
          {meetings.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[var(--jos-muted)]">No upcoming meetings.</li>
          ) : (
            meetings.map((meeting) => {
              const linked = slidesByPrep.get(meeting.id);
              return (
                <li key={meeting.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--jos-ink)]">
                      {meeting.title}
                    </p>
                    <p className="text-[12px] text-[var(--jos-muted)]">{formatWhen(meeting.startsAt)}</p>
                  </div>
                  {linked ? (
                    <Link
                      href={`/live/slides/${linked.id}`}
                      className={cn(buttonVariants({ size: "sm" }))}
                    >
                      Open Slides
                    </Link>
                  ) : (
                    <NewSlidesDialog
                      playbooks={playbooks}
                      meetingPrepId={meeting.id}
                      meetingTitle={meeting.title}
                      triggerLabel="New Slides"
                    />
                  )}
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
          All Slides
        </h2>
        <ul className="mt-3 divide-y divide-[var(--jos-line)] border border-[var(--jos-line)] bg-[var(--jos-surface)]">
          {slides.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[var(--jos-muted)]">No Slides yet.</li>
          ) : (
            slides.map((deck) => (
              <li key={deck.id}>
                <Link
                  href={`/live/slides/${deck.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[color-mix(in_srgb,var(--jos-focus)_6%,transparent)]"
                >
                  <span className="truncate text-sm font-semibold">{deck.name}</span>
                  <span className="shrink-0 text-[12px] text-[var(--jos-muted)]">
                    {deck.slideCount} slides
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
