"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarBlank, EnvelopeSimple, Sparkle, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  FieldSaveRow,
  LIVE_SECTION_LABEL,
  OutcomeMarkButton,
  useSavedField,
} from "@/components/jasonos/live";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  EMPTY_AFTER,
  afterDraftFromLines,
  afterDraftFromLog,
  mergeAfterExtract,
  plannedAgainstSaid,
  prefillAfter,
  sameAfterDraft,
  thankYouDueBy,
  type AfterDraft,
  type FollowUp,
  type ReceivedContact,
  type ReceivedStatus,
  type SaidStatus,
} from "@/lib/meeting-prep/after";
import type { CallSheetBlock } from "@/lib/meeting-prep/call-sheet";
import type { MeetingContextPerson } from "@/lib/meeting-prep/context-model";
import {
  THANK_YOU_MAX_WORDS,
  mailtoHref,
  parseStoredThankYou,
  wordCount,
  type ThankYouDraft,
} from "@/lib/meeting-prep/thank-you";
import type { CallSheet, CallSheetPerson } from "@/lib/server-actions/call-sheet";
import type { MeetingPoint } from "@/lib/server-actions/meeting-points";
import { setMeetingOutcomeMark, type MeetingPrepDetail, type OutcomeMark } from "@/lib/server-actions/meeting-prep";
import { runMeetingReview, type MeetingReview } from "@/lib/server-actions/meeting-reviews";
import {
  confirmAfter,
  draftThankYouForMeeting,
  markThankYouSent,
  prefillAfterFromReview,
  saveAfterDraft,
  saveThankYouDraft,
  type RelationshipLogEntry,
} from "@/lib/server-actions/person";
import { cn } from "@/lib/utils";

const ET = "America/New_York";
const INPUT =
  "w-full border border-[var(--jos-line)] bg-[var(--jos-bg)] px-3 py-2 text-[15px] leading-snug outline-none focus:border-[var(--jos-ink)]";
const LINK = "text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline disabled:opacity-50";

const PILL: Record<SaidStatus, { label: string; className: string }> = {
  covered: { label: "Covered", className: "bg-[var(--color-done)] text-white" },
  partial: { label: "Partial", className: "bg-[var(--color-process-yellow)] text-[var(--jos-ink)]" },
  skipped: { label: "Skipped", className: "bg-[var(--jos-surface)] text-[var(--jos-muted)]" },
};

function etDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: ET,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function etDate(ymdOrIso: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(ymdOrIso) ? `${ymdOrIso}T12:00:00Z` : ymdOrIso;
  return new Date(iso).toLocaleDateString("en-US", { timeZone: ET, weekday: "short", month: "short", day: "numeric" });
}

function plannedPoints(points: MeetingPoint[]) {
  return points.map((point) => ({
    id: point.id,
    kind: point.kind,
    headline: point.headline,
    state: point.state,
    note: point.note,
    confirmedState: point.confirmedState,
  }));
}

