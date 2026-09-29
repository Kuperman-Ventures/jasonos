import { Suspense } from "react";
import { MeetingFollowupsClient } from "@/components/jasonos/outreach/meeting-followups-client";
import { getGoogleConnectionStatus } from "@/lib/integrations/google-tokens";
import { getOpenMeetingFollowups } from "@/lib/server-actions/meeting-followups";

export const metadata = { title: "Outreach · Follow Up" };
export const dynamic = "force-dynamic";

export default async function OutreachFollowUpPage() {
  const [rows, google] = await Promise.all([
    getOpenMeetingFollowups(),
    getGoogleConnectionStatus(),
  ]);
  const calendarConnected =
    (google.advisorsConnected && !google.advisorsNeedsReconnect) ||
    (google.gmailConnected && !google.gmailNeedsReconnect);
  return (
    <Suspense>
      <MeetingFollowupsClient
        rows={rows}
        calendarConnected={calendarConnected}
      />
    </Suspense>
  );
}
