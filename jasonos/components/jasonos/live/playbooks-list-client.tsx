"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeckSummary } from "@/lib/server-actions/decks";
import { copyDeck, deleteDeck, renameDeck } from "@/lib/server-actions/decks";

export function PlaybooksListClient({ playbooks }: { playbooks: DeckSummary[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  if (!playbooks.length) {
    return <p className="mt-8 text-sm text-[var(--jos-muted)]">No playbooks yet.</p>;
  }

  return (
    <ul className="mt-8 divide-y divide-[var(--jos-line)] border border-[var(--jos-line)] bg-[var(--jos-surface)]">
      {playbooks.map((playbook) => (
        <li key={playbook.id} className="group px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link href={`/live/playbooks/${playbook.id}`} className="min-w-0 flex-1 hover:underline">
              {renamingId === playbook.id ? null : (
                <>
                  <p className="truncate text-sm font-semibold">{playbook.name}</p>
                  {playbook.description ? (
                    <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">{playbook.description}</p>
                  ) : null}
                  <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
                    {playbook.slideCount} slides
                  </p>
                </>
              )}
            </Link>
            <div className="flex flex-wrap gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await copyDeck(playbook.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Copied");
                    router.push(`/live/playbooks/${result.id}`);
                    router.refresh();
                  })
                }
              >
                Copy
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setRenamingId(playbook.id);
                  setRenameValue(playbook.name);
                }}
              >
                Rename
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-[var(--jos-danger-text)]"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!window.confirm(`Delete playbook “${playbook.name}”?`)) return;
                    const result = await deleteDeck(playbook.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Deleted");
                    router.refresh();
                  })
                }
              >
                Delete
              </Button>
            </div>
          </div>
          {renamingId === playbook.id ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                className="max-w-sm border-[var(--jos-line)] bg-[var(--jos-bg)]"
              />
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await renameDeck(playbook.id, renameValue);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    setRenamingId(null);
                    router.refresh();
                  })
                }
              >
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                Cancel
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
