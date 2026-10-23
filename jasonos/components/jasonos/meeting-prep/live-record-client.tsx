"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";
import { OutcomePill } from "@/components/jasonos/meeting-prep/live-library-client";
import { MeetingTitleField } from "@/components/jasonos/meeting-prep/live-rename-field";
import { isMarkable } from "@/lib/meeting-prep/points";
import { REACTION_LABELS } from "@/lib/meeting-prep/reactions";
import type { LiveMeetingRecord } from "@/lib/server-actions/live-library";

function easternDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
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

export function LiveRecordClient({ record }: { record: LiveMeetingRecord }) {
  const { prep, points, review } = record;
  const [open, setOpen] = useState(false);
  const markable = points.filter((point) => isMarkable(point.kind));

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
            Edit on the prep page
          </Link>
        </div>
        <p className="text-[14px] text-[var(--jos-muted)]">{easternDate(prep.startsAt)}</p>
        <p className="text-[15px] text-[var(--jos-ink)]">
          {prep.primaryContactId && prep.primaryContactName ? (
            <button type="button" className="font-semibold hover:underline" onClick={() => setOpen(true)}>
              {prep.primaryContactName}
            </button>
          ) : (
            prep.primaryContactName || "No person"
          )}
          {" · "}
          {prep.adaptedFromScriptName
            ? `Built from playbook ${prep.adaptedFromScriptName}`
            : prep.scriptName || "No playbook"}
          {prep.projectName ? ` · ${prep.projectName}` : ""}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">Outcome</h2>
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

      <section className="space-y-3">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">Points</h2>
        {markable.length === 0 ? (
          <p className="text-[15px] text-[var(--jos-muted)]">No points.</p>
        ) : (
          <ul className="space-y-4">
            {markable.map((point) => {
              const spoken = review?.pointsSpoken.find((item) => item.pointId === point.id);
              const observed = review?.reactionsObserved.find((item) => item.pointId === point.id);
              return (
                <li key={point.id} className="space-y-1">
                  <p className="text-[16px] font-semibold text-[var(--jos-ink)]">{point.headline}</p>
                  <p className="text-[13px] text-[var(--jos-muted)]">
                    {stateLabel(point.state)}
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
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">Checklist</h2>
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
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">
          Against your goals
        </h2>
        <p className="text-[15px] leading-relaxed text-[var(--jos-ink)]">
          {review?.projectGoalNote || "Nothing in the record bears on the project goal."}
        </p>
        <p className="text-[15px] leading-relaxed text-[var(--jos-ink)]">
          {review?.relationshipGoalNote || "Nothing in the record bears on the goal for this relationship."}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]">Links</h2>
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

      {prep.primaryContactId ? (
        <OutreachModal
          open={open}
          onOpenChange={setOpen}
          contactId={prep.primaryContactId}
          initialDisplay={
            prep.primaryContactName ? { name: prep.primaryContactName, title: null, firm: null } : undefined
          }
        />
      ) : null}
    </div>
  );
}
