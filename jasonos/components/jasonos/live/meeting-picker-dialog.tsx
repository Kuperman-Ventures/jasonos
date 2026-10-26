"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { linkDeckMeeting, unlinkDeckMeeting } from "@/lib/server-actions/decks";

export type MeetingOption = {
  id: string;
  title: string;
  startsAt: string;
};

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

export function MeetingPickerDialog({
  open,
  onOpenChange,
  deckId,
  meetings,
  linkedMeetingId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  meetings: MeetingOption[];
  linkedMeetingId: string | null;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{linkedMeetingId ? "Change meeting" : "Link meeting"}</DialogTitle>
        </DialogHeader>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start py-2 text-left"
                disabled={pending || meeting.id === linkedMeetingId}
                onClick={() =>
                  start(async () => {
                    const result = await linkDeckMeeting(deckId, meeting.id);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Meeting linked");
                    onOpenChange(false);
                    onDone();
                  })
                }
              >
                <span className="block">
                  <span className="font-medium">{meeting.title}</span>
                  <span className="mt-0.5 block text-[12px] text-[var(--jos-muted)]">
                    {formatWhen(meeting.startsAt)}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
        {linkedMeetingId ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await unlinkDeckMeeting(deckId);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Meeting unlinked");
                onOpenChange(false);
                onDone();
              })
            }
          >
            Unlink
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
