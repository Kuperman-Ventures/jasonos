import { getHomeData } from "@/lib/data/home";
import { HomeClient } from "@/components/jasonos/home/home-client";
import { MeetingFollowupsPanel } from "@/components/jasonos/home/meeting-followups-panel";
import { MorningBriefCard } from "@/components/jasonos/home/morning-brief-card";
import { InboxDispatchCard } from "@/components/jasonos/home/inbox-dispatch-card";
import { getDueMeetingFollowups } from "@/lib/server-actions/meeting-followups";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ brief?: string }>;
}) {
  const [data, dueFollowups, { brief }] = await Promise.all([
    getHomeData(),
    getDueMeetingFollowups(),
    searchParams,
  ]);
  return (
    <HomeClient data={data}>
      <MorningBriefCard selectedDate={brief} />
      <InboxDispatchCard />
      <MeetingFollowupsPanel rows={dueFollowups} />
    </HomeClient>
  );
}
