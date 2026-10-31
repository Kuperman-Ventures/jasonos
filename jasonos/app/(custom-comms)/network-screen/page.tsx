import { Suspense } from "react";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { NetworkScreenClient } from "@/components/jasonos/email/network-screen-client";

export const metadata: Metadata = { title: "Network Screen · JasonOS" };
export const dynamic = "force-dynamic";

export default async function NetworkScreenPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string | string[] }>;
}) {
  const params = await searchParams;
  const screen = Array.isArray(params.screen) ? params.screen[0] : params.screen;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rung-ink">
          <Users className="h-4 w-4" />
          Custom Comms
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Network Screen</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pick a contact, let Claude capture their visible LinkedIn network, then choose three
          intros and keep the rest on the bench.
        </p>
      </header>

      <Suspense>
        <NetworkScreenClient initialScreenId={screen ?? null} />
      </Suspense>
    </div>
  );
}
