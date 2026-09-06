"use client";

import { useEffect, useId, useState } from "react";
import type { ConsciousnessPremise } from "@/lib/iugr/types";
import { ORIGINAL_TOWN } from "@/lib/iugr/copy";
import { reactionSettleMs } from "@/lib/iugr/motion";
import { CountCard } from "@/components/iugr/CountCard";
import { Plate } from "@/components/iugr/plate/Plate";
import { PlateAnnotation } from "@/components/iugr/plate/PlateAnnotation";
import { ResidentFigure } from "@/components/iugr/plate/ResidentFigure";

const RESIDENT_COUNT = 10;

type OriginalTownChapterProps = {
  readerFigureIndex: number | null;
  copiesAreConscious: ConsciousnessPremise | null;
  onSelectReaderFigure: (index: number) => void;
  onSelectCopiesAreConscious: (value: ConsciousnessPremise) => void;
  reducedMotion: boolean;
  onContinue: () => void;
  onPrevious: () => void;
};

const ANSWERS: {
  id: ConsciousnessPremise;
  label: string;
}[] = [
  { id: "yes", label: ORIGINAL_TOWN.choiceYes },
  { id: "unsure", label: ORIGINAL_TOWN.choiceUnsure },
  { id: "no", label: ORIGINAL_TOWN.choiceNo },
];

function reactionText(answer: ConsciousnessPremise): string {
  if (answer === "yes") return ORIGINAL_TOWN.reactionYesAnnounce;
  if (answer === "unsure") return ORIGINAL_TOWN.reactionUnsureAnnounce;
  return ORIGINAL_TOWN.reactionNoAnnounce;
}

function TownSketch({ dashed = false }: { dashed?: boolean }) {
  return (
    <svg
      className="iugr-town-sketch"
      viewBox="0 0 280 78"
      aria-hidden
    >
      <path
        className="iugr-town-sketch-stroke"
        d="M18 62 H262"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <path
        className="iugr-town-sketch-stroke"
        d="M36 62 V40 H70 V62"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <path
        className="iugr-town-sketch-stroke"
        d="M32 40 L53 22 L74 40"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <path
        className="iugr-town-sketch-stroke"
        d="M46 62 V50 H60 V62"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <path
        className="iugr-town-sketch-stroke"
        d="M108 62 V28 H172 V62"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <path
        className="iugr-town-sketch-stroke"
        d="M102 28 L140 8 L178 28"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <rect
        className="iugr-town-sketch-stroke"
        x="132"
        y="44"
        width="16"
        height="18"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <path
        className="iugr-town-sketch-stroke"
        d="M198 62 V44 H232 V62"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <path
        className="iugr-town-sketch-stroke"
        d="M194 44 L215 28 L236 44"
        strokeDasharray={dashed ? "4 3" : undefined}
      />
    </svg>
  );
}

function TownResidents({
  readerFigureIndex,
  interactive,
  dashed,
  muted,
  readerTick,
  onSelect,
}: {
  readerFigureIndex: number | null;
  interactive: boolean;
  dashed?: boolean;
  muted?: boolean;
  readerTick?: string;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="iugr-town-residents">
      {Array.from({ length: RESIDENT_COUNT }, (_, index) => {
        const isReader = readerFigureIndex === index;
        const figure = (
          <ResidentFigure
            variant="full"
            isReader={isReader}
            index={index}
            dashed={dashed}
            muted={muted}
            tickLabel={isReader ? readerTick : undefined}
          />
        );

        if (!interactive) {
          return (
            <div key={index} className="iugr-town-resident-slot" aria-hidden>
              {figure}
            </div>
          );
        }

        return (
          <button
            key={index}
            type="button"
            className="iugr-town-resident-btn"
            aria-label={`Resident ${index + 1} of ${RESIDENT_COUNT}. Select as yourself.`}
            aria-pressed={isReader}
            onClick={() => onSelect?.(index)}
          >
            {figure}
          </button>
        );
      })}
    </div>
  );
}

