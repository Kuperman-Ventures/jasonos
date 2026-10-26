"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeckSummary } from "@/lib/server-actions/decks";
import { createBlankDeck, createDeckFromPlaybook } from "@/lib/server-actions/decks";

const primaryBtnClass = "h-12 w-full text-sm font-bold";

export function LiveHomeStart({ playbooks }: { playbooks: DeckSummary[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [deckName, setDeckName] = useState("");

  const picked = playbooks.find((row) => row.id === pickedId) ?? null;

  const openPlaybookDialog = () => {
    setPickedId(null);
    setDeckName("");
    setPlaybookOpen(true);
  };

  const pickPlaybook = (playbook: DeckSummary) => {
    setPickedId(playbook.id);
    setDeckName(playbook.name);
  };

  const createBlank = () =>
    start(async () => {
      const result = await createBlankDeck();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/live/decks/${result.id}`);
      router.refresh();
    });

  const createFromPlaybook = () =>
    start(async () => {
      if (!pickedId) return;
      const result = await createDeckFromPlaybook(pickedId, null, deckName);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPlaybookOpen(false);
      router.push(`/live/decks/${result.id}`);
      router.refresh();
    });

  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-4 min-[900px]:grid-cols-3">
        <div className="flex flex-col border border-[var(--jos-line)] bg-[var(--jos-surface)] p-5">
          <h2 className="text-base font-extrabold text-[var(--jos-ink)]">From scratch</h2>
          <p className="mt-2 flex-1 text-sm text-[var(--jos-muted)]">
            A blank deck. One empty slide.
          </p>
          <Button type="button" className={primaryBtnClass} disabled={pending} onClick={createBlank}>
            New deck
          </Button>
        </div>

        <div className="flex flex-col border border-[var(--jos-line)] bg-[var(--jos-surface)] p-5">
          <h2 className="text-base font-extrabold text-[var(--jos-ink)]">From a playbook</h2>
          <p className="mt-2 flex-1 text-sm text-[var(--jos-muted)]">
            Copy a playbook&apos;s slides and edit from there.
          </p>
          <Button
            type="button"
            className={primaryBtnClass}
            disabled={pending}
            onClick={openPlaybookDialog}
          >
            Choose playbook
          </Button>
        </div>

        <div className="flex flex-col border border-[var(--jos-line)] bg-[var(--jos-surface)] p-5">
          <h2 className="text-base font-extrabold text-[var(--jos-ink)]">Library</h2>
          <p className="mt-2 flex-1 text-sm text-[var(--jos-muted)]">
            Playbooks, decks and held meetings.
          </p>
          <Link
            href="/live/library"
            className={cn(buttonVariants(), primaryBtnClass, pending && "pointer-events-none opacity-[0.45]")}
          >
            Open library
          </Link>
        </div>
      </div>

      <Dialog open={playbookOpen} onOpenChange={setPlaybookOpen}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{picked ? "Name your deck" : "Choose playbook"}</DialogTitle>
          </DialogHeader>
          {picked ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--jos-muted)]">
                From <span className="font-semibold text-[var(--jos-ink)]">{picked.name}</span>
              </p>
              <Input
                value={deckName}
                onChange={(event) => setDeckName(event.target.value)}
                className="border-[var(--jos-line)] bg-[var(--jos-bg)]"
                autoFocus
              />
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-[var(--jos-line)] overflow-y-auto border border-[var(--jos-line)]">
              {playbooks.length === 0 ? (
                <li className="px-3 py-4 text-sm text-[var(--jos-muted)]">No playbooks yet.</li>
              ) : (
                playbooks.map((playbook) => (
                  <li key={playbook.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-3 text-left hover:bg-[var(--jos-surface)]"
                      disabled={pending}
                      onClick={() => pickPlaybook(playbook)}
                    >
                      <p className="text-sm font-semibold text-[var(--jos-ink)]">{playbook.name}</p>
                      {playbook.description ? (
                        <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
                          {playbook.description}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
                        {playbook.slideCount} slides
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {picked ? (
              <>
                <Button type="button" variant="ghost" disabled={pending} onClick={() => setPickedId(null)}>
                  Back
                </Button>
                <Button type="button" disabled={pending || !deckName.trim()} onClick={createFromPlaybook}>
                  Create
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setPlaybookOpen(false)}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
