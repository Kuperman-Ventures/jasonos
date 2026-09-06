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

export type AssumptionArcadeChapterProps = {
  assumptions: ScenarioAssumptions;
  onAssumptionsChange: (next: ScenarioAssumptions) => void;
  onContinue: () => void;
  onBack: () => void;
  reducedMotion: boolean;
};

function ScenarioMotif({ category }: { category: ScenarioCategory }) {
  return (
    <svg
      className="iugr-arcade-motif"
      viewBox="0 0 160 72"
      aria-hidden
      focusable="false"
    >
      <rect
        x="8"
        y="12"
        width="144"
        height="48"
        rx="12"
        fill="var(--iugr-panel-solid)"
        stroke="var(--iugr-border-strong)"
        strokeWidth="1.5"
      />
      {category === "observer-count-breaks" ? (
        <>
          <circle cx="40" cy="36" r="10" fill="var(--iugr-coral)" opacity="0.85" />
          <path
            d="M70 36 H128"
            stroke="var(--iugr-cream-muted)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <path
            d="M118 28 L130 36 L118 44"
            fill="none"
            stroke="var(--iugr-coral)"
            strokeWidth="2"
          />
        </>
      ) : null}
      {category === "copies-stay-rare" ? (
        <>
          <circle cx="48" cy="36" r="11" fill="var(--iugr-accent)" />
          <circle cx="86" cy="30" r="4" fill="var(--iugr-copy-fill)" opacity="0.7" />
          <circle cx="104" cy="42" r="3.5" fill="var(--iugr-copy-fill)" opacity="0.55" />
        </>
      ) : null}
      {category === "copies-could-outnumber" ? (
        <>
          <circle cx="36" cy="36" r="8" fill="var(--iugr-accent)" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <circle
              key={i}
              cx={64 + (i % 5) * 14}
              cy={24 + Math.floor(i / 5) * 18}
              r="4"
              fill="var(--iugr-copy-fill)"
              opacity={0.45 + (i % 3) * 0.15}
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
            fill="none"
            stroke="var(--iugr-violet)"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
          <circle cx="92" cy="28" r="5" fill="var(--iugr-violet)" opacity="0.45" />
          <circle cx="112" cy="44" r="5" fill="var(--iugr-copy-fill)" opacity="0.45" />
          <text
            x="128"
            y="40"
            fill="var(--iugr-cream-muted)"
            fontSize="16"
            fontFamily="var(--iugr-font), system-ui, sans-serif"
          >
            ?
          </text>
        </>
      ) : null}
    </svg>
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
  const legendId = useId();

  return (
    <fieldset className="iugr-arcade-control">
      <legend className="iugr-arcade-control-title" id={legendId}>
        {control.title}
      </legend>
      <p className="iugr-arcade-control-explain">{control.explanation}</p>

      <div
        className="iugr-arcade-segments"
        role="radiogroup"
        aria-labelledby={legendId}
      >
        {control.options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`iugr-arcade-segment${selected ? " is-selected" : ""}`}
              onClick={() => onChange(option.id)}
            >
              <span className="iugr-arcade-segment-mark" aria-hidden>
                {selected ? "●" : "○"}
              </span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <p className="iugr-arcade-aside">{control.aside}</p>

      <details className="iugr-arcade-why">
        <summary>Why it matters</summary>
        <p>{control.whyItMatters}</p>
      </details>
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
      aria-labelledby="iugr-arcade-title"
    >
      <div className="iugr-label">{ASSUMPTION_ARCADE.chapterLabel}</div>
      <h1 id="iugr-arcade-title" className="iugr-headline iugr-headline-sm">
        {ASSUMPTION_ARCADE.title}
      </h1>
      <p className="iugr-lead">{ASSUMPTION_ARCADE.welcome}</p>
      <p className="iugr-body">{ASSUMPTION_ARCADE.welcomeAside}</p>
      <p className="iugr-body">{ASSUMPTION_ARCADE.bridgeFromDoors}</p>

      <p className="iugr-arcade-controls-label">{ASSUMPTION_ARCADE.controlsLabel}</p>

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

          <p className="iugr-arcade-disclaimer" role="note">
            {ASSUMPTION_ARCADE.disclaimer}
          </p>

          <div className="iugr-arcade-work">
            <h3>{ASSUMPTION_ARCADE.whatDidTheWorkTitle}</h3>
            <ul>
              {evaluation.whatDidTheWork.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <details className="iugr-arcade-reasoning">
            <summary>{ASSUMPTION_ARCADE.showReasoning}</summary>
            <ul>
              {evaluation.reasoning.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>

          <p className="iugr-arcade-try">{ASSUMPTION_ARCADE.tryAnother}</p>
        </aside>
      </div>

      <details className="iugr-arcade-whycant">
        <summary>{ASSUMPTION_ARCADE.whyCantTitle}</summary>
        <p>{ASSUMPTION_ARCADE.whyCantBody}</p>
        <ul>
          {ASSUMPTION_ARCADE.whyCantBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </details>

      <p className="iugr-body">{ASSUMPTION_ARCADE.bridgeNext}</p>

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
