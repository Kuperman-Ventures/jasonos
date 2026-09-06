"use client";

import { useId, useMemo, useState } from "react";
import { COPY_MACHINE } from "@/lib/iugr/copy";
import {
  COPY_SNAP_POINTS,
  computeTownScenario,
  formatWholeNumber,
  narrationForCopies,
  nearestSnapPoint,
  PEOPLE_PER_TOWN,
  type CopySnapPoint,
} from "@/lib/iugr/scenarioMath";
import type { ConsciousnessPremise } from "@/lib/iugr/types";
import { FractionViz } from "@/components/iugr/FractionViz";
import { MathDrawer } from "@/components/iugr/MathDrawer";

type CopyMachineChapterProps = {
  consciousnessPremise: ConsciousnessPremise | null;
  copiedTowns: number;
  hasInteracted: boolean;
  reachedNine: boolean;
  onCopiedTownsChange: (
    next: number,
    meta: { interacted: boolean; reachedNine: boolean },
  ) => void;
  onContinue: () => void;
  onBack: () => void;
  reducedMotion: boolean;
};

/** Compact town glyph for the population map — no per-token “COPY” label. */
function TownMark({
  variant,
  size = 28,
}: {
  variant: "original" | "copy";
  size?: number;
}) {
  const fill = variant === "original" ? "var(--iugr-original-fill)" : "var(--iugr-copy-fill)";
  const roof = variant === "original" ? "var(--iugr-original-roof)" : "var(--iugr-copy-accent)";
  const accent = variant === "original" ? "var(--iugr-accent)" : "var(--iugr-copy-accent)";
  return (
    <svg
      className={`iugr-field-mark iugr-field-mark-${variant}`}
      viewBox="0 0 40 34"
      width={size}
      height={size * 0.85}
      aria-hidden
    >
      <rect x="4" y="12" width="32" height="18" rx="5" fill={fill} />
      <rect x="9" y="5" width="10" height="11" rx="1.5" fill={roof} />
      <rect x="21" y="3" width="12" height="13" rx="1.5" fill={roof} />
      <circle cx="20" cy="20" r="3" fill={accent} />
    </svg>
  );
}

/**
 * Data-aware population map for copied-town scale.
 * Caps visible tokens; uses one SVG grid/field at high counts (no tall COPY grids).
 */
