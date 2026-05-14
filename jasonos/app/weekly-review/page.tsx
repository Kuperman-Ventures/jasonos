import type { Metadata } from "next";
import { KpiDashboardClient } from "@/components/jasonos/weekly-review/kpi-dashboard-client";
import { getWeeklyReviewData } from "@/lib/server-actions/weekly-review";

export const metadata: Metadata = { title: "Weekly Review | JasonOS" };
export const dynamic = "force-dynamic";

export default async function WeeklyReviewPage() {
  const data = await getWeeklyReviewData();

  return (
    <main className="mx-auto max-w-5xl">
      <KpiDashboardClient
        completionLog={data.completionLog}
        calendarEventTags={data.calendarEventTags}
        fridayReviews={data.fridayReviews}
        quickLogs={data.quickLogs}
      />
    </main>
  );
}
