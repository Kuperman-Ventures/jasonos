"use client";

import { useId, useMemo } from "react";
import {
  ARCADE_CONTROLS,
  ASSUMPTION_ARCADE,
  type ArcadeControlDef,
} from "@/lib/iugr/arcadeControls";
import {
  evaluateScenario,
  type ScenarioAssumptions,
  type ScenarioCategory,
} from "@/lib/iugr/scenarioEngine";
import { ARCADE_SCRIPT, TRANSITION_5 } from "@/lib/iugr/script";
import { Plate } from "@/components/iugr/plate/Plate";
import { TransitionBlock } from "@/components/iugr/TransitionBlock";

export type AssumptionArcadeChapterProps = {
  assumptions: ScenarioAssumptions;
  onAssumptionsChange: (next: ScenarioAssumptions) => void;
  onContinue: () => void;
  onBack: () => void;
  reducedMotion: boolean;
};

function ScenarioMotif({ category }: { category: ScenarioCategory }) {
  const stroke = {
    fill: "none",
    stroke: "var(--cream)",
    strokeWidth: 1.4,
    vectorEffect: "non-scaling-stroke" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <Plate figureNumber={5} caption="Scenario field.">
      <svg
        className="iugr-arcade-motif"
        viewBox="0 0 160 72"
        aria-hidden
        focusable="false"
      >
        <rect x="8" y="12" width="144" height="48" rx="4" {...stroke} />
        {category === "observer-count-breaks" ? (
          <>
            <circle cx="40" cy="36" r="10" {...stroke} />
            <path d="M70 36 H128" {...stroke} strokeDasharray="4 3" />
            <path d="M118 28 L130 36 L118 44" {...stroke} />
          </>
        ) : null}
        {category === "copies-stay-rare" ? (
          <>
            <circle cx="48" cy="36" r="11" {...stroke} />
            <circle cx="86" cy="30" r="4" {...stroke} />
            <circle cx="104" cy="42" r="3.5" {...stroke} />
          </>
        ) : null}
        {category === "copies-could-outnumber" ? (
          <>
            <circle cx="36" cy="36" r="8" {...stroke} />
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <circle
                key={i}
                cx={64 + (i % 5) * 14}
                cy={24 + Math.floor(i / 5) * 18}
                r="4"
                {...stroke}
              />
            ))}
          </>
        ) : null}
        {category === "too-uncertain-to-count" ||
        category === "mixed-or-uncertain" ? (
          <>
            <circle
              cx="52"
              cy="36"
              r="10"
              {...stroke}
              strokeDasharray="3 3"
            />
            <circle cx="92" cy="28" r="5" {...stroke} />
            <circle cx="112" cy="44" r="5" {...stroke} />
            <path d="M128 32 L136 40 L128 48" {...stroke} />
          </>
        ) : null}
      </svg>
    </Plate>
  );
}

function AssumptionControl({
  control,
  value,
  onChange,
}: {
  control: ArcadeControlDef;
  value: string;
  onChange: (next: string) => void;
}) {
  const headingId = useId();

  return (
    <fieldset className="iugr-arcade-control" aria-labelledby={headingId}>
      <legend className="sr-only">{control.title}</legend>
      <h3 className="iugr-arcade-control-title" id={headingId}>
        {control.title}
      </h3>
      {control.explanation ? (
        <p className="iugr-arcade-control-explain">{control.explanation}</p>
      ) : null}

      <div
        className="iugr-arcade-segments"
        role="radiogroup"
        aria-labelledby={headingId}
      >
        {control.options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              className={`iugr-arcade-segment${selected ? " is-selected" : ""}`}
              onClick={() => onChange(option.id)}
            >
              <span className="iugr-arcade-segment-mark" aria-hidden>
                {selected ? "●" : "○"}
              </span>
              <span aria-hidden>{option.label}</span>
            </button>
          );
        })}
      </div>

      {control.aside ? <p className="iugr-arcade-aside">{control.aside}</p> : null}

      {control.whyItMatters ? (
        <details className="iugr-arcade-why">
          <summary>Why it matters</summary>
          <p>{control.whyItMatters}</p>
        </details>
      ) : null}
    </fieldset>
  );
}

export function AssumptionArcadeChapter({
  assumptions,
  onAssumptionsChange,
  onContinue,
  onBack,
  reducedMotion,
}: AssumptionArcadeChapterProps) {
  const evaluation = useMemo(
    () => evaluateScenario(assumptions),
    [assumptions],
  );
  const liveId = useId();

  const setControl = (id: keyof ScenarioAssumptions, next: string) => {
    onAssumptionsChange({ ...assumptions, [id]: next } as ScenarioAssumptions);
  };

  return (
    <section
      className="iugr-panel iugr-assumption-arcade"
      data-wash="coral"
      aria-labelledby="iugr-arcade-title"
    >
      <div className="iugr-label">{ASSUMPTION_ARCADE.chapterLabel}</div>
      <h1 id="iugr-arcade-title" className="iugr-headline iugr-headline-sm">
        {ASSUMPTION_ARCADE.title}
      </h1>
      <p className="iugr-lead">{ASSUMPTION_ARCADE.welcome}</p>

      <div
        className="iugr-arcade-console"
        aria-label={ASSUMPTION_ARCADE.consoleAria}
      >
        <div className="iugr-arcade-controls">
          {ARCADE_CONTROLS.map((control) => (
            <AssumptionControl
              key={control.id}
              control={control}
              value={assumptions[control.id]}
              onChange={(next) => setControl(control.id, next)}
            />
          ))}
        </div>

        <aside
          className={[
            "iugr-arcade-outcome",
            `is-${evaluation.category}`,
            reducedMotion ? "is-static" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={ASSUMPTION_ARCADE.outcomeAria}
        >
          <h2 className="iugr-arcade-outcome-title">
            {ASSUMPTION_ARCADE.outcomeTitle}
          </h2>

          <div className="iugr-arcade-outcome-status">
            <span
              className={`iugr-arcade-status-mark is-${evaluation.category}`}
              aria-hidden
            />
            <p className="iugr-arcade-outcome-label">{evaluation.label}</p>
          </div>

          <ScenarioMotif category={evaluation.category} />
          <p className="sr-only">
            Abstract illustration for scenario category: {evaluation.label}
          </p>

          <p
            id={liveId}
            className="iugr-arcade-outcome-explain"
            aria-live="polite"
            aria-atomic="true"
          >
            {evaluation.explanation}
          </p>

          <div className="iugr-arcade-work">
            <h3>{ASSUMPTION_ARCADE.whatDidTheWorkTitle}</h3>
            <ul>
              {evaluation.whatDidTheWork.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <p className="iugr-arcade-try">{ASSUMPTION_ARCADE.tryAnother}</p>
        </aside>
      </div>

      <div className="iugr-arcade-closing-note">
        {ARCADE_SCRIPT.closingNote.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <TransitionBlock paragraphs={TRANSITION_5} />

      <div className="iugr-actions iugr-arcade-nav">
        <button type="button" className="iugr-btn iugr-btn-ghost" onClick={onBack}>
          {ASSUMPTION_ARCADE.previousLabel}
        </button>
        <button
          type="button"
          className="iugr-btn iugr-btn-primary"
          onClick={onContinue}
        >
          {ASSUMPTION_ARCADE.continueLabel}
        </button>
      </div>
    </section>
  );
}
