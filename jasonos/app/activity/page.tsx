import { Suspense } from "react";
import { getWeeklyActivityLog } from "@/lib/server-actions/activity-log";
import { ActivityLogClient } from "@/components/jasonos/activity/activity-log-client";

export const metadata = { title: "Weekly Log · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const data = await getWeeklyActivityLog(week);
  return (
    <Suspense>
      <ActivityLogClient data={data} />
    </Suspense>
  );
}
