"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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

function CopyToken({
  index,
  printing,
  reducedMotion,
}: {
  index: number;
  printing: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div
      className={[
        "iugr-copy-token",
        printing && !reducedMotion ? "is-printing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ["--token-i" as string]: index }}
      aria-hidden
    >
      <svg viewBox="0 0 48 40" width="48" height="40" role="presentation">
        <rect x="4" y="10" width="40" height="24" rx="6" fill="var(--iugr-copy-fill)" />
        <rect
          x="10"
          y="16"
          width="8"
          height="10"
          rx="1.5"
          fill="var(--iugr-cream-muted)"
          opacity="0.35"
        />
        <rect
          x="20"
          y="16"
          width="8"
          height="10"
          rx="1.5"
          fill="var(--iugr-cream-muted)"
          opacity="0.35"
        />
        <rect
          x="30"
          y="16"
          width="8"
          height="10"
          rx="1.5"
          fill="var(--iugr-cream-muted)"
          opacity="0.35"
        />
        <circle cx="24" cy="8" r="3" fill="var(--iugr-copy-accent)" />
      </svg>
      <span>Copy</span>
    </div>
  );
}

function AggregatedCopies({ count }: { count: number }) {
  return (
    <div className="iugr-copy-aggregate" aria-hidden>
      <svg viewBox="0 0 120 88" width="120" height="88" role="presentation">
        <rect
          x="8"
          y="18"
          width="72"
          height="52"
          rx="10"
          fill="var(--iugr-copy-fill)"
          opacity="0.45"
        />
        <rect
          x="20"
          y="12"
          width="72"
          height="52"
          rx="10"
          fill="var(--iugr-copy-fill)"
          opacity="0.7"
        />
        <rect x="32" y="6" width="72" height="52" rx="10" fill="var(--iugr-copy-fill)" />
        <text
          x="68"
          y="38"
          textAnchor="middle"
          fill="var(--iugr-ink)"
          fontSize="16"
          fontWeight="700"
          fontFamily="var(--iugr-font), system-ui, sans-serif"
        >
          ×{formatWholeNumber(count)}
        </text>
      </svg>
      <span className="iugr-copy-aggregate-label">
        {formatWholeNumber(count)} copied towns
      </span>
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
  const [printingIndex, setPrintingIndex] = useState<number | null>(null);
  const prevCopies = useRef(copiedTowns);

  const census = useMemo(() => computeTownScenario(copiedTowns), [copiedTowns]);
  const narration = useMemo(() => narrationForCopies(copiedTowns), [copiedTowns]);
  const snap = nearestSnapPoint(copiedTowns);

  useEffect(() => {
    if (copiedTowns > prevCopies.current && !reducedMotion) {
      setPrintingIndex(copiedTowns);
      const t = window.setTimeout(() => setPrintingIndex(null), 520);
      prevCopies.current = copiedTowns;
      return () => window.clearTimeout(t);
    }
    prevCopies.current = copiedTowns;
  }, [copiedTowns, reducedMotion]);

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

  const visibleTokens = Math.min(copiedTowns, 9);
  const overflow = Math.max(0, copiedTowns - 9);

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
          {copiedTowns === 0 ? (
            <p className="iugr-copy-cluster-empty">No copies yet. Pull the count up.</p>
          ) : null}
          {visibleTokens > 0 ? (
            <div className="iugr-copy-token-grid">
              {Array.from({ length: visibleTokens }, (_, i) => (
                <CopyToken
                  key={i}
                  index={i}
                  printing={
                    printingIndex === i + 1 ||
                    (printingIndex === copiedTowns && i === visibleTokens - 1)
                  }
                  reducedMotion={reducedMotion}
                />
              ))}
            </div>
          ) : null}
          {overflow > 0 ? <AggregatedCopies count={copiedTowns} /> : null}
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
