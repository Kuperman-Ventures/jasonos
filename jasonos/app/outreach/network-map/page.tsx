import { Suspense } from "react";
import { getNetworkMapData } from "@/lib/server-actions/network-map";
import { NetworkMapClient } from "@/components/jasonos/outreach/network-map-client";

export const metadata = { title: "Network Map · Outreach · JasonOS" };
export const dynamic = "force-dynamic";

export default async function OutreachNetworkMapPage() {
  const data = await getNetworkMapData();
  return (
    <Suspense>
      <NetworkMapClient data={data} />
    </Suspense>
  );
}
