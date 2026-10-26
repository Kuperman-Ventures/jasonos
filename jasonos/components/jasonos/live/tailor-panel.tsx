"use client";

import { useState, useTransition } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { tailorSlides, undoTailor } from "@/lib/server-actions/decks";

export function TailorPanel({
  deckId,
  aiNotes,
  onUpdated,
}: {
  deckId: string;
  aiNotes: string | null;
  onUpdated: () => void;
}) {
  const [notes, setNotes] = useState(aiNotes);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await tailorSlides(deckId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setNotes(result.aiNotes);
              toast.success("Slides tailored");
              onUpdated();
            })
          }
        >
          {pending ? <CircleNotch className="animate-spin" size={14} aria-hidden /> : null}
          Tailor
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await undoTailor(deckId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setNotes(null);
              toast.success("Undo applied");
              onUpdated();
            })
          }
        >
          Undo
        </Button>
      </div>
      {notes ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--jos-muted)] whitespace-pre-wrap">{notes}</p>
      ) : (
        <p className="mt-3 text-[13px] text-[var(--jos-muted)]">Tailor rewrites Slides using meeting context and recent email.</p>
      )}
    </div>
  );
}
