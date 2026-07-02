import type { ReactNode } from "react";
import { OutreachTabs } from "@/components/jasonos/outreach/outreach-tabs";
import { getOutreachSyncState } from "@/lib/outreach/data";
import { getNewCandidateCount } from "@/lib/server-actions/contact-candidates";

export const metadata = { title: "Outreach · JasonOS" };
export const dynamic = "force-dynamic";

export default async function OutreachLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [syncState, suggestedCount] = await Promise.all([
    getOutreachSyncState(),
    getNewCandidateCount(),
  ]);
  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      <OutreachTabs syncState={syncState} suggestedCount={suggestedCount} />
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
