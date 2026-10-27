"use client";

import Link from "next/link";
import { LiveCollapsibleList } from "@/components/jasonos/live/live-collapsible-list";
import { homeDeckState } from "@/components/jasonos/live/live-format";
import type { DeckSummary } from "@/lib/server-actions/decks";

export type RecentDeckRow = {
  deck: DeckSummary;
  meetingLine: string;
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
        {rows.map(({ deck, meetingLine }) => (
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
            <span className="shrink-0 pt-0.5 text-[12px] font-semibold text-[var(--jos-muted)]">
              {homeDeckState(deck)}
            </span>
          </li>
        ))}
      </ul>
    </LiveCollapsibleList>
  );
}
