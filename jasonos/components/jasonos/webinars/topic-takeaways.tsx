import { weekdayDate } from "@/lib/webinars/display";
import type { TopicTakeawayView, WebinarTopicRow } from "@/lib/webinars/store";
import { TakeawayList } from "./takeaway-list";
import { TopicHeader } from "./topic-header";

export function TopicTakeaways({
  topic,
  takeaways,
  takeawayCount,
  sessionCount,
  topicNames,
}: {
  topic: WebinarTopicRow;
  takeaways: TopicTakeawayView[];
  takeawayCount: number;
  sessionCount: number;
  topicNames: Record<string, string>;
}) {
  const groups: Array<{
    id: string;
    title: string;
    date: string;
    topicSlug: string | null;
    items: TopicTakeawayView[];
  }> = [];
  const indexBySession = new Map<string, number>();
  for (const takeaway of takeaways) {
    const existing = indexBySession.get(takeaway.session_id);
    if (existing == null) {
      indexBySession.set(takeaway.session_id, groups.length);
      groups.push({
        id: takeaway.session_id,
        title: takeaway.session_title,
        date: takeaway.session_date,
        topicSlug: takeaway.session_topic_slug,
        items: [takeaway],
      });
    } else {
      groups[existing]!.items.push(takeaway);
    }
  }
  groups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const group of groups) {
    group.items.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  }
  const actions = takeaways.filter((takeaway) => takeaway.is_action).length;

  return (
    <div className="min-h-full bg-[#f6f5f3] text-[#201e1d]">
      <div className="mx-auto flex max-w-[860px] flex-col gap-11 px-6 pb-20 pt-10">
        <TopicHeader
          slug={topic.slug}
          name={topic.name}
          sessions={sessionCount}
          takeaways={takeawayCount}
          actions={actions}
          range="all"
          backHref="/webinars"
        />
        {groups.length ? (
          <div className="rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff] px-6 py-2">
            {groups.map((group) => (
              <section key={group.id} className="border-t border-[rgba(32,30,29,0.08)] py-3 first:border-t-0">
                <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[#7d7979]">
                  {group.title} · {weekdayDate(group.date)}
                </p>
                <TakeawayList
                  takeaways={group.items}
                  sessionTopicSlug={group.topicSlug}
                  topicNames={topicNames}
                  limit={null}
                />
              </section>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[#7d7979]">No takeaways in this topic yet.</p>
        )}
      </div>
    </div>
  );
}
