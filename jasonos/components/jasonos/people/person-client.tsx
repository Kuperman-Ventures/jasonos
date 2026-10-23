"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowSquareOut,
  FileText,
  HourglassMedium,
  IdentificationCard,
  LinkedinLogo,
  ListChecks,
  Microphone,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { FieldSaveRow, LIVE_SECTION_LABEL, useSavedField } from "@/components/jasonos/live";
import { Button } from "@/components/ui/button";
import {
  heldOfThree,
  isOverdueNext,
  nextContactTone,
  statusLabel,
  thankYouState,
} from "@/lib/meeting-prep/people";
import {
  saveToDiscussNext,
  startNextSheet,
  type PersonDetail,
  type PersonOpenItem,
  type PersonTimelineRow,
} from "@/lib/server-actions/person";
import { cn } from "@/lib/utils";
import { OverduePill, Past48hPill, shortDay } from "./people-pills";

const ET = "America/New_York";
const LINK = "inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline";
const INPUT =
  "w-full border border-[var(--jos-line)] bg-[var(--jos-bg)] px-3 py-2 text-[15px] leading-snug outline-none focus:border-[var(--jos-ink)]";
const OUTCOME_LABELS: Record<string, string> = { hit: "Hit", partial: "Partial", missed: "Missed" };

function etDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: ET, month: "short", day: "numeric", year: "numeric" });
}

function etDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: ET,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function todayYmd(now: number): string {
  return new Date(now).toLocaleDateString("en-CA", { timeZone: ET });
}

function callLabel(touchNumber: number): string {
  return touchNumber <= 3 ? `Call ${touchNumber} of 3` : `Call ${touchNumber}`;
}

function NextContact({ person, now }: { person: PersonDetail; now: number }) {
  const today = todayYmd(now);
  const tone = nextContactTone({ past48h: person.overdue48h, nextContact: person.nextContact, todayYmd: today });
  if (tone === "magenta") {
    return (
      <p className="flex flex-wrap items-center gap-2 text-[15px]">
        <Past48hPill />
        <span>
          Referral came in
          {person.referralReceivedAt ? ` ${etDateTime(person.referralReceivedAt)}` : ""}. Reach out today.
        </span>
      </p>
    );
  }
  if (!person.nextContact) return <p className="text-[15px] text-[var(--jos-muted)]">No next contact set.</p>;
  const overdue = isOverdueNext(person.nextContact, today);
  return (
    <p className="flex flex-wrap items-center gap-2 text-[15px]">
      {overdue ? <OverduePill /> : null}
      <span
        className={cn(
          tone === "yellow" && "rounded-[2px] bg-[var(--jos-warn-tint)] px-1.5 py-0.5 font-semibold text-[var(--jos-ink)]"
        )}
      >
        Next contact {shortDay(person.nextContact)}
      </span>
    </p>
  );
}

