import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveCallClient } from "@/components/jasonos/meeting-prep/live-call-client";
import { getMeetingPoints } from "@/lib/server-actions/meeting-points";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";

export const dynamic = "force-dynamic";

export default async function LiveMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [prepResult, pointsResult] = await Promise.all([
    getMeetingPrep(id),
    getMeetingPoints(id),
  ]);
  if (!prepResult.ok) {
    if (prepResult.error === "Meeting prep not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{prepResult.error}</p>
      </div>
    );
  }
  if (!pointsResult.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <p className="text-sm text-muted-foreground">{pointsResult.error}</p>
        <Link
          href={`/meetings/${id}`}
          className="text-sm font-semibold text-[var(--color-accent-700)] hover:underline"
        >
          Back to the meeting
        </Link>
      </div>
    );
  }
  return (
    <LiveCallClient
      prep={prepResult.prep}
      points={pointsResult.points}
      liveStartedAt={prepResult.prep.liveStartedAt}
    />
  );
}
