import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { EmailClient } from "@/components/jasonos/email/email-client";

export const metadata: Metadata = { title: "Email · JasonOS" };
export const dynamic = "force-dynamic";

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[]; screen?: string | string[] }>;
}) {
  const params = await searchParams;
  const section = Array.isArray(params.section) ? params.section[0] : params.section;
  if (section === "network-screen") {
    const screen = Array.isArray(params.screen) ? params.screen[0] : params.screen;
    redirect(screen ? `/network-screen?screen=${encodeURIComponent(screen)}` : "/network-screen");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rung-ink">
          <Mail className="h-4 w-4" />
          Custom Comms
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Email</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Start from a proven template or build a custom note from scratch, then
          open Apple Mail with the draft ready. You finish and send there - sync
          brings the send back into the queue.
        </p>
      </header>

      <Suspense>
        <EmailClient />
      </Suspense>
    </div>
  );
}
