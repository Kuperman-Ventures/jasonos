import { Suspense } from "react";
import { MeetingFollowupsClient } from "@/components/jasonos/outreach/meeting-followups-client";
import { SentFollowupsClient } from "@/components/jasonos/outreach/sent-followups-client";
import { getGoogleConnectionStatus } from "@/lib/integrations/google-tokens";
import { getOutlookConnectionStatus } from "@/lib/integrations/outlook-tokens";
import { getOpenMeetingFollowups } from "@/lib/server-actions/meeting-followups";
import { getSentEmailFollowups } from "@/lib/server-actions/sent-followups";

export const metadata = { title: "Outreach · Follow Up" };
export const dynamic = "force-dynamic";

export default async function OutreachFollowUpPage() {
  const [meetingRows, sentRows, google, outlook] = await Promise.all([
    getOpenMeetingFollowups(),
    getSentEmailFollowups(),
    getGoogleConnectionStatus(),
    getOutlookConnectionStatus(),
  ]);
  const calendarConnected =
    (google.advisorsConnected && !google.advisorsNeedsReconnect) ||
    (google.gmailConnected && !google.gmailNeedsReconnect) ||
    (outlook.connected && !outlook.needsReconnect);
  const mailConnected =
    (google.advisorsConnected && !google.advisorsNeedsReconnect) ||
    (google.gmailConnected && !google.gmailNeedsReconnect) ||
    (outlook.connected && !outlook.needsReconnect);

  return (
    <Suspense>
      <div className="space-y-10 pb-10">
        <MeetingFollowupsClient
          rows={meetingRows}
          calendarConnected={calendarConnected}
        />
        <SentFollowupsClient rows={sentRows} mailConnected={mailConnected} />
      </div>
    </Suspense>
  );
}
