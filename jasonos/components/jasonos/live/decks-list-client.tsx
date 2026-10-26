"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetingPickerDialog, type MeetingOption } from "@/components/jasonos/live/meeting-picker-dialog";
import type { DeckSummary } from "@/lib/server-actions/decks";
import { copyDeck, deleteDeck, renameDeck } from "@/lib/server-actions/decks";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Row = {
  deck: DeckSummary;
  meetingTitle: string | null;
  meetingStartsAt: string | null;
};

export function DecksListClient({
  rows,
  meetings,
}: {
  rows: Row[];
  meetings: MeetingOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [linkDeckId, setLinkDeckId] = useState<string | null>(null);

  if (!rows.length) {
    return <p className="mt-8 text-sm text-[var(--jos-muted)]">No decks yet.</p>;
  }

  return (
    <>
      <ul className="mt-8 divide-y divide-[var(--jos-line)] border border-[var(--jos-line)] bg-[var(--jos-surface)]">
        {rows.map(({ deck, meetingTitle, meetingStartsAt }) => {
          const state = deck.hasTranscript
            ? "Transcript"
            : deck.runStartedAt
              ? "Run"
              : "Draft";
          return (
            <li key={deck.id} className="group relative px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link href={`/live/decks/${deck.id}`} className="min-w-0 flex-1 hover:underline">
                  {renamingId === deck.id ? null : (
                    <>
                      <p className="truncate text-sm font-semibold text-[var(--jos-ink)]">{deck.name}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
                        {meetingTitle
                          ? `${meetingTitle}${meetingStartsAt ? ` · ${formatWhen(meetingStartsAt)}` : ""}`
                          : "No meeting"}
                        {" · "}
                        {deck.slideCount} slides · {state}
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
                    onClick={() => setLinkDeckId(deck.id)}
                  >
                    {deck.meetingPrepId ? "Change meeting" : "Link meeting"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await copyDeck(deck.id);
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Copied");
                        router.push(`/live/decks/${result.id}`);
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
                      setRenamingId(deck.id);
                      setRenameValue(deck.name);
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
                        if (!window.confirm(`Delete deck “${deck.name}”?`)) return;
                        const result = await deleteDeck(deck.id);
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
              {renamingId === deck.id ? (
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
                        const result = await renameDeck(deck.id, renameValue);
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
          );
        })}
      </ul>
      {linkDeckId ? (
        <MeetingPickerDialog
          open
          onOpenChange={(open) => {
            if (!open) setLinkDeckId(null);
          }}
          deckId={linkDeckId}
          meetings={meetings}
          linkedMeetingId={
            rows.find((row) => row.deck.id === linkDeckId)?.deck.meetingPrepId ?? null
          }
          onDone={() => {
            setLinkDeckId(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
