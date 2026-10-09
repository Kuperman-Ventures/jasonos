"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";
import {
  collapseText,
  easternDateLong,
  type MeetingContext,
  type MeetingContextConnection,
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
    <section className="space-y-3 border-t border-border pt-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function sameText(a: string | null, b: string | null): boolean {
  const left = collapseText(a)?.toLowerCase();
  const right = collapseText(b)?.toLowerCase();
  return Boolean(left && right && left === right);
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

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-border bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-medium text-foreground/80">
      {children}
    </span>
  );
}

function PersonCard({ person }: { person: MeetingContextPerson }) {
  const relationship = knownLabel(RELATIONSHIP_TYPE_LABELS, person.relationshipType);
  const intent = knownLabel(CONTACT_INTENT_LABELS, person.intent);
  const role = knownLabel(NETWORK_ROLE_LABELS, person.networkRole);
  const labels = [relationship, intent, role].filter((label): label is string => Boolean(label));
  const roleLine = [person.title, person.company].filter(Boolean).join(" · ");
  return (
    <article className="space-y-3 rounded-lg border bg-card px-4 py-4">
      <div className="space-y-1">
        <p className="text-base font-semibold">
          <Link
            href={`/outreach/people?id=${person.contactId}`}
            className="text-rung-ink hover:underline"
          >
            {person.name}
          </Link>
        </p>
        {roleLine ? <p className="text-sm text-muted-foreground">{roleLine}</p> : null}
        {person.email ? <p className="text-sm text-muted-foreground">{person.email}</p> : null}
      </div>
      {labels.length ? (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <MetaChip key={label}>{label}</MetaChip>
          ))}
        </div>
      ) : null}
      {person.linkedinUrl || person.phone ? (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {person.linkedinUrl ? <ExternalLink href={person.linkedinUrl}>LinkedIn</ExternalLink> : null}
          {person.phone ? <span>{person.phone}</span> : null}
        </p>
      ) : null}
      {person.personalGoal ? (
        <Fact label="Goal">
          <p className="whitespace-pre-wrap">{person.personalGoal}</p>
        </Fact>
      ) : null}
      {person.notes ? (
        <Fact label="Notes">
          <p className="whitespace-pre-wrap text-muted-foreground">{person.notes}</p>
        </Fact>
      ) : null}
      {person.researchLead || person.researchBullets.length ? (
        <Fact label="Research">
          {person.researchLead ? <p>{person.researchLead}</p> : null}
          {person.researchBullets.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {person.researchBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </Fact>
      ) : null}
    </article>
  );
}

