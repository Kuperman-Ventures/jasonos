import { Suspense } from "react";
import { getContactCandidates } from "@/lib/server-actions/contact-candidates";
import { isGmailConnected } from "@/lib/integrations/gmail";
import { SuggestedClient } from "@/components/jasonos/outreach/suggested-client";

export const metadata = { title: "Outreach · Suggested" };
export const dynamic = "force-dynamic";

export default async function OutreachSuggestedPage() {
  const [candidates, gmailConnected] = await Promise.all([
    getContactCandidates(),
    isGmailConnected(),
  ]);
  return (
    <Suspense>
      <SuggestedClient candidates={candidates} gmailConnected={gmailConnected} />
    </Suspense>
  );
}
