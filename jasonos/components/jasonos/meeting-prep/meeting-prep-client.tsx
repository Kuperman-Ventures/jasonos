"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarBlank, CheckCircle, Play } from "@phosphor-icons/react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  CollapsibleSection,
  LIVE_SECTION_LABEL,
  UnfinishedField,
  deriveMeetingMode,
  readModeOverride,
  writeModeOverride,
  type MeetingPageMode,
} from "@/components/jasonos/live";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ContactCreateModal } from "@/components/jasonos/outreach/contact-create-modal";
import { AfterTheCall } from "@/components/jasonos/meeting-prep/after-call";
import { InlineField, PointsEditor } from "@/components/jasonos/meeting-prep/points-editor";
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
  setMeetingOutcomeMark,
  setMeetingOutcomeSentence,
  setMeetingPrimaryContact,
  setMeetingProject,
  setMeetingPurpose,
  setMeetingTrack,
  type MeetingPrepDetail,
  type OutcomeMark,
  type ProjectPickerOption,
} from "@/lib/server-actions/meeting-prep";
import { TRACK_META, TRACKS, type Track } from "@/lib/types";
import type { MeetingReview } from "@/lib/server-actions/meeting-reviews";
import {
  createMeetingPoint,
  deleteMeetingPoint,
  draftMeetingPointReactions,
  draftMeetingPoints,
  reorderMeetingPoints,
  updateMeetingPoint,
  type MeetingPoint,
} from "@/lib/server-actions/meeting-points";
import { rebuildBrowningPlan } from "@/lib/server-actions/browning-networking";
import {
  acceptAdaptation,
  applyLiveScript,
  attachPlanToMeeting,
  discardAdaptation,
  proposeAdaptation,
  saveMeetingPointsAsScript,
  type LiveScript,
  type MeetingAdaptation,
} from "@/lib/server-actions/live-scripts";
import { cn } from "@/lib/utils";

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
      toast.success(result.built ? "Plan rebuilt from Browning strategy." : "Plan unchanged.");
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

const FIELD =
  "w-full rounded-[2px] border-0 border-b-2 border-[var(--color-neutral-400)] bg-[var(--jos-surface)] px-3.5 text-[16px] text-[var(--jos-ink)] outline-none placeholder:text-[var(--jos-muted)]";

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

