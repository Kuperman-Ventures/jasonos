"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LIVE_FIELD, LIVE_SECTION_LABEL } from "@/components/jasonos/live";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FAMILY_LABELS,
  QUESTION_TOPICS,
  QUESTION_TOPIC_LABELS,
  readyGates,
} from "@/lib/meeting-prep/playbook-blocks";
import {
  createLiveScript,
  type LiveScript,
  type PlaybookQuestion,
} from "@/lib/server-actions/live-scripts";
import { cn } from "@/lib/utils";

export function PlaybooksIndexClient({
  playbooks,
  questions,
  error,
}: {
  playbooks: LiveScript[];
  questions: PlaybookQuestion[];
  error: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const blank = playbooks.find((playbook) => playbook.family === "blank") ?? null;
  const groups = QUESTION_TOPICS.map((topic) => ({
    topic,
    rows: questions.filter((question) => question.topic === topic),
  })).filter((group) => group.rows.length > 0);

  const create = () => {
    if (!name.trim()) {
      toast.error("Name the playbook.");
      return;
    }
    setCreating(true);
    void createLiveScript({
      name,
      kind: "strategy",
      family: "custom",
      blocks: blank?.blocks ?? [],
    }).then((result) => {
      setCreating(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      setName("");
      router.push(`/live/scripts/${result.script.id}`);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 min-[900px]:px-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--jos-ink)]">Playbooks</h1>
          <p className="mt-1 text-[14px] text-[var(--jos-muted)]">
            One template per kind of call. A call sheet is built from its blocks.
          </p>
        </div>
        <Button type="button" variant="default" size="sm" onClick={() => setOpen(true)}>
          New playbook
        </Button>
      </header>
      {error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{error}</p> : null}
      {playbooks.length === 0 ? (
        <p className="text-[15px] text-[var(--jos-muted)]">No playbooks yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--jos-line)] border-t border-b border-[var(--jos-line)]">
          {playbooks.map((playbook) => {
            const gates = readyGates(playbook.blocks);
            const blockCount = playbook.blocks.length;
            return (
              <li key={playbook.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/live/scripts/${playbook.id}`}
                    className="text-[16px] font-bold text-[var(--jos-ink)] hover:underline"
                  >
                    {playbook.name}
                  </Link>
                  <p className="mt-0.5 text-[13px] tabular-nums text-[var(--jos-muted)]">
                    {FAMILY_LABELS[playbook.family]}
                    {" · "}
                    {blockCount === 1 ? "1 block" : `${blockCount} blocks`}
                    {" · "}
                    {playbook.itemCount === 1 ? "1 point" : `${playbook.itemCount} points`}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-[12px] font-bold uppercase tracking-[0.08em]",
                    gates.length ? "text-[var(--color-accent-2-text)]" : "text-[var(--jos-muted)]"
                  )}
                >
                  {gates.length ? `Ready needs ${gates.join(", ")}` : "No Ready gate"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <section id="questions" className="space-y-4 pt-4">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight">Question bank</h2>
          <p className="mt-1 text-[14px] text-[var(--jos-muted)]">
            Shared questions every playbook can use. Questions added on a playbook stay with it.
          </p>
        </div>
        {groups.length === 0 ? (
          <p className="text-[15px] text-[var(--jos-muted)]">No questions yet.</p>
        ) : (
          <div className="grid gap-6 min-[900px]:grid-cols-2">
            {groups.map((group) => (
              <div key={group.topic}>
                <p className={LIVE_SECTION_LABEL}>{QUESTION_TOPIC_LABELS[group.topic]}</p>
                <ul className="mt-1 divide-y divide-[var(--jos-line)]">
                  {group.rows.map((question) => (
                    <li key={question.id} className="py-2">
                      <p className="text-[15px] font-semibold leading-snug">{question.text}</p>
                      {question.spoken ? (
                        <p className="mt-0.5 text-[14px] leading-snug text-[var(--jos-muted)]">
                          {question.spoken}
                        </p>
                      ) : null}
                      {question.source ? (
                        <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">{question.source}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (creating) return;
          setOpen(next);
          if (!next) setName("");
        }}
      >
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New playbook</DialogTitle>
            <DialogDescription>Starts from Blank&apos;s blocks. Change them on the next page.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create();
            }}
          >
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Name</span>
              <input
                autoFocus
                required
                value={name}
                maxLength={120}
                className={cn(LIVE_FIELD, "h-11")}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={creating} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={creating}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
