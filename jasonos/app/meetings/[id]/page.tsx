import { notFound } from "next/navigation";
import { MeetingPrepClient } from "@/components/jasonos/meeting-prep/meeting-prep-client";
import { loadMeetingContext } from "@/lib/meeting-prep/context";
import { getLiveScript, listLiveScripts } from "@/lib/server-actions/live-scripts";
import { getMeetingPoints } from "@/lib/server-actions/meeting-points";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import { getMeetingReview } from "@/lib/server-actions/meeting-reviews";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function MeetingPrepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, contextResult, pointsResult, scriptsResult] = await Promise.all([
    getMeetingPrep(id),
    loadMeetingContext(id).then(
      (context) => ({ ok: true as const, context }),
      (error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      })
    ),
    getMeetingPoints(id),
    listLiveScripts(),
  ]);
  if (!result.ok) {
    if (result.error === "Meeting prep not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }
  if (!contextResult.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{contextResult.error}</p>
      </div>
    );
  }
  const [reviewResult, scriptResult] = await Promise.all([
    getMeetingReview(result.prep.id),
    result.prep.scriptId ? getLiveScript(result.prep.scriptId) : Promise.resolve(null),
  ]);
  const rubric = scriptResult?.ok ? scriptResult.script.rubric : [];
  return (
    <MeetingPrepClient
      key={result.prep.id}
      prep={result.prep}
      context={contextResult.context}
      points={pointsResult.ok ? pointsResult.points : []}
      pointsError={pointsResult.ok ? null : pointsResult.error}
      scripts={scriptsResult.ok ? scriptsResult.scripts : []}
      rubric={rubric}
      review={reviewResult.ok ? reviewResult.review : null}
    />
  );
}
