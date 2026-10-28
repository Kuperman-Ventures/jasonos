"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLeaveGuard } from "@/components/jasonos/live/leave-guard";
import {
  createPlaybookFromDeck,
  updatePlaybookFromDeck,
} from "@/lib/server-actions/decks";

export function SaveAsMenu({
  deckId,
  deckName,
  deckSlideCount,
  sourcePlaybook,
  onUpdated,
}: {
  deckId: string;
  deckName: string;
  deckSlideCount: number;
  sourcePlaybook: { id: string; name: string; slideCount: number } | null;
  onUpdated: () => void;
}) {
  const { requestLeave } = useLeaveGuard();
  const [menuOpen, setMenuOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState(deckName);
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();

  const runGuarded = (proceed: () => void) => {
    setMenuOpen(false);
    requestLeave(proceed);
  };

  return (
    <div className="relative">
      <Button type="button" size="sm" variant="outline" onClick={() => setMenuOpen((v) => !v)}>
        Save as
      </Button>
      {menuOpen ? (
        <div className="absolute left-0 z-20 mt-1 min-w-[16rem] rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-bg)] py-1 shadow-sm">
          {sourcePlaybook ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-[14px] hover:bg-[color-mix(in_srgb,var(--jos-focus)_8%,transparent)]"
              onClick={() =>
                runGuarded(() => {
                  setUpdateOpen(true);
                })
              }
            >
              Update playbook &ldquo;{sourcePlaybook.name}&rdquo;
            </button>
          ) : null}
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[14px] hover:bg-[color-mix(in_srgb,var(--jos-focus)_8%,transparent)]"
            onClick={() =>
              runGuarded(() => {
                setName(deckName);
                setDescription("");
                setCreateOpen(true);
              })
            }
          >
            New playbook from this deck
          </button>
        </div>
      ) : null}

      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update playbook</DialogTitle>
          </DialogHeader>
          {sourcePlaybook ? (
            <p className="text-[14px] text-[var(--jos-ink)]">
              Replace the {sourcePlaybook.slideCount} slides in {sourcePlaybook.name} with the{" "}
              {deckSlideCount} slides in this deck?
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setUpdateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !sourcePlaybook}
              onClick={() =>
                start(async () => {
                  const result = await updatePlaybookFromDeck(deckId);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`${result.playbookName} updated.`);
                  setUpdateOpen(false);
                  onUpdated();
                })
              }
            >
              Update playbook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New playbook from this deck</DialogTitle>
          </DialogHeader>
          <label className="block text-[12px] font-semibold uppercase tracking-wide text-[var(--jos-muted)]">
            Name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 border-[var(--jos-line)] bg-[var(--jos-bg)]"
            />
          </label>
          <label className="mt-3 block text-[12px] font-semibold uppercase tracking-wide text-[var(--jos-muted)]">
            Description
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="mt-1 border-[var(--jos-line)] bg-[var(--jos-bg)]"
              placeholder="What this is for"
            />
          </label>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !name.trim()}
              onClick={() =>
                start(async () => {
                  const result = await createPlaybookFromDeck(deckId, {
                    name,
                    description,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(
                    <span>
                      Playbook {result.name} created.{" "}
                      <Link href={`/live/playbooks/${result.playbookId}`} className="underline">
                        Open
                      </Link>
                    </span>
                  );
                  setCreateOpen(false);
                  onUpdated();
                })
              }
            >
              Create playbook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
