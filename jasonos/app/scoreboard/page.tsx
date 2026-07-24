import { Suspense } from "react";
import { getScoreboardApplications } from "@/lib/server-actions/scoreboard";
import { ScoreboardClient } from "@/components/jasonos/scoreboard/scoreboard-client";

export const metadata = { title: "Scoreboard · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ScoreboardPage() {
  const applications = await getScoreboardApplications();
  return (
    <Suspense>
      <ScoreboardClient applications={applications} />
    </Suspense>
  );
}
