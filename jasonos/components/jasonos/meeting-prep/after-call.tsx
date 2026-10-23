"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  LIVE_SECTION_LABEL,
  OutcomeMarkButton,
  UnfinishedField,
} from "@/components/jasonos/live";
import { ExternalLink } from "@/components/jasonos/meeting-prep/meeting-prep-bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { REACTION_LABELS, type ReactionShape } from "@/lib/meeting-prep/reactions";
import type { SpokenMatch } from "@/lib/meeting-prep/review";
import { runMeetingReview, type MeetingReview } from "@/lib/server-actions/meeting-reviews";
import {
  setMeetingOutcomeMark,
  setMeetingOutcomeSentence,
  type MeetingPrepDetail,
  type OutcomeMark,
} from "@/lib/server-actions/meeting-prep";
import {
  confirmMeetingPointState,
  confirmMeetingPointsAsShown,
  type ConfirmedPointState,
  type MeetingPoint,
} from "@/lib/server-actions/meeting-points";
import { cn } from "@/lib/utils";

function matchLabel(match: SpokenMatch | undefined): string {
  if (match === "exact") return "Said";
  if (match === "close") return "Close";
  return "Not found";
}

function presetConfirm(
  point: MeetingPoint,
  match: SpokenMatch | undefined
): ConfirmedPointState {
  if (match === "exact" || match === "close") return "covered";
  if (point.state === "skipped") return "skipped";
  if (point.state === "covered") return "covered";
  return "not_reached";
}

