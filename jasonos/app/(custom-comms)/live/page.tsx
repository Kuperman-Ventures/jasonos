import type { Metadata } from "next";
import { LiveMeetingsClient } from "@/components/jasonos/meeting-prep/live-meetings-client";
import { getTodaysMeetingPreps } from "@/lib/server-actions/meeting-prep";
import { listLiveScripts } from "@/lib/server-actions/live-scripts";

export const metadata: Metadata = { title: "Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LiveMeetingsPage() {
  const [result, scriptsResult] = await Promise.all([
    getTodaysMeetingPreps(),
    listLiveScripts(),
  ]);
  return (
    <LiveMeetingsClient
      nowIso={new Date().toISOString()}
      meetings={result.ok ? result.meetings : []}
      error={result.ok ? null : result.error}
      warnings={result.ok ? result.warnings : []}
      scripts={scriptsResult.ok ? scriptsResult.scripts : []}
      scriptsError={scriptsResult.ok ? null : scriptsResult.error}
    />
  );
}