function GoalLinks({
  prep,
  projects,
  people,
}: {
  prep: MeetingPrepDetail;
  projects: ProjectPickerOption[];
  people: MeetingContextPerson[];
}) {
  const router = useRouter();
  const personId = prep.primaryContactId ?? people[0]?.contactId ?? "";
  const person = people.find((item) => item.contactId === personId) ?? null;
  const project = projects.find((item) => item.id === prep.projectId) ?? null;

  const saveProject = (value: string) => {
    void setMeetingProject(prep.id, value || null).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const savePerson = (value: string) => {
    void setMeetingPrimaryContact(prep.id, value || null).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
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

  return (
    <div className="grid gap-3 pt-1 sm:grid-cols-3">
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
      <label className="block space-y-1">
        <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">Person</span>
        <select
          value={personId}
          aria-label="Person"
          className="w-full border-0 border-b-2 border-[var(--color-neutral-400)] bg-transparent py-1 text-[15px] outline-none"
          onChange={(event) => savePerson(event.target.value)}
        >
          <option value="">No person</option>
          {people.map((item) => (
            <option key={item.contactId} value={item.contactId}>
              {item.name}
            </option>
          ))}
        </select>
        {person?.personalGoal ? (
          <p className="text-[14px] text-[var(--jos-muted)]">
            Your goal for {person.name}: {person.personalGoal}
          </p>
        ) : null}
      </label>
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

function AttendeeResearch({ people }: { people: MeetingContextPerson[] }) {
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

function AdaptedPlan({
  proposal,
  personName,
  pointCount,
  onProposal,
  onClose,
}: {
  proposal: MeetingAdaptation;
  personName: string;
  pointCount: number;
  onProposal: (next: MeetingAdaptation | null) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const accept = (mode: "add" | "replace") => {
    setBusy(true);
    void acceptAdaptation({ adaptationId: proposal.id, mode }).then((result) => {
      setBusy(false);
      setConfirmReplace(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "replace" ? "Replaced with the adapted plan" : "Added the adapted plan");
      onClose();
      router.replace(`/meetings/${proposal.prepId}`);
      router.refresh();
    });
  };

  const redo = () => {
    setBusy(true);
    void proposeAdaptation({ scriptId: proposal.scriptId, prepId: proposal.prepId }).then((result) => {
      setBusy(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onProposal(result.adaptation);
      router.refresh();
    });
  };

  const discard = () => {
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
      <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">Adapted plan</h2>
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
              onClick={() => accept("replace")}
            >
              Confirm
            </button>
            {" · "}
            <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmReplace(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => (pointCount > 0 ? setConfirmReplace(true) : accept("replace"))}
            >
              Accept and replace
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => accept("add")}>
              Accept and add
            </Button>
          </>
        )}
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={redo}>
          Redo
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={discard}>
          Discard
        </Button>
      </div>
    </section>
  );
}

function PrepPoints({
  prep,
  points,
  pointsError,
  scripts,
  people,
  adaptation,
}: {
  prep: MeetingPrepDetail;
  points: MeetingPoint[];
  pointsError?: string | null;
  scripts: LiveScript[];
  people: MeetingContextPerson[];
  adaptation: MeetingAdaptation | null;
}) {
  const router = useRouter();
  const [scriptId, setScriptId] = useState(prep.scriptId ?? "");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const signature = adaptation ? `${adaptation.id}:${adaptation.updatedAt}` : "";
  const [seenAdaptation, setSeenAdaptation] = useState(signature);
  const [proposal, setProposal] = useState<MeetingAdaptation | null>(adaptation);
  if (signature !== seenAdaptation) {
    setSeenAdaptation(signature);
    setProposal(adaptation);
  }
  const personName =
    prep.primaryContactName ||
    people.find((person) => person.contactId === prep.primaryContactId)?.name ||
    people[0]?.name ||
    "This person";
  const first = firstName(personName);

  const markable = points.filter((point) => point.kind !== "agenda");
  const asks = markable.filter((point) => point.kind === "ask");
  const asksMissing = asks.filter((point) => point.reactions.length !== 6);
  const reactionsReady = asks.length > 0 && asksMissing.length === 0;
  const adaptedLabel = prep.builtAt
    ? new Date(prep.builtAt).toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const adapt = () => {
    if (!scriptId) return;
    setApplying(true);
    void proposeAdaptation({ scriptId, prepId: prep.id }).then((result) => {
      setApplying(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setProposal(result.adaptation);
      router.replace(`/meetings/${prep.id}?adapt=${scriptId}`);
    });
  };

  const apply = (mode: "add" | "replace") => {
    if (!scriptId) return;
    setApplying(true);
    const selected = scripts.find((script) => script.id === scriptId);
    const run =
      selected?.kind === "plan"
        ? attachPlanToMeeting({ scriptId, prepId: prep.id, mode })
        : applyLiveScript({ scriptId, prepId: prep.id, mode });
    void run.then((result) => {
      setApplying(false);
      setConfirmReplace(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const count = result.added === 1 ? "1 point" : `${result.added} points`;
      toast.success(selected?.kind === "plan" ? `Attached ${count}` : `Added ${count}`);
      router.refresh();
    });
  };

  const saveScript = () => {
    const name = saveName.trim();
    if (!name) {
      toast.error("Name the strategy.");
      return;
    }
    setSaving(true);
    void saveMeetingPointsAsScript({
      prepId: prep.id,
      name,
      description: saveDescription,
    }).then((result) => {
      setSaving(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaveOpen(false);
      setSaveName("");
      setSaveDescription("");
      toast.success(
        <span>
          Saved as strategy.{" "}
          <a className="underline" href={`/live/scripts/${result.scriptId}`}>
            Open it
          </a>
        </span>
      );
    });
  };

  const selectedScript = scripts.find((script) => script.id === scriptId) ?? null;

  return (
    <>
      {proposal ? (
        <AdaptedPlan
          proposal={proposal}
          personName={personName}
          pointCount={points.length}
          onProposal={setProposal}
          onClose={() => setProposal(null)}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[24px] font-extrabold tracking-tight">The plan</h2>
        <label className="sr-only" htmlFor="plan-strategy">
          Strategy
        </label>
        <select
          id="plan-strategy"
          aria-label="Strategy"
          value={scriptId}
          className="h-8 max-w-[14rem] border-0 border-b-2 border-[#b5b2b2] bg-[var(--jos-surface)] px-2 text-[13px] font-bold outline-none"
          onChange={(event) => {
            setScriptId(event.target.value);
            setConfirmReplace(false);
          }}
        >
          <option value="">{prep.scriptName || "Start from a strategy"}</option>
          {scripts
            .filter((script) => script.kind !== "plan")
            .map((script) => (
              <option key={script.id} value={script.id}>
                {script.name}
              </option>
            ))}
          {scripts.some((script) => script.kind === "plan" && !script.attachedPrepId) ? (
            <option disabled value="">
              ——— Plans ———
            </option>
          ) : null}
          {scripts
            .filter((script) => script.kind === "plan" && !script.attachedPrepId)
            .map((script) => (
              <option key={script.id} value={script.id}>
                Plan: {script.name}
              </option>
            ))}
        </select>
        {scriptId ? (
          confirmReplace ? (
            <span className="text-[13px]">
              Replace {points.length} existing points?{" "}
              <button
                type="button"
                className="font-semibold text-[var(--color-accent-700)] hover:underline"
                disabled={applying}
                onClick={() => apply("replace")}
              >
                Confirm
              </button>
              {" · "}
              <button type="button" className="font-semibold hover:underline" onClick={() => setConfirmReplace(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <>
              <Button type="button" size="sm" variant="secondary" disabled={applying} onClick={() => apply("add")}>
                Add
              </Button>
              <Button type="button" size="sm" variant="secondary" disabled={applying} onClick={() => setConfirmReplace(true)}>
                Replace
              </Button>
              {selectedScript?.kind !== "plan" ? (
                <Button type="button" size="sm" variant="secondary" disabled={applying} onClick={adapt}>
                  Adapt to {first}
                </Button>
              ) : null}
            </>
          )
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!scripts.some((script) => script.kind !== "plan")}
            onClick={() => {
              const firstStrategy = scripts.find((script) => script.kind !== "plan");
              if (firstStrategy) setScriptId(firstStrategy.id);
            }}
          >
            Adapt to {first}
          </Button>
        )}
        {selectedScript ? (
          <Link
            href={`/live/scripts/${selectedScript.id}`}
            className="ml-auto text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
          >
            Edit plan
          </Link>
        ) : prep.scriptId ? (
          <Link
            href={`/live/scripts/${prep.scriptId}`}
            className="ml-auto text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
          >
            Edit plan
          </Link>
        ) : null}
      </div>

      {prep.planSource === "browning_auto" ? (
        <p className="mt-2 text-[14px] text-[var(--jos-muted)]">
          Built from the Browning first-call strategy and their resume. Edit anything.
        </p>
      ) : null}

      <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-[var(--jos-muted)]">
        <span>
          {markable.length} points · {asks.length} asks
          {reactionsReady ? " · reactions ready" : ""}
          {adaptedLabel ? ` · adapted ${adaptedLabel}` : ""}
        </span>
        {reactionsReady ? (
          <CheckCircle size={16} weight="duotone" className="text-[var(--color-done)]" style={{ color: "#006925" }} aria-hidden />
        ) : asksMissing.length ? (
          <span className="rounded-[2px] bg-[var(--jos-warn-tint)] px-2 py-0.5 text-[13px] font-semibold text-[var(--jos-ink)]">
            {asksMissing.length === 1
              ? "1 ask has no reactions"
              : `${asksMissing.length} asks have no reactions`}
            {asksMissing[0] ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setSelectedPointId(asksMissing[0].id)}
                >
                  Open card
                </button>
              </>
            ) : null}
          </span>
        ) : null}
      </p>

      <div className="mt-4">
        <PointsEditor
          layout="outline"
          points={points}
          error={pointsError}
          selectedId={selectedPointId}
          onSelectedIdChange={setSelectedPointId}
          actions={{
            create: async (input) => {
              const result = await createMeetingPoint({ prepId: prep.id, ...input });
              if (!result.ok) return result;
              return { ok: true, id: result.point.id };
            },
            update: (id, patch) => updateMeetingPoint(id, patch),
            draftReactions: (id) => draftMeetingPointReactions(id),
            remove: (id) => deleteMeetingPoint(id),
            reorder: (ids) => reorderMeetingPoints(prep.id, ids),
          }}
          draft={{ label: "Draft points", run: () => draftMeetingPoints(prep.id) }}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {markable.length ? (
          <Link
            href={`/meetings/${prep.id}/live`}
            className={cn(buttonVariants({ variant: "default" }), "h-12 gap-2 px-5 text-[15px]")}
          >
            <Play size={18} weight="fill" aria-hidden />
            Start live
          </Link>
        ) : (
          <button type="button" disabled className={cn(buttonVariants({ variant: "default" }), "h-12 px-5")}>
            Add at least one point
          </button>
        )}
        <Button type="button" size="sm" variant="secondary" disabled={markable.length === 0} onClick={() => setSaveOpen(true)}>
          Save as strategy
        </Button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="rounded-[2px] bg-[var(--jos-bg)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as strategy</DialogTitle>
            <DialogDescription>
              Copies these points into a strategy. State and notes stay on this meeting.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveScript();
            }}
          >
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">
                Name <span className="text-[var(--jos-danger)]">*</span>
              </span>
              <input
                required
                value={saveName}
                maxLength={120}
                className={`${FIELD} h-11`}
                onChange={(event) => setSaveName(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[14px] font-semibold">Description</span>
              <textarea
                value={saveDescription}
                rows={3}
                className={`${FIELD} py-2`}
                onChange={(event) => setSaveDescription(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" disabled={saving}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
  const usablePurpose = isJoinBoilerplate(prep.purpose) ? "" : (prep.purpose ?? "");
  const [, setText] = useState(usablePurpose);
  const [seenPurpose, setSeenPurpose] = useState(usablePurpose);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const [showAllThreads, setShowAllThreads] = useState(false);
  const [addTarget, setAddTarget] = useState<{ email: string; name: string | null } | null>(null);
  const [modeOverride, setModeOverride] = useState<MeetingPageMode | null>(() =>
    readModeOverride(prep.id)
  );

  useEffect(() => {
    // Clock starts after mount so the server HTML does not depend on the current minute.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);

  if (usablePurpose !== seenPurpose) {
    setSeenPurpose(usablePurpose);
    setText(usablePurpose);
  }

  const stored = usablePurpose.trim();
  const join = joinHref(prep);
  const briefing = context.briefing;

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

  const hasTranscript = context.granolaNotes.some((note) => note.kind === "this_meeting");
  const derived = deriveMeetingMode(prep, review, now ?? 0, hasTranscript);
  const mode = modeOverride ?? derived;
  const setMode = (next: MeetingPageMode) => {
    setModeOverride(next);
    writeModeOverride(prep.id, next);
  };

  const primary =
    context.people.find((person) => person.contactId === prep.primaryContactId) ??
    context.people[0] ??
    null;
  const extraPeople = Math.max(0, context.people.length + context.unmatched.length - (primary ? 1 : 0));
  const researchLine = primary?.researchLead?.trim() || null;
  const metaLine = [
    primary?.company,
    primary?.referredByName
      ? `introduced by ${primary.referredByName}`
      : null,
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
  const commitments = context.brief.commitments.map((item) => ({
    text: item.text,
    direction: item.direction,
    due: item.due,
    personName: item.personName,
    status: item.status,
  }));

  const modeToggle = (
    <div className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.08em]">
      <button
        type="button"
        className={mode === "before" ? "text-[var(--jos-ink)]" : "text-[var(--jos-muted)]"}
        onClick={() => setMode("before")}
      >
        Before
      </button>
      <span className="text-[var(--jos-muted)]">/</span>
      <button
        type="button"
        className={mode === "after" ? "text-[var(--jos-ink)]" : "text-[var(--jos-muted)]"}
        onClick={() => setMode("after")}
      >
        After
      </button>
    </div>
  );

  if (mode === "after") {
    return (
      <div className="min-h-[calc(100vh-var(--jos-nav-h))]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--jos-ink)] px-10 py-6">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
              <CalendarBlank size={14} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
              {kicker}
              {duration ? ` · ${duration}` : ""}
            </p>
            <h1 className="mt-2 text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] break-words">
              {prep.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {modeToggle}
          </div>
        </header>
        <div className="flex flex-col gap-8 min-[1100px]:flex-row">
          <div className="min-w-0 flex-[1.5]">
            <AfterTheCall
              prep={prep}
              points={points}
              rubric={rubric}
              review={review}
              commitments={commitments}
              nextTouch={null}
            />
          </div>
          <aside className="w-full shrink-0 space-y-5 px-10 pb-10 min-[1100px]:w-[360px] min-[1100px]:px-0 min-[1100px]:pr-10 min-[1100px]:pt-6">
            <CollapsibleSection id={`${prep.id}-after-brief`} label="Before the call" defaultOpen={false}>
              {context.brief.summary ? <Expandable text={context.brief.summary} /> : (
                <p className="text-[14px] text-[var(--jos-muted)]">No brief on file.</p>
              )}
            </CollapsibleSection>
            <CollapsibleSection id={`${prep.id}-after-research`} label="Research" defaultOpen={false}>
              <AttendeeResearch people={context.people} />
            </CollapsibleSection>
          </aside>
        </div>
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

  const showWhoTheyAre = Boolean(
    primary &&
      (primary.packet ||
        primary.tags.includes("source:browning") ||
        primary.browningPrep)
  );

  return (
    <div className="min-h-[calc(100vh-var(--jos-nav-h))]">
      {showWhoTheyAre && primary ? <WhoTheyAreCard prep={prep} person={primary} /> : null}
      <header className="grid gap-6 border-b border-[var(--jos-ink)] px-10 py-7 min-[1100px]:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-calendar-700)]">
              <CalendarBlank size={14} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
              {kicker}
              {duration ? ` · ${duration}` : ""}
            </p>
            {modeToggle}
          </div>
          <h1 className="mt-3 text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] break-words">
            {prep.title}
          </h1>
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
                        document.getElementById("in-the-room")?.scrollIntoView({ behavior: "smooth" });
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
          ) : null}
          {prep.error ? (
            <p className="mt-3 text-[14px] font-medium text-[var(--color-accent-2-text)]">{prep.error}</p>
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
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
            {prep.calendarUrl ? (
              <a
                href={prep.calendarUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "secondary", size: "sm" }) + " h-9"}
              >
                Calendar
              </a>
            ) : null}
          </div>
          <p className={cn(LIVE_SECTION_LABEL, "mt-5")}>What you want out of this</p>
          <div className="mt-2">
            <UnfinishedField
              value={stored}
              emptyLabel="Add a sentence"
              inputClassName="text-[20px] font-semibold"
              onSave={(next) => {
                setText(next);
                startTransition(async () => {
                  const result = await setMeetingPurpose(prep.id, next);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Focus saved");
                  router.refresh();
                });
              }}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-8 px-10 py-8 min-[1100px]:flex-row">
        <div className="min-w-0 flex-[1.5]">
          <PrepPoints
            prep={prep}
            points={points}
            pointsError={pointsError}
            scripts={scripts}
            people={context.people}
            adaptation={adaptation}
          />
          <div className="mt-8">
            <OutcomeForMeeting prep={prep} projects={projects} people={context.people} />
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-5 min-[1100px]:w-[360px]">
          <div id="in-the-room">
            <CollapsibleSection
              id={`${prep.id}-room`}
              label="In the room"
              meta={String(context.people.length + context.unmatched.length) || undefined}
              defaultOpen
            >
              <ul>
                {context.people.map((person) => (
                  <PersonRow key={person.contactId} person={person} />
                ))}
                {context.unmatched.map((person) => (
                  <li key={person.email} className="border-t border-[var(--jos-line)] py-3">
                    <p className="text-[16px] font-semibold">{person.name || person.email}</p>
                    <button
                      type="button"
                      className="mt-1 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                      onClick={() => setAddTarget(person)}
                    >
                      Add to contacts
                    </button>
                  </li>
                ))}
              </ul>
              <ResearchStatus
                prepId={prep.id}
                researchRanAt={prep.researchRanAt}
                researching={
                  !prep.researchRanAt &&
                  meetingIsSoon(prep.startsAt) &&
                  context.people.some(personNeedsResearch)
                }
              />
            </CollapsibleSection>
          </div>

          <CollapsibleSection id={`${prep.id}-research`} label="Research" defaultOpen>
            <AttendeeResearch people={context.people} />
          </CollapsibleSection>

          <CollapsibleSection id={`${prep.id}-brief`} label="Before the call" defaultOpen>
            {hasRead ? (
              <div className="space-y-4">
                {context.brief.summary ? <Expandable text={context.brief.summary} /> : null}
                {context.brief.nextMove ? (
                  <p className="text-[15px] leading-relaxed">
                    <span className="font-semibold">Next. </span>
                    {context.brief.nextMove}
                  </p>
                ) : null}
                {context.connections.map((connection) => (
                  <ConnectionRead key={connection.id} connection={connection} />
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-[var(--jos-muted)]">Nothing stored yet on the people in this meeting.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id={`${prep.id}-came-about`}
            label="How this came about"
            defaultOpen={false}
          >
            {prep.emailContext ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{prep.emailContext}</p>
            ) : (
              <p className="text-[14px] text-[var(--jos-muted)]">No email context yet.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id={`${prep.id}-earlier-meetings`}
            label="Earlier meetings"
            meta={context.pastMeetings.length || undefined}
            defaultOpen={false}
          >
            {context.pastMeetings.length ? (
              <ul className="space-y-4">
                {context.pastMeetings.map((meeting) => (
                  <li key={meeting.id}>
                    <p className="text-[13px] font-semibold text-[var(--jos-muted)]">
                      {meeting.when ? easternDateLong(meeting.when) : "Past meeting"}
                    </p>
                    {meeting.title ? <p className="text-[15px] font-semibold">{meeting.title}</p> : null}
                    {meeting.nextStep ? (
                      <p className="mt-1 text-[14px]">
                        <span className="font-semibold">Next. </span>
                        {meeting.nextStep}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-[var(--jos-muted)]">No earlier meetings on file.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id={`${prep.id}-email`}
            label="Latest email"
            meta={briefing.otherThreads.length || undefined}
            defaultOpen={false}
          >
            {emailIsNew && context.recentEmail ? (
              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-[var(--jos-muted)]">
                  With {context.recentEmail.personName}
                </p>
                <Expandable text={context.recentEmail.summary} />
                {context.recentEmail.threadUrl ? (
                  <ExternalLink href={context.recentEmail.threadUrl}>Open email</ExternalLink>
                ) : null}
              </div>
            ) : briefing.otherThreads.length ? (
              <ul>
                {visibleThreads.map((thread) => (
                  <ThreadRow key={thread.id} thread={thread} />
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-[var(--jos-muted)]">No recent email.</p>
            )}
            {hiddenThreadCount > 0 ? (
              <button
                type="button"
                className="mt-2 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                onClick={() => setShowAllThreads(true)}
              >
                {hiddenThreadCount} earlier threads
              </button>
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection
            id={`${prep.id}-docs`}
            label="Documents"
            meta={context.documents.length || undefined}
            defaultOpen={false}
          >
            {context.documents.length ? (
              <ul className="space-y-3 text-[15px]">
                {context.documents.map((document) => (
                  <li key={document.id}>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {document.url ? (
                        <ExternalLink href={document.url}>{document.label}</ExternalLink>
                      ) : (
                        <span className="font-semibold">{document.label}</span>
                      )}
                      {document.sourceType ? (
                        <span className="text-[12px] text-[var(--jos-muted)]">{document.sourceType}</span>
                      ) : null}
                    </div>
                    {document.snippet ? (
                      <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-[var(--jos-muted)]">
                        {document.snippet}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-[var(--jos-muted)]">No documents linked.</p>
            )}
          </CollapsibleSection>

          {context.jobSearch.length ? (
            <CollapsibleSection id={`${prep.id}-jobs`} label="Job search" defaultOpen={false}>
              <ul className="space-y-2">
                {context.jobSearch.map((job) => (
                  <li key={`${job.kind}-${job.id}`} className="text-[15px]">
                    <Link href={job.href} className="font-semibold text-[var(--color-accent-700)] hover:underline">
                      {job.title}
                      {job.company ? ` · ${job.company}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          ) : null}

          <div className="border-t-2 border-[var(--jos-ink)] pt-3">
            <GoalLinks prep={prep} projects={projects} people={context.people} />
          </div>
        </aside>
      </div>

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
