import type { Metadata } from "next";
import { LiveBeforeClient } from "@/components/jasonos/meeting-prep/live-before-client";
import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";

export const metadata: Metadata = { title: "Before · Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LiveBeforePage() {
  const result = await getUpcomingMeetingPreps(14);
  return (
    <LiveBeforeClient
      nowIso={new Date().toISOString()}
      meetings={result.ok ? result.meetings : []}
      error={result.ok ? null : result.error}
      warnings={result.ok ? result.warnings : []}
    />
  );
}
