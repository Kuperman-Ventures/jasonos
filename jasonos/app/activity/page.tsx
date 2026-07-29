import { Suspense } from "react";
import { getNetworkingReport } from "@/lib/server-actions/networking-status";
import { NetworkingReportView } from "@/components/jasonos/activity/networking-report";

export const metadata = { title: "Networking Activity · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const report = await getNetworkingReport({ week });
  return (
    <Suspense>
      <NetworkingReportView report={report} />
    </Suspense>
  );
}
