import { Suspense } from "react";
import { getCommunicationsData } from "@/lib/server-actions/communications";
import { getWarmthReminders } from "@/lib/outreach/data";
import { isGmailConnected } from "@/lib/integrations/gmail";
import { CommunicationsClient } from "@/components/jasonos/communications/communications-client";
import { WarmthWidget } from "@/components/jasonos/outreach/warmth-widget";

export const metadata = { title: "Outreach · Schedule" };
export const dynamic = "force-dynamic";

export default async function OutreachSchedulePage() {
  const [contacts, gmailConnected, warmthReminders] = await Promise.all([
    getCommunicationsData(),
    isGmailConnected(),
    getWarmthReminders(12),
  ]);
  return (
    <Suspense>
      {warmthReminders.length > 0 ? (
        <div className="px-4 pt-4">
          <WarmthWidget reminders={warmthReminders} />
        </div>
      ) : null}
      <CommunicationsClient contacts={contacts} gmailConnected={gmailConnected} />
    </Suspense>
  );
}
