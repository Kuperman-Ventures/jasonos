"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import type { AttachableNote } from "@/lib/server-actions/decks";
import {
  attachTranscript,
  listRecentNotesForAttach,
  suggestNoteForMeeting,
} from "@/lib/server-actions/decks";
import { formatMeetingWhen } from "@/components/jasonos/live/live-format";

export function AttachTranscriptDialog({
  open,
  onOpenChange,
  meetingPrepId,
  deckId,
  meetingTitle,
  meetingStartsAt,
  reviewedAt,
  onAttached,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingPrepId?: string | null;
  deckId?: string | null;
  meetingTitle: string;
  meetingStartsAt?: string | null;
  reviewedAt?: string | null;
  onAttached: (deckId: string, noteTitle: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notes, setNotes] = useState<AttachableNote[]>([]);
  const [suggested, setSuggested] = useState<AttachableNote | null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const orphanMode = !meetingPrepId && !deckId;
  /** Exactly one of meetingPrepId or deckId for the server action; prefer deck. */
  const attachDeckId = deckId?.trim() || undefined;
  const attachMeetingPrepId = attachDeckId ? undefined : meetingPrepId?.trim() || undefined;

  useEffect(() => {
    if (!open) return;
    setWarnings([]);
    setLoadingNotes(true);
    setLoadingSuggest(Boolean(meetingPrepId));
    setSuggested(null);
    setSelectedNoteId(null);
    setNoteSearch("");

    void listRecentNotesForAttach(10).then((result) => {
      setLoadingNotes(false);
      if (!result.ok) {
        setWarnings([result.error]);
        return;
      }
      setNotes(result.notes);
      setWarnings(result.warnings);
    });

    if (meetingPrepId) {
      void suggestNoteForMeeting(meetingPrepId).then((result) => {
        setLoadingSuggest(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.note) {
          setSuggested(result.note);
          setSelectedNoteId(result.note.id);
        }
      });
    }
  }, [open, meetingPrepId]);

  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    return (
      notes.find((note) => note.id === selectedNoteId) ??
      (suggested?.id === selectedNoteId ? suggested : null)
    );
  }, [notes, selectedNoteId, suggested]);

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((note) => note.title.toLowerCase().includes(q));
  }, [notes, noteSearch]);

  const runAttach = (clearReview?: boolean) => {
    if (!selectedNote) {
      toast.error("Pick a transcript.");
      return;
    }
    start(async () => {
      const result = await attachTranscript({
        meetingPrepId: attachMeetingPrepId,
        deckId: attachDeckId,
        noteId: selectedNote.id,
        source: selectedNote.source,
        name: orphanMode ? selectedNote.title : undefined,
        clearReview,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Transcript attached");
      onOpenChange(false);
      onAttached(result.deckId, selectedNote.title);
      router.refresh();
    });
  };

  const onAttach = () => {
    if (!selectedNote) {
      toast.error("Pick a transcript.");
      return;
    }
    if (reviewedAt && attachDeckId) {
      const ok = window.confirm("Changing the transcript removes the current review.");
      if (!ok) return;
      runAttach(true);
      return;
    }
    runAttach();
  };

  const heading = orphanMode
    ? "Review a note without a meeting"
    : `Attach a transcript to ${meetingTitle}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2px] bg-[var(--jos-bg)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!orphanMode && meetingStartsAt ? (
            <p className="text-[12px] text-[var(--jos-muted)]">
              {formatMeetingWhen(meetingStartsAt)}
            </p>
          ) : null}

          {loadingSuggest && meetingPrepId ? (
            <p className="text-sm text-[var(--jos-muted)]">Looking for a matching note…</p>
          ) : null}
          {suggested ? (
            <div>
              <p className="text-[13px] font-semibold">Suggested</p>
              <button
                type="button"
                className={`mt-1.5 w-full rounded-[2px] border px-3 py-2 text-left text-sm hover:bg-[var(--jos-surface)] ${
                  selectedNoteId === suggested.id
                    ? "border-[var(--jos-ink)] bg-[var(--jos-surface)] font-semibold"
                    : "border-[var(--jos-line)]"
                }`}
                onClick={() => setSelectedNoteId(suggested.id)}
              >
                <span className="block truncate">{suggested.title}</span>
                <span className="mt-0.5 block text-[12px] text-[var(--jos-muted)]">
                  {suggested.source === "granola" ? "Granola" : "Wispr"} ·{" "}
                  {formatMeetingWhen(suggested.at)}
                </span>
              </button>
            </div>
          ) : null}

          <div>
            <p className="text-[13px] font-semibold">All notes</p>
            <Input
              value={noteSearch}
              onChange={(event) => setNoteSearch(event.target.value)}
              placeholder="Search by title…"
              className="mt-1.5 border-[var(--jos-line)] bg-[var(--jos-bg)]"
            />
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-[2px] border border-[var(--jos-line)]">
              {loadingNotes ? (
                <li className="px-3 py-2 text-sm text-[var(--jos-muted)]">
                  Reading Granola and Wispr…
                </li>
              ) : filteredNotes.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--jos-muted)]">No transcripts found.</li>
              ) : (
                filteredNotes.map((note) => {
                  const active = note.id === selectedNoteId;
                  return (
                    <li key={`${note.source}-${note.id}`}>
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--jos-surface)] ${
                          active ? "bg-[var(--jos-surface)] font-semibold" : ""
                        }`}
                        onClick={() => setSelectedNoteId(note.id)}
                      >
                        <span className="block truncate">{note.title}</span>
                        <span className="mt-0.5 block text-[12px] text-[var(--jos-muted)]">
                          {note.source === "granola" ? "Granola" : "Wispr"} ·{" "}
                          {formatMeetingWhen(note.at)}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            {warnings.length ? (
              <div className="mt-2 space-y-0.5">
                {warnings.map((warning) => (
                  <p key={warning} className="text-[12px] text-[var(--jos-muted)]">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !selectedNote} onClick={() => onAttach()}>
            {pending ? "Attaching…" : "Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
