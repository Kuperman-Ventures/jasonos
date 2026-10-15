"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";
import {
  collapseText,
  easternDateLong,
  linkify,
  subjectKey,
  type BriefingBeat,
  type BriefingThread,
  type MeetingContext,
  type MeetingContextConnection,
  type MeetingContextPerson,
  type OtherThread,
} from "@/lib/meeting-prep/context-model";
import { isJoinBoilerplate, plainTextFromHtml } from "@/lib/meeting-prep/text";
import {
  CONTACT_INTENT_LABELS,
  NETWORK_ROLE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from "@/lib/outreach/types";
import {
  confirmMeetingPurpose,
  setMeetingPurpose,
  type MeetingPrepDetail,
} from "@/lib/server-actions/meeting-prep";
import { cn } from "@/lib/utils";

function easternClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function easternDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function etDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function durationLabel(startsAt: string, endsAt: string): string {
  const mins = Math.max(0, Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60000));
  if (!mins) return "";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function meetingKicker(startsAt: string, endsAt: string, now: number | null): string {
  const date = easternDay(startsAt);
  const length = durationLabel(startsAt, endsAt);
  let when = date;
  if (now != null) {
    const day = etDateKey(Date.parse(startsAt));
    if (day === etDateKey(now)) when = "Today";
    else if (day === etDateKey(now + 86_400_000)) when = "Tomorrow";
  }
  const dated = when === date ? date : `${when} · ${date}`;
  return length ? `${dated} · ${length}` : dated;
}

function relativeStart(startsAt: string, endsAt: string, now: number): string | null {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (now >= start && now <= end) return "Happening now";
  if (now > end) {
    return etDateKey(start) === etDateKey(now) ? "Ended" : null;
  }
  const mins = Math.round((start - now) / 60000);
  if (mins < 1) return "Starts now";
  if (mins < 60) return `Starts in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 18) return hours === 1 ? "Starts in 1 hr" : `Starts in ${hours} hr`;
  return null;
}

function humanPlace(location: string | null): string | null {
  const value = location?.trim();
  if (!value || /^https?:/i.test(value)) return null;
  return value;
}

function joinHref(prep: MeetingPrepDetail): string | null {
  if (prep.conferenceUrl) return prep.conferenceUrl;
  if (prep.location && /^https?:/i.test(prep.location.trim())) return prep.location.trim();
  return null;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function knownLabel(map: object, value: string | null): string | null {
  if (!value) return null;
  return (map as Record<string, string>)[value] ?? value;
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = collapseText(a)?.toLowerCase();
  const right = collapseText(b)?.toLowerCase();
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:/i.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="font-semibold text-[var(--color-accent-700)] hover:underline"
    >
      {children}
    </a>
  );
}

function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {linkify(text).map((part, index) =>
        part.href ? (
          <ExternalLink key={`${part.href}-${index}`} href={part.href}>
            {part.text}
          </ExternalLink>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}

function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
      {children}
    </h2>
  );
}

function Expandable({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <div>
      <p
        className={cn(
          "whitespace-pre-wrap text-[16px] leading-relaxed text-[var(--color-text)]",
          long && !open && "line-clamp-6"
        )}
      >
        <Prose text={text} />
      </p>
      {long ? (
        <button
          type="button"
          className="mt-1 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Show less" : "Show the rest"}
        </button>
      ) : null}
    </div>
  );
}

function beatWho(beat: BriefingBeat): string {
  if (beat.direction === "outbound") return `You to ${firstName(beat.name)}`;
  return beat.name;
}

function beatSubject(beat: BriefingBeat, meetingTitle: string): string | null {
  if (!beat.subject) return null;
  if (subjectKey(beat.subject) === subjectKey(meetingTitle)) return null;
  return beat.subject.replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, "");
}

function ReadBeat({
  label,
  beat,
  meetingTitle,
  primary,
  body,
}: {
  label: string;
  beat: BriefingBeat;
  meetingTitle: string;
  primary?: boolean;
  body?: string;
}) {
  const subject = beatSubject(beat, meetingTitle);
  return (
    <div
      className={cn(
        "border-l-4 pl-4",
        primary ? "border-[var(--color-calendar)]" : "border-[var(--color-neutral-300)]"
      )}
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--color-calendar-700)]">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[var(--jos-muted)]">
        {easternDateLong(beat.at)}
        <span className="font-medium"> · {beatWho(beat)}</span>
      </p>
      {subject ? (
        <p className="mt-0.5 text-[13px] text-[var(--jos-muted)]">{subject}</p>
      ) : null}
      <div className="mt-2 max-w-[65ch]">
        {primary ? (
          <p className="text-[18px] font-medium leading-snug text-[var(--color-text)]">
            <Prose text={body ?? beat.text} />
          </p>
        ) : (
          <Expandable text={body ?? beat.text} />
        )}
      </div>
      {beat.url ? (
        <p className="mt-2 text-[14px]">
          <ExternalLink href={beat.url}>Open email</ExternalLink>
        </p>
      ) : null}
    </div>
  );
}

function threadFootnote(thread: BriefingThread): string {
  const start = easternDateLong(thread.firstAt);
  const end = easternDateLong(thread.lastAt);
  const span = start === end ? start : `${start} – ${end}`;
  const emails = thread.messageCount === 1 ? "1 email" : `${thread.messageCount} emails`;
  const mostly =
    thread.messageCount > 1 && thread.schedulingCount >= thread.messageCount - 1;
  return `${emails} on this thread, ${span}${mostly ? ", mostly moving the time" : ""}.`;
}

function historyLine(person: MeetingContextPerson): string {
  if (!person.directTouchCount) return "No direct email in JasonOS";
  const notes = person.directTouchCount === 1 ? "1 note" : `${person.directTouchCount} notes`;
  if (!person.lastTouchAt) return notes;
  return `${notes} · last ${easternDateLong(person.lastTouchAt)}`;
}

function PersonRow({ person }: { person: MeetingContextPerson }) {
  const relationship = knownLabel(RELATIONSHIP_TYPE_LABELS, person.relationshipType);
  const intent = knownLabel(CONTACT_INTENT_LABELS, person.intent);
  const role = knownLabel(NETWORK_ROLE_LABELS, person.networkRole);
  const labels = [relationship, role, intent].filter((label): label is string => Boolean(label));
  const roleLine = [person.title, person.company].filter(Boolean).join(" · ");
  return (
    <li className="border-t border-[var(--jos-line)] py-4 first:border-t-0 first:pt-1">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4">
        <Link
          href={`/outreach/people?id=${person.contactId}`}
          className="text-[18px] font-semibold tracking-tight text-[var(--color-text)] hover:underline"
        >
          {person.name}
        </Link>
        {labels.length ? (
          <p className="text-[13px] font-medium text-[var(--jos-muted)]">{labels.join(" · ")}</p>
        ) : null}
      </div>
      {roleLine ? (
        <p className="mt-0.5 text-[15px] text-[var(--color-text)]">{roleLine}</p>
      ) : null}
      <p className="mt-1 text-[13px] text-[var(--jos-muted)]">
        {person.email ? <span>{person.email}</span> : null}
        {person.email ? " · " : null}
        <span>{historyLine(person)}</span>
        {person.linkedinUrl ? (
          <>
            {" · "}
            <ExternalLink href={person.linkedinUrl}>LinkedIn</ExternalLink>
          </>
        ) : null}
        {person.phone ? ` · ${person.phone}` : null}
      </p>
      {person.referredByName ? (
        <p className="mt-2 text-[14px] text-[var(--color-text)]">
          Referred by <span className="font-semibold">{person.referredByName}</span>
        </p>
      ) : null}
      {person.personalGoal ? (
        <div className="mt-3 max-w-[65ch]">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Goal
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
            <Prose text={person.personalGoal} />
          </p>
        </div>
      ) : null}
      {person.researchLead || person.researchBullets.length ? (
        <div className="mt-3 max-w-[65ch]">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Research
          </p>
          {person.researchLead ? (
            <p className="mt-1 text-[15px] leading-relaxed">
              <Prose text={person.researchLead} />
            </p>
          ) : null}
          {person.researchBullets.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
              {person.researchBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {person.browningPrep ? (
        <div className="mt-3 max-w-[65ch]">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Tracy&apos;s note
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
            <Prose text={person.browningPrep} />
          </p>
        </div>
      ) : null}
      {person.notes ? (
        <div className="mt-3 max-w-[65ch]">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Notes
          </p>
          <div className="mt-1">
            <Expandable text={person.notes} />
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ConnectionRead({ connection }: { connection: MeetingContextConnection }) {
  const showWhy = connection.why && !sameText(connection.why, connection.whyTheyReplied);
  return (
    <div className="space-y-4 border-l-4 border-[var(--color-calendar)] pl-4">
      <div>
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--color-calendar-700)]">
          Tracy&apos;s introduction
        </p>
        <p className="mt-1 text-[13px] font-semibold text-[var(--jos-muted)]">
          Browning Associates
          {connection.receivedAt ? ` · ${easternDateLong(connection.receivedAt)}` : ""}
        </p>
        {connection.subject ? (
          <p className="mt-1 text-[15px]">
            {connection.emailUrl ? (
              <ExternalLink href={connection.emailUrl}>{connection.subject}</ExternalLink>
            ) : (
              connection.subject
            )}
          </p>
        ) : null}
      </div>
      {connection.ask || connection.overlap ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {connection.ask ? (
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                The ask
              </p>
              <p className="mt-1 text-[16px] leading-relaxed">{connection.ask}</p>
            </div>
          ) : null}
          {connection.overlap ? (
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                Overlap
              </p>
              <p className="mt-1 text-[16px] leading-relaxed">{connection.overlap}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {connection.whyTheyReplied ? (
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Why they took it
          </p>
          <p className="mt-1 text-[16px] leading-relaxed">{connection.whyTheyReplied}</p>
        </div>
      ) : null}
      {connection.who ? (
        <p className="text-[15px] leading-relaxed">{connection.who}</p>
      ) : null}
      {showWhy ? <p className="text-[15px] leading-relaxed">{connection.why}</p> : null}
      {connection.meetingBrief ? <Expandable text={connection.meetingBrief} /> : null}
      {connection.questions.length ? (
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Questions Tracy suggested
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[16px] leading-relaxed">
            {connection.questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {connection.attachmentUrl ? (
        <p className="text-[14px]">
          <ExternalLink href={connection.attachmentUrl}>
            {connection.attachmentLabel || "Attached resume"}
          </ExternalLink>
        </p>
      ) : null}
    </div>
  );
}

function FocusEditor({
  text,
  stored,
  dirty,
  pending,
  canConfirm,
  onChange,
  onSave,
  onConfirm,
  onCancel,
}: {
  text: string;
  stored: string;
  dirty: boolean;
  pending: boolean;
  canConfirm: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="max-w-[65ch] space-y-3">
      <p className="text-[14px] leading-relaxed text-[var(--jos-muted)]">
        One or two lines. This stays on the meeting.
      </p>
      <Textarea
        value={text}
        placeholder="What do you want out of this meeting?"
        onChange={(event) => onChange(event.target.value)}
        rows={3}
      />
      <div className="flex flex-wrap gap-2">
        {canConfirm ? (
          <Button type="button" size="sm" disabled={pending} onClick={onConfirm}>
            Confirm
          </Button>
        ) : null}
        {dirty ? (
          <Button type="button" size="sm" disabled={pending || !text.trim()} onClick={onSave}>
            Save
          </Button>
        ) : null}
        {stored ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ThreadRow({ thread }: { thread: OtherThread }) {
  return (
    <li className="grid gap-1 border-t border-[var(--jos-line)] py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:gap-4">
      <div>
        <p className="text-[13px] font-medium text-[var(--jos-muted)]">{easternDateLong(thread.lastAt)}</p>
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--jos-muted)]">
          {thread.channelLabel}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-snug">{thread.title}</p>
        {thread.names.length ? (
          <p className="mt-0.5 text-[13px] text-[var(--jos-muted)]">
            {thread.names.join(", ")}
            {thread.messageCount > 1 ? ` · ${thread.messageCount} messages` : ""}
          </p>
        ) : null}
        {thread.preview && thread.preview !== thread.title ? (
          <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-[var(--jos-muted)]">
            <Prose text={thread.preview} />
          </p>
        ) : null}
      </div>
      {thread.url ? (
        <div className="text-[14px] sm:pt-0.5">
          <ExternalLink href={thread.url}>Open</ExternalLink>
        </div>
      ) : (
        <span className="hidden sm:block" />
      )}
    </li>
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
  const usablePurpose = isJoinBoilerplate(prep.purpose) ? "" : (prep.purpose ?? "");
  const [text, setText] = useState(usablePurpose);
  const [seenPurpose, setSeenPurpose] = useState(usablePurpose);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const [showAllThreads, setShowAllThreads] = useState(false);
  const [addTarget, setAddTarget] = useState<{ email: string; name: string | null } | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  if (usablePurpose !== seenPurpose) {
    setSeenPurpose(usablePurpose);
    setText(usablePurpose);
    setEditing(false);
  }

  const stored = usablePurpose.trim();
  const dirty = text.trim() !== stored;
  const canConfirm =
    !dirty &&
    !prep.purposeConfirmed &&
    Boolean(stored) &&
    (prep.purposeSource === "calendar" || prep.purposeSource === "suggested");
  const description = prep.description ? plainTextFromHtml(prep.description) : "";
  const showDescription = Boolean(description) && !isJoinBoilerplate(description);
  const join = joinHref(prep);
  const place = humanPlace(prep.location);
  const starts = relativeStart(prep.startsAt, prep.endsAt, now ?? Number.NaN);
  const briefing = context.briefing;

  const save = () => {
    startTransition(async () => {
      const result = await setMeetingPurpose(prep.id, text);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Focus saved");
      setEditing(false);
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
      setEditing(false);
      router.refresh();
    });
  };

  const standBody =
    context.recentEmail &&
    briefing.whereItStands &&
    sameText(context.recentEmail.summary, briefing.whereItStands.text) &&
    context.recentEmail.summary.length > briefing.whereItStands.text.length + 40
      ? context.recentEmail.summary
      : undefined;
  const emailIsNew =
    Boolean(context.recentEmail) &&
    !sameText(context.recentEmail?.summary, standBody ?? briefing.whereItStands?.text) &&
    !sameText(context.recentEmail?.summary, briefing.introduction?.text) &&
    !sameText(context.recentEmail?.summary, briefing.yourStake?.text);

  const hasRead =
    Boolean(context.brief.summary) ||
    Boolean(context.brief.nextMove) ||
    context.brief.commitments.length > 0 ||
    context.brief.remember.length > 0 ||
    context.brief.helped.length > 0 ||
    context.brief.topics.length > 0 ||
    context.connections.length > 0 ||
    Boolean(briefing.whereItStands) ||
    Boolean(briefing.introduction) ||
    Boolean(briefing.yourStake) ||
    context.granolaNotes.length > 0 ||
    emailIsNew;

  const visibleThreads = showAllThreads ? briefing.otherThreads : briefing.otherThreads.slice(0, 4);
  const hiddenThreadCount = briefing.otherThreads.length - visibleThreads.length;

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Home
      </Link>

      <header className="space-y-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
          {meetingKicker(prep.startsAt, prep.endsAt, now)}
        </p>
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--color-text)] break-words">
          {prep.title}
        </h1>
        <p className="text-[18px] font-medium tracking-tight text-[var(--color-text)]">
          {easternClock(prep.startsAt)}–{easternClock(prep.endsAt)} ET
          {starts ? (
            <span className="ml-2 text-[15px] font-semibold text-[var(--color-calendar-700)]">
              {starts}
            </span>
          ) : null}
        </p>
        {place ? <p className="text-[15px] text-[var(--jos-muted)]">{place}</p> : null}
        {prep.error ? (
          <p className="text-[14px] font-medium text-[var(--color-accent-2-text)]">{prep.error}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 pt-1">
          {join ? (
            <a
              href={join}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "calendar" })}
            >
              Join the call
            </a>
          ) : null}
          {prep.calendarUrl ? (
            <ExternalLink href={prep.calendarUrl}>Calendar</ExternalLink>
          ) : null}
        </div>
        {showDescription ? (
          description.length > 320 ? (
            <details className="max-w-[65ch]">
              <summary className="cursor-pointer text-[14px] font-semibold text-[var(--jos-muted)]">
                Note on the invite
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--color-text)]">
                {description}
              </p>
            </details>
          ) : (
            <p className="max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--jos-muted)]">
              {description}
            </p>
          )
        ) : null}
      </header>

      {stored || editing ? (
        <section className="space-y-2">
          <BlockTitle>What you want out of this</BlockTitle>
          {stored && !editing ? (
            <>
              <p className="max-w-[62ch] text-[22px] font-medium leading-snug tracking-tight text-[var(--color-text)]">
                {stored}
              </p>
              <button
                type="button"
                className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            </>
          ) : (
            <FocusEditor
              text={text}
              stored={stored}
              dirty={dirty}
              pending={pending}
              canConfirm={canConfirm}
              onChange={setText}
              onSave={save}
              onConfirm={confirm}
              onCancel={() => {
                setText(stored);
                setEditing(false);
              }}
            />
          )}
        </section>
      ) : null}

      {context.people.length || context.unmatched.length ? (
        <section className="space-y-3">
          <BlockTitle>In the room</BlockTitle>
          <ul>
            {context.people.map((person) => (
              <PersonRow key={person.contactId} person={person} />
            ))}
            {context.unmatched.map((person) => (
              <li
                key={person.email}
                className="border-t border-[var(--jos-line)] py-4 first:border-t-0 first:pt-1"
              >
                <p className="text-[18px] font-semibold tracking-tight">
                  {person.name || person.email}
                </p>
                {person.name ? (
                  <p className="mt-0.5 text-[13px] text-[var(--jos-muted)]">{person.email}</p>
                ) : null}
                <p className="mt-1 text-[13px] text-[var(--jos-muted)]">Not a contact yet</p>
                <button
                  type="button"
                  className="mt-2 text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
                  onClick={() => setAddTarget(person)}
                >
                  Add to contacts
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <BlockTitle>Before the call</BlockTitle>
        {hasRead ? (
          <div className="space-y-6 bg-[var(--color-surface)] px-4 py-5 sm:px-5">
            {context.brief.summary ? (
              <div className="max-w-[65ch] text-[17px] leading-relaxed">
                <Expandable text={context.brief.summary} />
              </div>
            ) : null}
            {context.brief.nextMove ? (
              <p className="max-w-[65ch] text-[16px] leading-relaxed">
                <span className="font-semibold">Next. </span>
                {context.brief.nextMove}
              </p>
            ) : null}
            {context.brief.topics.length ? (
              <p className="text-[14px] leading-relaxed text-[var(--jos-muted)]">
                <span className="font-semibold text-[var(--color-text)]">In play. </span>
                {context.brief.topics.join(" · ")}
              </p>
            ) : null}
            {context.brief.commitments.length ||
            context.brief.remember.length ||
            context.brief.helped.length ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {context.brief.commitments.length ? (
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                      Open
                    </p>
                    <ul className="mt-2 space-y-2 text-[15px] leading-snug">
                      {context.brief.commitments.map((item) => (
                        <li
                          key={`${item.personName}-${item.text}`}
                          className={item.status === "overdue" ? "text-[var(--color-accent-2-text)]" : undefined}
                        >
                          <span className="font-semibold">
                            {item.direction === "mine" ? "You" : item.personName}
                          </span>
                          {" · "}
                          {item.text}
                          {item.due ? ` · due ${item.due}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {context.brief.remember.length || context.brief.helped.length ? (
                  <div className="space-y-4">
                    {context.brief.remember.length ? (
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                          Remember
                        </p>
                        <ul className="mt-2 space-y-1.5 text-[15px] leading-snug">
                          {context.brief.remember.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {context.brief.helped.length ? (
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                          You&apos;ve already
                        </p>
                        <ul className="mt-2 space-y-1.5 text-[15px] leading-snug">
                          {context.brief.helped.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {context.connections.map((connection) => (
              <ConnectionRead key={connection.id} connection={connection} />
            ))}

            {briefing.whereItStands ? (
              <ReadBeat
                label="Where it stands"
                beat={briefing.whereItStands}
                meetingTitle={prep.title}
                primary
                body={standBody}
              />
            ) : null}
            {briefing.introduction ? (
              <ReadBeat
                label="How you got in the room"
                beat={briefing.introduction}
                meetingTitle={prep.title}
              />
            ) : null}
            {briefing.yourStake ? (
              <ReadBeat
                label="What you said you'd cover"
                beat={briefing.yourStake}
                meetingTitle={prep.title}
              />
            ) : null}

            {context.granolaNotes.map((note) => (
              <div key={note.id} className="border-l-4 border-[var(--color-neutral-300)] pl-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--color-calendar-700)]">
                  {note.kind === "this_meeting" ? "Granola on this meeting" : "Recent Granola"}
                </p>
                {note.when ? (
                  <p className="mt-1 text-[13px] font-semibold text-[var(--jos-muted)]">
                    {easternDateLong(note.when)}
                    {note.title ? ` · ${note.title}` : ""}
                  </p>
                ) : null}
                <div className="mt-2 max-w-[65ch]">
                  <Expandable text={note.summary} />
                </div>
                {note.url ? (
                  <p className="mt-2 text-[14px]">
                    <ExternalLink href={note.url}>Open in Granola</ExternalLink>
                  </p>
                ) : null}
              </div>
            ))}

            {emailIsNew && context.recentEmail ? (
              <div className="border-l-4 border-[var(--color-neutral-300)] pl-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--color-calendar-700)]">
                  Latest email with {context.recentEmail.personName}
                </p>
                <div className="mt-2 max-w-[65ch]">
                  <Expandable text={context.recentEmail.summary} />
                </div>
                {context.recentEmail.threadUrl ? (
                  <p className="mt-2 text-[14px]">
                    <ExternalLink href={context.recentEmail.threadUrl}>Open email</ExternalLink>
                  </p>
                ) : null}
              </div>
            ) : null}

            {briefing.meetingThread && briefing.meetingThread.messageCount > 1 ? (
              <p className="text-[13px] leading-relaxed text-[var(--jos-muted)]">
                {threadFootnote(briefing.meetingThread)}
                {briefing.meetingThread.url ? (
                  <>
                    {" "}
                    <ExternalLink href={briefing.meetingThread.url}>Open the thread</ExternalLink>
                  </>
                ) : null}
              </p>
            ) : null}
            {context.brief.provenance.length ? (
              <p className="text-[12px] text-[var(--jos-muted)]">
                From {context.brief.provenance.join(" · ")}
                {context.granolaNotes.length ? " · Granola" : ""}
                {context.recentEmail ? " · Gmail" : ""}.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed text-[var(--jos-muted)]">
            {briefing.otherThreads.length
              ? "No intro or open loops for this meeting. Earlier email is below."
              : "Nothing stored yet on the people in this meeting. Add them as contacts and sync, or write a relationship brief on their People card."}
          </p>
        )}
      </section>

      {!stored && !editing ? (
        <section className="space-y-3">
          <BlockTitle>What you want out of this</BlockTitle>
          <FocusEditor
            text={text}
            stored={stored}
            dirty={dirty}
            pending={pending}
            canConfirm={canConfirm}
            onChange={setText}
            onSave={save}
            onConfirm={confirm}
            onCancel={() => {
              setText(stored);
              setEditing(false);
            }}
          />
        </section>
      ) : null}

      {briefing.otherThreads.length ? (
        <section className="space-y-2">
          <BlockTitle>Earlier email</BlockTitle>
          <ul>
            {visibleThreads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </ul>
          {hiddenThreadCount > 0 ? (
            <button
              type="button"
              className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
              onClick={() => setShowAllThreads(true)}
            >
              {hiddenThreadCount === 1 ? "1 earlier thread" : `${hiddenThreadCount} earlier threads`}
            </button>
          ) : null}
        </section>
      ) : null}

      {context.pastMeetings.length ? (
        <section className="space-y-3">
          <BlockTitle>Earlier meetings</BlockTitle>
          <ul className="space-y-5">
            {context.pastMeetings.map((meeting) => (
              <li key={meeting.id} className="border-t border-[var(--jos-line)] pt-4">
                <p className="text-[13px] font-semibold text-[var(--jos-muted)]">
                  {meeting.when ? easternDateLong(meeting.when) : "Past meeting"}
                </p>
                {meeting.title ? (
                  <p className="mt-0.5 text-[16px] font-semibold">{meeting.title}</p>
                ) : null}
                <div className="mt-2 max-w-[65ch] space-y-2 text-[15px] leading-relaxed">
                  {meeting.nextStep ? (
                    <p>
                      <span className="font-semibold">Next. </span>
                      {meeting.nextStep}
                    </p>
                  ) : null}
                  {meeting.debriefNotes ? <Expandable text={meeting.debriefNotes} /> : null}
                  {meeting.prepGoal && meeting.prepGoal !== meeting.title ? (
                    <p>{meeting.prepGoal}</p>
                  ) : null}
                  {meeting.prepShortAsk ? <p>{meeting.prepShortAsk}</p> : null}
                  {meeting.granolaSummary ? <Expandable text={meeting.granolaSummary} /> : null}
                  {meeting.introAsks.length ? (
                    <p className="text-[var(--jos-muted)]">Intros: {meeting.introAsks.join("; ")}</p>
                  ) : null}
                  {meeting.granolaUrl ? (
                    <ExternalLink href={meeting.granolaUrl}>Open in Granola</ExternalLink>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {context.documents.length ? (
        <section className="space-y-2">
          <BlockTitle>Documents</BlockTitle>
          <ul className="space-y-2 text-[15px]">
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
        </section>
      ) : null}

      {context.jobSearch.length ? (
        <section className="space-y-2">
          <BlockTitle>Job search</BlockTitle>
          <ul className="space-y-2">
            {context.jobSearch.map((job) => (
              <li key={`${job.kind}-${job.id}`} className="text-[15px]">
                <Link href={job.href} className="font-semibold text-[var(--color-accent-700)] hover:underline">
                  {job.title}
                  {job.company ? ` · ${job.company}` : ""}
                </Link>
                <span className="ml-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--jos-muted)]">
                  {job.kind === "interview" ? "Interview" : "Job"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
