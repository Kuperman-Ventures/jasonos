import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { countPhrase, rangeWhen, shortTopicName, type WebinarRange } from "@/lib/webinars/display";
import { topicStyle } from "@/lib/webinars/topic-style";

export function TopicHeader({
  slug,
  name,
  sessions,
  takeaways,
  actions,
  range,
  backHref,
}: {
  slug: string;
  name: string;
  sessions: number;
  takeaways: number;
  actions: number;
  range: WebinarRange;
  backHref?: string;
}) {
  const style = topicStyle(slug);
  const Icon = style.icon;
  const when = rangeWhen(range);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px]"
          style={{ background: style.tint, color: style.ink }}
        >
          <Icon size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          {backHref ? (
            <h1 className="text-[22px] font-semibold leading-tight text-[#201e1d]">{name}</h1>
          ) : (
            <h2 className="text-[22px] font-semibold leading-tight text-[#201e1d]">{name}</h2>
          )}
          <p className="mt-1 text-[13px] text-[#605d5d]">
            {countPhrase(sessions, "session", "sessions")} {when}
            {" · "}
            {countPhrase(takeaways, "takeaway", "takeaways")}
            {" · "}
            {countPhrase(actions, "action", "actions")}
          </p>
        </div>
      </div>
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[13px] text-[#201e1d]"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Webinars
        </Link>
      ) : (
        <Link
          href={`/webinars/${slug}`}
          className="inline-flex items-center gap-1 text-[13px] text-[#201e1d]"
        >
          All {shortTopicName(name)} takeaways
          <ArrowRight size={14} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
