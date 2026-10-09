import { notFound } from "next/navigation";
import { MeetingPrepClient } from "@/components/jasonos/meeting-prep/meeting-prep-client";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function MeetingPrepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getMeetingPrep(id);
  if (!result.ok) {
    if (result.error === "Meeting prep not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }
  return <MeetingPrepClient key={result.prep.id} prep={result.prep} />;
}
