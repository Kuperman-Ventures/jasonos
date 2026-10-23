import { notFound } from "next/navigation";
import { CallSheetClient, type CallSheetView } from "@/components/jasonos/meeting-prep/call-sheet-client";
import { loadMeetingContext } from "@/lib/meeting-prep/context";
import { getCallSheet, getCallSheetPerson } from "@/lib/server-actions/call-sheet";
import { getLiveScript, listPlaybooks } from "@/lib/server-actions/live-scripts";
import { getMeetingPoints } from "@/lib/server-actions/meeting-points";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import { getMeetingReview } from "@/lib/server-actions/meeting-reviews";
import { getRelationshipLogForMeeting } from "@/lib/server-actions/person";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VIEWS = new Set<CallSheetView>(["read", "rehearse", "live", "debrief"]);

export default async function MeetingPrepPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [result, contextResult, pointsResult] = await Promise.all([
    getMeetingPrep(id),
    loadMeetingContext(id).then(
      (context) => ({ ok: true as const, context }),
      (error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      })
    ),
    getMeetingPoints(id),
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
  const [reviewResult, scriptResult, sheetResult, personResult, playbooksResult, logResult] =
    await Promise.all([
      getMeetingReview(result.prep.id),
      result.prep.scriptId ? getLiveScript(result.prep.scriptId) : Promise.resolve(null),
      getCallSheet({ prepId: result.prep.id }),
      getCallSheetPerson(result.prep.id),
      listPlaybooks(),
      getRelationshipLogForMeeting(result.prep.id),
    ]);
  const rubric = scriptResult?.ok ? scriptResult.script.rubric : [];
  const view = VIEWS.has(query.view as CallSheetView) ? (query.view as CallSheetView) : "read";

  return (
    <CallSheetClient
      key={result.prep.id}
      prep={result.prep}
      context={contextResult.context}
      sheet={sheetResult.ok ? sheetResult.sheet : null}
      sheetError={sheetResult.ok ? null : sheetResult.error}
      person={personResult.ok ? personResult.person : null}
      playbooks={playbooksResult.ok ? playbooksResult.playbooks : []}
      points={pointsResult.ok ? pointsResult.points : []}
      pointsError={pointsResult.ok ? null : pointsResult.error}
      rubric={rubric}
      review={reviewResult.ok ? reviewResult.review : null}
      log={logResult.ok ? logResult.log : null}
      initialView={view}
    />
  );
}
