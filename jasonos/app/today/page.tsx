import type { Metadata } from "next";
import { TodayClient } from "@/components/jasonos/today/today-client";
import { getTodayData } from "@/lib/server-actions/today";

export const metadata: Metadata = { title: "Today | JasonOS" };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const data = await getTodayData();
  return (
    <main className="mx-auto max-w-5xl">
      <TodayClient
        initialTasks={data.tasks}
        initialSessions={data.sessions}
        date={data.date}
      />
    </main>
  );
}
