import { getHomeData } from "@/lib/data/home";
import { HomeClient } from "@/components/jasonos/home/home-client";
import { MeetingFollowupsPanel } from "@/components/jasonos/home/meeting-followups-panel";
import { SentFollowupsPanel } from "@/components/jasonos/home/sent-followups-panel";
import { MorningBriefCard } from "@/components/jasonos/home/morning-brief-card";
import { InboxDispatchCard } from "@/components/jasonos/home/inbox-dispatch-card";
import { getDueMeetingFollowups } from "@/lib/server-actions/meeting-followups";
import { getSentEmailFollowups } from "@/lib/server-actions/sent-followups";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ brief?: string }>;
}) {
  // Email follow-ups on Home use the same loader as Networking → Follow Up.
  const [data, dueMeetings, sentFollowups, { brief }] = await Promise.all([
    getHomeData(),
    getDueMeetingFollowups(),
    getSentEmailFollowups(),
    searchParams,
  ]);
  return (
    <HomeClient data={data}>
      <MorningBriefCard selectedDate={brief} />
      <InboxDispatchCard />
      <MeetingFollowupsPanel rows={dueMeetings} />
      <SentFollowupsPanel rows={sentFollowups} />
    </HomeClient>
  );
}
