import type { Metadata } from "next";
import { LiveBreadcrumb } from "@/components/jasonos/live/live-breadcrumb";
import { LiveHomeStart } from "@/components/jasonos/live/live-home-start";
import { LiveRecentDecks } from "@/components/jasonos/live/live-recent-decks";
import { LiveUpcomingMeetings } from "@/components/jasonos/live/live-upcoming-meetings";
import {
  filterUpcomingWeekMeetings,
  formatMeetingWhen,
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

  const recentRows = recent.map((deck) => {
    const { meetingTitle, meetingStartsAt } = deckMeetingFields(deck, meetingMap);
    const meetingLine =
      meetingTitle || meetingStartsAt
        ? [meetingTitle, meetingStartsAt ? formatMeetingWhen(meetingStartsAt) : null]
            .filter(Boolean)
            .join(" · ")
        : "No meeting";
    return { deck, meetingLine };
  });

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

      <LiveRecentDecks rows={recentRows} />
    </div>
  );
}
