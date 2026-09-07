"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ConsciousnessPremise } from "@/lib/iugr/types";
import { ORIGINAL_TOWN } from "@/lib/iugr/copy";
import {
  THE_QUESTION_SCRIPT,
  TRANSITION_2,
} from "@/lib/iugr/script";
import { reactionSettleMs } from "@/lib/iugr/motion";
import { CountCard } from "@/components/iugr/CountCard";
import { Plate } from "@/components/iugr/plate/Plate";
import { TownResidents } from "@/components/iugr/TownResidents";
import { TownSketch } from "@/components/iugr/TownSketch";
import { TransitionBlock } from "@/components/iugr/TransitionBlock";

type TheQuestionChapterProps = {
  readerFigureIndex: number | null;
  copiesAreConscious: ConsciousnessPremise | null;
  onSelectCopiesAreConscious: (value: ConsciousnessPremise) => void;
  reducedMotion: boolean;
  onContinue: () => void;
  onPrevious: () => void;
};

const ANSWERS: {
  id: ConsciousnessPremise;
  label: string;
}[] = [
  { id: "yes", label: THE_QUESTION_SCRIPT.choiceYes },
  { id: "unsure", label: THE_QUESTION_SCRIPT.choiceUnsure },
  { id: "no", label: THE_QUESTION_SCRIPT.choiceNo },
];

function reactionText(answer: ConsciousnessPremise): string {
  if (answer === "yes") return ORIGINAL_TOWN.reactionYesAnnounce;
  if (answer === "unsure") return ORIGINAL_TOWN.reactionUnsureAnnounce;
  return ORIGINAL_TOWN.reactionNoAnnounce;
}

function censusStatus(answer: ConsciousnessPremise | null): string {
  if (answer === "yes") return ORIGINAL_TOWN.statusYes;
  if (answer === "unsure") return ORIGINAL_TOWN.statusUnsure;
  if (answer === "no") return ORIGINAL_TOWN.statusNo;
  return ORIGINAL_TOWN.statusBefore;
}

/**
 * Beat 2b — The Question.
 * Small marked town, the question, three answers. Result renders below
 * the answers so the reader never scrolls up to see the change.
 */
export function TheQuestionChapter({
  readerFigureIndex,
  copiesAreConscious,
  onSelectCopiesAreConscious,
  reducedMotion,
  onContinue,
  onPrevious,
}: TheQuestionChapterProps) {
  const questionId = useId();
  const reactionId = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const [settledAnswer, setSettledAnswer] = useState<ConsciousnessPremise | null>(
    null,
  );

  useEffect(() => {
    if (!copiesAreConscious) return;
    const wait = reactionSettleMs(reducedMotion, copiesAreConscious);
    const timer = window.setTimeout(() => {
      setSettledAnswer(copiesAreConscious);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [copiesAreConscious, reducedMotion]);

  useEffect(() => {
    if (!copiesAreConscious) return;
    resultRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [copiesAreConscious, reducedMotion]);

  const reactionReady =
    copiesAreConscious != null && settledAnswer === copiesAreConscious;

  const census =
    copiesAreConscious === "yes"
      ? { worlds: 2, residents: 200, copies: 100 }
      : copiesAreConscious === "unsure"
        ? { worlds: 2, residents: 100, copies: 100 }
        : copiesAreConscious === "no"
          ? { worlds: 2, residents: 100, copies: 100 }
          : { worlds: 1, residents: 100, copies: 0 };

  const responseLine =
    copiesAreConscious === "yes"
      ? THE_QUESTION_SCRIPT.reactionYes
      : copiesAreConscious === "unsure"
        ? THE_QUESTION_SCRIPT.reactionUnsure
        : copiesAreConscious === "no"
          ? THE_QUESTION_SCRIPT.reactionNo
          : null;

  return (
    <section
      className={`iugr-panel iugr-town-chapter iugr-question-chapter${reducedMotion ? " is-static" : " is-enter"}`}
      data-wash="violet"
      aria-labelledby="iugr-question-title"
    >
      <div className="iugr-label">Chapter · The Question</div>
      <h1 id="iugr-question-title" className="iugr-headline iugr-headline-sm">
        The Question
      </h1>

      <div className="iugr-question-town-preview">
        <Plate figureNumber={1} caption={ORIGINAL_TOWN.plateCaption}>
          <TownSketch />
          <TownResidents
            readerFigureIndex={readerFigureIndex}
            interactive={false}
            compact
          />
        </Plate>
      </div>

      <div className="iugr-town-question">
        <div id={questionId} className="iugr-town-question-text">
          {THE_QUESTION_SCRIPT.question.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div
          className="iugr-choice-stack"
          role="radiogroup"
          aria-labelledby={questionId}
        >
          {ANSWERS.map((answer) => (
            <button
              key={answer.id}
              type="button"
              role="radio"
              aria-checked={copiesAreConscious === answer.id}
              className="iugr-choice"
              data-selected={copiesAreConscious === answer.id}
              onClick={() => onSelectCopiesAreConscious(answer.id)}
            >
              {answer.label}
            </button>
          ))}
        </div>
      </div>

      {copiesAreConscious ? (
        <p id={reactionId} className="sr-only" aria-live="polite">
          {reactionText(copiesAreConscious)}
        </p>
      ) : null}

      <div ref={resultRef} className="iugr-question-result">
        {copiesAreConscious ? (
          <>
            <div
              className={[
                "iugr-town-copy-layer",
                `is-${copiesAreConscious}`,
                reducedMotion ? "is-static" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden
            >
              <Plate
                figureNumber={2}
                caption={ORIGINAL_TOWN.copyPlateCaption}
              >
                <TownSketch dashed={copiesAreConscious !== "yes"} />
                <TownResidents
                  readerFigureIndex={readerFigureIndex}
                  interactive={false}
                  dashed={copiesAreConscious === "unsure"}
                  muted={copiesAreConscious === "no"}
                  copyPalette
                  readerTick={copiesAreConscious === "unsure" ? "?" : "YOU"}
                />
              </Plate>
            </div>

            <CountCard
              worlds={census.worlds}
              residents={census.residents}
              copies={census.copies}
              worldsLabel={ORIGINAL_TOWN.countWorlds}
              residentsLabel={ORIGINAL_TOWN.countResidents}
              copiesLabel={ORIGINAL_TOWN.countCopies}
              statusLine={censusStatus(copiesAreConscious)}
              strikeCopies={copiesAreConscious === "no"}
            />
          </>
        ) : null}

        {reactionReady && responseLine ? (
          <div className="iugr-town-response">
            <p>{responseLine}</p>
            <p className="iugr-town-field-note" role="note">
              {THE_QUESTION_SCRIPT.fieldNote}
            </p>
            <TransitionBlock paragraphs={TRANSITION_2} />
            <button
              type="button"
              className="iugr-btn iugr-btn-primary"
              onClick={onContinue}
            >
              {THE_QUESTION_SCRIPT.continueLabel}
            </button>
          </div>
        ) : null}
      </div>

      <div className="iugr-actions">
        <button
          type="button"
          className="iugr-btn iugr-btn-ghost"
          onClick={onPrevious}
        >
          {THE_QUESTION_SCRIPT.previousLabel}
        </button>
      </div>
    </section>
  );
}
