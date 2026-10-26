import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DeckEditor } from "@/components/jasonos/live/deck-editor";
import { getDeck, listPlaybooks } from "@/lib/server-actions/decks";
import { getMeetingPrep, getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";

export const dynamic = "force-dynamic";

export default async function DeckEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getDeck(id);
  if (!result.ok) {
    if (result.error === "Not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-[var(--jos-danger-text)]">{result.error}</p>
      </div>
    );
  }
  if (result.deck.kind !== "deck") notFound();

  const [meetingsResult, playbooksResult, meetingResult] = await Promise.all([
    getUpcomingMeetingPreps(30),
    listPlaybooks(),
    result.deck.meetingPrepId
      ? getMeetingPrep(result.deck.meetingPrepId)
      : Promise.resolve(null),
  ]);

  let meetingLabel: string | null = null;
  if (meetingResult && meetingResult.ok) {
    const when = new Date(meetingResult.prep.startsAt).toLocaleString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    meetingLabel = `${meetingResult.prep.title} · ${when}`;
  }

  let sourcePlaybook: { id: string; name: string; slideCount: number } | null = null;
  if (result.deck.sourcePlaybookId && playbooksResult.ok) {
    const found = playbooksResult.playbooks.find((row) => row.id === result.deck.sourcePlaybookId);
    if (found) {
      sourcePlaybook = { id: found.id, name: found.name, slideCount: found.slideCount };
    }
  }

  return (
    <Suspense fallback={<div className="px-4 py-8 text-sm text-[var(--jos-muted)]">Loading…</div>}>
      <DeckEditor
        deck={result.deck}
        meetingOptions={
          meetingsResult.ok
            ? meetingsResult.meetings.map((meeting) => ({
                id: meeting.id,
                title: meeting.title,
                startsAt: meeting.startsAt,
              }))
            : []
        }
        meetingLabel={meetingLabel}
        sourcePlaybook={sourcePlaybook}
      />
    </Suspense>
  );
}