export function AfterTheCall({
  prep,
  points,
  rubric,
  review,
  commitments,
  nextTouch,
}: {
  prep: MeetingPrepDetail;
  points: MeetingPoint[];
  rubric: string[];
  review: MeetingReview | null;
  commitments?: Array<{
    text: string;
    direction: "mine" | "theirs";
    due: string | null;
    personName: string;
    status?: string;
  }>;
  nextTouch?: { date: string | null; reason: string | null } | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(review);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [localPoints, setLocalPoints] = useState(points);
  const [seenId, setSeenId] = useState(review?.id ?? null);
  const [seenPointsKey, setSeenPointsKey] = useState(() =>
    points.map((point) => `${point.id}:${point.confirmedState ?? ""}:${point.confirmedAt ?? ""}`).join("|")
  );
  if ((review?.id ?? null) !== seenId) {
    setSeenId(review?.id ?? null);
    setCurrent(review);
  }
  const pointsKey = points
    .map((point) => `${point.id}:${point.confirmedState ?? ""}:${point.confirmedAt ?? ""}`)
    .join("|");
  if (pointsKey !== seenPointsKey) {
    setSeenPointsKey(pointsKey);
    setLocalPoints(points);
  }

  const markable = localPoints.filter((point) => point.kind !== "agenda");
  const spokenById = new Map((current?.pointsSpoken ?? []).map((row) => [row.pointId, row]));
  const reactionById = new Map((current?.reactionsObserved ?? []).map((row) => [row.pointId, row]));

  const presets = useMemo(() => {
    const map = new Map<string, ConfirmedPointState>();
    for (const point of markable) {
      const found = spokenById.get(point.id);
      map.set(point.id, point.confirmedState ?? presetConfirm(point, found?.match));
    }
    return map;
  }, [markable, spokenById]);

  const liveCovered = markable.filter((point) => point.state === "covered").length;
  const confirmedRows = markable.filter((point) => point.confirmedState);
  const confirmedCovered = confirmedRows.filter((point) => point.confirmedState === "covered").length;
  const confirmedSkipped = confirmedRows.filter((point) => point.confirmedState === "skipped").length;
  const confirmedNotReached = confirmedRows.filter(
    (point) => point.confirmedState === "not_reached"
  ).length;
  const checklistMet = (current?.rubricResults ?? []).filter((row) => row.met).length;
  const checklistTotal = (current?.rubricResults?.length || rubric.length) || 0;
  const checklistFallback = !prep.scriptId && checklistTotal > 0;
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

  const mark = (value: OutcomeMark) => {
    void setMeetingOutcomeMark(prep.id, { mark: value, note: prep.outcomeNote ?? "" }).then(
      (result) => {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        router.refresh();
      }
    );
  };

  const saveNote = (note: string) => {
    void setMeetingOutcomeMark(prep.id, {
      mark: prep.outcomeMark,
      note,
    }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const saveSentence = (sentence: string) => {
    void setMeetingOutcomeSentence(prep.id, sentence).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const confirmOne = (pointId: string, state: ConfirmedPointState) => {
    setConfirming(true);
    void confirmMeetingPointState(pointId, state).then((result) => {
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLocalPoints((prev) =>
        prev.map((point) => (point.id === pointId ? result.point : point))
      );
      router.refresh();
    });
  };

  const confirmAll = () => {
    setConfirming(true);
    const rows = markable.map((point) => ({
      pointId: point.id,
      state: presets.get(point.id) ?? "not_reached",
    }));
    void confirmMeetingPointsAsShown(prep.id, rows).then((result) => {
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Confirmed ${result.updated} points`);
      router.refresh();
    });
  };

  const tally =
    confirmedRows.length > 0
      ? `${markable.length} points · live: ${liveCovered} covered · confirmed: ${confirmedCovered} covered, ${confirmedSkipped} skipped, ${confirmedNotReached} not reached`
      : `${markable.length} points · live: ${liveCovered} covered`;

  return (
    <div className="space-y-8">
      <div className="bg-[var(--jos-surface)] px-10 py-6">
        <div className="grid gap-6 min-[1100px]:grid-cols-3">
          <div>
            <p className={LIVE_SECTION_LABEL}>You wanted</p>
            {prep.outcomeSentence?.trim() ? (
              <p className="mt-2 text-[17px] font-medium leading-snug">{prep.outcomeSentence}</p>
            ) : (
              <div className="mt-2">
                <UnfinishedField value="" emptyLabel="Add a sentence" onSave={saveSentence} />
              </div>
            )}
          </div>
          <div>
            <p className={LIVE_SECTION_LABEL}>Outcome</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["hit", "partial", "missed"] as const).map((value) => (
                <OutcomeMarkButton
                  key={value}
                  mark={value}
                  selected={prep.outcomeMark === value}
                  onClick={() => mark(value)}
                />
              ))}
            </div>
            {current?.suggestedMark ? (
              <p className="mt-3 flex items-start gap-1.5 text-[14px] leading-snug text-[var(--jos-ink)]">
                <Sparkle
                  size={14}
                  weight="duotone"
                  className="mt-0.5 shrink-0 text-[var(--color-accent-700)]"
                  aria-hidden
                />
                <span>
                  Review suggests{" "}
                  {current.suggestedMark === "hit"
                    ? "Hit"
                    : current.suggestedMark === "partial"
                      ? "Partial"
                      : "Missed"}
                  {current.suggestedReason ? `. ${current.suggestedReason}` : "."}
                </span>
              </p>
            ) : !analyzed ? (
              <button
                type="button"
                className="mt-3 text-[13px] font-semibold text-[var(--color-accent-700)] hover:underline"
                disabled={running}
                onClick={run}
              >
                {running ? "Reviewing…" : "Review the transcript"}
              </button>
            ) : null}
          </div>
          <div>
            <p className={LIVE_SECTION_LABEL}>Outcome note</p>
            <div className="mt-2">
              <UnfinishedField
                value={prep.outcomeNote}
                emptyLabel="Add a sentence"
                multiline
                onSave={saveNote}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {current?.sourceUrl ? (
            <a
              href={current.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Transcript
            </a>
          ) : (
            <Button type="button" variant="secondary" size="sm" disabled={running} onClick={run}>
              {running ? "Reviewing…" : "Transcript"}
            </Button>
          )}
          <a
            href={`/live/library/${prep.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Record page
          </a>
        </div>
      </div>

      <div className="px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[24px] font-extrabold tracking-tight">Planned against said</h2>
          <p className="text-[14px] text-[var(--jos-muted)]">
            {tally}
            {checklistTotal ? ` · checklist ${checklistMet} of ${checklistTotal}` : ""}
          </p>
        </div>
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={confirming || !markable.length}
            onClick={confirmAll}
          >
            Confirm all as shown
          </Button>
        </div>
        <ul className="mt-4">
          {markable.map((point) => {
            const found = spokenById.get(point.id);
            const selected = point.confirmedState ?? presets.get(point.id) ?? "not_reached";
            return (
              <li
                key={point.id}
                className="flex flex-wrap items-start gap-3 border-t border-[var(--jos-line)] py-3"
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0 text-[12px] font-bold uppercase tracking-[0.06em]",
                    found?.match === "exact" && "text-[var(--color-done)]",
                    found?.match === "close" && "text-[var(--color-accent-700)]",
                    (!found || found.match === "none") && "text-[var(--jos-muted)]"
                  )}
                >
                  {matchLabel(found?.match)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-snug">{point.headline}</p>
                  {found?.nearest ? (
                    <p className="mt-1 text-[14px] text-[var(--jos-muted)]">
                      {found.timestamp ? `${found.timestamp} · ` : ""}
                      {found.nearest}
                    </p>
                  ) : null}
                  {point.kind === "ask" ? (
                    <p className="mt-1 text-[13px] text-[var(--jos-muted)]">
                      Recorded{" "}
                      {point.observedReaction
                        ? REACTION_LABELS[point.observedReaction as ReactionShape]
                        : "nothing"}
                      {" · "}
                      Review found{" "}
                      {reactionById.get(point.id)?.shape
                        ? REACTION_LABELS[reactionById.get(point.id)!.shape as ReactionShape]
                        : "nothing"}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(
                      [
                        ["covered", "Covered"],
                        ["skipped", "Skipped"],
                        ["not_reached", "Not reached"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={confirming}
                        onClick={() => confirmOne(point.id, value)}
                        className={cn(
                          "border px-2 py-1 text-[12px] font-semibold",
                          selected === value
                            ? "border-[var(--jos-ink)] bg-[var(--jos-ink)] text-white"
                            : "border-[var(--jos-line)] text-[var(--jos-ink)]"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {checklistTotal ? (
          <div className="mt-6">
            <p className={LIVE_SECTION_LABEL}>Checklist</p>
            {checklistFallback ? (
              <p className="mt-1 text-[13px] text-[var(--jos-muted)]">
                Checklist built from the outcome sentence and the asks; no playbook was used
              </p>
            ) : null}
            <ul className="mt-2 space-y-2">
              {(current?.rubricResults?.length ? current.rubricResults : rubric.map((item) => ({ item, met: false, quote: null }))).map(
                (row) => (
                  <li key={row.item} className="text-[15px]">
                    <span className={row.met ? "text-[var(--color-done)]" : "text-[var(--jos-muted)]"}>
                      {row.met ? "Met" : "Missed"}
                    </span>
                    {" · "}
                    {row.item}
                    {row.quote ? (
                      <span className="block text-[13px] text-[var(--jos-muted)]">{row.quote}</span>
                    ) : null}
                  </li>
                )
              )}
            </ul>
          </div>
        ) : null}
        {current?.error ? (
          <p className="mt-3 text-[14px] text-[var(--color-accent-2-text)]">{current.error}</p>
        ) : null}
      </div>

      <div className="space-y-6 px-10 pb-10">
        <section>
          <p className={LIVE_SECTION_LABEL}>Commitments from the call</p>
          {commitments && commitments.length ? (
            <ul className="mt-3 space-y-3">
              {commitments.map((item) => (
                <li key={`${item.personName}-${item.text}`} className="flex items-start gap-2">
                  <CheckSquare
                    size={18}
                    weight="duotone"
                    className="mt-0.5 shrink-0 text-[var(--color-todo)]"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-[15px] leading-snug",
                        item.status === "overdue" && "text-[var(--color-accent-2-text)]"
                      )}
                    >
                      {item.text}
                    </p>
                    <p className="text-[13px] text-[var(--jos-muted)]">
                      {item.direction === "mine" ? "Yours" : "Theirs"}
                      {item.due ? ` · due ${item.due}` : " · this week"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[14px] text-[var(--jos-muted)]">
              No open commitments on the record yet.
            </p>
          )}
        </section>

        <section>
          <p className={LIVE_SECTION_LABEL}>Next touch</p>
          {nextTouch?.date ? (
            <p className="mt-2 text-[15px]">
              {nextTouch.date}
              {nextTouch.reason ? ` · ${nextTouch.reason}` : ""}
            </p>
          ) : (
            <p className="mt-2 text-[14px] text-[var(--jos-muted)]">No next touch set on this person.</p>
          )}
        </section>

        {current?.sourceUrl ? (
          <p className="text-[14px]">
            <ExternalLink href={current.sourceUrl}>Open in Granola</ExternalLink>
          </p>
        ) : null}
      </div>
    </div>
  );
}
