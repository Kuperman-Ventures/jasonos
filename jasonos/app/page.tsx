import { getDashboardData } from "@/lib/data/dashboard";
import { getWhatNowAdvice } from "@/lib/server-actions/what-now";
import { getPinnedTodayCards } from "@/lib/server-actions/pin";
import { getBrowningSummary } from "@/lib/browning/data";
import { DashboardClient } from "@/components/jasonos/dashboard-client";

export const revalidate = 0;

export default async function Dashboard() {
  const [data, whatNow, pinned, browningSummary] = await Promise.all([
    getDashboardData(),
    getWhatNowAdvice(),
    getPinnedTodayCards(),
    getBrowningSummary(),
  ]);
  return (
    <DashboardClient
      data={data}
      whatNow={whatNow}
      pinned={pinned}
      browningSummary={browningSummary}
    />
  );
}
