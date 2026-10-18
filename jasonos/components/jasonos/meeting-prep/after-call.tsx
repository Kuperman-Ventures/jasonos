"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BlockTitle, ExternalLink } from "@/components/jasonos/meeting-prep/meeting-prep-bits";
import { Button } from "@/components/ui/button";
import { REACTION_LABELS, type ReactionShape } from "@/lib/meeting-prep/reactions";
import { runMeetingReview, type MeetingReview } from "@/lib/server-actions/meeting-reviews";
import { setMeetingOutcomeMark, type MeetingPrepDetail, type OutcomeMark } from "@/lib/server-actions/meeting-prep";
import type { MeetingPoint } from "@/lib/server-actions/meeting-points";

const MARK_LABEL: Record<OutcomeMark, string> = {
  hit: "Hit",
  partial: "Partial",
  missed: "Missed",
};

function stateLabel(state: MeetingPoint["state"]): string {
  if (state === "covered") return "Covered";
  if (state === "skipped") return "Skipped";
  return "Open";
}

export function AfterTheCall({
  prep,
  points,
  rubric,
  review,
}: {
  prep: MeetingPrepDetail;
  points: MeetingPoint[];
  rubric: string[];
  review: MeetingReview | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(review);
  const [running, setRunning] = useState(false);
  const [seenId, setSeenId] = useState(review?.id ?? null);
  if ((review?.id ?? null) !== seenId) {
    setSeenId(review?.id ?? null);
    setCurrent(review);
  }

  if (!prep.liveEndedAt) return null;

  const markable = points.filter((point) => point.kind !== "agenda");
  const spokenById = new Map((current?.pointsSpoken ?? []).map((row) => [row.pointId, row]));
  const reactionById = new Map((current?.reactionsObserved ?? []).map((row) => [row.pointId, row]));
  const covered = markable.filter((point) => point.state === "covered").length;
  const spoken = markable.filter((point) => spokenById.get(point.id)?.spoken).length;
  const analyzed = current && current.sourceKind !== "none" && !current.error;

  const run = () => {
    setRunning(true);
    void runMeetingReview(prep.id).then((result) => {
      setRunning(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent(result.review);
      router.refresh();
    });
  };

  const useSuggested = () => {
    if (!current?.suggestedMark) return;
    void setMeetingOutcomeMark(prep.id, { mark: current.suggestedMark, note: prep.outcomeNote ?? "" }).then(
      (result) => {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        router.refresh();
      }
    );
  };

  const mark = (value: OutcomeMark) => {
    void setMeetingOutcomeMark(prep.id, { mark: value, note: prep.outcomeNote ?? "" }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <BlockTitle>After the call</BlockTitle>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={running} onClick={run}>
          {running ? "Reviewing…" : "Review the transcript"}
        </Button>
        {current?.sourceKind === "transcript" ? (
          <p className="text-[13px] text-[var(--jos-muted)]">Reviewed from Granola transcript</p>
        ) : null}
        {current?.sourceKind === "summary" ? (
          <p className="text-[13px] text-[var(--jos-muted)]">
            Reviewed from Granola summary (no transcript available)
          </p>
        ) : null}
        {current?.sourceUrl ? <ExternalLink href={current.sourceUrl}>Open in Granola</ExternalLink> : null}
      </div>
      {current?.error ? <p className="text-[14px] text-[var(--color-accent-2-text)]">{current.error}</p> : null}
      {current?.talkRatio != null ? (
        <p className="text-[14px] text-[var(--jos-ink)]">
          You spoke {Math.round(current.talkRatio * 100)}% of the words.
        </p>
      ) : null}

      {analyzed ? (
        <>
          <div className="space-y-2">
            <p className="text-[13px] text-[var(--jos-muted)]">
              {markable.length} points · {covered} covered · {spoken} spoken
            </p>
            <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
              Planned vs said
            </h3>
            <ul>
              {markable.map((point) => {
                const found = spokenById.get(point.id);
                const wasSpoken = Boolean(found?.spoken);
                const plannedCovered = point.state === "covered";
                const plannedSkipped = point.state === "skipped";
                const disagree =
                  (plannedCovered && !wasSpoken) || (plannedSkipped && wasSpoken) || (point.state === "open" && wasSpoken);
                return (
                  <li
                    key={point.id}
                    className={
                      disagree
                        ? "border-l-4 border-[var(--color-accent-2)] py-2 pl-3"
                        : "border-t border-[var(--jos-line)] py-2"
                    }
                  >
                    <p className="text-[15px] font-semibold">{point.headline}</p>
                    <p className="text-[13px] text-[var(--jos-muted)]">
                      {stateLabel(point.state)} · {wasSpoken ? "Spoken" : "Not found"}
                    </p>
                    {found?.quote ? <p className="mt-1 text-[14px] leading-snug">{found.quote}</p> : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">Checklist</h3>
            {rubric.length === 0 ? (
              <p className="text-[14px] text-[var(--jos-muted)]">This strategy has no checklist.</p>
            ) : (
              <ul>
                {(current?.rubricResults.length ? current.rubricResults : rubric.map((item) => ({ item, met: false, quote: null }))).map(
                  (row) => (
                    <li key={row.item} className="border-t border-[var(--jos-line)] py-2">
                      <p className="text-[15px]">
                        <span className="font-semibold">{row.met ? "Met" : "Not met"}. </span>
                        {row.item}
                      </p>
                      {row.quote ? <p className="mt-1 text-[14px] leading-snug">{row.quote}</p> : null}
                    </li>
                  )
                )}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">Reactions</h3>
            {markable.filter((point) => point.kind === "ask").length === 0 ? (
              <p className="text-[14px] text-[var(--jos-muted)]">No asks on this meeting.</p>
            ) : (
              <ul>
                {markable
                  .filter((point) => point.kind === "ask")
                  .map((point) => {
                    const found = reactionById.get(point.id);
                    const recorded = point.observedReaction
                      ? REACTION_LABELS[point.observedReaction as ReactionShape]
                      : "Not recorded";
                    const heard = found?.shape ? REACTION_LABELS[found.shape] : "Not found";
                    return (
                      <li key={point.id} className="border-t border-[var(--jos-line)] py-2">
                        <p className="text-[15px] font-semibold">{point.headline}</p>
                        <p className="text-[13px] text-[var(--jos-muted)]">
                          You recorded {recorded}. Review found {heard}.
                        </p>
                        {found?.quote ? <p className="mt-1 text-[14px] leading-snug">{found.quote}</p> : null}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
              Suggested outcome
            </h3>
            <p className="text-[15px]">
              Suggested {current?.suggestedMark ? MARK_LABEL[current.suggestedMark] : "nothing"}. Yours is{" "}
              {prep.outcomeMark ? MARK_LABEL[prep.outcomeMark] : "not marked"}.
            </p>
            {current?.suggestedReason ? (
              <p className="max-w-[65ch] text-[15px] leading-relaxed">{current.suggestedReason}</p>
            ) : null}
            {current?.suggestedMark ? (
              <Button type="button" size="sm" variant="outline" onClick={useSuggested}>
                Use suggested
              </Button>
            ) : null}
            {!prep.outcomeMark ? (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MARK_LABEL) as OutcomeMark[]).map((value) => (
                  <Button key={value} type="button" size="sm" variant="outline" onClick={() => mark(value)}>
                    {MARK_LABEL[value]}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
