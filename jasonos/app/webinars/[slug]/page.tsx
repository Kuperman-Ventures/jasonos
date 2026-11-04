import { notFound } from "next/navigation";
import { TopicTakeaways } from "@/components/jasonos/webinars/topic-takeaways";
import { getTopicPage, listWebinarTopics } from "@/lib/webinars/store";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Webinars · JasonOS",
  description: "Takeaways collected under one webinar topic.",
};

export default async function WebinarTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [page, topicList] = await Promise.all([
    getTopicPage({ slug, weeks: null }),
    listWebinarTopics({ include_archived: true }),
  ]);
  if (!page) notFound();
  const topicNames = Object.fromEntries(topicList.topics.map((topic) => [topic.slug, topic.name]));

  return (
    <TopicTakeaways
      topic={page.topic}
      takeaways={page.takeaways}
      takeawayCount={page.takeaway_count}
      sessionCount={page.session_count}
      topicNames={topicNames}
    />
  );
}
