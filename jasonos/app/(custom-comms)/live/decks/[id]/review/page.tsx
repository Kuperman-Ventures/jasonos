import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReviewView } from "@/components/jasonos/live/review-view";
import { getDeck } from "@/lib/server-actions/decks";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import { formatMeetingWhen } from "@/components/jasonos/live/live-format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getDeck(id);
  const name = result.ok ? result.deck.name : "Review";
  return { title: `${name} · Review · Live · JasonOS` };
}

export default async function DeckReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getDeck(id);
  if (!result.ok) {
    if (result.error === "Not found.") notFound();
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-[var(--jos-danger-text)]">{result.error}</p>
      </div>
    );
  }
  if (result.deck.kind !== "deck") notFound();

  let meetingLabel: string | null = null;
  if (result.deck.meetingPrepId) {
    const meetingResult = await getMeetingPrep(result.deck.meetingPrepId);
    if (meetingResult.ok) {
      meetingLabel = `${meetingResult.prep.title} · ${formatMeetingWhen(meetingResult.prep.startsAt)}`;
    }
  }

  return (
    <Suspense fallback={<div className="px-4 py-8 text-sm text-[var(--jos-muted)]">Loading…</div>}>
      <ReviewView deck={result.deck} meetingLabel={meetingLabel} />
    </Suspense>
  );
}
