import type { Metadata } from "next";
import { LiveAfterClient } from "@/components/jasonos/meeting-prep/live-after-client";
import { getRecentLiveMeetings } from "@/lib/server-actions/meeting-prep";

export const metadata: Metadata = { title: "After · Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LiveAfterPage() {
  const result = await getRecentLiveMeetings(24);
  return (
    <LiveAfterClient
      meetings={result.ok ? result.meetings : []}
      error={result.ok ? null : result.error}
    />
  );
}
