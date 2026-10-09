"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";
import {
  easternDateLong,
  type MeetingContext,
  type MeetingContextPerson,
} from "@/lib/meeting-prep/context-model";
import { plainTextFromHtml } from "@/lib/meeting-prep/text";
import {
  CONTACT_INTENT_LABELS,
  NETWORK_ROLE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from "@/lib/outreach/types";
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

function knownLabel(map: object, value: string | null): string | null {
  if (!value) return null;
  const label = (map as Record<string, string>)[value];
  return label ?? value;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-rung-ink hover:underline"
    >
      {children}
    </a>
  );
}

function PersonCard({ person }: { person: MeetingContextPerson }) {
  const relationship = knownLabel(RELATIONSHIP_TYPE_LABELS, person.relationshipType);
  const intent = knownLabel(CONTACT_INTENT_LABELS, person.intent);
  const role = knownLabel(NETWORK_ROLE_LABELS, person.networkRole);
  const labels = [relationship, intent, role].filter(Boolean);
  return (
    <article className="space-y-1 rounded-lg border px-3 py-3">
      <p className="text-sm font-medium">
        <Link
          href={`/outreach/people?id=${person.contactId}`}
          className="text-rung-ink hover:underline"
        >
          {person.name}
        </Link>
        {person.email ? (
          <span className="ml-2 font-normal text-muted-foreground">{person.email}</span>
        ) : null}
      </p>
      {person.title || person.company ? (
        <p className="text-sm text-muted-foreground">
          {[person.title, person.company].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {person.linkedinUrl ? (
        <p className="text-sm">
          <ExternalLink href={person.linkedinUrl}>LinkedIn</ExternalLink>
        </p>
      ) : null}
      {labels.length ? (
        <p className="text-sm text-muted-foreground">{labels.join(" · ")}</p>
      ) : null}
      {person.phone ? <p className="text-sm">{person.phone}</p> : null}
      {person.personalGoal ? (
        <p className="whitespace-pre-wrap text-sm">{person.personalGoal}</p>
      ) : null}
      {person.notes ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{person.notes}</p>
      ) : null}
      {person.researchLead ? <p className="text-sm">{person.researchLead}</p> : null}
      {person.researchBullets.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {person.researchBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function MeetingPrepClient({
  prep,
  context,
}: {
  prep: MeetingPrepDetail;
  context: MeetingContext;
}) {
  const router = useRouter();
  const [text, setText] = useState(prep.purpose ?? "");
  const [seenPurpose, setSeenPurpose] = useState(prep.purpose ?? "");
  const [pending, startTransition] = useTransition();
  const [addTarget, setAddTarget] = useState<{ email: string; name: string | null } | null>(
    null
  );
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
  const hasConnection =
    context.connections.length > 0 ||
    context.people.some((person) => person.referredByName || person.browningPrep);

  const save = () => {
    startTransition(async () => {
      const result = await setMeetingPurpose(prep.id, text);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Focus saved");
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
      toast.success("Focus confirmed");
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
          {prep.calendarUrl ? <ExternalLink href={prep.calendarUrl}>Calendar</ExternalLink> : null}
          {prep.conferenceUrl ? <ExternalLink href={prep.conferenceUrl}>Join</ExternalLink> : null}
        </div>
        {description ? (
          <details className="rounded-lg border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Calendar description</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>
          </details>
        ) : null}
      </header>

      <Section title="Brief">
        <p className="text-sm text-muted-foreground">The brief is added in the next update.</p>
      </Section>

      <Section title="How You Are Connected">
        {context.connections.map((connection) => (
          <div key={connection.id} className="space-y-1 text-sm">
            <p>
              Introduced by Tracy SantaMaria (Browning Associates)
              {connection.receivedAt ? ` on ${easternDateLong(connection.receivedAt)}` : ""}
            </p>
            {connection.subject ? (
              <p>
                {connection.emailUrl ? (
                  <ExternalLink href={connection.emailUrl}>{connection.subject}</ExternalLink>
                ) : (
                  connection.subject
                )}
              </p>
            ) : null}
            {connection.whyTheyReplied ? (
              <p>
                <span className="font-medium">Why they agreed. </span>
                {connection.whyTheyReplied}
              </p>
            ) : null}
            {connection.who ? (
              <p>
                <span className="font-medium">Who. </span>
                {connection.who}
              </p>
            ) : null}
            {connection.why ? (
              <p>
                <span className="font-medium">Why. </span>
                {connection.why}
              </p>
            ) : null}
            {connection.ask ? (
              <p>
                <span className="font-medium">Ask. </span>
                {connection.ask}
              </p>
            ) : null}
            {connection.overlap ? (
              <p>
                <span className="font-medium">Overlap. </span>
                {connection.overlap}
              </p>
            ) : null}
          </div>
        ))}
        {context.people
          .filter((person) => person.browningPrep)
          .map((person) => (
            <p key={`${person.contactId}-prep`} className="whitespace-pre-wrap text-sm">
              {person.browningPrep}
            </p>
          ))}
        {context.people
          .filter((person) => person.referredByName)
          .map((person) => (
            <p key={`${person.contactId}-referrer`} className="text-sm">
              Referred by {person.referredByName}
            </p>
          ))}
        {hasConnection ? null : (
          <p className="text-sm text-muted-foreground">No introduction record found.</p>
        )}
      </Section>

      {context.people.length || context.unmatched.length ? (
        <Section title="Who They Are">
          <div className="space-y-3">
            {context.people.map((person) => (
              <PersonCard key={person.contactId} person={person} />
            ))}
            {context.unmatched.map((person) => (
              <article key={person.email} className="space-y-1 rounded-lg border px-3 py-3">
                <p className="text-sm font-medium">{person.name || person.email}</p>
                {person.name ? (
                  <p className="text-sm text-muted-foreground">{person.email}</p>
                ) : null}
                <button
                  type="button"
                  className="text-sm font-medium text-rung-ink hover:underline"
                  onClick={() => setAddTarget(person)}
                >
                  Add to contacts
                </button>
              </article>
            ))}
          </div>
        </Section>
      ) : null}

      {context.history.length ? (
        <Section title="Conversation History">
          <ul className="space-y-3">
            {context.history.map((entry) => (
              <li key={entry.id} className="text-sm">
                <p>
                  <span className="text-muted-foreground">{easternDateLong(entry.lastAt)}</span>
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="font-medium">{entry.channelLabel}</span>
                  {entry.direction ? (
                    <span className="text-muted-foreground"> · {entry.direction}</span>
                  ) : null}
                  {entry.messageCount > 1 ? (
                    <span className="text-muted-foreground"> · {entry.messageCount} messages</span>
                  ) : null}
                </p>
                <p>{entry.title}</p>
                {entry.preview && entry.preview !== entry.title ? (
                  <p className="text-muted-foreground">{entry.preview}</p>
                ) : null}
                {entry.url ? <ExternalLink href={entry.url}>Open</ExternalLink> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {context.documents.length ? (
        <Section title="Documents">
          <ul className="space-y-1 text-sm">
            {context.documents.map((document) => (
              <li key={document.id}>
                {document.url ? (
                  <ExternalLink href={document.url}>{document.label}</ExternalLink>
                ) : (
                  document.label
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {context.pastMeetings.length ? (
        <Section title="Past Meetings">
          <ul className="space-y-3">
            {context.pastMeetings.map((meeting) => (
              <li key={meeting.id} className="space-y-1 text-sm">
                <p className="font-medium">
                  {meeting.when ? easternDateLong(meeting.when) : "Past meeting"}
                  {meeting.title ? ` · ${meeting.title}` : ""}
                </p>
                {meeting.debriefNotes ? (
                  <p className="whitespace-pre-wrap">{meeting.debriefNotes}</p>
                ) : null}
                {meeting.nextStep ? <p>Next step: {meeting.nextStep}</p> : null}
                {meeting.prepNotes ? (
                  <p className="whitespace-pre-wrap text-muted-foreground">{meeting.prepNotes}</p>
                ) : null}
                {meeting.introAsks.length ? (
                  <p>Intros: {meeting.introAsks.join("; ")}</p>
                ) : null}
                {meeting.granolaSummary ? (
                  <p className="whitespace-pre-wrap">{meeting.granolaSummary}</p>
                ) : null}
                {meeting.granolaUrl ? (
                  <ExternalLink href={meeting.granolaUrl}>Granola</ExternalLink>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {context.jobSearch.length ? (
        <Section title="Job Search">
          <ul className="space-y-1 text-sm">
            {context.jobSearch.map((job) => (
              <li key={`${job.kind}-${job.id}`}>
                <Link href={job.href} className="font-medium text-rung-ink hover:underline">
                  {job.title}
                  {job.company ? ` · ${job.company}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Your Focus for This Meeting (Optional)">
        <div className="flex flex-wrap items-baseline gap-2">
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
      </Section>

      {addTarget ? (
        <ContactCreateModal
          key={addTarget.email}
          open
          initial={{ name: addTarget.name ?? "", email: addTarget.email }}
          onOpenChange={(open) => {
            if (!open) setAddTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
