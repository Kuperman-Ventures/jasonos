import { Suspense } from "react";
import { BrowningNetworkingClient } from "@/components/jasonos/browning-networking/browning-networking-client";
import { getBrowningNetworkingPage } from "@/lib/browning-networking/data";

export const metadata = { title: "Browning Networking" };
export const dynamic = "force-dynamic";

export default async function BrowningNetworkingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const page = await getBrowningNetworkingPage();
  return (
    <Suspense>
      <BrowningNetworkingClient page={page} initialId={params.id} />
    </Suspense>
  );
}
