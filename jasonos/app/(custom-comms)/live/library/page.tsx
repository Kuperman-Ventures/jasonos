import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveBreadcrumb } from "@/components/jasonos/live/live-breadcrumb";
import { LibraryClient, type LibraryTab } from "@/components/jasonos/live/library-client";
import {
  deckMeetingFields,
  enrichMeetingMap,
  meetingMapFromAttachable,
} from "@/lib/live/meeting-meta";
import { listAttachableMeetings, listDecks, listPlaybooks } from "@/lib/server-actions/decks";

export const metadata: Metadata = { title: "Library · Live · JasonOS" };
export const dynamic = "force-dynamic";

function parseTab(raw: string | undefined): LibraryTab {
  if (raw === "decks" || raw === "held" || raw === "playbooks") return raw;
  return "playbooks";
}

export default async function LiveLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const tabParam = typeof query.tab === "string" ? query.tab : undefined;
  const initialTab = parseTab(tabParam);

  const [playbooksResult, decksResult, meetingsResult] = await Promise.all([
    listPlaybooks(),
    listDecks(),
    listAttachableMeetings(),
  ]);

  const playbooks = playbooksResult.ok ? playbooksResult.playbooks : [];
  const allDecks = decksResult.ok ? decksResult.decks : [];
  const meetings = meetingsResult.ok ? meetingsResult.meetings : [];

  const active = allDecks.filter((deck) => !deck.runEndedAt);
  const held = allDecks
    .filter((deck) => deck.runEndedAt)
    .sort((a, b) => {
      const aEnd = a.runEndedAt ? Date.parse(a.runEndedAt) : 0;
      const bEnd = b.runEndedAt ? Date.parse(b.runEndedAt) : 0;
      return bEnd - aEnd;
    });

  const meetingMap = await enrichMeetingMap(
    meetingMapFromAttachable(meetings),
    [...active, ...held].map((deck) => deck.meetingPrepId)
  );

  const activeDecks = active.map((deck) => ({
    deck,
    ...deckMeetingFields(deck, meetingMap),
  }));
  const heldDecks = held.map((deck) => ({
    deck,
    ...deckMeetingFields(deck, meetingMap),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LiveBreadcrumb
        crumbs={[
          { label: "Live", href: "/live" },
          { label: "Library" },
        ]}
      />
      <div className="mt-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
          Live
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Library</h1>
      </div>

      {!playbooksResult.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{playbooksResult.error}</p>
      ) : null}
      {!decksResult.ok ? (
        <p className="mt-4 text-sm text-[var(--jos-danger-text)]">{decksResult.error}</p>
      ) : null}

      <Suspense fallback={<p className="mt-8 text-sm text-[var(--jos-muted)]">Loading…</p>}>
        <LibraryClient
          initialTab={initialTab}
          playbooks={playbooks}
          activeDecks={activeDecks}
          heldDecks={heldDecks}
          meetings={meetings}
        />
      </Suspense>
    </div>
  );
}
