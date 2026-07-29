import { getHomeData } from "@/lib/data/home";
import { HomeClient } from "@/components/jasonos/home/home-client";
import { MorningBriefCard } from "@/components/jasonos/home/morning-brief-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Dashboard() {
  const data = await getHomeData();
  return (
    <HomeClient data={data}>
      <MorningBriefCard />
    </HomeClient>
  );
}
