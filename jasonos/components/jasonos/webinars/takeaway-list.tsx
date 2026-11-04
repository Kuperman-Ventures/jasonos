"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, CornerDownRight, Zap } from "lucide-react";
import { TrackPill } from "@/components/jasonos/track-pill";
import type { Track } from "@/lib/types";

export type TakeawayItem = {
  id: string;
  text: string;
  lead?: string;
  topic_slug: string | null;
  track: Track | string | null;
  relevance_note: string;
  is_action: boolean;
  card_id: string | null;
};

export function ActionPill({
  cardId,
  count,
}: {
  cardId?: string | null;
  count?: number;
}) {
  const className =
    "inline-flex items-center gap-1 rounded-full bg-[#201e1d] px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#ffffff]";
  const inner = (
    <>
      <Zap size={10} strokeWidth={2} />
      {count != null ? count : "Action"}
    </>
  );
  if (cardId) {
    return (
      <Link href={`/?card=${cardId}`} className={className}>
        {inner}
      </Link>
    );
  }
  return <span className={className}>{inner}</span>;
}

export function TakeawayList({
  takeaways,
  sessionTopicSlug = null,
  topicNames = {},
  limit = 3,
}: {
  takeaways: TakeawayItem[];
  sessionTopicSlug?: string | null;
  topicNames?: Record<string, string>;
  limit?: number | null;
}) {
  const [open, setOpen] = useState(false);
  if (!takeaways.length) {
    return <p className="text-[13px] text-[#7d7979]">No takeaways published yet.</p>;
  }
  const capped = limit != null && !open ? takeaways.slice(0, limit) : takeaways;
  const hidden = limit != null ? takeaways.length - limit : 0;

  return (
    <div>
      <ol>
        {capped.map((takeaway, index) => {
          const otherTopic =
            takeaway.topic_slug && takeaway.topic_slug !== sessionTopicSlug
              ? topicNames[takeaway.topic_slug] ?? takeaway.topic_slug
              : null;
          return (
            <li
              key={takeaway.id}
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-[rgba(32,30,29,0.08)] py-3 first:border-t-0 max-[720px]:grid-cols-[28px_minmax(0,1fr)]"
            >
              <span className="pt-0.5 text-right text-[12px] font-semibold text-[#9b9797]">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] leading-[1.5] text-[#201e1d]">
                  {takeaway.lead ? (
                    <span className="font-semibold">{takeaway.lead} </span>
                  ) : null}
                  {takeaway.text}
                </p>
                {takeaway.relevance_note ? (
                  <p className="mt-1 flex items-start gap-1 text-[13px] leading-[1.5] text-[#7d7979]">
                    <CornerDownRight size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
                    <span>{takeaway.relevance_note}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-start justify-end gap-1.5 max-[720px]:col-start-2 max-[720px]:justify-start">
                {takeaway.is_action ? <ActionPill cardId={takeaway.card_id} /> : null}
                {takeaway.track ? (
                  <TrackPill track={takeaway.track as Track} compact />
                ) : null}
                {otherTopic ? (
                  <span className="text-[12px] text-[#7d7979]">{otherTopic}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {hidden > 0 && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 inline-flex items-center gap-1 text-[13px] text-[#201e1d]"
        >
          <ChevronDown size={14} strokeWidth={2} />
          Show {hidden} more {hidden === 1 ? "takeaway" : "takeaways"}
        </button>
      ) : null}
    </div>
  );
}
