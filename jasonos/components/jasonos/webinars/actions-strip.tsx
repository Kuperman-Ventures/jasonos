"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { TrackPill } from "@/components/jasonos/track-pill";
import { actionsHeading, countPhrase, type WebinarRange } from "@/lib/webinars/display";
import type { WebinarActionView } from "@/lib/webinars/store";
import type { Track } from "@/lib/types";

const VISIBLE = 4;

export function ActionsStrip({
  actions,
  range,
}: {
  actions: WebinarActionView[];
  range: WebinarRange;
}) {
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  const shown = open ? actions : actions.slice(0, VISIBLE);
  const hidden = actions.length - VISIBLE;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold text-[#201e1d]">
          <Zap size={18} strokeWidth={2} />
          {actionsHeading(range)}
        </h2>
        <p className="text-[13px] text-[#7d7979]">
          {countPhrase(actions.length, "on the Action Queue", "on the Action Queue")}
        </p>
      </div>
      <div className="rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff]">
        <ul>
          {shown.map((action) => (
            <li
              key={action.id}
              className="flex items-start gap-3 border-t border-[rgba(32,30,29,0.08)] px-5 py-3 first:border-t-0"
            >
              <span
                aria-hidden
                className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-[3px] border-[1.5px] border-[rgba(32,30,29,0.35)]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-[1.5] text-[#201e1d]">
                  {action.lead ? <span className="font-semibold">{action.lead} </span> : null}
                  {action.text}
                </p>
                <p className="text-[12.5px] text-[#605d5d]">{action.session_title}</p>
              </div>
              {action.track ? (
                <TrackPill track={action.track as Track} compact />
              ) : null}
            </li>
          ))}
        </ul>
        {hidden > 0 && !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full border-t border-[rgba(32,30,29,0.08)] py-3 text-center text-[13px] text-[#201e1d]"
          >
            Show {hidden} more {hidden === 1 ? "action" : "actions"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
