import type { Metadata } from "next";
import { LiveMeetingsClient } from "@/components/jasonos/meeting-prep/live-meetings-client";
import { getLiveSettings } from "@/lib/server-actions/live-settings";
import { getRecentLiveMeetings, getTodaysMeetingPreps } from "@/lib/server-actions/meeting-prep";
import { listLiveScripts } from "@/lib/server-actions/live-scripts";

export const metadata: Metadata = { title: "Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LiveMeetingsPage() {
  const [result, scriptsResult, recentResult, settingsResult] = await Promise.all([
    getTodaysMeetingPreps(),
    listLiveScripts(),
    getRecentLiveMeetings(10),
    getLiveSettings(),
  ]);
  return (
    <LiveMeetingsClient
      nowIso={new Date().toISOString()}
      meetings={result.ok ? result.meetings : []}
      error={result.ok ? null : result.error}
      warnings={result.ok ? result.warnings : []}
      scripts={scriptsResult.ok ? scriptsResult.scripts : []}
      scriptsError={scriptsResult.ok ? null : scriptsResult.error}
      recent={recentResult.ok ? recentResult.meetings : []}
      recentError={recentResult.ok ? null : recentResult.error}
      settings={
        settingsResult.ok
          ? { targetCompanies: settingsResult.targetCompanies, snapshot: settingsResult.snapshot }
          : { targetCompanies: [], snapshot: null }
      }
      settingsError={settingsResult.ok ? null : settingsResult.error}
    />
  );
}
