import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { EmailTemplatesClient } from "@/components/jasonos/email-templates/email-templates-client";

export const metadata: Metadata = { title: "Email Templates · JasonOS" };
export const dynamic = "force-dynamic";

export default function EmailTemplatesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-300">
          <Mail className="h-4 w-4" />
          Custom Communications
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Email Templates
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pick a reconnection note, choose someone from your contact list, fill
          the personal bits, then open Apple Mail with the draft ready. You
          finish and send there - sync brings the send back into the queue.
        </p>
      </header>

      <EmailTemplatesClient />
    </div>
  );
}
