"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OutcomePill } from "@/components/jasonos/meeting-prep/live-library-client";
import { MeetingTitleField } from "@/components/jasonos/meeting-prep/live-rename-field";
import { AFTER_LABELS, afterDraftFromLines } from "@/lib/meeting-prep/after";
import type { CallSheetBlock } from "@/lib/meeting-prep/call-sheet";
import { isMarkable } from "@/lib/meeting-prep/points";
import { REACTION_LABELS } from "@/lib/meeting-prep/reactions";
import type { LiveMeetingRecord } from "@/lib/server-actions/live-library";
import type { MeetingPoint } from "@/lib/server-actions/meeting-points";
import type { MeetingReview } from "@/lib/server-actions/meeting-reviews";

const LABEL = "text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]";

function easternDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayLabel(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function stateLabel(state: string): string {
  if (state === "covered") return "Covered";
  if (state === "skipped") return "Skipped";
  return "Open";
}

interface AfterView {
  conversation: string | null;
  contacts: Array<{ name: string; company: string | null }>;
  followUps: Array<{ text: string; owner: "me" | "them" }>;
  nextContact: string | null;
  toDiscussNext: string | null;
  thankYouSentAt: string | null;
  logged: boolean;
}

function afterView(record: LiveMeetingRecord): AfterView | null {
  const { log, sheet } = record;
  if (log) {
    return {
      conversation: log.conversation,
      contacts: log.contactsReceived.map((row) => ({ name: row.name, company: row.company })),
      followUps: log.followUpWith,
      nextContact: log.nextContactAt,
      toDiscussNext: log.toDiscussNext,
      thankYouSentAt: log.thankYouSentAt ?? record.prep.thankYouSentAt,
      logged: true,
    };
  }
  const block = sheet?.blocks.find((row) => row.kind === "after");
  const draft = block ? afterDraftFromLines(block.lines) : null;
  if (!draft) return null;
  return {
    conversation: draft.conversation || null,
    contacts: draft.contactsReceived
      .filter((row) => row.status === "accepted")
      .map((row) => ({ name: row.name, company: row.company })),
    followUps: draft.followUpWith,
    nextContact: draft.nextContactAt,
    toDiscussNext: draft.toDiscussNext || null,
    thankYouSentAt: record.prep.thankYouSentAt,
    logged: false,
  };
}

function AfterBody({ after }: { after: AfterView | null }) {
  if (!after) return <p className="text-[15px] text-[var(--jos-muted)]">Nothing written on Debrief yet.</p>;
  const row = (label: string, value: ReactNode) => (
    <div className="grid gap-1 min-[700px]:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="text-[14px] font-semibold text-[var(--jos-muted)]">{label}</dt>
      <dd className="text-[15px] leading-relaxed text-[var(--jos-ink)]">{value}</dd>
    </div>
  );
  const none = <span className="text-[var(--jos-muted)]">None</span>;
  return (
    <dl className="space-y-3">
      {row(AFTER_LABELS.conversation, after.conversation ? <span className="whitespace-pre-wrap">{after.conversation}</span> : none)}
      {row(
        AFTER_LABELS.contacts,
        after.contacts.length
          ? after.contacts.map((item) => (item.company ? `${item.name} (${item.company})` : item.name)).join(", ")
          : none
      )}
      {row(
        AFTER_LABELS.followUps,
        after.followUps.length ? (
          <ul className="space-y-1">
            {after.followUps.map((item) => (
              <li key={`${item.owner}-${item.text}`}>
                <span className="font-semibold">{item.owner === "me" ? "Me" : "Them"}.</span> {item.text}
              </li>
            ))}
          </ul>
        ) : (
          none
        )
      )}
      {row(AFTER_LABELS.nextContact, after.nextContact ? dayLabel(after.nextContact) : none)}
      {row(AFTER_LABELS.toDiscuss, after.toDiscussNext ?? none)}
      {row("Thank-you", after.thankYouSentAt ? `Sent ${easternDate(after.thankYouSentAt)}` : "Not sent")}
      {!after.logged ? (
        <p className="text-[13px] text-[var(--jos-muted)]">Not confirmed on Debrief yet, so nothing is logged.</p>
      ) : null}
    </dl>
  );
}

function PointList({ points, review }: { points: MeetingPoint[]; review: MeetingReview | null }) {
  const markable = points.filter((point) => isMarkable(point.kind));
  if (!markable.length) return <p className="text-[15px] text-[var(--jos-muted)]">No points.</p>;
  return (
    <ul className="space-y-4">
      {markable.map((point) => {
        const spoken = review?.pointsSpoken.find((item) => item.pointId === point.id);
        const observed = review?.reactionsObserved.find((item) => item.pointId === point.id);
        return (
          <li key={point.id} className="space-y-1">
            <p className="text-[16px] font-semibold text-[var(--jos-ink)]">{point.headline}</p>
            <p className="text-[13px] text-[var(--jos-muted)]">
              {stateLabel(point.confirmedState ?? point.state)}
              {point.observedReaction ? ` · ${REACTION_LABELS[point.observedReaction]}` : ""}
            </p>
            {point.note ? <p className="text-[14px] text-[var(--jos-ink)]">{point.note}</p> : null}
            {spoken ? (
              <p className="text-[14px] text-[var(--jos-ink)]">
                {spoken.spoken ? "Spoken" : "Not found"}
                {spoken.quote ? `: ${spoken.quote}` : ""}
              </p>
            ) : null}
            {observed?.quote ? (
              <p className="text-[14px] text-[var(--jos-muted)]">
                {observed.shape ? REACTION_LABELS[observed.shape] : "Reaction"}: {observed.quote}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function BlockBody({
  block,
  points,
  review,
  after,
}: {
  block: CallSheetBlock;
  points: MeetingPoint[];
  review: MeetingReview | null;
  after: AfterView | null;
}) {
  if (block.kind === "after") return <AfterBody after={after} />;
  if (block.kind === "points") return <PointList points={points} review={review} />;
  const lines = block.lines.filter((line) => line.text.trim());
  if (!block.body && !lines.length) return <p className="text-[15px] text-[var(--jos-muted)]">Not written.</p>;
  return (
    <div className="space-y-2">
      {block.body ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{block.body}</p> : null}
      {lines.length ? (
        <ul className="space-y-2">
          {lines.map((line, index) => (
            <li key={`${line.label}-${index}`} className="text-[15px] leading-relaxed">
              {line.label ? <span className="font-semibold">{line.label}. </span> : null}
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function LiveRecordClient({ record }: { record: LiveMeetingRecord }) {
  const { prep, points, review, sheet } = record;
  const after = afterView(record);
  const playbook = sheet?.playbook?.name ?? prep.scriptName ?? prep.adaptedFromScriptName ?? "No playbook";
  const touch = record.log?.touchNumber ?? sheet?.person?.touchNumber ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <Link
        href="/live/library"
        className="inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline"
      >
        <ChevronLeft className="size-4" />
        Library
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <MeetingTitleField
            prepId={prep.id}
            title={prep.title}
            className="text-[28px] font-extrabold tracking-tight text-[var(--jos-ink)]"
          />
          <Link href={`/meetings/${prep.id}`} className="text-[14px] font-semibold text-[var(--color-accent-700)] hover:underline">
            Open the call sheet
          </Link>
        </div>
        <p className="text-[14px] text-[var(--jos-muted)]">
          {easternDate(prep.startsAt)}
          {touch ? ` · Call ${touch}` : ""}
        </p>
        <p className="text-[15px] text-[var(--jos-ink)]">
          {prep.primaryContactId && prep.primaryContactName ? (
            <Link href={`/live/people/${prep.primaryContactId}`} className="font-semibold hover:underline">
              {prep.primaryContactName}
            </Link>
          ) : (
            prep.primaryContactName || "No person"
          )}
          {" · "}
          {playbook}
          {prep.projectName ? ` · ${prep.projectName}` : ""}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className={LABEL}>Outcome</h2>
        <p className="text-[15px] leading-relaxed text-[var(--jos-ink)]">
          {prep.outcomeSentence || "No outcome sentence."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <OutcomePill mark={prep.outcomeMark} />
          {review?.suggestedMark ? (
            <span className="text-[13px] text-[var(--jos-muted)]">
              Suggested <OutcomePill mark={review.suggestedMark} />
            </span>
          ) : null}
        </div>
        {prep.outcomeNote ? <p className="text-[14px] text-[var(--jos-ink)]">{prep.outcomeNote}</p> : null}
        {review?.suggestedReason ? (
          <p className="text-[14px] leading-relaxed text-[var(--jos-ink)]">{review.suggestedReason}</p>
        ) : null}
      </section>

      {sheet ? (
        <section className="space-y-6">
          <h2 className={LABEL}>Call sheet</h2>
          {sheet.blocks.map((block, index) => (
            <section key={block.id} className="space-y-2 border-t border-[var(--jos-line)] pt-4">
              <h3 className="text-[18px] font-extrabold tracking-tight">
                <span className="mr-2 tabular-nums text-[var(--jos-muted)]">{index + 1}</span>
                {block.title}
              </h3>
              <BlockBody block={block} points={points} review={review} after={after} />
            </section>
          ))}
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className={LABEL}>Points</h2>
            <PointList points={points} review={review} />
          </section>
          <section className="space-y-3">
            <h2 className={LABEL}>After</h2>
            <AfterBody after={after} />
          </section>
        </>
      )}

      <section className="space-y-2">
        <h2 className={LABEL}>Checklist</h2>
        {!review || review.rubricResults.length === 0 ? (
          <p className="text-[15px] text-[var(--jos-muted)]">No checklist results.</p>
        ) : (
          <ul className="space-y-2">
            {review.rubricResults.map((item) => (
              <li key={item.item} className="text-[15px] text-[var(--jos-ink)]">
                <span className="font-semibold">{item.met ? "Met" : "Not met"}.</span> {item.item}
                {item.quote ? <span className="text-[var(--jos-muted)]"> · {item.quote}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className={LABEL}>Against your goals</h2>
        <p className="text-[15px] leading-relaxed text-[var(--jos-ink)]">
          {review?.projectGoalNote || "Nothing in the record bears on the project goal."}
        </p>
        <p className="text-[15px] leading-relaxed text-[var(--jos-ink)]">
          {review?.relationshipGoalNote || "Nothing in the record bears on the goal for this relationship."}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className={LABEL}>Links</h2>
        <p className="flex flex-wrap gap-4 text-[14px] font-semibold">
          {record.granolaUrl ? (
            <a className="text-[var(--color-accent-700)] hover:underline" href={record.granolaUrl}>
              Granola note
            </a>
          ) : (
            <span className="font-normal text-[var(--jos-muted)]">No Granola note</span>
          )}
          {record.calendarUrl ? (
            <a className="text-[var(--color-accent-700)] hover:underline" href={record.calendarUrl}>
              Calendar
            </a>
          ) : (
            <span className="font-normal text-[var(--jos-muted)]">No calendar link</span>
          )}
        </p>
      </section>
    </div>
  );
}
