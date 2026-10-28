import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DeckEditor } from "@/components/jasonos/live/deck-editor";
import { getDeck } from "@/lib/server-actions/decks";

export const dynamic = "force-dynamic";

export default async function PlaybookEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getDeck(id);
  if (!result.ok) {
    if (result.error === "Not found.") notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-[var(--jos-danger-text)]">{result.error}</p>
      </div>
    );
  }
  if (result.deck.kind !== "playbook") notFound();
  return (
    <Suspense fallback={<div className="px-4 py-8 text-sm text-[var(--jos-muted)]">Loading…</div>}>
      <DeckEditor deck={result.deck} />
    </Suspense>
  );
}
