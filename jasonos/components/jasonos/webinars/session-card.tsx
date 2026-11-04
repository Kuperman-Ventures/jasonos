import { CalendarDays, ChevronUp, ExternalLink } from "lucide-react";
import {
  durationLabel,
  firstSentence,
  monogram,
  speakerLine,
  weekdayDate,
} from "@/lib/webinars/display";
import { topicStyle } from "@/lib/webinars/topic-style";
import type { WebinarSessionRow, WebinarTakeawayRow } from "@/lib/webinars/store";
import { TakeawayList } from "./takeaway-list";

export function SessionCard({
  session,
  takeaways,
  topicNames = {},
  onCollapse,
}: {
  session: WebinarSessionRow;
  takeaways: WebinarTakeawayRow[];
  topicNames?: Record<string, string>;
  onCollapse?: () => void;
}) {
  const style = topicStyle(session.topic_slug);
  const speakers = speakerLine(session.speakers);
  const when = weekdayDate(session.session_date);
  const duration = durationLabel(session.duration_minutes);
  const lede = firstSentence(session.summary_md);

  return (
    <article className="rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff] px-6 py-[22px]">
      <header
        className={onCollapse ? "flex cursor-pointer gap-[14px]" : "flex gap-[14px]"}
        onClick={onCollapse}
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[6px] text-[13px] font-semibold"
          style={{ background: style.tint, color: style.ink }}
        >
          {monogram(session.host_org, session.title)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[18px] font-semibold leading-snug text-[#201e1d]">
              {session.title}
            </h3>
            {onCollapse ? (
              <button
                type="button"
                aria-label="Collapse session"
                onClick={(event) => {
                  event.stopPropagation();
                  onCollapse();
                }}
                className="mt-1 shrink-0 text-[#9b9797]"
              >
                <ChevronUp size={18} strokeWidth={2} />
              </button>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#605d5d]">
            {speakers ? <span>{speakers}</span> : null}
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={13} strokeWidth={2} />
              {when}
              {duration ? ` · ${duration}` : ""}
            </span>
            {session.transcript_url ? (
              <a
                href={session.transcript_url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-1 text-[#201e1d] underline-offset-2 hover:underline"
              >
                <ExternalLink size={13} strokeWidth={2} />
                Transcript
              </a>
            ) : null}
          </p>
        </div>
      </header>
      <div className="mt-4 pl-[58px] max-[720px]:pl-0">
        {lede ? (
          <p className="mb-3 text-[15.5px] leading-[1.5] text-[#444141]">{lede}</p>
        ) : null}
        <TakeawayList
          takeaways={takeaways}
          sessionTopicSlug={session.topic_slug}
          topicNames={topicNames}
        />
      </div>
    </article>
  );
}
