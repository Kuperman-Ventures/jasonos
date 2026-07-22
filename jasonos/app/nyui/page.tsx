import { getWeekData, getAllWorkSearches } from "@/lib/server-actions/nyui";
import { getResumeApplicationQueue } from "@/lib/server-actions/resume-applications";
import { NyuiClient } from "@/components/jasonos/nyui/nyui-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "NYUI · JasonOS" };

function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(sunday), end: fmt(saturday) };
}

export default async function NyuiPage() {
  const { start, end } = getWeekBounds();
  const [data, allWorkSearches, applicationQueue] = await Promise.all([
    getWeekData(start, end),
    getAllWorkSearches(),
    getResumeApplicationQueue(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <NyuiClient
        initialData={data}
        weekStart={start}
        weekEnd={end}
        allWorkSearches={allWorkSearches}
        applicationQueue={applicationQueue}
      />
    </div>
  );
}
