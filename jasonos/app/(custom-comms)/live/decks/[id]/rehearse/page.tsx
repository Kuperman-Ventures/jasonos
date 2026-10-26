import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DeckStage } from "@/components/jasonos/live/deck-stage";
import { getDeck } from "@/lib/server-actions/decks";

export const dynamic = "force-dynamic";

export default async function DeckRehearsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getDeck(id);
  if (!result.ok || result.deck.kind !== "deck") notFound();
  return (
    <Suspense>
      <DeckStage deck={result.deck} mode="rehearse" />
    </Suspense>
  );
}
