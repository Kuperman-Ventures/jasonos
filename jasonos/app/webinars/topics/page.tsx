import { TopicsEditor } from "@/components/jasonos/webinars/topics-editor";
import { listWebinarTopics } from "@/lib/webinars/store";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Manage topics · Webinars · JasonOS",
  description: "Edit the webinar topic list.",
};

export default async function WebinarTopicsPage() {
  const { topics } = await listWebinarTopics({ include_archived: true });
  const nextSortOrder = topics.reduce((max, topic) => Math.max(max, topic.sort_order), 0) + 10;
  const editorKey = topics
    .map((topic) => `${topic.slug}:${topic.updated_at}:${topic.status}:${topic.sort_order}`)
    .join("|");
  return <TopicsEditor key={editorKey} topics={topics} nextSortOrder={nextSortOrder} />;
}
