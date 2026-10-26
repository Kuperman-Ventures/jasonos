"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AttachableMeeting, DeckSummary, RecentReviewNote } from "@/lib/server-actions/decks";
import { listRecentReviewNotes, reviewMeetingFromNote } from "@/lib/server-actions/decks";

function formatNoteWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ReviewMeetingDialog({
  open,
  onOpenChange,
  playbooks,
  meetings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbooks: DeckSummary[];
  meetings: AttachableMeeting[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notes, setNotes] = useState<RecentReviewNote[]>([]);
  const [noteSearch, setNoteSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [meetingPrepId, setMeetingPrepId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [rubricSource, setRubricSource] = useState<string>("default");

  useEffect(() => {
    if (!open) return;
    setLoadingNotes(true);
    void listRecentReviewNotes().then((result) => {
      setLoadingNotes(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNotes(result.notes);
      if (result.warnings.length) {
        for (const warning of result.warnings) toast.warning(warning);
      }
    });
  }, [open]);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

  useEffect(() => {
    if (selectedNote && !name.trim()) {
      setName(selectedNote.title);
    }
  }, [selectedNote, name]);

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        note.source.toLowerCase().includes(q)
    );
  }, [notes, noteSearch]);

  const now = Date.now();
  const pastMeetings = useMemo(
    () =>
      meetings
        .filter((meeting) => Date.parse(meeting.startsAt) <= now)
        .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt)),
    [meetings, now]
  );

  const onSubmit = () => {
    if (!selectedNote) {
      toast.error("Pick a transcript.");
      return;
    }
    const label = name.trim();
    if (!label) {
      toast.error("Write a name.");
      return;
    }
    start(async () => {
      const result = await reviewMeetingFromNote({
        noteId: selectedNote.id,
        source: selectedNote.source,
        name: label,
        goal: goal.trim() || null,
        rubricFromPlaybookId: rubricSource === "default" ? null : rubricSource,
        meetingPrepId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Review started");
      onOpenChange(false);
      router.push(`/live/decks/${result.id}/review`);
      router.refresh();
    });
  };

  const resetForm = () => {
    setNoteSearch("");
    setSelectedNoteId(null);
    setMeetingPrepId(null);
    setName("");
    setGoal("");
    setRubricSource("default");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2px] bg-[var(--jos-bg)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review a meeting</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-[13px] font-semibold">Transcript</p>
            <Input
              value={noteSearch}
              onChange={(event) => setNoteSearch(event.target.value)}
              placeholder="Search notes…"
              className="mt-1.5 border-[var(--jos-line)] bg-[var(--jos-bg)]"
            />
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-[2px] border border-[var(--jos-line)]">
              {loadingNotes ? (
                <li className="px-3 py-2 text-sm text-[var(--jos-muted)]">Loading transcripts…</li>
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
                          {formatNoteWhen(note.at)} · {note.source === "granola" ? "Granola" : "Wispr"}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div>
            <p className="text-[13px] font-semibold">Calendar meeting (optional)</p>
            <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto rounded-[2px] border border-[var(--jos-line)]">
              <li>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--jos-surface)] ${
                    !meetingPrepId ? "bg-[var(--jos-surface)] font-semibold" : ""
                  }`}
                  onClick={() => setMeetingPrepId(null)}
                >
                  None
                </button>
              </li>
              {pastMeetings.map((meeting) => {
                const taken = meeting.hasDeck;
                const active = meetingPrepId === meeting.id;
                return (
                  <li key={meeting.id}>
                    <button
                      type="button"
                      disabled={taken}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-[var(--jos-surface)] disabled:cursor-not-allowed disabled:opacity-50 ${
                        active ? "bg-[var(--jos-surface)] font-semibold" : ""
                      }`}
                      onClick={() => setMeetingPrepId(meeting.id)}
                    >
                      <span className="block truncate">{meeting.title}</span>
                      <span className="mt-0.5 block text-[12px] text-[var(--jos-muted)]">
                        {formatNoteWhen(meeting.startsAt)}
                        {taken ? " · has a deck" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <label htmlFor="review-meeting-name" className="text-[13px] font-semibold">Name</label>
            <Input
              id="review-meeting-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 border-[var(--jos-line)] bg-[var(--jos-bg)]"
            />
          </div>

          <div>
            <label htmlFor="review-meeting-goal" className="text-[13px] font-semibold">Goal</label>
            <Input
              id="review-meeting-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="mt-1.5 border-[var(--jos-line)] bg-[var(--jos-bg)]"
              placeholder="Optional"
            />
          </div>

          <div>
            <p className="text-[13px] font-semibold">Rubric</p>
            <Select
              value={rubricSource}
              onValueChange={(value) => {
                if (value) setRubricSource(value);
              }}
            >
              <SelectTrigger className="mt-1.5 border-[var(--jos-line)] bg-[var(--jos-bg)]">
                <SelectValue placeholder="Default rubric" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default rubric</SelectItem>
                {playbooks.map((playbook) => (
                  <SelectItem key={playbook.id} value={playbook.id}>
                    {playbook.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="button" className="w-full" disabled={pending} onClick={onSubmit}>
            {pending ? "Creating…" : "Create and review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
