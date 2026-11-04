import { notFound } from "next/navigation";
import { TopicTakeaways } from "@/components/jasonos/webinars/topic-takeaways";
import { getTopicPage } from "@/lib/webinars/store";

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
  const page = await getTopicPage({ slug, weeks: null });
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-[880px] px-4 py-8">
      <TopicTakeaways
        topic={page.topic}
        takeaways={page.takeaways}
        takeawayCount={page.takeaway_count}
        sessionCount={page.session_count}
      />
    </div>
  );
}
