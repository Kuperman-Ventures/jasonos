import {
  getWeekData,
  getAllWorkSearches,
  getAllBusinessHours,
} from "@/lib/server-actions/nyui";
import { getResumeApplicationQueue } from "@/lib/server-actions/resume-applications";
import { NyuiClient } from "@/components/jasonos/nyui/nyui-client";
import { etToday, weekRangeMonSun } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "NYUI · JasonOS" };

function getWeekBounds(): { start: string; end: string } {
  // Universal JasonOS reporting week: Monday → Sunday.
  return weekRangeMonSun(etToday());
}

export default async function NyuiPage() {
  const { start, end } = getWeekBounds();
  const [data, allWorkSearches, allBusinessHours, applicationQueue] =
    await Promise.all([
      getWeekData(start, end),
      getAllWorkSearches(),
      getAllBusinessHours(),
      getResumeApplicationQueue(),
    ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <NyuiClient
        initialData={data}
        weekStart={start}
        weekEnd={end}
        allWorkSearches={allWorkSearches}
        allBusinessHours={allBusinessHours}
        applicationQueue={applicationQueue}
      />
    </div>
  );
}
