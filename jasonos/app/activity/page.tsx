import { Suspense } from "react";
import { getWeeklyActivityLog } from "@/lib/server-actions/activity-log";
import { getNetworkingStatus } from "@/lib/server-actions/networking-status";
import { ActivityLogClient } from "@/components/jasonos/activity/activity-log-client";
import { NetworkingStatusClient } from "@/components/jasonos/activity/networking-status-client";

export const metadata = { title: "Networking Status · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const [status, weekly] = await Promise.all([
    getNetworkingStatus(),
    getWeeklyActivityLog(week),
  ]);
  return (
    <Suspense>
      <NetworkingStatusClient data={status} />
      <div className="mx-auto max-w-4xl px-4">
        <div className="border-t border-border" />
      </div>
      <ActivityLogClient data={weekly} />
    </Suspense>
  );
}
