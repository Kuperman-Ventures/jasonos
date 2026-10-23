import { WeekPlannerClient } from "@/components/jasonos/calendar/week-planner-client";
import { LiveTertiaryNav } from "@/components/jasonos/live/live-tertiary-nav";
import { fetchCalendarWeek, getAllocations } from "@/lib/server-actions/calendar";
import { getTasks } from "@/lib/server-actions/tasks";
import { formatLocalDate } from "@/lib/calendar/health-model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar · JasonOS" };

function getMondayStr(): string {
  const d = new Date();
  const day = d.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysToMonday + (day === 0 ? 7 : 0));
  d.setHours(0, 0, 0, 0);
  return formatLocalDate(d);
}

export default async function CalendarPage() {
  const mondayStr = getMondayStr();
  const [weekData, allocations, tasks] = await Promise.all([
    fetchCalendarWeek(mondayStr),
    getAllocations(),
    getTasks(),
  ]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
      <LiveTertiaryNav />
      <div className="min-h-0 flex-1">
        <WeekPlannerClient
          initialWeekData={weekData}
          initialMondayStr={mondayStr}
          initialAllocations={allocations}
          taskLibrary={tasks}
        />
      </div>
    </div>
  );
}
