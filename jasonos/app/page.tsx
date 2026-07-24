import { getHomeData } from "@/lib/data/home";
import { HomeClient } from "@/components/jasonos/home/home-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Dashboard() {
  const data = await getHomeData();
  return <HomeClient data={data} />;
}
