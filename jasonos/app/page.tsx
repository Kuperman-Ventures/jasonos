import { getHomeData } from "@/lib/data/home";
import { HomeClient } from "@/components/jasonos/home/home-client";
import { MorningBriefCard } from "@/components/jasonos/home/morning-brief-card";
import { InboxDispatchCard } from "@/components/jasonos/home/inbox-dispatch-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ brief?: string }>;
}) {
  const [data, { brief }] = await Promise.all([getHomeData(), searchParams]);
  return (
    <HomeClient data={data}>
      <MorningBriefCard selectedDate={brief} />
      <InboxDispatchCard />
    </HomeClient>
  );
}
