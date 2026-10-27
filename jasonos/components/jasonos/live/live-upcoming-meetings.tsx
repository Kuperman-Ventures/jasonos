"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  formatMeetingDate,
  formatMeetingTime,
} from "@/components/jasonos/live/live-format";
import type { AttachableMeeting, DeckSummary } from "@/lib/server-actions/decks";
import {
  createBlankDeck,
  createDeckFromLibrary,
  createDeckFromPlaybook,
} from "@/lib/server-actions/decks";

type StartMode = "choose" | "playbook" | "library" | "name-playbook";

function meetingPeopleLine(names: string[]): string {
  if (!names.length) return "No attendees listed";
  return names.join(", ");
}

export function LiveUpcomingMeetings({
  meetings,
  playbooks,
  libraryDecks,
}: {
  meetings: AttachableMeeting[];
  playbooks: DeckSummary[];
  libraryDecks: DeckSummary[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<AttachableMeeting | null>(null);
  const [mode, setMode] = useState<StartMode>("choose");
  const [pickedPlaybookId, setPickedPlaybookId] = useState<string | null>(null);
  const [deckName, setDeckName] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");

  const pickedPlaybook = playbooks.find((row) => row.id === pickedPlaybookId) ?? null;

  const filteredLibrary = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return libraryDecks;
    return libraryDecks.filter((row) => row.name.toLowerCase().includes(q));
  }, [libraryDecks, libraryQuery]);

  const openStart = (meeting: AttachableMeeting) => {
    setTarget(meeting);
    setMode("choose");
    setPickedPlaybookId(null);
    setDeckName(meeting.title);
    setLibraryQuery("");
  };

  const closeStart = () => {
    setTarget(null);
    setMode("choose");
    setPickedPlaybookId(null);
    setDeckName("");
    setLibraryQuery("");
  };

  const goToDeck = (id: string) => {
    closeStart();
    router.push(`/live/decks/${id}`);
    router.refresh();
  };

  const createBlank = () => {
    if (!target) return;
    start(async () => {
      const result = await createBlankDeck(target.title, target.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      goToDeck(result.id);
    });
  };

  const createFromPlaybook = () => {
    if (!target || !pickedPlaybookId) return;
    start(async () => {
      const result = await createDeckFromPlaybook(
        pickedPlaybookId,
        target.id,
        deckName.trim() || target.title
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      goToDeck(result.id);
    });
  };

  const createFromLibrary = (sourceId: string) => {
    if (!target) return;
    start(async () => {
      const result = await createDeckFromLibrary(sourceId, target.id, target.title);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      goToDeck(result.id);
    });
  };

  const dialogTitle =
    mode === "choose"
      ? "Start a deck"
      : mode === "playbook"
        ? "From a playbook"
        : mode === "name-playbook"
          ? "Name your deck"
          : "From the Library";

  return (
    <>
      <section className="mt-12">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
          Upcoming
        </h2>
        <p className="mt-1 text-[13px] text-[var(--jos-muted)]">Next 7 days</p>
        {meetings.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--jos-muted)]">No meetings in the next week.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--jos-line)]">
            {meetings.map((meeting) => (
              <li
                key={meeting.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--jos-muted)]">
                    {formatMeetingDate(meeting.startsAt)}, {formatMeetingTime(meeting.startsAt)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--jos-ink)]">
                    {meeting.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
                    {meetingPeopleLine(meeting.attendeeNames)}
                  </p>
                </div>
                {meeting.hasDeck && meeting.deckId ? (
                  <Link
                    href={`/live/decks/${meeting.deckId}`}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    Open deck
                  </Link>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => openStart(meeting)}
                  >
                    Start deck
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) closeStart();
        }}
      >
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          {target ? (
            <p className="text-[13px] text-[var(--jos-muted)]">
              {target.title}
              {target.attendeeNames.length
                ? ` · ${meetingPeopleLine(target.attendeeNames)}`
                : ""}
            </p>
          ) : null}

          {mode === "choose" ? (
            <div className="grid gap-2">
              <Button
                type="button"
                className="h-auto w-full justify-start px-3 py-3 text-left"
                disabled={pending}
                onClick={createBlank}
              >
                <span>
                  <span className="block text-sm font-bold">New deck</span>
                  <span className="mt-0.5 block text-[12px] font-normal opacity-80">
                    Blank deck linked to this meeting
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start px-3 py-3 text-left"
                disabled={pending}
                onClick={() => setMode("playbook")}
              >
                <span>
                  <span className="block text-sm font-bold">From a playbook</span>
                  <span className="mt-0.5 block text-[12px] font-normal text-[var(--jos-muted)]">
                    Copy playbook slides for this meeting
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start px-3 py-3 text-left"
                disabled={pending}
                onClick={() => setMode("library")}
              >
                <span>
                  <span className="block text-sm font-bold">From the Library</span>
                  <span className="mt-0.5 block text-[12px] font-normal text-[var(--jos-muted)]">
                    Start from an existing deck
                  </span>
                </span>
              </Button>
            </div>
          ) : null}

          {mode === "playbook" ? (
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
                      onClick={() => {
                        setPickedPlaybookId(playbook.id);
                        setDeckName(target?.title || playbook.name);
                        setMode("name-playbook");
                      }}
                    >
                      <p className="text-sm font-semibold text-[var(--jos-ink)]">{playbook.name}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
                        {playbook.slideCount} slides
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}

          {mode === "name-playbook" && pickedPlaybook ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--jos-muted)]">
                From{" "}
                <span className="font-semibold text-[var(--jos-ink)]">{pickedPlaybook.name}</span>
              </p>
              <Input
                value={deckName}
                onChange={(event) => setDeckName(event.target.value)}
                className="border-[var(--jos-line)] bg-[var(--jos-bg)]"
                autoFocus
              />
            </div>
          ) : null}

          {mode === "library" ? (
            <div className="space-y-3">
              <Input
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
                placeholder="Search decks"
                className="border-[var(--jos-line)] bg-[var(--jos-bg)]"
              />
              <ul className="max-h-80 divide-y divide-[var(--jos-line)] overflow-y-auto border border-[var(--jos-line)]">
                {filteredLibrary.length === 0 ? (
                  <li className="px-3 py-4 text-sm text-[var(--jos-muted)]">No decks in the library.</li>
                ) : (
                  filteredLibrary.map((deck) => (
                    <li key={deck.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-3 text-left hover:bg-[var(--jos-surface)]"
                        disabled={pending}
                        onClick={() => createFromLibrary(deck.id)}
                      >
                        <p className="text-sm font-semibold text-[var(--jos-ink)]">{deck.name}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--jos-muted)]">
                          {deck.slideCount} slides
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {mode === "choose" ? (
              <Button type="button" variant="ghost" onClick={closeStart}>
                Cancel
              </Button>
            ) : mode === "name-playbook" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setPickedPlaybookId(null);
                    setMode("playbook");
                  }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={pending || !deckName.trim()}
                  onClick={createFromPlaybook}
                >
                  Create
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setMode("choose")}>
                Back
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
