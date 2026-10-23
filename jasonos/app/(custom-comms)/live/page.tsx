import type { Metadata } from "next";
import { LiveMeetingsClient } from "@/components/jasonos/meeting-prep/live-meetings-client";
import { getLiveSettings } from "@/lib/server-actions/live-settings";
import {
  getRecentLiveMeetings,
  getUpcomingMeetingPreps,
} from "@/lib/server-actions/meeting-prep";
import { listLivePlans, listLiveScripts } from "@/lib/server-actions/live-scripts";

export const metadata: Metadata = { title: "Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LiveMeetingsPage() {
  const [result, scriptsResult, plansResult, upcomingResult, recentResult, settingsResult] =
    await Promise.all([
      getUpcomingMeetingPreps(2),
      listLiveScripts({ kind: "strategy" }),
      listLivePlans(),
      getUpcomingMeetingPreps(14),
      getRecentLiveMeetings(6),
      getLiveSettings(),
    ]);
  const unattachedPlans = plansResult.ok
    ? plansResult.plans.filter((plan) => !plan.attachedPrepId)
    : [];
  return (
    <LiveMeetingsClient
      nowIso={new Date().toISOString()}
      meetings={result.ok ? result.meetings : []}
      error={result.ok ? null : result.error}
      warnings={result.ok ? result.warnings : []}
      scripts={scriptsResult.ok ? scriptsResult.scripts : []}
      scriptsError={scriptsResult.ok ? null : scriptsResult.error}
      plans={unattachedPlans}
      plansError={plansResult.ok ? null : plansResult.error}
      upcomingMeetings={upcomingResult.ok ? upcomingResult.meetings : []}
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