function Header({ person, now }: { person: PersonDetail; now: number }) {
  const role = [person.title, person.company].filter(Boolean).join(" · ");
  const pipelineStatus =
    person.status && !["call_1", "call_2", "call_3"].includes(person.status) ? statusLabel(person.status) : null;
  return (
    <header className="space-y-3 border-b border-[var(--jos-line)] pb-6">
      <h1 className="text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--jos-ink)]">{person.name}</h1>
      {role ? <p className="text-[16px] text-[var(--jos-ink)]">{role}</p> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {person.referrer ? (
          <span className="text-[14px] text-[var(--jos-muted)]">
            Introduced by{" "}
            <Link href={`/live/people/${person.referrer.id}`} className={LINK}>
              {person.referrer.name}
            </Link>
          </span>
        ) : null}
        {person.linkedinUrl ? (
          <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className={LINK}>
            <LinkedinLogo size={16} weight="duotone" aria-hidden />
            LinkedIn
          </a>
        ) : null}
        <Link href={person.contactHref} className={LINK}>
          <IdentificationCard size={16} weight="duotone" aria-hidden />
          Contact card
        </Link>
      </div>
      <p className="text-[15px] font-semibold text-[var(--jos-ink)]">
        {pipelineStatus ? `${pipelineStatus} · ` : ""}
        {heldOfThree(person.touchCount)}
      </p>
      <NextContact person={person} now={now} />
    </header>
  );
}

function NextTime({ person }: { person: PersonDetail }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const field = useSavedField<string>({
    saved: person.toDiscussNext ?? "",
    savedAt: person.updatedAt,
    label: "Discuss next",
    onSave: async (value) => {
      const result = await saveToDiscussNext({ contactId: person.contactId, toDiscussNext: value });
      if (!result.ok) return result;
      return { ok: true, value: result.toDiscussNext ?? "", savedAt: result.savedAt };
    },
  });
  const meeting = person.nextMeeting;

  const start = async () => {
    setStarting(true);
    if (field.dirty && !(await field.save())) {
      setStarting(false);
      return;
    }
    const result = await startNextSheet(person.contactId);
    if (!result.ok) {
      setStarting(false);
      toast.error(result.error);
      return;
    }
    if (result.created) toast.success(`Started ${result.playbookName}`);
    router.push(result.href);
  };

  return (
    <section className="space-y-4 border border-[var(--jos-line)] p-5" onKeyDown={field.onKeyDown}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-extrabold tracking-[-0.01em]">Next time</h2>
        <p className="text-[14px] text-[var(--jos-muted)]">{person.nextPlaybook.label}</p>
      </div>
      <p className="text-[14px] text-[var(--jos-ink)]">
        {meeting
          ? `${meeting.title}, ${etDateTime(meeting.startsAt)}.${meeting.hasSheet ? " The sheet is started." : ""}`
          : "No meeting on the calendar yet. The sheet starts unattached."}
      </p>
      <label className="block">
        <span className={LIVE_SECTION_LABEL}>Discuss next</span>
        <textarea
          className={cn(INPUT, "mt-1 min-h-[96px] resize-y")}
          value={field.value}
          placeholder="What to bring up on the next call"
          onChange={(event) => field.setValue(event.target.value)}
        />
      </label>
      {field.state !== "clean" || field.savedAt ? <FieldSaveRow field={field} name="Discuss next" /> : null}
      <Button type="button" disabled={starting} onClick={() => void start()}>
        {starting ? "Starting…" : meeting?.hasSheet ? "Open next call sheet" : "Start next call sheet"}
      </Button>
    </section>
  );
}

function ItemList({ items, icon, empty }: { items: PersonOpenItem[]; icon: ReactNode; empty: string }) {
  if (!items.length) return <p className="text-[14px] text-[var(--jos-muted)]">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.text}-${index}`} className="flex items-start gap-2 text-[15px] leading-snug">
          <span className="mt-0.5 shrink-0">{icon}</span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

function OpenItems({ person }: { person: PersonDetail }) {
  const last = person.lastOutcome;
  return (
    <section className="space-y-4">
      <h2 className="text-[20px] font-extrabold tracking-[-0.01em]">Open items</h2>
      {last ? (
        <p className="text-[14px] text-[var(--jos-muted)]">
          From {callLabel(last.touchNumber).toLowerCase()}, {etDay(last.occurredAt)}
          {last.mark ? `. Outcome: ${OUTCOME_LABELS[last.mark] ?? last.mark}` : ""}
          {last.sentence ? `. ${last.sentence}` : ""}
        </p>
      ) : null}
      <div className="grid gap-5 min-[700px]:grid-cols-2">
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--color-todo-700)]">
            <ListChecks size={18} weight="duotone" className="text-[var(--color-todo)]" aria-hidden />
            Mine
          </h3>
          <ItemList
            items={person.openItems.mine}
            empty="Nothing on you."
            icon={<span className="block size-2.5 translate-y-1 rounded-full bg-[var(--color-todo)]" aria-hidden />}
          />
        </div>
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--jos-muted)]">
            <HourglassMedium size={18} weight="duotone" aria-hidden />
            Theirs
          </h3>
          <ItemList
            items={person.openItems.theirs}
            empty="Nothing waiting on them."
            icon={<HourglassMedium size={16} weight="duotone" className="text-[var(--jos-muted)]" aria-hidden />}
          />
        </div>
      </div>
    </section>
  );
}

function ThankYou({ row, now }: { row: PersonTimelineRow; now: number }) {
  const state = thankYouState({ sentAt: row.thankYouSentAt, dueAt: row.thankYouDueAt }, now);
  if (state.kind === "sent") return <span className="text-[var(--color-done)]">Sent {etDateTime(state.at)}</span>;
  if (state.kind === "late") {
    return <span className="text-[var(--color-accent-2-text)]">Not sent. Was due {etDateTime(state.at)}</span>;
  }
  if (state.kind === "due") return <span>Due by {etDateTime(state.at)}</span>;
  return <span className="text-[var(--jos-muted)]">Not sent</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 min-[700px]:grid-cols-[8.5rem_minmax(0,1fr)]">
      <dt className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--jos-muted)] min-[700px]:pt-0.5">{label}</dt>
      <dd className="text-[15px] leading-snug text-[var(--jos-ink)]">{children}</dd>
    </div>
  );
}

function Timeline({ rows, now }: { rows: PersonTimelineRow[]; now: number }) {
  const ordered = [...rows].reverse();
  return (
    <section className="space-y-4">
      <h2 className="text-[20px] font-extrabold tracking-[-0.01em]">Timeline</h2>
      {ordered.length === 0 ? <p className="text-[15px] text-[var(--jos-muted)]">No calls held yet.</p> : null}
      <ol className="space-y-4">
        {ordered.map((row) => (
          <li key={row.id} className="border-l-2 border-[var(--jos-ink)] pl-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[16px] font-bold text-[var(--jos-ink)]">{etDay(row.occurredAt)}</p>
              <p className="text-[14px] font-semibold text-[var(--jos-ink)]">{callLabel(row.touchNumber)}</p>
              {row.playbookName ? <p className="text-[14px] text-[var(--jos-muted)]">{row.playbookName}</p> : null}
              <span className="ml-auto flex flex-wrap gap-x-4">
                {row.sheetHref ? (
                  <Link href={row.sheetHref} className={LINK}>
                    <FileText size={16} weight="duotone" aria-hidden />
                    Call sheet
                  </Link>
                ) : null}
                {row.granolaUrl ? (
                  <a href={row.granolaUrl} target="_blank" rel="noreferrer" className={LINK}>
                    <Microphone size={16} weight="duotone" aria-hidden />
                    Granola
                    <ArrowSquareOut size={12} aria-hidden />
                  </a>
                ) : null}
              </span>
            </div>
            <dl className="mt-3 space-y-2">
              <Field label="Discussed">
                {row.conversation ? (
                  <span className="whitespace-pre-line">{row.conversation}</span>
                ) : (
                  <span className="text-[var(--jos-muted)]">Nothing logged</span>
                )}
              </Field>
              <Field label="Received">
                {row.contactsReceived.length ? (
                  row.contactsReceived.map((item, index) => (
                    <span key={`${item.name}-${index}`}>
                      {index ? ", " : ""}
                      {item.contactId ? (
                        <Link href={`/live/people/${item.contactId}`} className="font-semibold hover:underline">
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                      {item.company ? ` (${item.company})` : ""}
                    </span>
                  ))
                ) : (
                  <span className="text-[var(--jos-muted)]">No one</span>
                )}
              </Field>
              <Field label="Follow up">
                {row.followUpWith.length ? (
                  <ul className="space-y-1">
                    {row.followUpWith.map((item, index) => (
                      <li key={`${item.text}-${index}`} className="flex items-start gap-2">
                        {item.owner === "them" ? (
                          <HourglassMedium size={16} weight="duotone" className="mt-0.5 shrink-0 text-[var(--jos-muted)]" aria-label="Theirs" />
                        ) : (
                          <span className="mt-1.5 block size-2.5 shrink-0 rounded-full bg-[var(--color-todo)]" aria-label="Mine" />
                        )}
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[var(--jos-muted)]">None</span>
                )}
              </Field>
              {row.toDiscussNext ? <Field label="Discuss next">{row.toDiscussNext}</Field> : null}
              <Field label="Thank-you">
                <ThankYou row={row} now={now} />
              </Field>
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function PersonClient({ person, nowIso }: { person: PersonDetail; nowIso: string }) {
  const now = Date.parse(nowIso);
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 min-[900px]:px-10">
      <Link href="/live/people" className={LINK}>
        <ArrowLeft size={16} weight="bold" aria-hidden />
        People
      </Link>
      <Header person={person} now={now} />
      <NextTime person={person} />
      <OpenItems person={person} />
      <Timeline rows={person.timeline} now={now} />
    </div>
  );
}
