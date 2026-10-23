import { WeekPlannerClient } from "@/components/jasonos/calendar/week-planner-client";
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
    <div style={{ height: "calc(100vh - 3rem)" }}>
      <WeekPlannerClient
        initialWeekData={weekData}
        initialMondayStr={mondayStr}
        initialAllocations={allocations}
        taskLibrary={tasks}
      />
    </div>
  );
}
