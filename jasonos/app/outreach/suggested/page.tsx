import { Suspense } from "react";
import { getContactCandidates } from "@/lib/server-actions/contact-candidates";
import { listPendingIntros } from "@/lib/server-actions/network-screen";
import { isGmailConnected } from "@/lib/integrations/gmail";
import { SuggestedClient } from "@/components/jasonos/outreach/suggested-client";

export const metadata = { title: "Outreach · Suggested" };
export const dynamic = "force-dynamic";
/** Suggested list is filled by the top-nav Sync (90 days of Gmail + calendar + Beeper). */
export const maxDuration = 300;

export default async function OutreachSuggestedPage() {
  const [candidates, gmailConnected, pending] = await Promise.all([
    getContactCandidates(),
    isGmailConnected(),
    listPendingIntros(),
  ]);
  return (
    <Suspense>
      <SuggestedClient
        candidates={candidates}
        gmailConnected={gmailConnected}
        pendingIntros={pending.ok ? pending.intros : []}
      />
    </Suspense>
  );
}
