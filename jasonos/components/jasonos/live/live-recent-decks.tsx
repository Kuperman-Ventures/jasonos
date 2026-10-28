"use client";

import Link from "next/link";
import { LiveCollapsibleList } from "@/components/jasonos/live/live-collapsible-list";
import { LiveStateBadge } from "@/components/jasonos/live/live-state-badge";
import { liveListState } from "@/components/jasonos/live/live-format";
import type { DeckSummary } from "@/lib/server-actions/decks";

export type RecentDeckRow = {
  deck: DeckSummary;
  meetingLine: string;
  meetingStartsAt: string | null;
};

export function LiveRecentDecks({ rows }: { rows: RecentDeckRow[] }) {
  return (
    <LiveCollapsibleList
      title="Recent"
      count={rows.length}
      storageKey="jasonos.live.recent.collapsed"
      empty={<p className="text-sm text-[var(--jos-muted)]">No decks yet.</p>}
    >
      <ul className="mt-4 divide-y divide-[var(--jos-line)]">
        {rows.map(({ deck, meetingLine, meetingStartsAt }) => {
          const state = liveListState({
            reviewedAt: deck.reviewedAt,
            hasTranscript: deck.hasTranscript,
            runEndedAt: deck.runEndedAt,
            runStartedAt: deck.runStartedAt,
            meetingStartsAt,
          });
          return (
            <li key={deck.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/live/decks/${deck.id}`}
                  className="text-sm font-semibold text-[var(--jos-ink)] hover:underline"
                >
                  {deck.name}
                </Link>
                <p className="mt-0.5 truncate text-[12px] text-[var(--jos-muted)]">{meetingLine}</p>
              </div>
              <div className="shrink-0 pt-0.5">
                <LiveStateBadge state={state} />
              </div>
            </li>
          );
        })}
      </ul>
    </LiveCollapsibleList>
  );
}
