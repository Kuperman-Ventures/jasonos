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
import { Textarea } from "@/components/ui/textarea";
import type { AttachableNote } from "@/lib/server-actions/decks";
import {
  attachTranscript,
  listRecentNotesForAttach,
  pasteTranscript,
  suggestNoteForMeeting,
} from "@/lib/server-actions/decks";
import { formatMeetingWhen } from "@/components/jasonos/live/live-format";

type Mode = "pick" | "paste";

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
  const [mode, setMode] = useState<Mode>("pick");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notes, setNotes] = useState<AttachableNote[]>([]);
  const [suggested, setSuggested] = useState<AttachableNote | null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [orphanPasteName, setOrphanPasteName] = useState("");

  const orphanMode = !meetingPrepId && !deckId;
  /** Exactly one of meetingPrepId or deckId for the server action; prefer deck. */
  const attachDeckId = deckId?.trim() || undefined;
  const attachMeetingPrepId = attachDeckId ? undefined : meetingPrepId?.trim() || undefined;

  useEffect(() => {
    if (!open) return;
    setMode("pick");
    setWarnings([]);
    setLoadingNotes(true);
    setLoadingSuggest(Boolean(meetingPrepId));
    setSuggested(null);
    setSelectedNoteId(null);
    setNoteSearch("");
    setPasteText("");
    setOrphanPasteName(meetingTitle?.trim() || "");

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
  }, [open, meetingPrepId, meetingTitle]);

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

  const confirmClearReview = () => {
    if (!(reviewedAt && attachDeckId)) return true;
    return window.confirm("Changing the transcript removes the current review.");
  };

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
    if (!confirmClearReview()) return;
    runAttach(Boolean(reviewedAt && attachDeckId));
  };

  const onPasteSave = () => {
    const text = pasteText.trim();
    if (text.length < 40) {
      toast.error("Paste the full transcript (at least a few lines).");
      return;
    }
    if (orphanMode && !orphanPasteName.trim()) {
      toast.error("Write a name for this review.");
      return;
    }
    if (!confirmClearReview()) return;
    start(async () => {
      const result = await pasteTranscript({
        meetingPrepId: attachMeetingPrepId,
        deckId: attachDeckId,
        text,
        name: orphanMode ? orphanPasteName.trim() : undefined,
        clearReview: Boolean(reviewedAt && attachDeckId),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pasted transcript saved");
      onOpenChange(false);
      onAttached(result.deckId, "Pasted transcript");
      router.refresh();
    });
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

          <div className="flex gap-1 border-b border-[var(--jos-line)] pb-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "pick" ? "default" : "ghost"}
              disabled={pending}
              onClick={() => setMode("pick")}
            >
              From Granola / Wispr
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "paste" ? "default" : "ghost"}
              disabled={pending}
              onClick={() => setMode("paste")}
            >
              Paste transcript
            </Button>
          </div>

          {mode === "pick" ? (
            <>
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
                    <li className="px-3 py-2 text-sm text-[var(--jos-muted)]">
                      No transcripts found. Paste one instead.
                    </li>
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
                <p className="mt-2 text-[12px] text-[var(--jos-muted)]">
                  Pulls the full spoken transcript, not the AI summary. If that fails, use Paste
                  transcript.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {orphanMode ? (
                <div>
                  <p className="text-[13px] font-semibold">Name</p>
                  <Input
                    value={orphanPasteName}
                    onChange={(event) => setOrphanPasteName(event.target.value)}
                    placeholder="Meeting name"
                    className="mt-1.5 border-[var(--jos-line)] bg-[var(--jos-bg)]"
                  />
                </div>
              ) : null}
              <div>
                <p className="text-[13px] font-semibold">Full transcript</p>
                <p className="mt-1 text-[12px] text-[var(--jos-muted)]">
                  Paste speaker lines from Granola, Wispr, or Zoom — not the meeting notes summary.
                </p>
                <Textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  rows={12}
                  placeholder={"Jason: …\nThem: …"}
                  className="mt-1.5 border-[var(--jos-line)] bg-[var(--jos-bg)] font-mono text-[13px]"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === "pick" ? (
            <Button type="button" disabled={pending || !selectedNote} onClick={() => onAttach()}>
              {pending ? "Attaching…" : "Attach"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending || pasteText.trim().length < 40}
              onClick={() => onPasteSave()}
            >
              {pending ? "Saving…" : "Save paste"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
