import type { Metadata } from "next";
import { LiveMeetingsClient } from "@/components/jasonos/meeting-prep/live-meetings-client";
import { getTodaysMeetingPreps } from "@/lib/server-actions/meeting-prep";

export const metadata: Metadata = { title: "Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LiveMeetingsPage() {
  const result = await getTodaysMeetingPreps();
  return (
    <LiveMeetingsClient
      nowIso={new Date().toISOString()}
      meetings={result.ok ? result.meetings : []}
      error={result.ok ? null : result.error}
      warnings={result.ok ? result.warnings : []}
    />
  );
}