function Section({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-t border-[var(--jos-line)] pt-4", className)}>
      <p className={LIVE_SECTION_LABEL}>{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/* ---------- Left column ---------- */

function PlannedAgainstSaid({
  prep,
  points,
  review,
  onReview,
}: {
  prep: MeetingPrepDetail;
  points: MeetingPoint[];
  review: MeetingReview | null;
  onReview: (review: MeetingReview) => void;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [mark, setMark] = useState<OutcomeMark | null>(prep.outcomeMark);
  const analyzed = Boolean(review && review.sourceKind !== "none" && !review.error);
  const rows = plannedAgainstSaid(plannedPoints(points), analyzed ? review!.pointsSpoken : null);

  const run = () => {
    setRunning(true);
    void runMeetingReview(prep.id).then((result) => {
      setRunning(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onReview(result.review);
      router.refresh();
    });
  };

  const choose = (value: OutcomeMark) => {
    const previous = mark;
    setMark(value);
    void setMeetingOutcomeMark(prep.id, { mark: value, note: prep.outcomeNote ?? "" }).then((result) => {
      if (!result.ok) {
        setMark(previous);
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className={LIVE_SECTION_LABEL}>Planned against said</p>
        <button type="button" className={LINK} disabled={running} onClick={run}>
          {running ? "Reviewing…" : analyzed ? "Review again" : "Review the transcript"}
        </button>
      </div>
      {!analyzed ? (
        <p className="mt-1 text-[13px] text-[var(--jos-muted)]">
          {review?.error ?? "From what you marked live. Review the transcript to check it against what was said."}
        </p>
      ) : null}
      {rows.length ? (
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--jos-muted)]">
              <th className="pb-2 pr-3 font-bold">Point</th>
              <th className="pb-2 pr-3 font-bold">What happened</th>
              <th className="pb-2 font-bold" aria-label="Status" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--jos-line)] align-top">
                <td className="w-[38%] py-2.5 pr-3 text-[15px] font-semibold leading-snug">{row.headline}</td>
                <td className="py-2.5 pr-3 text-[14px] leading-snug text-[var(--jos-muted)]">{row.happened}</td>
                <td className="py-2.5 text-right">
                  <span
                    className={cn(
                      "inline-block px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em]",
                      PILL[row.status].className
                    )}
                  >
                    {PILL[row.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-[14px] text-[var(--jos-muted)]">No points on this sheet.</p>
      )}

      <Section label="You wanted" className="mt-8">
        {prep.outcomeSentence?.trim() ? (
          <p className="text-[17px] font-medium leading-snug">{prep.outcomeSentence}</p>
        ) : (
          <p className="text-[14px] text-[var(--jos-muted)]">No outcome sentence on this meeting.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(["hit", "partial", "missed"] as const).map((value) => (
            <OutcomeMarkButton key={value} mark={value} selected={mark === value} onClick={() => choose(value)} />
          ))}
        </div>
        {analyzed && review?.suggestedMark ? (
          <p className="mt-3 flex items-start gap-1.5 text-[14px] leading-snug">
            <Sparkle size={14} weight="duotone" className="mt-0.5 shrink-0 text-[var(--color-accent-700)]" aria-hidden />
            <span>
              Review suggests {review.suggestedMark === "hit" ? "Hit" : review.suggestedMark === "partial" ? "Partial" : "Missed"}
              {review.suggestedReason ? `. ${review.suggestedReason}` : "."}
            </span>
          </p>
        ) : null}
      </Section>
    </div>
  );
}

/* ---------- After fields ---------- */

function ContactsReceived({
  rows,
  onChange,
}: {
  rows: ReceivedContact[];
  onChange: (rows: ReceivedContact[]) => void;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const setStatus = (index: number, status: ReceivedStatus) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, status } : row)));
  const add = () => {
    if (!name.trim()) return;
    onChange([...rows, { name: name.trim(), company: company.trim() || null, note: null, status: "accepted" }]);
    setName("");
    setCompany("");
  };
  return (
    <div>
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={`${row.name}-${index}`} className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
              <div className={cn("min-w-0 flex-1", row.status === "dismissed" && "text-[var(--jos-muted)] line-through")}>
                <p className="text-[15px] font-semibold leading-snug">
                  {row.name}
                  {row.company ? <span className="font-normal text-[var(--jos-muted)]"> · {row.company}</span> : null}
                </p>
                {row.note ? <p className="text-[13px] leading-snug text-[var(--jos-muted)]">{row.note}</p> : null}
              </div>
              {row.status === "suggested" ? (
                <div className="flex shrink-0 gap-1.5">
                  <Button type="button" size="sm" variant="ok" onClick={() => setStatus(index, "accepted")}>
                    Accept
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setStatus(index, "dismissed")}>
                    Dismiss
                  </Button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-3 text-[13px]">
                  {row.status === "accepted" ? (
                    <span className="font-semibold text-[var(--color-done)]">Accepted</span>
                  ) : (
                    <span className="text-[var(--jos-muted)]">Dismissed</span>
                  )}
                  <button type="button" className={LINK} onClick={() => setStatus(index, "suggested")}>
                    Undo
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-[var(--jos-muted)]">Nobody named yet.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className={cn(INPUT, "min-w-[140px] flex-1")}
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <input
          className={cn(INPUT, "min-w-[120px] flex-1")}
          placeholder="Company"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" size="sm" className="h-10" disabled={!name.trim()} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

function FollowUps({ rows, onChange }: { rows: FollowUp[]; onChange: (rows: FollowUp[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...rows, { text: draft.trim(), owner: "me" }]);
    setDraft("");
  };
  return (
    <div>
      {rows.length ? (
        <ul className="space-y-1.5">
          {rows.map((row, index) => (
            <li key={`${row.text}-${index}`} className="flex items-start gap-2.5">
              <span className="mt-[7px] size-2.5 shrink-0 bg-[var(--color-todo)]" aria-hidden />
              <p className="min-w-0 flex-1 text-[15px] leading-snug">{row.text}</p>
              <button
                type="button"
                className="shrink-0 border border-[var(--jos-line)] px-2 py-0.5 text-[12px] font-semibold text-[var(--color-todo-700)]"
                title="Whose follow-up"
                onClick={() =>
                  onChange(rows.map((item, at) => (at === index ? { ...item, owner: item.owner === "me" ? "them" : "me" } : item)))
                }
              >
                {row.owner === "me" ? "Me" : "Them"}
              </button>
              <button
                type="button"
                className="shrink-0 p-0.5 text-[var(--jos-muted)] hover:text-[var(--jos-ink)]"
                aria-label={`Remove ${row.text}`}
                onClick={() => onChange(rows.filter((_, at) => at !== index))}
              >
                <X size={14} weight="bold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        className={cn(INPUT, rows.length && "mt-2")}
        placeholder="Add a follow-up and press Enter"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
}

/* ---------- Thank-you ---------- */

function ThankYouPanel({
  prep,
  to,
  stored,
  sentAt,
  afterDraft,
  onStored,
  onSent,
}: {
  prep: MeetingPrepDetail;
  to: string | null;
  stored: ThankYouDraft | null;
  sentAt: string | null;
  afterDraft: AfterDraft;
  onStored: (draft: ThankYouDraft) => void;
  onSent: (at: string) => void;
}) {
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const field = useSavedField<ThankYouDraft>({
    saved: stored ?? { subject: "", body: "" },
    label: "Thank-you",
    onSave: async (value) => {
      const result = await saveThankYouDraft({ prepId: prep.id, subject: value.subject, body: value.body });
      if (!result.ok) return result;
      onStored(result.thankYou);
      return { ok: true, value: result.thankYou, savedAt: result.savedAt };
    },
  });
  const { subject, body } = field.value;
  const words = wordCount(body);
  const due = thankYouDueBy(prep.endsAt);
  const empty = !body.trim();

  const redraft = () => {
    setDrafting(true);
    void draftThankYouForMeeting(prep.id, afterDraft).then((result) => {
      setDrafting(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      field.setValue(result.thankYou);
      if (result.warning) toast.warning(result.warning);
    });
  };

  const copy = () => {
    void navigator.clipboard.writeText(body).then(
      () => toast.success("Note copied"),
      () => toast.error("Could not copy")
    );
  };

  const markSent = async () => {
    setSending(true);
    if (field.dirty && !(await field.save())) {
      setSending(false);
      return;
    }
    const result = await markThankYouSent(prep.id);
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onSent(result.sentAt);
    toast.success("Marked sent");
  };

  return (
    <section className="border border-[var(--jos-line)] p-5" onKeyDown={field.onKeyDown}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <EnvelopeSimple size={22} weight="duotone" className="text-[var(--color-email)]" aria-hidden />
        <h3 className="text-[18px] font-extrabold tracking-[-0.01em]">Thank-you note</h3>
        <p className="ml-auto text-[13px] font-semibold text-[var(--color-email-700)]">
          {sentAt ? `Sent ${etDateTime(sentAt)}` : due ? `Due by ${etDateTime(due)}` : null}
        </p>
      </div>
      {empty && field.state === "clean" ? (
        <p className="mt-3 text-[14px] text-[var(--jos-muted)]">
          Confirm After drafts the note from what you logged. Nothing is sent.
        </p>
      ) : null}
      <label className="mt-4 block">
        <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--jos-muted)]">Subject</span>
        <input
          className={cn(INPUT, "mt-1")}
          value={subject}
          onChange={(event) => field.setValue({ subject: event.target.value, body })}
        />
      </label>
      <label className="mt-3 block">
        <span className="flex items-baseline justify-between text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--jos-muted)]">
          Note
          <span
            className={cn(
              "font-semibold normal-case tracking-normal",
              words > THANK_YOU_MAX_WORDS && "text-[var(--color-accent-2-text)]"
            )}
          >
            {words} of {THANK_YOU_MAX_WORDS} words
          </span>
        </span>
        <textarea
          className={cn(INPUT, "mt-1 min-h-[220px] resize-y")}
          value={body}
          onChange={(event) => field.setValue({ subject, body: event.target.value })}
        />
      </label>
      {field.state !== "clean" || field.savedAt ? <FieldSaveRow field={field} name="edits" /> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="emailOutline" size="sm" disabled={empty} onClick={copy}>
          Copy
        </Button>
        <a
          href={mailtoHref({ to, subject, body })}
          aria-disabled={empty}
          className={cn(buttonVariants({ variant: "email", size: "sm" }), empty && "pointer-events-none opacity-50")}
        >
          Open in Mail
        </a>
        <Button type="button" variant="ok" size="sm" disabled={empty || sending || Boolean(sentAt)} onClick={() => void markSent()}>
          {sentAt ? "Sent" : sending ? "Marking…" : "Mark sent"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={drafting} onClick={redraft}>
          {drafting ? "Drafting…" : empty ? "Draft now" : "Redraft"}
        </Button>
      </div>
    </section>
  );
}

/* ---------- Debrief ---------- */

export function CallSheetDebrief({
  prep,
  primary,
  sheet,
  person,
  points,
  review: serverReview,
  log: serverLog,
  onSaved,
}: {
  prep: MeetingPrepDetail;
  primary: MeetingContextPerson | null;
  sheet: CallSheet;
  person: CallSheetPerson | null;
  points: MeetingPoint[];
  review: MeetingReview | null;
  log: RelationshipLogEntry | null;
  onSaved: (block: CallSheetBlock) => void;
}) {
  const router = useRouter();
  const [review, setReview] = useState(serverReview);
  const [seenReview, setSeenReview] = useState(serverReview);
  if (seenReview !== serverReview) {
    setSeenReview(serverReview);
    setReview(serverReview);
  }
  const [log, setLog] = useState(serverLog);
  const [stored, setStored] = useState(() => parseStoredThankYou(prep.thankYouDraft));
  const [sentAt, setSentAt] = useState(prep.thankYouSentAt ?? serverLog?.thankYouSentAt ?? null);
  const [confirming, setConfirming] = useState(false);

  const afterBlock = sheet.blocks.find((block) => block.kind === "after") ?? null;
  const savedAfter = useMemo(
    () => afterDraftFromLines(afterBlock?.lines ?? []) ?? (log ? afterDraftFromLog(log) : null),
    [afterBlock?.lines, log]
  );
  const [filling, setFilling] = useState(
    () => !savedAfter && Boolean(serverReview && serverReview.sourceKind !== "none" && !serverReview.error)
  );
  const touchNumber = log?.touchNumber ?? person?.touchNumber ?? 1;
  const prefill = useMemo(
    () =>
      prefillAfter({
        points: plannedPoints(points),
        review: review && review.sourceKind !== "none" ? review : null,
        occurredAt: prep.startsAt,
        touchNumber,
      }),
    [points, review, prep.startsAt, touchNumber]
  );

  const field = useSavedField<AfterDraft>({
    saved: savedAfter ?? EMPTY_AFTER,
    label: "After",
    equals: sameAfterDraft,
    onSave: async (value) => {
      const result = await saveAfterDraft({ prepId: prep.id, draft: value });
      if (!result.ok) return result;
      onSaved(result.block);
      return { ok: true, value: result.draft };
    },
  });
  const value = field.value;
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  });
  const set = (patch: Partial<AfterDraft>) => field.setValue({ ...valueRef.current, ...patch });

  // Nothing saved yet: start from the live notes and the review, unsaved, once per visit.
  const [seeded, setSeeded] = useState(Boolean(savedAfter));
  if (!seeded) {
    setSeeded(true);
    field.setValue(prefill);
  }

  const readTranscript = (quiet: boolean) =>
    prefillAfterFromReview(prep.id).then((result) => {
      setFilling(false);
      if (!result.ok) {
        if (!quiet) toast.error(result.error);
        return;
      }
      field.setValue(mergeAfterExtract(valueRef.current, result.extract));
      if (!quiet) toast.success(`Filled from the ${result.sourceKind}`);
    });
  const fill = () => {
    setFilling(true);
    void readTranscript(false);
  };

  const autoFill = useRef(!savedAfter && Boolean(review && review.sourceKind !== "none" && !review.error));
  useEffect(() => {
    if (!autoFill.current) return;
    autoFill.current = false;
    void readTranscript(true);
    // Runs once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async () => {
    setConfirming(true);
    const draft = valueRef.current;
    if (field.dirty && !(await field.save())) {
      setConfirming(false);
      return;
    }
    const result = await confirmAfter({ prepId: prep.id, ...draft });
    setConfirming(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLog(result.log);
    onSaved(result.block);
    setStored(result.thankYou);
    toast.success(`Logged call ${result.log.touchNumber} with ${person?.name ?? primary?.name ?? "them"}`);
    for (const warning of result.warnings.slice(0, 3)) toast.warning(warning);
    router.refresh();
  };

  const firstCall = touchNumber <= 1;
  const to = primary?.email ?? prep.attendees.find((item) => item.email)?.email ?? null;

  return (
    <div className="mx-auto grid max-w-[1240px] gap-10 px-10 pb-24 pt-6 min-[1100px]:grid-cols-[440px_minmax(0,1fr)]">
      <PlannedAgainstSaid prep={prep} points={points} review={review} onReview={setReview} />

      <div className="min-w-0 space-y-8">
        <section onKeyDown={field.onKeyDown}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-[24px] font-extrabold tracking-[-0.02em]">After</h2>
            <p className="text-[14px] text-[var(--jos-muted)]">
              {log
                ? `Logged as call ${log.touchNumber} · ${etDate(log.loggedAt)}`
                : person
                  ? `Not logged yet · call ${touchNumber} with ${person.name}`
                  : "Not logged yet"}
            </p>
            <button type="button" className={cn(LINK, "ml-auto")} disabled={filling} onClick={fill}>
              {filling ? "Reading the transcript…" : "Fill from transcript"}
            </button>
          </div>

          <div className="mt-4 space-y-5">
            <Section label="The conversation">
              <textarea
                className={cn(INPUT, "min-h-[120px] resize-y")}
                placeholder="What they told you that matters later."
                value={value.conversation}
                onChange={(event) => set({ conversation: event.target.value })}
              />
            </Section>
            <Section label="Contacts received">
              <ContactsReceived rows={value.contactsReceived} onChange={(rows) => set({ contactsReceived: rows })} />
            </Section>
            <Section label="Follow up with">
              <FollowUps rows={value.followUpWith} onChange={(rows) => set({ followUpWith: rows })} />
            </Section>
            <Section label="Next contact">
              <div className="flex flex-wrap items-center gap-3">
                <CalendarBlank size={20} weight="duotone" className="text-[var(--color-calendar)]" aria-hidden />
                <input
                  type="date"
                  className="border border-[var(--color-calendar)] bg-[var(--color-calendar-100)] px-3 py-2 text-[15px] font-semibold text-[var(--color-calendar-700)] outline-none"
                  value={value.nextContactAt ?? ""}
                  onChange={(event) => set({ nextContactAt: event.target.value || null })}
                />
                {value.nextContactAt ? (
                  <span className="text-[14px] font-semibold text-[var(--color-calendar-700)]">
                    {etDate(value.nextContactAt)}
                  </span>
                ) : null}
                <span className="text-[13px] text-[var(--jos-muted)]">
                  {firstCall ? "Two weeks after a first call" : "Three weeks after a later call"}
                </span>
              </div>
            </Section>
            <Section label="To discuss next">
              <textarea
                className={cn(INPUT, "min-h-[80px] resize-y")}
                placeholder="What to bring up on the next call."
                value={value.toDiscussNext}
                onChange={(event) => set({ toDiscussNext: event.target.value })}
              />
            </Section>
          </div>

          {field.state !== "clean" || savedAfter ? <FieldSaveRow field={field} name="draft" /> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" variant="default" disabled={confirming || !person} onClick={() => void confirm()}>
              {confirming ? "Confirming…" : log ? "Confirm After again" : "Confirm After"}
            </Button>
            <p className="text-[13px] text-[var(--jos-muted)]">
              {person
                ? "Logs the call, moves the person and drafts the thank-you. Nothing is sent."
                : "Link this meeting to a person before you confirm."}
            </p>
          </div>
        </section>

        <ThankYouPanel
          prep={prep}
          to={to}
          stored={stored}
          sentAt={sentAt}
          afterDraft={value}
          onStored={setStored}
          onSent={setSentAt}
        />
      </div>
    </div>
  );
}
