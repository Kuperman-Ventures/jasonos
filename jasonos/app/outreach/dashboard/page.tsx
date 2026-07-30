import { Suspense } from "react";
import { getNetworkingReport } from "@/lib/server-actions/networking-status";
import { NetworkingDashboard } from "@/components/jasonos/outreach/networking-dashboard";

export const metadata = { title: "Dashboard · Outreach · JasonOS" };
export const dynamic = "force-dynamic";

export default async function OutreachDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const report = await getNetworkingReport({ week });
  return (
    <Suspense>
      <NetworkingDashboard report={report} />
    </Suspense>
  );
}