function CopyField({
  copiedTowns,
  reducedMotion,
}: {
  copiedTowns: number;
  reducedMotion: boolean;
}) {
  const totalTowns = 1 + copiedTowns;
  const summary = `Town population map: 1 Original Town and ${formatWholeNumber(copiedTowns)} copied towns, for ${formatWholeNumber(totalTowns)} towns total.`;

  let mode: "empty" | "pair" | "ten" | "hundred" | "thousand" = "empty";
  if (copiedTowns === 0) mode = "empty";
  else if (copiedTowns === 1) mode = "pair";
  else if (copiedTowns <= 9) mode = "ten";
  else if (copiedTowns <= 99) mode = "hundred";
  else mode = "thousand";

  const sampleCap = mode === "thousand" ? 36 : mode === "hundred" ? 99 : copiedTowns;
  const shownCopies = Math.min(copiedTowns, sampleCap);
  const remainder = Math.max(0, copiedTowns - shownCopies);

  return (
    <div
      className={[
        "iugr-copy-field",
        `is-${mode}`,
        reducedMotion ? "is-static" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="sr-only">{summary}</p>

      <div className="iugr-copy-field-legend" aria-hidden>
        <span className="iugr-copy-field-legend-item">
          <span className="iugr-copy-field-swatch iugr-copy-field-swatch-original" />
          Original Town
        </span>
        <span className="iugr-copy-field-legend-item">
          <span className="iugr-copy-field-swatch iugr-copy-field-swatch-copy" />
          Copied towns
        </span>
      </div>

      <div className="iugr-copy-field-body" aria-hidden>
        {mode === "empty" ? (
          <div className="iugr-copy-field-empty">
            <TownMark variant="original" size={36} />
            <span className="iugr-copy-field-empty-label">No copied towns yet</span>
          </div>
        ) : null}

        {mode === "pair" ? (
          <div className="iugr-copy-field-pair">
            <div className="iugr-copy-field-pair-item">
              <TownMark variant="original" size={40} />
              <span>Original Town</span>
            </div>
            <div className="iugr-copy-field-pair-item">
              <TownMark variant="copy" size={40} />
              <span>Copied town</span>
            </div>
          </div>
        ) : null}

        {mode === "ten" ? (
          <div className="iugr-copy-field-ten">
            <TownMark variant="original" size={30} />
            {Array.from({ length: shownCopies }, (_, i) => (
              <span key={i} className="iugr-copy-field-dot" />
            ))}
            {Array.from({ length: Math.max(0, 9 - shownCopies) }, (_, i) => (
              <span key={`e-${i}`} className="iugr-copy-field-dot is-empty" />
            ))}
          </div>
        ) : null}

        {mode === "hundred" ? (
          <svg className="iugr-copy-field-grid" viewBox="0 0 100 100" aria-hidden>
            <rect
              x="1"
              y="1"
              width="8"
              height="8"
              rx="1.5"
              fill="var(--iugr-accent)"
            />
            {Array.from({ length: shownCopies }, (_, i) => {
              const slot = i + 1;
              const col = slot % 10;
              const row = Math.floor(slot / 10);
              return (
                <rect
                  key={slot}
                  x={1 + col * 10}
                  y={1 + row * 10}
                  width="8"
                  height="8"
                  rx="1.5"
                  fill="var(--iugr-copy-fill)"
                  opacity={0.55 + (i % 5) * 0.08}
                />
              );
            })}
          </svg>
        ) : null}

        {mode === "thousand" ? (
          <div className="iugr-copy-field-thousand">
            <svg className="iugr-copy-field-orbit" viewBox="0 0 200 72" aria-hidden>
              <circle cx="22" cy="36" r="10" fill="var(--iugr-accent)" />
              {Array.from({ length: shownCopies }, (_, i) => {
                const col = i % 12;
                const row = Math.floor(i / 12);
                return (
                  <circle
                    key={i}
                    cx={48 + col * 12}
                    cy={14 + row * 14}
                    r="3.2"
                    fill="var(--iugr-copy-fill)"
                    opacity={0.45 + (i % 7) * 0.07}
                  />
                );
              })}
            </svg>
            <span className="iugr-copy-field-badge">
              {formatWholeNumber(copiedTowns)} copied towns
            </span>
          </div>
        ) : null}
      </div>

      {mode !== "empty" && mode !== "thousand" ? (
        <p className="iugr-copy-field-caption" aria-hidden>
          {mode === "pair"
            ? "1 Original Town · 1 copied town"
            : remainder > 0
              ? `1 Original Town · ${formatWholeNumber(shownCopies)} shown · +${formatWholeNumber(remainder)} more copied towns`
              : `1 Original Town · ${formatWholeNumber(copiedTowns)} copied towns`}
        </p>
      ) : null}

      {mode === "empty" ? (
        <p className="iugr-copy-field-caption" aria-hidden>
          1 Original Town · 0 copied towns
        </p>
      ) : null}

    </div>
  );
}

export function CopyMachineChapter({
  consciousnessPremise,
  copiedTowns,
  hasInteracted,
  reachedNine,
  onCopiedTownsChange,
  onContinue,
  onBack,
  reducedMotion,
}: CopyMachineChapterProps) {
  const sliderId = useId();
  const liveId = useId();
  const [mathOpen, setMathOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [defineOpen, setDefineOpen] = useState(false);

  const census = useMemo(() => computeTownScenario(copiedTowns), [copiedTowns]);
  const narration = useMemo(() => narrationForCopies(copiedTowns), [copiedTowns]);
  const snap = nearestSnapPoint(copiedTowns);


  const setCopies = (raw: number, fromUser: boolean) => {
    const next = Math.max(0, Math.min(999, Math.round(raw)));
    onCopiedTownsChange(next, {
      interacted: fromUser || hasInteracted,
      reachedNine: reachedNine || next >= 9,
    });
  };

  const nudge = (delta: number) => {
    const idx = COPY_SNAP_POINTS.indexOf(snap as CopySnapPoint);
    if (idx >= 0) {
      const nextIdx = Math.max(0, Math.min(COPY_SNAP_POINTS.length - 1, idx + delta));
      setCopies(COPY_SNAP_POINTS[nextIdx], true);
      return;
    }
    setCopies(copiedTowns + delta, true);
  };


  const caveat =
    consciousnessPremise === "unsure"
      ? COPY_MACHINE.caveatUnsure
      : consciousnessPremise === "no"
        ? COPY_MACHINE.caveatNo
        : null;

  const liveText = `${formatWholeNumber(census.copiedTowns)} copied towns. ${narration.headline}${
    narration.detail ? ` ${narration.detail}` : ""
  }`;

  const dialAngle = -90 + (copiedTowns / 999) * 270;
  const dialRad = (dialAngle * Math.PI) / 180;

  return (
    <section
      className="iugr-panel iugr-copy-machine"
      aria-labelledby="iugr-copy-title"
    >
      <div className="iugr-label">{COPY_MACHINE.chapterLabel}</div>
      <h1 id="iugr-copy-title" className="iugr-headline iugr-headline-sm">
        {COPY_MACHINE.title}
      </h1>
      <p className="iugr-lead">{COPY_MACHINE.guideIntro}</p>
      <p className="iugr-copy-disclaimer">{COPY_MACHINE.disclaimer}</p>

      {caveat ? (
        <p className="iugr-copy-caveat" role="note">
          {caveat}
        </p>
      ) : null}

      <div className="iugr-copy-stage">
        <div className="iugr-copy-original-bubble" aria-label="Original Town">
          <svg viewBox="0 0 88 72" width="88" height="72" role="presentation" aria-hidden>
            <ellipse cx="44" cy="58" rx="34" ry="8" fill="var(--iugr-cream)" opacity="0.08" />
            <rect x="18" y="28" width="52" height="28" rx="6" fill="var(--iugr-original-fill)" />
            <rect x="26" y="18" width="14" height="16" rx="2" fill="var(--iugr-original-roof)" />
            <rect x="44" y="14" width="18" height="20" rx="2" fill="var(--iugr-original-roof)" />
            <circle cx="44" cy="42" r="5" fill="var(--iugr-accent)" />
          </svg>
          <span className="iugr-copy-original-badge">Original</span>
          <span className="iugr-copy-original-meta">{PEOPLE_PER_TOWN} residents</span>
        </div>

        <div className="iugr-copy-machine-art" role="group" aria-label={COPY_MACHINE.machineAria}>
          <svg
            className="iugr-copy-machine-svg"
            viewBox="0 0 220 160"
            role="img"
            aria-label="Oversized Copy Machine with lever and dial"
          >
            <rect x="30" y="48" width="160" height="90" rx="18" fill="var(--iugr-machine-body)" />
            <rect x="48" y="64" width="88" height="40" rx="8" fill="var(--iugr-machine-screen)" />
            <text
              x="92"
              y="90"
              textAnchor="middle"
              fill="var(--iugr-cream)"
              fontSize="18"
              fontWeight="700"
              fontFamily="var(--iugr-font), system-ui, sans-serif"
            >
              {formatWholeNumber(copiedTowns)}
            </text>
            <circle
              cx="168"
              cy="84"
              r="22"
              fill="var(--iugr-machine-dial)"
              stroke="var(--iugr-border-strong)"
              strokeWidth="2"
            />
            <line
              x1="168"
              y1="84"
              x2={168 + Math.cos(dialRad) * 14}
              y2={84 + Math.sin(dialRad) * 14}
              stroke="var(--iugr-accent)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <rect
              x="188"
              y={copiedTowns === 0 ? 70 : 40}
              width="14"
              height="56"
              rx="7"
              fill="var(--iugr-coral)"
              className="iugr-copy-lever"
            />
            <circle
              cx="195"
              cy={copiedTowns === 0 ? 70 : 40}
              r="10"
              fill="var(--iugr-coral)"
              opacity="0.85"
            />
          </svg>

          <div className="iugr-copy-controls">
            <label className="iugr-copy-slider-label" htmlFor={sliderId}>
              {COPY_MACHINE.sliderLabel}
            </label>
            <div className="iugr-copy-slider-row">
              <button
                type="button"
                className="iugr-btn iugr-btn-ghost iugr-copy-step"
                onClick={() => nudge(-1)}
                aria-label="Fewer copied towns"
                disabled={copiedTowns <= 0}
              >
                −
              </button>
              <input
                id={sliderId}
                className="iugr-copy-slider"
                type="range"
                min={0}
                max={999}
                step={1}
                value={copiedTowns}
                onChange={(e) => setCopies(Number(e.target.value), true)}
                list={`${sliderId}-snaps`}
                aria-valuemin={0}
                aria-valuemax={999}
                aria-valuenow={copiedTowns}
                aria-valuetext={`${formatWholeNumber(copiedTowns)} copied towns`}
                aria-describedby={liveId}
              />
              <button
                type="button"
                className="iugr-btn iugr-btn-ghost iugr-copy-step"
                onClick={() => nudge(1)}
                aria-label="More copied towns"
                disabled={copiedTowns >= 999}
              >
                +
              </button>
            </div>
            <datalist id={`${sliderId}-snaps`}>
              {COPY_SNAP_POINTS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>

            <div className="iugr-copy-snaps" role="group" aria-label="Quick copy counts">
              {COPY_SNAP_POINTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={[
                    "iugr-copy-snap",
                    copiedTowns === p ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setCopies(p, true)}
                  aria-pressed={copiedTowns === p}
                >
                  {formatWholeNumber(p)}
                </button>
              ))}
            </div>

            <p className="iugr-copy-snap-hint">{COPY_MACHINE.snapHints}</p>

            <div className="iugr-copy-control-actions">
              <button
                type="button"
                className="iugr-btn iugr-btn-ghost"
                onClick={() =>
                  onCopiedTownsChange(0, { interacted: hasInteracted, reachedNine })
                }
              >
                {COPY_MACHINE.resetLabel}
              </button>
              <button
                type="button"
                className="iugr-btn iugr-btn-ghost"
                onClick={() => setMathOpen(true)}
              >
                {COPY_MACHINE.showMath}
              </button>
            </div>
          </div>
        </div>

        <div className="iugr-copy-cluster" aria-label={COPY_MACHINE.clusterAria}>
          <CopyField copiedTowns={copiedTowns} reducedMotion={reducedMotion} />
        </div>
      </div>

      <p id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        {liveText}
      </p>

      {copiedTowns >= 9 ? (
        <p className="iugr-copy-margin-note">
          {COPY_MACHINE.countTransitionNote}
        </p>
      ) : null}

      <div className="iugr-copy-panels">
        <section className="iugr-census" aria-label={COPY_MACHINE.censusTitle}>
          <h2>{COPY_MACHINE.censusTitle}</h2>
          <dl className="iugr-census-grid">
            <div>
              <dt>{COPY_MACHINE.originalTowns}</dt>
              <dd>{census.originalTowns}</dd>
            </div>
            <div>
              <dt>{COPY_MACHINE.copiedTowns}</dt>
              <dd>{formatWholeNumber(census.copiedTowns)}</dd>
            </div>
            <div>
              <dt>{COPY_MACHINE.totalTowns}</dt>
              <dd>{formatWholeNumber(census.totalTowns)}</dd>
            </div>
            <div>
              <dt>{COPY_MACHINE.originalResidents}</dt>
              <dd>{formatWholeNumber(census.originalResidents)}</dd>
            </div>
            <div>
              <dt>{COPY_MACHINE.copiedResidents}</dt>
              <dd>{formatWholeNumber(census.copiedResidents)}</dd>
            </div>
            <div>
              <dt>{COPY_MACHINE.totalResidents}</dt>
              <dd>{formatWholeNumber(census.totalResidents)}</dd>
            </div>
          </dl>
        </section>

        <FractionViz census={census} />
      </div>

      <details
        className="iugr-copy-why"
        open={whyOpen}
        onToggle={(e) => setWhyOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>{COPY_MACHINE.whyAssumption}</summary>
        <p>{COPY_MACHINE.whyAssumptionBody}</p>
      </details>

      {reachedNine ? (
        <div className="iugr-copy-anthropic">
          <p>{COPY_MACHINE.anthropicReveal}</p>
          <details
            open={defineOpen}
            onToggle={(e) => setDefineOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary>What does that mean?</summary>
            <p>{COPY_MACHINE.anthropicDefinition}</p>
          </details>
        </div>
      ) : null}

      <div className="iugr-actions iugr-copy-nav">
        <button type="button" className="iugr-btn iugr-btn-ghost" onClick={onBack}>
          {COPY_MACHINE.previousLabel}
        </button>
        {hasInteracted ? (
          <button type="button" className="iugr-btn iugr-btn-primary" onClick={onContinue}>
            {COPY_MACHINE.continueLabel}
          </button>
        ) : (
          <p className="iugr-copy-continue-hint">Try the Copy Machine once to continue.</p>
        )}
      </div>

      <MathDrawer open={mathOpen} onClose={() => setMathOpen(false)} census={census} />
    </section>
  );
}
