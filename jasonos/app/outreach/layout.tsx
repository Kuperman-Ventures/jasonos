import type { ReactNode } from "react";
import { OutreachTabs } from "@/components/jasonos/outreach/outreach-tabs";
import { getOutreachSyncState } from "@/lib/outreach/data";
import { getNewCandidateCount } from "@/lib/server-actions/contact-candidates";
import { isGoogleGmailConnected } from "@/lib/integrations/google-tokens";

export const metadata = { title: "Networking · JasonOS" };
export const dynamic = "force-dynamic";

export default async function OutreachLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [syncState, suggestedCount, gmailPersonalConnected] = await Promise.all([
    getOutreachSyncState(),
    getNewCandidateCount(),
    isGoogleGmailConnected(),
  ]);
  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      <OutreachTabs
        syncState={syncState}
        suggestedCount={suggestedCount}
        gmailPersonalConnected={gmailPersonalConnected}
      />
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
