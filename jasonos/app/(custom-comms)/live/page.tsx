import type { Metadata } from "next";
import Link from "next/link";
import { LiveBreadcrumb } from "@/components/jasonos/live/live-breadcrumb";
import { LiveHomeStart } from "@/components/jasonos/live/live-home-start";
import { LiveUpcomingMeetings } from "@/components/jasonos/live/live-upcoming-meetings";
import {
  filterUpcomingWeekMeetings,
  formatMeetingWhen,
  homeDeckState,
} from "@/components/jasonos/live/live-format";
import {
  deckMeetingFields,
  enrichMeetingMap,
  meetingMapFromAttachable,
} from "@/lib/live/meeting-meta";
import { listAttachableMeetings, listDecks, listPlaybooks } from "@/lib/server-actions/decks";

export const metadata: Metadata = { title: "Start · Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LiveHomePage() {
  const [playbooksResult, decksResult, meetingsResult] = await Promise.all([
    listPlaybooks(),
    listDecks(),
    listAttachableMeetings(),
  ]);

  const playbooks = playbooksResult.ok ? playbooksResult.playbooks : [];
  const decks = decksResult.ok ? decksResult.decks : [];
  const recent = decks.slice(0, 5);

  const meetings = meetingsResult.ok ? meetingsResult.meetings : [];
  const upcoming = filterUpcomingWeekMeetings(meetings, 7);
  const meetingMap = await enrichMeetingMap(
    meetingMapFromAttachable(meetings),
    recent.map((deck) => deck.meetingPrepId)
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <LiveBreadcrumb crumbs={[{ label: "Live" }]} />
      <div className="mt-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
          Live
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Start</h1>
      </div>

      {!playbooksResult.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{playbooksResult.error}</p>
      ) : null}
      {!decksResult.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{decksResult.error}</p>
      ) : null}
      {!meetingsResult.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{meetingsResult.error}</p>
      ) : null}

      <LiveHomeStart playbooks={playbooks} />

      <LiveUpcomingMeetings
        meetings={upcoming}
        playbooks={playbooks}
        libraryDecks={decks}
      />

      <section className="mt-12">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
          Recent
        </h2>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--jos-muted)]">No decks yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--jos-line)]">
            {recent.map((deck) => {
              const { meetingTitle, meetingStartsAt } = deckMeetingFields(deck, meetingMap);
              const meetingLine =
                meetingTitle || meetingStartsAt
                  ? [meetingTitle, meetingStartsAt ? formatMeetingWhen(meetingStartsAt) : null]
                      .filter(Boolean)
                      .join(" · ")
                  : "No meeting";
              return (
                <li
                  key={deck.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/live/decks/${deck.id}`}
                      className="text-sm font-semibold text-[var(--jos-ink)] hover:underline"
                    >
                      {deck.name}
                    </Link>
                    <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">{meetingLine}</p>
                  </div>
                  <span className="text-[12px] font-semibold text-[var(--jos-muted)]">
                    {homeDeckState(deck)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
