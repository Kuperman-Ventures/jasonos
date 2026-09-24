import { Suspense } from "react";
import { SentFollowupsClient } from "@/components/jasonos/outreach/sent-followups-client";
import { getGoogleConnectionStatus } from "@/lib/integrations/google-tokens";
import { getSentEmailFollowups } from "@/lib/server-actions/sent-followups";

export const metadata = { title: "Outreach · Sent" };
export const dynamic = "force-dynamic";

export default async function OutreachSentPage() {
  const [rows, google] = await Promise.all([
    getSentEmailFollowups(),
    getGoogleConnectionStatus(),
  ]);
  return (
    <Suspense>
      <SentFollowupsClient
        rows={rows}
        advisorsConnected={google.advisorsConnected && !google.advisorsNeedsReconnect}
      />
    </Suspense>
  );
}
