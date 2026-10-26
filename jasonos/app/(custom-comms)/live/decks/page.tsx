import type { Metadata } from "next";
import { LiveBreadcrumb } from "@/components/jasonos/live/live-breadcrumb";
import { LiveSectionNav } from "@/components/jasonos/live/live-section-nav";
import { NewDeckDialog } from "@/components/jasonos/live/new-deck-dialog";
import { DecksListClient } from "@/components/jasonos/live/decks-list-client";
import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";
import { listDecks, listPlaybooks } from "@/lib/server-actions/decks";

export const metadata: Metadata = { title: "Decks · Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function DecksPage() {
  const [decksResult, playbooksResult, meetingsResult] = await Promise.all([
    listDecks(),
    listPlaybooks(),
    getUpcomingMeetingPreps(30),
  ]);
  const playbooks = playbooksResult.ok ? playbooksResult.playbooks : [];
  const decks = decksResult.ok ? decksResult.decks : [];
  const meetings = meetingsResult.ok ? meetingsResult.meetings : [];
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));

  const rows = decks.map((deck) => {
    const meeting = deck.meetingPrepId ? meetingById.get(deck.meetingPrepId) : null;
    return {
      deck,
      meetingTitle: meeting?.title ?? null,
      meetingStartsAt: meeting?.startsAt ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LiveBreadcrumb
        crumbs={[
          { label: "Live", href: "/live" },
          { label: "Decks" },
        ]}
      />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
            Live
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Decks</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LiveSectionNav current="decks" />
          <NewDeckDialog playbooks={playbooks} />
        </div>
      </div>

      {!decksResult.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{decksResult.error}</p>
      ) : (
        <DecksListClient
          rows={rows}
          meetings={meetings.map((meeting) => ({
            id: meeting.id,
            title: meeting.title,
            startsAt: meeting.startsAt,
          }))}
        />
      )}
    </div>
  );
}
