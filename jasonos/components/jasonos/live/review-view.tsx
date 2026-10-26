"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StatusPill, type StatusRung } from "@/components/jasonos/brand/status";
import { LiveBreadcrumb } from "@/components/jasonos/live/live-breadcrumb";
import {
  formatReviewedAt,
  formatRunSummary,
  goalMarkLabel,
  goalMarkRung,
  slideMarkLabel,
  slideMarkRung,
} from "@/components/jasonos/live/live-format";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  DeckDetail,
  DeckReview,
  ReviewGoalMark,
  ReviewSlideMark,
} from "@/lib/server-actions/decks";
import {
  fetchTranscript,
  reviewRun,
  setReviewMark,
  setRubricMark,
} from "@/lib/server-actions/decks";
import type { RubricScore } from "@/lib/server-actions/decks";
import { cn } from "@/lib/utils";

function ReviewMarkPill({
  label,
  rung,
  choices,
  onPick,
  disabled,
}: {
  label: string;
  rung: StatusRung;
  choices: Array<{ mark: string; label: string; rung: StatusRung }>;
  onPick: (mark: string) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "inline-flex cursor-pointer rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jos-focus)]",
          disabled && "cursor-not-allowed opacity-60"
        )}
        aria-label={`Change mark: ${label}`}
      >
        <StatusPill rung={rung} className="text-[11px]">{label}</StatusPill>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36">
        {choices.map((choice) => (
          <DropdownMenuItem
            key={choice.mark}
            onSelect={(event) => {
              event.preventDefault();
              onPick(choice.mark);
            }}
          >
            <StatusPill rung={choice.rung} className="text-[11px]">{choice.label}</StatusPill>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const GOAL_CHOICES: Array<{ mark: ReviewGoalMark; label: string; rung: StatusRung }> = [
  { mark: "hit", label: "Hit", rung: "done" },
  { mark: "partly", label: "Partly", rung: 2 },
  { mark: "missed", label: "Missed", rung: 1 },
];

const SLIDE_CHOICES: Array<{ mark: ReviewSlideMark; label: string; rung: StatusRung }> = [
  { mark: "covered", label: "Covered", rung: "done" },
  { mark: "partly", label: "Partly", rung: 2 },
  { mark: "skipped", label: "Skipped", rung: 1 },
];

function RubricScoreSquares({
  score,
  disabled,
  onPick,
}: {
  score: number | null;
  disabled?: boolean;
  onPick: (score: number) => void;
}) {
  const filled = score ?? 0;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Rubric score">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          aria-label={`Score ${value}`}
          onClick={() => onPick(value)}
          className={cn(
            "h-3.5 w-3.5 rounded-[1px] border border-[var(--jos-line)] disabled:cursor-not-allowed disabled:opacity-50",
            value <= filled ? "bg-[var(--jos-ink)]" : "bg-transparent"
          )}
        />
      ))}
    </div>
  );
}

