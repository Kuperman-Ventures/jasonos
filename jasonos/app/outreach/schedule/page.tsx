import { Suspense } from "react";
import { getCommunicationsData } from "@/lib/server-actions/communications";
import { getWarmthReminders } from "@/lib/outreach/data";
import { isGmailConnected } from "@/lib/integrations/gmail";
import { isGoogleGmailConnected } from "@/lib/integrations/google-tokens";
import { CommunicationsClient } from "@/components/jasonos/communications/communications-client";
import { WarmthWidget } from "@/components/jasonos/outreach/warmth-widget";

export const metadata = { title: "Outreach · Schedule" };
export const dynamic = "force-dynamic";

export default async function OutreachSchedulePage() {
  const [contacts, gmailConnected, gmailPersonalConnected, warmthReminders] = await Promise.all([
    getCommunicationsData(),
    isGmailConnected(),
    isGoogleGmailConnected(),
    getWarmthReminders(12),
  ]);
  return (
    <Suspense>
      {warmthReminders.length > 0 ? (
        <div className="px-4 pt-4">
          <WarmthWidget reminders={warmthReminders} />
        </div>
      ) : null}
      <CommunicationsClient
        contacts={contacts}
        gmailConnected={gmailConnected}
        gmailPersonalConnected={gmailPersonalConnected}
      />
    </Suspense>
  );
}
