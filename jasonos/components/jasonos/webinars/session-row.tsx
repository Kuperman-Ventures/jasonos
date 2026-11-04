import { ChevronDown } from "lucide-react";
import { monogram, weekdayDate } from "@/lib/webinars/display";
import { topicStyle } from "@/lib/webinars/topic-style";
import type { WebinarSessionRow } from "@/lib/webinars/store";
import { ActionPill } from "./takeaway-list";

export function SessionRow({
  session,
  takeawayCount,
  actionCount,
  onExpand,
}: {
  session: WebinarSessionRow;
  takeawayCount: number;
  actionCount: number;
  onExpand: () => void;
}) {
  const style = topicStyle(session.topic_slug);
  const host = session.host_org.trim();
  const when = weekdayDate(session.session_date);
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-full items-center gap-[14px] rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff] px-6 py-4 text-left"
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[6px] text-[13px] font-semibold"
        style={{ background: style.tint, color: style.ink }}
      >
        {monogram(session.host_org, session.title)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-[#201e1d]">
          {session.title}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-[#605d5d]">
          {host ? `${host} · ${when}` : when}
        </span>
      </span>
      <span className="shrink-0 text-[13px] text-[#7d7979] max-[720px]:hidden">
        {takeawayCount} {takeawayCount === 1 ? "takeaway" : "takeaways"}
      </span>
      {actionCount > 0 ? (
        <span className="max-[720px]:hidden">
          <ActionPill count={actionCount} />
        </span>
      ) : null}
      <ChevronDown size={18} strokeWidth={2} className="shrink-0 text-[#9b9797]" />
    </button>
  );
}