function RubricReviewRow({
  row,
  disabled,
  onScore,
  onNa,
}: {
  row: RubricScore;
  disabled?: boolean;
  onScore: (score: number) => void;
  onNa: () => void;
}) {
  return (
    <div className="border-b border-[var(--jos-line)] py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug">{row.line}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {row.na ? (
            <span className="text-[13px] font-semibold text-[var(--jos-muted)]">Not applicable</span>
          ) : (
            <RubricScoreSquares score={row.score} disabled={disabled} onPick={onScore} />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[12px]"
            disabled={disabled}
            onClick={onNa}
          >
            N/A
          </Button>
        </div>
      </div>
      {row.note ? (
        <p className="mt-1.5 text-[14px] text-[var(--jos-muted)]">{row.note}</p>
      ) : null}
    </div>
  );
}

function countSlideMarks(review: DeckReview | null) {
  const counts = { covered: 0, partly: 0, skipped: 0 };
  if (!review) return counts;
  for (const row of review.slides) {
    counts[row.mark] += 1;
  }
  return counts;
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
        {title}
      </h2>
      {items.length ? (
        <ul className="mt-2 space-y-1.5 text-[14px] leading-snug">
          {items.map((line, index) => (
            <li key={`${index}-${line.slice(0, 24)}`} className="border-l-2 border-[var(--jos-line)] pl-3">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[14px] text-[var(--jos-muted)]">—</p>
      )}
    </section>
  );
}

export function ReviewView({
  deck,
  meetingLabel,
}: {
  deck: DeckDetail;
  meetingLabel: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reviewing, setReviewing] = useState(false);
  const [fetchingTranscript, setFetchingTranscript] = useState(false);
  const [review, setReview] = useState<DeckReview | null>(deck.review);
  const [reviewedAt, setReviewedAt] = useState(deck.reviewedAt);
  const [transcript, setTranscript] = useState(deck.transcript);
  const [transcriptSource, setTranscriptSource] = useState(deck.transcriptSource);
  const [transcriptFetchedAt, setTranscriptFetchedAt] = useState(deck.transcriptFetchedAt);

  useEffect(() => {
    setReview(deck.review);
    setReviewedAt(deck.reviewedAt);
    setTranscript(deck.transcript);
    setTranscriptSource(deck.transcriptSource);
    setTranscriptFetchedAt(deck.transcriptFetchedAt);
  }, [deck]);

  const hasTranscript = Boolean(transcript?.trim());
  const runSummary = formatRunSummary(deck.runStartedAt, deck.runEndedAt);
  const slideCounts = countSlideMarks(review);
  const hasSlides = deck.slides.length > 0;
  const rubricLines = deck.rubric;
  const rubricRows = review?.rubric ?? [];
  const rubricNaCount = rubricRows.filter((row) => row.na).length;
  const rubricAverage = review?.rubric_average ?? null;

  const crumbs = [
    { label: "Live", href: "/live" },
    { label: "Library", href: "/live/library" },
    { label: "Held meetings", href: "/live/library?tab=held" },
    { label: deck.name, href: `/live/decks/${deck.id}` },
    { label: "Review" },
  ];

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const onSetRubricMark = (index: number, input: { score: number | "na" }) => {
    start(async () => {
      const result = await setRubricMark(deck.id, index, input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReview(result.review);
      refresh();
    });
  };

  const onSetMark = (target: string, mark: ReviewSlideMark | ReviewGoalMark) => {
    start(async () => {
      const result = await setReviewMark(deck.id, { target, mark });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReview(result.review);
      refresh();
    });
  };

  const onFetchTranscript = () => {
    setFetchingTranscript(true);
    start(async () => {
      const result = await fetchTranscript(deck.id);
      setFetchingTranscript(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTranscript(result.transcript);
      setTranscriptSource(result.source);
      setTranscriptFetchedAt(new Date().toISOString());
      toast.success(result.transcript ? "Transcript saved" : "No transcript found");
      refresh();
    });
  };

  const onReviewRun = () => {
    setReviewing(true);
    start(async () => {
      const result = await reviewRun(deck.id);
      setReviewing(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReview(result.review);
      setReviewedAt(new Date().toISOString());
      toast.success("Review complete");
      refresh();
    });
  };

  const onReviewAgain = () => {
    const ok = window.confirm(
      "Run review again? Manual mark overrides from this review will be cleared."
    );
    if (!ok) return;
    onReviewRun();
  };

  const reviewBySlideId = new Map(review?.slides.map((row) => [row.slide_id, row]) ?? []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <LiveBreadcrumb crumbs={crumbs} />

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
            Review
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{deck.name}</h1>
          {meetingLabel ? (
            <p className="mt-1 text-[14px] text-[var(--jos-muted)]">{meetingLabel}</p>
          ) : null}
          {runSummary ? (
            <p className="mt-0.5 text-[13px] text-[var(--jos-muted)]">{runSummary}</p>
          ) : null}
        </div>
        <Link href={`/live/decks/${deck.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Edit deck
        </Link>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 min-[1100px]:grid-cols-[1.1fr_1fr] min-[1100px]:items-start">
        <div className="min-w-0">
          {deck.goal?.trim() ? (
            <section className="rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-surface)] px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
                Goal
              </p>
              <p className="mt-1 text-[15px] font-semibold leading-snug">{deck.goal}</p>
              {review?.goal ? (
                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <ReviewMarkPill
                    label={goalMarkLabel(review.goal.mark)}
                    rung={goalMarkRung(review.goal.mark)}
                    choices={GOAL_CHOICES}
                    onPick={(mark) => onSetMark("goal", mark as ReviewGoalMark)}
                    disabled={pending || !review}
                  />
                  {review.goal.evidence ? (
                    <p className="min-w-0 flex-1 text-[13px] text-[var(--jos-muted)]">{review.goal.evidence}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : (
            <p className="text-[14px] text-[var(--jos-muted)]">No goal was set for this deck.</p>
          )}

          <section className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
                Rubric
              </h2>
              {review && rubricAverage != null ? (
                <p className="text-[13px] font-semibold tabular-nums text-[var(--jos-ink)]">
                  {rubricAverage} of 5
                  {rubricNaCount > 0 ? (
                    <span className="ml-2 font-normal text-[var(--jos-muted)]">
                      {rubricNaCount} not applicable
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            {!rubricLines.length ? (
              <p className="mt-2 text-[14px] text-[var(--jos-muted)]">
                No rubric on this deck.{" "}
                <Link href={`/live/decks/${deck.id}#rubric`} className="font-semibold text-[var(--jos-ink)] underline">
                  Add rubric
                </Link>
              </p>
            ) : review ? (
              <div className="mt-2">
                {rubricRows.map((row, index) => (
                  <RubricReviewRow
                    key={`${index}-${row.line.slice(0, 24)}`}
                    row={row}
                    disabled={pending}
                    onScore={(score) => onSetRubricMark(index, { score })}
                    onNa={() =>
                      onSetRubricMark(index, { score: row.na ? 1 : "na" })
                    }
                  />
                ))}
              </div>
            ) : (
              <ul className="mt-2 space-y-1 text-[14px] text-[var(--jos-muted)]">
                {rubricLines.map((line, index) => (
                  <li key={`${index}-${line.slice(0, 24)}`}>{line}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            {!hasSlides ? (
              <p className="text-[14px] text-[var(--jos-muted)]">
                No slides. This meeting was not run in Live.
              </p>
            ) : (
              <>
                <p className="text-[13px] text-[var(--jos-muted)]">
                  {review
                    ? `${slideCounts.covered} covered · ${slideCounts.partly} partly · ${slideCounts.skipped} skipped`
                    : `${deck.slides.length} slides`}
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-[var(--jos-line)] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--jos-muted)]">
                        <th className="py-2 pr-3 w-10">#</th>
                        <th className="py-2 pr-3">Headline</th>
                        <th className="py-2 pr-3 w-28">Mark</th>
                        <th className="py-2">Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deck.slides.map((slide, index) => {
                        const row = reviewBySlideId.get(slide.id);
                        return (
                          <tr key={slide.id} className="border-b border-[var(--jos-line)] align-top">
                            <td className="py-2.5 pr-3 tabular-nums text-[var(--jos-muted)]">{index + 1}</td>
                            <td className="py-2.5 pr-3 font-semibold">{slide.headline}</td>
                            <td className="py-2.5 pr-3">
                              {row ? (
                                <ReviewMarkPill
                                  label={slideMarkLabel(row.mark)}
                                  rung={slideMarkRung(row.mark)}
                                  choices={SLIDE_CHOICES}
                                  onPick={(mark) => onSetMark(slide.id, mark as ReviewSlideMark)}
                                  disabled={pending || !review}
                                />
                              ) : (
                                <span className="text-[var(--jos-muted)]">—</span>
                              )}
                            </td>
                            <td className="py-2.5 text-[13px] text-[var(--jos-muted)]">
                              {row?.evidence ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {review ? (
            <>
              <ReviewList title="What they said that matters" items={review.said} />
              <ReviewList title="What I committed to" items={review.committed} />
              <ReviewList title="Do differently next time" items={review.next_time} />
            </>
          ) : null}

          <section className="mt-10 border-t border-[var(--jos-line)] pt-8">
            {!review ? (
              <>
                <Button
                  type="button"
                  disabled={!hasTranscript || reviewing || pending}
                  title={!hasTranscript ? "Fetch the transcript first" : undefined}
                  onClick={() => onReviewRun()}
                >
                  {reviewing ? "Reading the transcript…" : "Review this run"}
                </Button>
                {!hasTranscript ? (
                  <p className="mt-2 text-[13px] text-[var(--jos-muted)]">Fetch the transcript first</p>
                ) : null}
              </>
            ) : null}
            {review && reviewedAt ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[13px] text-[var(--jos-muted)]">
                  {formatReviewedAt(
                    reviewedAt,
                    review.transcript_source ?? transcriptSource
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reviewing || pending}
                  onClick={() => onReviewAgain()}
                >
                  {reviewing ? "Reading the transcript…" : "Review again"}
                </Button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="min-w-0 min-[1100px]:sticky min-[1100px]:top-6">
          <div className="rounded-[2px] border border-[var(--jos-line)] bg-[var(--jos-surface)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--jos-line)] px-4 py-3">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jos-muted)]">
                Transcript
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fetchingTranscript || pending}
                onClick={() => onFetchTranscript()}
              >
                {fetchingTranscript
                  ? "Fetching…"
                  : hasTranscript
                    ? "Fetch again"
                    : "Fetch transcript"}
              </Button>
            </div>
            <div className="max-h-[min(70vh,720px)] overflow-y-auto px-4 py-3">
              {fetchingTranscript ? (
                <p className="text-[14px] text-[var(--jos-muted)]">Looking for a transcript…</p>
              ) : hasTranscript ? (
                <>
                  {transcriptFetchedAt ? (
                    <p className="mb-3 text-[12px] text-[var(--jos-muted)]">
                      Fetched{" "}
                      {new Date(transcriptFetchedAt).toLocaleString("en-US", {
                        timeZone: "America/New_York",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {transcriptSource ? ` · ${transcriptSource === "granola" ? "Granola" : "Wispr"}` : ""}
                    </p>
                  ) : null}
                  <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--jos-ink)]">
                    {transcript}
                  </pre>
                </>
              ) : (
                <p className="text-[14px] text-[var(--jos-muted)]">
                  No transcript stored yet. Fetch from Granola or Wispr when the meeting note is ready.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
