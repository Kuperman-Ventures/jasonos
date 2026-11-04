import { WebinarsPageClient, type WebinarRange } from "@/components/jasonos/webinars/webinars-page-client";
import { getWebinarsByTopic, listWebinarTopics } from "@/lib/webinars/store";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Webinars · JasonOS",
  description: "Webinar sessions and takeaways, grouped by topic.",
};

function parseRange(raw: string | string[] | undefined): WebinarRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "week" || value === "all" || value === "4w") return value;
  return "4w";
}

function rangeToWeeks(range: WebinarRange): number | null {
  if (range === "week") return 1;
  if (range === "all") return null;
  return 4;
}

export default async function WebinarsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const [data, topicList] = await Promise.all([
    getWebinarsByTopic({ weeks: rangeToWeeks(range) }),
    listWebinarTopics({ include_archived: true }),
  ]);
  const topicNames = Object.fromEntries(topicList.topics.map((topic) => [topic.slug, topic.name]));
  const activeTopics = topicList.topics
    .filter((topic) => topic.status === "active")
    .map((topic) => ({ slug: topic.slug, name: topic.name }));

  return (
    <WebinarsPageClient
      range={range}
      data={data}
      topicNames={topicNames}
      activeTopics={activeTopics}
    />
  );
}
