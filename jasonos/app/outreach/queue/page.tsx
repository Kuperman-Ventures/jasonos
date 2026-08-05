import { getThreeColumnQueue } from "@/lib/outreach/queue-buckets";
import { getWarmthReminders } from "@/lib/outreach/data";
import { getCommunicationsData } from "@/lib/server-actions/communications";
import { ThreeColumnQueueClient } from "@/components/jasonos/outreach/three-column-queue-client";
import { WarmthWidget } from "@/components/jasonos/outreach/warmth-widget";

export const metadata = { title: "Outreach · Queue" };
export const dynamic = "force-dynamic";

export default async function OutreachQueuePage() {
  const [buckets, warmthReminders, scheduleContacts] = await Promise.all([
    getThreeColumnQueue(),
    getWarmthReminders(12),
    getCommunicationsData(),
  ]);

  return (
    <>
      {warmthReminders.length > 0 ? (
        <div className="mx-auto max-w-[1500px] px-4 pt-4">
          <WarmthWidget reminders={warmthReminders} />
        </div>
      ) : null}
      <ThreeColumnQueueClient
        buckets={buckets}
        scheduleContacts={scheduleContacts}
      />
    </>
  );
}
