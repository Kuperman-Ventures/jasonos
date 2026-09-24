import { getHomeData } from "@/lib/data/home";
import { HomeClient } from "@/components/jasonos/home/home-client";
import { SentFollowupsPanel } from "@/components/jasonos/home/sent-followups-panel";
import { MorningBriefCard } from "@/components/jasonos/home/morning-brief-card";
import { InboxDispatchCard } from "@/components/jasonos/home/inbox-dispatch-card";
import { getDueSentEmailFollowups } from "@/lib/server-actions/sent-followups";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ brief?: string }>;
}) {
  const [data, dueFollowups, { brief }] = await Promise.all([
    getHomeData(),
    getDueSentEmailFollowups(),
    searchParams,
  ]);
  return (
    <HomeClient data={data}>
      <MorningBriefCard selectedDate={brief} />
      <InboxDispatchCard />
      <SentFollowupsPanel rows={dueFollowups} />
    </HomeClient>
  );
}
