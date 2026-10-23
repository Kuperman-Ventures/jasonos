"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarBlank } from "@phosphor-icons/react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { LIVE_SECTION_LABEL, LiveTertiaryNav, UnfinishedField } from "@/components/jasonos/live";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";
import { InlineField } from "@/components/jasonos/meeting-prep/points-editor";
import {
  BlockTitle,
  easternClock,
  ExternalLink,
  joinHref,
  Prose,
} from "@/components/jasonos/meeting-prep/meeting-prep-bits";
import {
  collapseText,
  easternDateLong,
  subjectKey,
  type BriefingBeat,
  type BriefingThread,
  type MeetingContext,
  type MeetingContextConnection,
  type MeetingContextPerson,
  type OtherThread,
} from "@/lib/meeting-prep/context-model";
import { isJoinBoilerplate } from "@/lib/meeting-prep/text";
import {
  CONTACT_INTENT_LABELS,
  NETWORK_ROLE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from "@/lib/outreach/types";
import { isContactThin } from "@/lib/meeting-prep/research-policy";
import { runMeetingResearch } from "@/lib/server-actions/meeting-research";
import {
  searchCompaniesForMeeting,
  setMeetingCompany,
  setMeetingOutcomeMark,
  setMeetingOutcomeSentence,
  setMeetingPrimaryContact,
  setMeetingProject,
  setMeetingTitle,
  setMeetingTrack,
  type MeetingPrepDetail,
  type OutcomeMark,
  type ProjectPickerOption,
} from "@/lib/server-actions/meeting-prep";
import { searchContactsForEmailTemplate } from "@/lib/server-actions/email-templates";
import { TRACK_META, TRACKS, type Track } from "@/lib/types";
import type { MeetingReview } from "@/lib/server-actions/meeting-reviews";
import type { MeetingPoint } from "@/lib/server-actions/meeting-points";
import { rebuildBrowningPlan } from "@/lib/server-actions/browning-networking";
import { acceptMeetingPlan } from "@/lib/server-actions/meeting-plan";
import {
  discardAdaptation,
  type LiveScript,
  type MeetingAdaptation,
} from "@/lib/server-actions/live-scripts";
import { cn } from "@/lib/utils";
import { MeetingOnePath } from "@/components/jasonos/meeting-prep/meeting-one-path";

export { BlockTitle, easternClock, joinHref, Prose };

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
  const clock = easternClock(startsAt);
  const length = durationLabel(startsAt, endsAt);
  let when = easternDay(startsAt);
  if (now != null) {
    const day = etDateKey(Date.parse(startsAt));
    if (day === etDateKey(now)) when = "Today";
    else if (day === etDateKey(now + 86_400_000)) when = "Tomorrow";
  }
  const parts = [`${when} ${clock}`];
  if (now != null) {
    const relative = relativeStart(startsAt, endsAt, now);
    if (relative?.startsWith("Starts in")) {
      parts.push(relative.replace(/^Starts in /i, "IN ").toUpperCase());
    } else if (relative === "Happening now") {
      parts.push("NOW");
    }
  }
  if (length) parts.push(length);
  return parts.join(" · ");
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

export function Expandable({ text }: { text: string }) {
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

function WhoTheyAreCard({
  prep,
  person,
}: {
  prep: MeetingPrepDetail;
  person: MeetingContextPerson;
}) {
  const [introOpen, setIntroOpen] = useState(false);
  const [docText, setDocText] = useState<{ title: string; text: string; url: string | null } | null>(
    null
  );
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const router = useRouter();
  const packet = person.packet;
  const intro = packet?.introReason?.trim() || null;
  const introLines = intro ? intro.split(/\n/).filter(Boolean) : [];
  const introShort = introLines.slice(0, 4).join("\n");
  const introLong = Boolean(intro && introLines.length > 4);
  const highlights = prep.packetHighlights;
  const linkedinUrls =
    packet?.linkedinUrls?.length
      ? packet.linkedinUrls
      : person.linkedinUrl
        ? [person.linkedinUrl]
        : [];
  const resumeUrl = `/api/browning-networking/resume?contactId=${encodeURIComponent(person.contactId)}`;

  const rebuild = () => {
    setRebuilding(true);
    void rebuildBrowningPlan({ prepId: prep.id, force: true }).then((result) => {
      setRebuilding(false);
      setConfirmRebuild(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.built ? "Plan rebuilt from Browning playbook." : "Plan unchanged.");
      router.refresh();
    });
  };

  return (
    <section className="border-b border-[var(--jos-line)] px-10 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={LIVE_SECTION_LABEL}>Who they are</p>
          <p className="mt-1 text-[22px] font-extrabold tracking-tight">{person.name}</p>
          <p className="mt-0.5 text-[15px] text-[var(--jos-muted)]">
            {[person.title || "Title unfinished", person.company || "Company unfinished"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {confirmRebuild ? (
          <span className="text-[13px]">
            Replace the plan?{" "}
            <button
              type="button"
              className="font-semibold text-[var(--color-accent-700)] hover:underline"
              disabled={rebuilding}
              onClick={rebuild}
            >
              Confirm
            </button>
            {" · "}
            <button
              type="button"
              className="font-semibold hover:underline"
              onClick={() => setConfirmRebuild(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={rebuilding}
            onClick={() => setConfirmRebuild(true)}
          >
            Rebuild plan
          </Button>
        )}
      </div>

      {intro ? (
        <div className="mt-3 max-w-[70ch]">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Why Browning connected us
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
            {introOpen || !introLong ? intro : introShort}
          </p>
          {introLong ? (
            <button
              type="button"
              className="mt-1 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
              onClick={() => setIntroOpen((open) => !open)}
            >
              {introOpen ? "Less" : "More"}
            </button>
          ) : null}
        </div>
      ) : null}

      {highlights.length ? (
        <div className="mt-3 max-w-[70ch]">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            From their resume
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
        {linkedinUrls.map((url) => (
          <ExternalLink key={url} href={url}>
            LinkedIn
          </ExternalLink>
        ))}
        <ExternalLink href={resumeUrl}>Resume</ExternalLink>
        {(packet?.otherDocuments ?? []).map((doc) => (
          <button
            key={doc.filename}
            type="button"
            className="font-semibold text-[var(--color-accent-700)] hover:underline"
            onClick={() => setDocText({ title: doc.filename, text: doc.text, url: null })}
          >
            {doc.filename}
          </button>
        ))}
      </div>

      {docText ? (
        <Dialog open onOpenChange={(open) => !open && setDocText(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{docText.title}</DialogTitle>
              <DialogDescription>Extracted text from the Browning packet.</DialogDescription>
            </DialogHeader>
            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-[14px] leading-relaxed">
              {docText.text}
            </pre>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}

export function PersonRow({ person }: { person: MeetingContextPerson }) {
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
            {connection.attachmentLabel || "Resume"}
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

export function ThreadRow({ thread }: { thread: OtherThread }) {
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

export const MEETING_PREP_FIELD =
  "w-full rounded-[2px] border-0 border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] px-3.5 text-[16px] text-[var(--jos-ink)] outline-none placeholder:text-[var(--jos-muted)]";
const FIELD = MEETING_PREP_FIELD;

const MARK_PILL: Record<OutcomeMark, { label: string; className: string }> = {
  hit: {
    label: "Hit",
    className: "bg-[var(--color-done-100)] text-[var(--color-done)]",
  },
  partial: {
    label: "Partial",
    className: "bg-[var(--jos-warn-tint)] text-[var(--jos-ink)]",
  },
  missed: {
    label: "Missed",
    className: "bg-[var(--color-accent-2-100)] text-[var(--color-accent-2-text)]",
  },
};

function MarkPill({ mark }: { mark: OutcomeMark | null }) {
  if (!mark) {
    return (
      <span className="bg-[var(--color-surface)] px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
        Not marked
      </span>
    );
  }
  const pill = MARK_PILL[mark];
  return (
    <span className={`px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] ${pill.className}`}>
      {pill.label}
    </span>
  );
}

function OutcomeForMeeting({
  prep,
  projects,
  people,
}: {
  prep: MeetingPrepDetail;
  projects: ProjectPickerOption[];
  people: MeetingContextPerson[];
}) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState(prep.outcomeNote ?? "");
  const [seenNote, setSeenNote] = useState(prep.outcomeNote ?? "");
  const purpose = isJoinBoilerplate(prep.purpose) ? "" : (prep.purpose ?? "").trim();

  if ((prep.outcomeNote ?? "") !== seenNote && !changing) {
    setSeenNote(prep.outcomeNote ?? "");
    setNote(prep.outcomeNote ?? "");
  }

  const saveSentence = (next: string) => {
    void setMeetingOutcomeSentence(prep.id, next).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const saveMark = (mark: OutcomeMark) => {
    void setMeetingOutcomeMark(prep.id, { mark, note }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setChanging(false);
      router.refresh();
    });
  };

  return (
    <div className="mt-3 max-w-[62ch] space-y-2">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
        Outcome for this meeting
      </p>
      <InlineField
        value={prep.outcomeSentence ?? ""}
        placeholder="One sentence you will score this meeting against"
        emptyLabel="One sentence you will score this meeting against"
        maxLength={400}
        className="text-[16px] font-medium text-[var(--jos-ink)]"
        onSave={saveSentence}
      />
      {!prep.outcomeSentence && purpose ? (
        <button
          type="button"
          className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
          onClick={() => saveSentence(purpose)}
        >
          Use purpose
        </button>
      ) : null}
      <GoalLinks prep={prep} projects={projects} people={people} />
      {prep.liveEndedAt ? (
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <MarkPill mark={prep.outcomeMark} />
            {changing ? null : (
              <button
                type="button"
                className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
                onClick={() => {
                  setNote(prep.outcomeNote ?? "");
                  setChanging(true);
                }}
              >
                Change
              </button>
            )}
          </div>
          {prep.outcomeNote && !changing ? (
            <p className="text-[15px] leading-snug text-[var(--jos-ink)]">{prep.outcomeNote}</p>
          ) : null}
          {changing ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MARK_PILL) as OutcomeMark[]).map((mark) => (
                  <Button key={mark} type="button" size="sm" variant="outline" onClick={() => saveMark(mark)}>
                    {MARK_PILL[mark].label}
                  </Button>
                ))}
              </div>
              <input
                value={note}
                maxLength={400}
                placeholder="Optional note"
                aria-label="Outcome note"
                className="w-full border-0 border-b-2 border-[var(--color-neutral-400)] bg-transparent py-1 text-[15px] outline-none"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type EntityHit = { id: string; name: string; detail?: string | null };

function MeetingEntityPicker({
  label,
  valueLabel,
  emptyLabel,
  ariaLabel,
  onClear,
  onPick,
  kind,
  roomOptions = [],
}: {
  label: string;
  valueLabel: string | null;
  emptyLabel: string;
  ariaLabel: string;
  onClear: () => void;
  onPick: (hit: EntityHit) => void;
  kind: "contact" | "company";
  roomOptions?: EntityHit[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<EntityHit[]>([]);
  const [searching, setSearching] = useState(false);
  const roomKey = roomOptions.map((row) => row.id).join(",");

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(roomOptions.slice(0, 8));
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      const run =
        kind === "contact"
          ? searchContactsForEmailTemplate(trimmed, 10).then((rows) =>
              rows.map((row) => ({ id: row.id, name: row.name, detail: row.firm }))
            )
          : searchCompaniesForMeeting(trimmed, 10).then((rows) =>
              rows.map((row) => ({ id: row.id, name: row.name }))
            );
      void run.then((rows) => {
        if (cancelled) return;
        setResults(rows);
        setSearching(false);
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // roomOptions identity changes every render; roomKey is the stable signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kind, roomKey]);

  return (
    <label className="relative block space-y-1">
      <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">{label}</span>
      {valueLabel ? (
        <div className="flex items-baseline justify-between gap-2 border-b-2 border-[var(--color-neutral-400)] py-1">
          <span className="min-w-0 truncate text-[15px] font-semibold">{valueLabel}</span>
          <button
            type="button"
            className="shrink-0 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      ) : (
        <input
          value={query}
          aria-label={ariaLabel}
          placeholder={emptyLabel}
          className="w-full border-0 border-b-2 border-[var(--color-neutral-400)] bg-transparent py-1 text-[15px] outline-none placeholder:text-[var(--jos-muted)]"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (!query.trim()) setResults(roomOptions.slice(0, 8));
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        />
      )}
      {!valueLabel && open ? (
        <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-20 max-h-56 overflow-y-auto rounded-[2px] bg-[var(--jos-bg)] shadow-[var(--shadow-lg)]">
          {searching && results.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-[var(--jos-muted)]">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-[var(--jos-muted)]">No matches.</p>
          ) : (
            results.map((hit) => (
              <button
                key={hit.id}
                type="button"
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-[var(--jos-surface)]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(hit);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="truncate text-[15px] font-semibold">{hit.name}</span>
                {hit.detail ? (
                  <span className="truncate text-[13px] text-[var(--jos-muted)]">{hit.detail}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </label>
  );
}

export function GoalLinks({
  prep,
  projects,
  people,
  showCompany = true,
}: {
  prep: MeetingPrepDetail;
  projects: ProjectPickerOption[];
  people: MeetingContextPerson[];
  showCompany?: boolean;
}) {
  const router = useRouter();
  const personId = prep.primaryContactId ?? "";
  const person = people.find((item) => item.contactId === personId) ?? null;
  const personLabel = person?.name ?? prep.primaryContactName;
  const project = projects.find((item) => item.id === prep.projectId) ?? null;
  const roomPeople = people.map((item) => ({
    id: item.contactId,
    name: item.name,
    detail: item.company,
  }));

  const saveProject = (value: string) => {
    void setMeetingProject(prep.id, value || null).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const savePerson = (value: string | null) => {
    void setMeetingPrimaryContact(prep.id, value).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(value ? "Person linked" : "Person cleared");
      router.refresh();
    });
  };

  const saveCompany = (value: string | null) => {
    void setMeetingCompany(prep.id, value).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(value ? "Company linked" : "Company cleared");
      router.refresh();
    });
  };

  const inferred = inferredMeetingTrack(people);
  const saveTrack = (value: string) => {
    void setMeetingTrack(prep.id, value || null).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const gridClass = showCompany
    ? "grid gap-3 pt-1 sm:grid-cols-2 min-[1100px]:grid-cols-4"
    : "grid gap-3 pt-1 sm:grid-cols-3";

  return (
    <div className={gridClass}>
      <label className="block space-y-1">
        <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">Track</span>
        <select
          value={prep.track ?? ""}
          aria-label="Track"
          className="w-full border-0 border-b-2 border-[var(--color-neutral-400)] bg-transparent py-1 text-[15px] outline-none"
          onChange={(event) => saveTrack(event.target.value)}
        >
          <option value="">
            {inferred ? `From contact (${TRACK_META[inferred].short})` : "No track"}
          </option>
          {MEETING_TRACKS.map((track) => (
            <option key={track} value={track}>
              {TRACK_META[track].short}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">Project</span>
        <select
          value={prep.projectId ?? ""}
          aria-label="Project"
          className="w-full border-0 border-b-2 border-[var(--color-neutral-400)] bg-transparent py-1 text-[15px] outline-none"
          onChange={(event) => saveProject(event.target.value)}
        >
          <option value="">No project</option>
          {projects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {project ? <p className="text-[14px] leading-snug text-[var(--jos-ink)]">{project.goalStatement}</p> : null}
      </label>
      <MeetingEntityPicker
        label="Person"
        valueLabel={personLabel}
        emptyLabel="Search contacts"
        ariaLabel="Link a person"
        kind="contact"
        roomOptions={roomPeople}
        onClear={() => savePerson(null)}
        onPick={(hit) => savePerson(hit.id)}
      />
      {showCompany ? (
        <MeetingEntityPicker
          label="Company"
          valueLabel={prep.primaryCompanyName}
          emptyLabel="Search companies"
          ariaLabel="Link a company"
          kind="company"
          onClear={() => saveCompany(null)}
          onPick={(hit) => saveCompany(hit.id)}
        />
      ) : null}
      {(person?.personalGoal || prep.personalGoal) && personLabel ? (
        <p
          className={cn(
            "text-[14px] text-[var(--jos-muted)]",
            showCompany ? "sm:col-span-2 min-[1100px]:col-span-4" : "sm:col-span-3"
          )}
        >
          Your goal for {personLabel}: {person?.personalGoal || prep.personalGoal}
        </p>
      ) : null}
    </div>
  );
}

const MEETING_TRACKS: Track[] = ["job_search", "advisors", "venture", "personal"];

function inferredMeetingTrack(people: MeetingContextPerson[]): Track | null {
  for (const person of people) {
    const track = person.tracks.find((item): item is Track => (TRACKS as string[]).includes(item));
    if (track) return track;
  }
  return null;
}

function meetingIsSoon(startsAt: string): boolean {
  const start = Date.parse(startsAt);
  if (Number.isNaN(start)) return false;
  const now = Date.now();
  return start >= now - 12 * 60 * 60 * 1000 && start <= now + 7 * 24 * 60 * 60 * 1000;
}

function personNeedsResearch(person: MeetingContextPerson): boolean {
  return isContactThin({
    title: person.title,
    companyId: person.company ? "linked" : null,
    linkedinUrl: person.linkedinUrl,
    researchAt: person.researchAt,
  });
}

function ResearchStatus({
  prepId,
  researchRanAt,
  researching,
}: {
  prepId: string;
  researchRanAt: string | null;
  researching: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!researching) return;
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [researching, router]);
  const run = () => {
    startTransition(async () => {
      const result = await runMeetingResearch(prepId, { force: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.errors.length && result.researched.length === 0) {
        toast.error(result.errors[0]);
      } else if (result.researched.length) {
        toast.success(`Researched ${result.researched.join(", ")}`);
      } else {
        toast.success("Research is current");
      }
      router.refresh();
    });
  };
  return (
    <p className="text-[14px] text-[var(--jos-muted)]">
      {pending || researching ? (
        "Researching attendees"
      ) : researchRanAt ? (
        <>
          Researched {easternDateLong(researchRanAt)}
          {" · "}
          <button type="button" className="font-semibold text-[var(--color-accent-700)] hover:underline" onClick={run}>
            Redo
          </button>
        </>
      ) : (
        <>
          Not researched
          {" · "}
          <button type="button" className="font-semibold text-[var(--color-accent-700)] hover:underline" onClick={run}>
            Research now
          </button>
        </>
      )}
    </p>
  );
}

function SourceLinks({ sources }: { sources: Array<{ title: string | null; url: string }> }) {
  if (!sources.length) return null;
  return (
    <p className="mt-1 text-[13px] leading-relaxed">
      {sources.slice(0, 4).map((source, index) => (
        <span key={source.url}>
          {index ? " · " : null}
          <ExternalLink href={source.url}>{source.title || "Source"}</ExternalLink>
        </span>
      ))}
    </p>
  );
}

export function AttendeeResearch({ people }: { people: MeetingContextPerson[] }) {
  const shown = people.filter(
    (person) => person.researchLead || person.researchBullets.length || person.companyResearch
  );
  if (!shown.length) return null;
  return (
    <div className="space-y-5">
      {shown.map((person) => (
        <div key={person.contactId} className="max-w-[65ch]">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
            Who {person.name} is
          </p>
          {person.researchLead ? (
            <p className="mt-1 text-[15px] leading-relaxed">
              <Prose text={person.researchLead} />
            </p>
          ) : null}
          {person.researchBullets.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
              {person.researchBullets.slice(0, 4).map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
          <SourceLinks sources={person.researchSources} />
          {person.companyResearch ? (
            <div className="mt-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                {person.companyResearch.name || "Their company"}
              </p>
              {!person.companyResearch.verified ? (
                <p className="mt-1 text-[14px] font-medium text-[var(--color-accent-2-text)]">
                  Unverified: JasonOS could not read the company website
                </p>
              ) : null}
              {person.companyResearch.lead ? (
                <p className="mt-1 text-[15px] leading-relaxed">
                  <Prose text={person.companyResearch.lead} />
                </p>
              ) : null}
              {person.companyResearch.bullets.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
                  {person.companyResearch.bullets.slice(0, 4).map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              <SourceLinks sources={person.companyResearch.sources} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AdaptedPlan({
  proposal,
  personName,
  pointCount,
  onClose,
}: {
  proposal: MeetingAdaptation;
  personName: string;
  pointCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const acceptPlan = () => {
    setBusy(true);
    void acceptMeetingPlan({ adaptationId: proposal.id, mode: "replace" }).then((result) => {
      setBusy(false);
      setConfirmReplace(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Plan saved");
      onClose();
      router.replace(`/meetings/${proposal.prepId}`);
      router.refresh();
    });
  };

  const startOver = () => {
    setBusy(true);
    void discardAdaptation(proposal.id).then((result) => {
      setBusy(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onClose();
      router.replace(`/meetings/${proposal.prepId}`);
      router.refresh();
    });
  };

  return (
    <section className="space-y-3 border border-[var(--color-neutral-400)] bg-[var(--jos-surface)] p-4">
      <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">Built for this meeting</h2>
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-[14px] font-semibold text-[var(--jos-ink)]">{proposal.scriptName}</h3>
          <ul className="space-y-3">
            {proposal.genericItems.map((item, index) => (
              <li key={`${item.kind}-${item.headline}-${index}`} className="space-y-1">
                <p className="text-[15px] font-semibold text-[var(--jos-ink)]">{item.headline}</p>
                {item.detail ? <p className="text-[14px] leading-snug text-[var(--jos-ink)]">{item.detail}</p> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-[14px] font-semibold text-[var(--jos-ink)]">{personName}&apos;s version</h3>
          <ul className="space-y-3">
            {proposal.items.map((item, index) => (
              <li key={`${item.headline}-${index}`} className="space-y-1">
                <p
                  className={`text-[15px] font-semibold text-[var(--jos-ink)] ${item.dropped ? "line-through" : ""}`}
                >
                  {item.headline}
                </p>
                {item.dropped ? (
                  <p className="text-[13px] text-[var(--jos-muted)]">{item.droppedReason || item.sourceHint}</p>
                ) : (
                  <>
                    {item.detail ? <p className="text-[14px] leading-snug text-[var(--jos-ink)]">{item.detail}</p> : null}
                    {item.added ? (
                      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                        Added from context
                      </p>
                    ) : null}
                    {item.sourceHint ? <p className="text-[13px] text-[var(--jos-muted)]">{item.sourceHint}</p> : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-[13px] text-[var(--jos-muted)]">Used: {proposal.contextUsed.join(" · ") || "none"}</p>
      <p className="text-[13px] text-[var(--jos-muted)]">Missing: {proposal.contextMissing.join(" · ") || "none"}</p>
      <div className="flex flex-wrap items-center gap-2">
        {confirmReplace ? (
          <span className="text-[13px] text-[var(--jos-ink)]">
            Replace {pointCount} existing points?{" "}
            <button
              type="button"
              className="font-semibold text-[var(--color-accent-700)] hover:underline"
              disabled={busy}
              onClick={acceptPlan}
            >
              Confirm
            </button>
            {" · "}
            <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmReplace(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={busy}
            onClick={() => (pointCount > 0 ? setConfirmReplace(true) : acceptPlan())}
          >
            Use this plan
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={startOver}>
          Start over
        </Button>
      </div>
    </section>
  );
}



void ReadBeat;
void threadFootnote;
void FocusEditor;

export function MeetingPrepClient({
  prep,
  context,
  points,
  pointsError,
  scripts,
  rubric,
  review,
  projects,
  adaptation,
}: {
  prep: MeetingPrepDetail;
  context: MeetingContext;
  points: MeetingPoint[];
  pointsError?: string | null;
  scripts: LiveScript[];
  rubric: string[];
  review: MeetingReview | null;
  projects: ProjectPickerOption[];
  adaptation: MeetingAdaptation | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const [addTarget, setAddTarget] = useState<{ email: string; name: string | null } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);

  const join = joinHref(prep);
  const primary =
    context.people.find((person) => person.contactId === prep.primaryContactId) ??
    context.people[0] ??
    null;
  const extraPeople = Math.max(0, context.people.length + context.unmatched.length - (primary ? 1 : 0));
  const researchLine = primary?.researchLead?.trim() || null;
  const metaLine = [
    primary?.company,
    primary?.referredByName ? `introduced by ${primary.referredByName}` : null,
    context.pastMeetings.length
      ? `${context.pastMeetings.length} earlier meeting${context.pastMeetings.length === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const initials = (primary?.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const duration = durationLabel(prep.startsAt, prep.endsAt);
  const kicker = meetingKicker(prep.startsAt, prep.endsAt, now);

  const titleField = (
    <UnfinishedField
      value={prep.title}
      emptyLabel="Name this meeting"
      placeholder="Meeting name"
      aria-label="Meeting name"
      inputClassName="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] break-words"
      className="mt-2"
      onSave={(next) => {
        startTransition(async () => {
          const result = await setMeetingTitle(prep.id, next);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Meeting name saved");
          router.refresh();
        });
      }}
    />
  );

  return (
    <div className="min-h-[calc(100vh-var(--jos-nav-h))]">
      <LiveTertiaryNav />
      <header className="border-b border-[var(--jos-ink)] px-10 py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
              <CalendarBlank size={14} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
              {kicker}
              {duration ? ` · ${duration}` : ""}
            </p>
            {titleField}
            {primary ? (
              <div className="mt-4 flex items-start gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center bg-[var(--jos-surface)] text-[18px] font-bold">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-[18px] font-bold leading-snug">
                    {primary.name}
                    {primary.title ? (
                      <span className="font-semibold text-[var(--jos-muted)]"> · {primary.title}</span>
                    ) : null}
                    {extraPeople > 0 ? (
                      <button
                        type="button"
                        className="ml-2 text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
                        onClick={() => {
                          document.getElementById("step-who")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        +{extraPeople}
                      </button>
                    ) : null}
                  </p>
                  {metaLine ? <p className="mt-0.5 text-[15px] text-[var(--jos-muted)]">{metaLine}</p> : null}
                  {researchLine ? (
                    <p className="mt-1 line-clamp-1 text-[15px] text-[var(--jos-ink)]">{researchLine}</p>
                  ) : null}
                </div>
              </div>
            ) : prep.primaryContactName || prep.primaryCompanyName ? (
              <p className="mt-3 text-[15px] text-[var(--jos-muted)]">
                {[prep.primaryContactName, prep.primaryCompanyName].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {prep.error ? (
              <p className="mt-3 text-[14px] font-medium text-[var(--color-accent-2-text)]">{prep.error}</p>
            ) : null}
          </div>
          {join ? (
            <a
              href={join}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" }) + " h-9"}
            >
              Join the call
            </a>
          ) : null}
        </div>
      </header>

      <MeetingOnePath
        prep={prep}
        context={context}
        points={points}
        pointsError={pointsError}
        scripts={scripts}
        rubric={rubric}
        review={review}
        projects={projects}
        adaptation={adaptation}
        onAddUnmatched={(person) => setAddTarget(person)}
      />

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
