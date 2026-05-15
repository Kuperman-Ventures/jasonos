import {
  getReconnectDashboardData,
  getReconnectTypeCounts,
} from "@/lib/reconnect/data";
import { getUntriagedReconnectCount } from "@/lib/server-actions/triage";
import { getWarmthReminders } from "@/lib/outreach/data";
import { ReconnectClient } from "@/components/jasonos/reconnect/reconnect-client";
import { WarmthWidget } from "@/components/jasonos/outreach/warmth-widget";

export const metadata = { title: "Outreach · Queue" };
export const dynamic = "force-dynamic";

export default async function OutreachQueuePage({
  searchParams,
}: {
  searchParams?: Promise<{ intent?: string; focus?: string }>;
}) {
  const params = await searchParams;
  const [data, triageCount, typeCounts, warmthReminders] = await Promise.all([
    getReconnectDashboardData(),
    getUntriagedReconnectCount(),
    getReconnectTypeCounts(),
    getWarmthReminders(12),
  ]);

  const initialIntentFilter =
    params?.focus === "anchors"
      ? "anchors_only"
      : params?.intent === "triaged_ready"
        ? "triaged_ready"
        : null;

  return (
    <>
      {warmthReminders.length > 0 ? (
        <div className="mx-auto max-w-[1500px] px-4 pt-4">
          <WarmthWidget reminders={warmthReminders} />
        </div>
      ) : null}
      <ReconnectClient
        data={data}
        triageCount={triageCount}
        typeCounts={typeCounts}
        initialIntentFilter={initialIntentFilter}
      />
    </>
  );
}
