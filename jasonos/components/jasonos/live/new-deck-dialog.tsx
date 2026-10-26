"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeckSummary } from "@/lib/server-actions/decks";
import { createBlankDeck, createDeckFromPlaybook } from "@/lib/server-actions/decks";

export function NewDeckDialog({
  playbooks,
  meetingPrepId,
  meetingTitle,
  triggerLabel = "New deck",
  triggerClassName,
}: {
  playbooks: DeckSummary[];
  meetingPrepId?: string;
  meetingTitle?: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const createBlank = () =>
    start(async () => {
      const result = await createBlankDeck(
        meetingTitle?.trim() || undefined,
        meetingPrepId ?? null
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.push(`/live/decks/${result.id}`);
      router.refresh();
    });

  const fromPlaybook = (playbookId: string) =>
    start(async () => {
      const result = await createDeckFromPlaybook(playbookId, meetingPrepId ?? null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.push(`/live/decks/${result.id}`);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New deck</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Button type="button" className="w-full justify-start" disabled={pending} onClick={createBlank}>
            Blank deck
          </Button>
          {playbooks.length ? (
            <div className="border-t border-[var(--jos-line)] pt-3">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--jos-muted)]">
                From Playbook
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {playbooks.map((playbook) => (
                  <li key={playbook.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start py-2 text-left"
                      disabled={pending}
                      onClick={() => fromPlaybook(playbook.id)}
                    >
                      <span className="font-medium">{playbook.name}</span>
                      <span className="ml-2 text-[12px] text-[var(--jos-muted)]">
                        {playbook.slideCount} slides
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
