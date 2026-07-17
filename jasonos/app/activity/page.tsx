import { Suspense } from "react";
import { getNetworkingActivity } from "@/lib/server-actions/networking-status";
import { NetworkingActivityClient } from "@/components/jasonos/activity/networking-status-client";

export const metadata = { title: "Networking Activity · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const data = await getNetworkingActivity();
  return (
    <Suspense>
      <NetworkingActivityClient data={data} />
    </Suspense>
  );
}