function ConnectionCard({ connection }: { connection: MeetingContextConnection }) {
  const showWhy = connection.why && !sameText(connection.why, connection.whyTheyReplied);
  return (
    <article className="space-y-4 rounded-lg border bg-card px-4 py-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Introduced by Tracy SantaMaria</p>
        <p className="text-sm text-muted-foreground">
          Browning Associates
          {connection.receivedAt ? ` · ${easternDateLong(connection.receivedAt)}` : ""}
        </p>
        {connection.subject ? (
          <p className="text-sm">
            {connection.emailUrl ? (
              <ExternalLink href={connection.emailUrl}>{connection.subject}</ExternalLink>
            ) : (
              connection.subject
            )}
          </p>
        ) : null}
      </div>
      {connection.ask || connection.overlap ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {connection.ask ? (
            <div className="rounded-md border border-border bg-background px-3 py-3">
              <Fact label="Ask">{connection.ask}</Fact>
            </div>
          ) : null}
          {connection.overlap ? (
            <div className="rounded-md border border-border bg-background px-3 py-3">
              <Fact label="Overlap">{connection.overlap}</Fact>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-3">
        {connection.whyTheyReplied ? (
          <Fact label="Why they agreed">{connection.whyTheyReplied}</Fact>
        ) : null}
        {connection.who ? <Fact label="Who">{connection.who}</Fact> : null}
        {showWhy ? <Fact label="Why">{connection.why}</Fact> : null}
      </div>
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
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
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
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          The brief is added in the next update.
        </p>
      </Section>

      <Section title="How You Are Connected">
        <div className="space-y-3">
          {context.connections.map((connection) => (
            <ConnectionCard key={connection.id} connection={connection} />
          ))}
          {context.people
            .filter((person) => person.browningPrep)
            .map((person) => (
              <div key={`${person.contactId}-prep`} className="rounded-lg border bg-card px-4 py-4">
                <Fact label="Tracy's note">
                  <p className="whitespace-pre-wrap">{person.browningPrep}</p>
                </Fact>
              </div>
            ))}
          {context.people
            .filter((person) => person.referredByName)
            .map((person) => (
              <p key={`${person.contactId}-referrer`} className="text-sm">
                Referred by <span className="font-medium">{person.referredByName}</span>
              </p>
            ))}
          {hasConnection ? null : (
            <p className="text-sm text-muted-foreground">No introduction record found.</p>
          )}
        </div>
      </Section>

      {context.people.length || context.unmatched.length ? (
        <Section title="Who They Are">
          <div className="space-y-3">
            {context.people.map((person) => (
              <PersonCard key={person.contactId} person={person} />
            ))}
            {context.unmatched.map((person) => (
              <article key={person.email} className="space-y-2 rounded-lg border bg-card px-4 py-4">
                <p className="text-base font-semibold">{person.name || person.email}</p>
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
          <ul className="divide-y divide-border rounded-lg border bg-card">
            {context.history.map((entry) => (
              <li key={entry.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:gap-4">
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">{easternDateLong(entry.lastAt)}</p>
                  <MetaChip>{entry.channelLabel}</MetaChip>
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{entry.title}</p>
                  {entry.preview && entry.preview !== entry.title ? (
                    <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                      {entry.preview}
                    </p>
                  ) : null}
                  {entry.direction || entry.messageCount > 1 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {[
                        entry.direction,
                        entry.messageCount > 1 ? `${entry.messageCount} messages` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                {entry.url ? (
                  <div className="sm:pt-0.5">
                    <ExternalLink href={entry.url}>Open</ExternalLink>
                  </div>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {context.documents.length ? (
        <Section title="Documents">
          <ul className="divide-y divide-border rounded-lg border bg-card">
            {context.documents.map((document) => (
              <li key={document.id} className="px-4 py-3 text-sm">
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
              <li key={meeting.id} className="space-y-3 rounded-lg border bg-card px-4 py-4">
                <p className="text-sm font-semibold">
                  {meeting.when ? easternDateLong(meeting.when) : "Past meeting"}
                  {meeting.title ? ` · ${meeting.title}` : ""}
                </p>
                {meeting.debriefNotes ? (
                  <Fact label="Debrief">
                    <p className="whitespace-pre-wrap">{meeting.debriefNotes}</p>
                  </Fact>
                ) : null}
                {meeting.nextStep ? <Fact label="Next step">{meeting.nextStep}</Fact> : null}
                {meeting.prepNotes ? (
                  <Fact label="Prep notes">
                    <p className="whitespace-pre-wrap">{meeting.prepNotes}</p>
                  </Fact>
                ) : null}
                {meeting.introAsks.length ? (
                  <Fact label="Intros">{meeting.introAsks.join("; ")}</Fact>
                ) : null}
                {meeting.granolaSummary ? (
                  <Fact label="Granola">
                    <p className="whitespace-pre-wrap">{meeting.granolaSummary}</p>
                  </Fact>
                ) : null}
                {meeting.granolaUrl ? <ExternalLink href={meeting.granolaUrl}>Open in Granola</ExternalLink> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {context.jobSearch.length ? (
        <Section title="Job Search">
          <ul className="divide-y divide-border rounded-lg border bg-card">
            {context.jobSearch.map((job) => (
              <li key={`${job.kind}-${job.id}`} className="px-4 py-3 text-sm">
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
        <div className="space-y-3 rounded-lg border bg-card px-4 py-4">
          {label || prep.purposeConfirmed ? (
            <div className="flex flex-wrap items-baseline gap-2">
              {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
              {prep.purposeConfirmed ? (
                <p className="text-xs font-medium text-muted-foreground">Confirmed</p>
              ) : null}
            </div>
          ) : null}
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
