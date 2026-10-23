import type { Metadata } from "next";
import { LiveMeetingsClient } from "@/components/jasonos/meeting-prep/live-meetings-client";
import { etToday, mondayStartOfWeekYmd } from "@/lib/dates";
import { getWeeklyActivity } from "@/lib/server-actions/activity-log";
import { getSheetStatuses } from "@/lib/server-actions/call-sheet";
import { getLiveSettings } from "@/lib/server-actions/live-settings";
import { listLivePlans, listPlaybooks } from "@/lib/server-actions/live-scripts";
import { getUpcomingMeetingPreps } from "@/lib/server-actions/meeting-prep";

export const metadata: Metadata = { title: "Live · JasonOS" };
export const dynamic = "force-dynamic";

export default async function LiveMeetingsPage() {
  const [result, activityResult, sheetsResult, upcomingResult, playbooksResult, settingsResult] =
    await Promise.all([
      getUpcomingMeetingPreps(2),
      getWeeklyActivity(),
      listLivePlans(),
      getUpcomingMeetingPreps(14),
      listPlaybooks(),
      getLiveSettings(),
    ]);
  const meetings = result.ok ? result.meetings : [];
  const statusesResult = await getSheetStatuses(
    meetings.map((meeting) => ({
      id: meeting.id,
      primaryContactId: meeting.primaryContactId,
      attendeeContactIds: meeting.attendees
        .map((attendee) => attendee.contactId)
        .filter((id): id is string => Boolean(id)),
    }))
  );
  const warnings = result.ok ? [...result.warnings] : [];
  if (!statusesResult.ok) warnings.push(statusesResult.error);
  return (
    <LiveMeetingsClient
      nowIso={new Date().toISOString()}
      meetings={meetings}
      statuses={statusesResult.ok ? statusesResult.statuses : {}}
      error={result.ok ? null : result.error}
      warnings={warnings}
      activity={activityResult.ok ? activityResult.activity : null}
      activityError={activityResult.ok ? null : activityResult.error}
      weekStart={mondayStartOfWeekYmd(etToday())}
      sheets={sheetsResult.ok ? sheetsResult.plans.filter((sheet) => !sheet.attachedPrepId) : []}
      sheetsError={sheetsResult.ok ? null : sheetsResult.error}
      upcomingMeetings={upcomingResult.ok ? upcomingResult.meetings : []}
      playbooks={playbooksResult.ok ? playbooksResult.playbooks : []}
      playbooksError={playbooksResult.ok ? null : playbooksResult.error}
      settings={
        settingsResult.ok
          ? { targetCompanies: settingsResult.targetCompanies, snapshot: settingsResult.snapshot }
          : { targetCompanies: [], snapshot: null }
      }
      settingsError={settingsResult.ok ? null : settingsResult.error}
    />
  );
}
