"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { plainTextFromHtml } from "@/lib/meeting-prep/text";
import {
  confirmMeetingPurpose,
  setMeetingPurpose,
  type MeetingPrepDetail,
  type MeetingPurposeSource,
} from "@/lib/server-actions/meeting-prep";

function easternRange(startsAt: string, endsAt: string): string {
  const date = new Date(startsAt).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    });
  return `${date} · ${time(startsAt)}–${time(endsAt)} ET`;
}

function purposeLabel(source: MeetingPurposeSource | null): string | null {
  if (source === "calendar") return "From the calendar invite";
  if (source === "suggested") return "Suggested";
  if (source === "user") return "Written by you";
  return null;
}

function attendeeName(attendee: MeetingPrepDetail["attendees"][number]): string {
  return attendee.name || attendee.email;
}

export function MeetingPrepClient({ prep }: { prep: MeetingPrepDetail }) {
  const router = useRouter();
  const [text, setText] = useState(prep.purpose ?? "");
  const [seenPurpose, setSeenPurpose] = useState(prep.purpose ?? "");
  const [pending, startTransition] = useTransition();
  if ((prep.purpose ?? "") !== seenPurpose) {
    setSeenPurpose(prep.purpose ?? "");
    setText(prep.purpose ?? "");
  }
  const stored = (prep.purpose ?? "").trim();
  const dirty = text.trim() !== stored;
  const label = purposeLabel(prep.purposeSource);
  const canConfirm =
    !dirty &&
    !prep.purposeConfirmed &&
    Boolean(stored) &&
    (prep.purposeSource === "calendar" || prep.purposeSource === "suggested");
  const description = prep.description ? plainTextFromHtml(prep.description) : "";

  const save = () => {
    startTransition(async () => {
      const result = await setMeetingPurpose(prep.id, text);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Purpose saved");
      router.refresh();
    });
  };

  const confirm = () => {
    startTransition(async () => {
      const result = await confirmMeetingPurpose(prep.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Purpose confirmed");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <p className="text-xs">
        <Link href="/" className="font-medium text-rung-ink hover:underline">
          Home
        </Link>
      </p>

      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight break-words">{prep.title}</h1>
        <p className="text-sm text-muted-foreground">{easternRange(prep.startsAt, prep.endsAt)}</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {prep.calendarUrl ? (
            <a
              href={prep.calendarUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-rung-ink hover:underline"
            >
              Calendar
            </a>
          ) : null}
          {prep.conferenceUrl ? (
            <a
              href={prep.conferenceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-rung-ink hover:underline"
            >
              Join
            </a>
          ) : null}
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Attendees</h2>
        <ul className="space-y-1">
          {prep.attendees.map((attendee) => (
            <li key={attendee.email} className="text-sm">
              {attendee.contactId ? (
                <Link
                  href={`/outreach/people?id=${attendee.contactId}`}
                  className="font-medium text-rung-ink hover:underline"
                >
                  {attendeeName(attendee)}
                </Link>
              ) : (
                <span className="font-medium">{attendeeName(attendee)}</span>
              )}
              {attendee.name ? (
                <span className="ml-2 text-muted-foreground">{attendee.email}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-bold">Purpose</h2>
          {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
          {prep.purposeConfirmed ? (
            <p className="text-xs font-medium text-muted-foreground">Confirmed</p>
          ) : null}
        </div>
        <Textarea
          value={text}
          placeholder="What do you want out of this meeting?"
          onChange={(event) => setText(event.target.value)}
          rows={4}
        />
        <div className="flex flex-wrap gap-2">
          {canConfirm ? (
            <Button type="button" size="sm" disabled={pending} onClick={confirm}>
              Confirm
            </Button>
          ) : null}
          {dirty ? (
            <Button type="button" size="sm" disabled={pending || !text.trim()} onClick={save}>
              Save
            </Button>
          ) : null}
        </div>
      </section>

      {description ? (
        <details className="rounded-lg border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Calendar description</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>
        </details>
      ) : null}

      <section className="space-y-1">
        <h2 className="text-sm font-bold">Brief</h2>
        <p className="text-sm text-muted-foreground">Part B adds sources and the brief.</p>
      </section>
    </div>
  );
}