export function OriginalTownChapter({
  readerFigureIndex,
  copiesAreConscious,
  onSelectReaderFigure,
  onSelectCopiesAreConscious,
  reducedMotion,
  onContinue,
  onPrevious,
}: OriginalTownChapterProps) {
  const questionId = useId();
  const reactionId = useId();
  const selected = readerFigureIndex != null;
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

  const reactionReady =
    copiesAreConscious != null && settledAnswer === copiesAreConscious;

  const census =
    copiesAreConscious === "yes"
      ? { worlds: 2, residents: 200, copies: 100 }
      : copiesAreConscious === "unsure"
        ? { worlds: 2, residents: 100, copies: 100 }
        : copiesAreConscious === "no"
          ? { worlds: 2, residents: 100, copies: 0 }
          : { worlds: 1, residents: 100, copies: 0 };

  const responseLine =
    copiesAreConscious === "yes"
      ? ORIGINAL_TOWN.ackYes
      : copiesAreConscious === "unsure"
        ? ORIGINAL_TOWN.ackUnsure
        : copiesAreConscious === "no"
          ? ORIGINAL_TOWN.ackNo
          : null;

  return (
    <section
      className={`iugr-panel iugr-town-chapter${reducedMotion ? " is-static" : " is-enter"}`}
      aria-labelledby="iugr-town-title"
    >
      <div className="iugr-label">Chapter · Original Town</div>
      <h1 id="iugr-town-title" className="iugr-headline iugr-headline-sm">
        Original Town
      </h1>

      {!selected ? (
        <div className="iugr-town-copy">
          <p>{ORIGINAL_TOWN.beforeSelect1}</p>
          <p>{ORIGINAL_TOWN.beforeSelect2}</p>
        </div>
      ) : (
        <p className="iugr-town-copy">{ORIGINAL_TOWN.afterSelect}</p>
      )}

      <div
        className={[
          "iugr-town-stack",
          copiesAreConscious ? "has-copy" : "",
          copiesAreConscious ? `is-${copiesAreConscious}` : "",
          reducedMotion ? "is-static" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {copiesAreConscious ? (
          <div className="iugr-town-copy-layer" aria-hidden>
            <Plate figureNumber={2} label={ORIGINAL_TOWN.copyPlateLabel}>
              <TownSketch dashed={copiesAreConscious !== "yes"} />
              <TownResidents
                readerFigureIndex={readerFigureIndex}
                interactive={false}
                dashed={copiesAreConscious === "unsure"}
                muted={copiesAreConscious === "no"}
                readerTick={copiesAreConscious === "unsure" ? "?" : "YOU"}
              />
              <p
                className={`iugr-town-copy-count${copiesAreConscious === "no" ? " is-struck" : ""}`}
              >
                <span>100</span>
              </p>
            </Plate>
          </div>
        ) : null}

        <div className="iugr-town-original-layer">
          <Plate figureNumber={1} label={ORIGINAL_TOWN.plateLabel}>
            <TownSketch />
            <TownResidents
              readerFigureIndex={readerFigureIndex}
              interactive
              onSelect={onSelectReaderFigure}
            />
            <PlateAnnotation
              text={ORIGINAL_TOWN.figureNote}
              anchor={{ x: 50, y: 58 }}
              label={{ x: 8, y: 92 }}
            />
          </Plate>
        </div>
      </div>

      <CountCard
        worlds={census.worlds}
        residents={census.residents}
        copies={census.copies}
        worldsLabel={ORIGINAL_TOWN.countWorlds}
        residentsLabel={ORIGINAL_TOWN.countResidents}
        copiesLabel={ORIGINAL_TOWN.countCopies}
        statusLine={ORIGINAL_TOWN.statusLine}
      />

      {selected ? (
        <div className="iugr-town-question">
          <div id={questionId} className="iugr-town-question-text">
            <p>{ORIGINAL_TOWN.question1}</p>
            <p>{ORIGINAL_TOWN.question2}</p>
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
      ) : null}

      {copiesAreConscious ? (
        <p id={reactionId} className="sr-only" aria-live="polite">
          {reactionText(copiesAreConscious)}
        </p>
      ) : null}

      {reactionReady && responseLine ? (
        <div className="iugr-town-response">
          <p>{responseLine}</p>
          <button
            type="button"
            className="iugr-btn iugr-btn-primary"
            onClick={onContinue}
          >
            {ORIGINAL_TOWN.continueLabel}
          </button>
        </div>
      ) : null}

      <div className="iugr-actions">
        <button type="button" className="iugr-btn iugr-btn-ghost" onClick={onPrevious}>
          {ORIGINAL_TOWN.previousLabel}
        </button>
      </div>
    </section>
  );
}
