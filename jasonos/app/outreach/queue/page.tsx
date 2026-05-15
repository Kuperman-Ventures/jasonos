import {
  getReconnectDashboardData,
  getReconnectTypeCounts,
} from "@/lib/reconnect/data";
import { getUntriagedReconnectCount } from "@/lib/server-actions/triage";
import { ReconnectClient } from "@/components/jasonos/reconnect/reconnect-client";

export const metadata = { title: "Outreach · Queue" };
export const dynamic = "force-dynamic";

export default async function OutreachQueuePage({
  searchParams,
}: {
  searchParams?: Promise<{ intent?: string; focus?: string }>;
}) {
  const params = await searchParams;
  const [data, triageCount, typeCounts] = await Promise.all([
    getReconnectDashboardData(),
    getUntriagedReconnectCount(),
    getReconnectTypeCounts(),
  ]);

  const initialIntentFilter =
    params?.focus === "anchors"
      ? "anchors_only"
      : params?.intent === "triaged_ready"
        ? "triaged_ready"
        : null;

  return (
    <ReconnectClient
      data={data}
      triageCount={triageCount}
      typeCounts={typeCounts}
      initialIntentFilter={initialIntentFilter}
    />
  );
}
