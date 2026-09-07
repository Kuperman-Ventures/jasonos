"use client";

import { useState } from "react";
import {
  APPARATUS,
  COUNT_ROW,
  dialNeedleAngle,
  formatCopiedShareLabel,
} from "@/lib/iugr/copyMachine";
import { formatWholeNumber } from "@/lib/iugr/scenarioMath";
import { useCountUp } from "@/lib/iugr/useCountUp";
import type { ConsciousnessPremise } from "@/lib/iugr/types";
import { PULL_BODY, PULL_BODY_NO, PULL_BODY_UNSURE } from "@/lib/iugr/deck";

/** Rest ≈14°, pull ≈86° from vertical-up (CSS rotate, clockwise positive). */
const ARM_REST_DEG = -14;
const ARM_PULL_DEG = 86;
const PULL_MS = 280;
const RETURN_MS = 320;

type Props = {
  copies: number;
  showCounts: boolean;
  showLever: boolean;
  silent: boolean;
  leverArmed: boolean;
  leverDone: boolean;
  challengePips: number;
  premise: ConsciousnessPremise | null;
  reducedMotion: boolean;
  onPull: () => void;
  leverLiveId: string;
  showChallenge?: boolean;
};

function DotField({ copies }: { copies: number }) {
  const total = Math.min(1000, 1 + Math.max(0, copies));
  const isDense = total > 100;
  const cols = isDense ? 40 : total <= 10 ? Math.min(total, 10) : 20;
  const rows = Math.ceil(total / cols);
  const cell = isDense ? 7.2 : total <= 10 ? 18 : 14;
  const origin = 8;
  const r = isDense ? 2.2 : total <= 10 ? 5.5 : 4;
  const readerR = isDense ? 2.8 : total <= 10 ? 6.5 : 5;
  const viewW = origin * 2 + Math.max(0, cols - 1) * cell;
  const viewH = origin * 2 + Math.max(0, rows - 1) * cell;

  return (
    <svg
      className="iugr-deck-dot-field"
      viewBox={`0 0 ${Math.max(viewW, 40)} ${Math.max(viewH, 24)}`}
      width="100%"
      aria-hidden
    >
      {Array.from({ length: total }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = origin + col * cell;
        const cy = origin + row * cell;
        if (i === 0) {
          return (
            <circle key="reader" cx={cx} cy={cy} r={readerR} fill="#C8F04A" />
          );
        }
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="rgba(232,131,111,0.72)"
          />
        );
      })}
    </svg>
  );
}

function CountRow({
  copies,
  reducedMotion,
  premise,
}: {
  copies: number;
  reducedMotion: boolean;
  premise: ConsciousnessPremise | null;
}) {
  const displayCopies = useCountUp(copies * 100, reducedMotion);
  const shareLabel = formatCopiedShareLabel(copies);
  const muted = copies === 0;
  const strike = premise === "no";
  const originalShare = copies === 0 ? 100 : 100 / (1 + copies);
  const copyShare = 100 - originalShare;

  return (
    <div className="iugr-deck-count-row">
      <div className="iugr-deck-count-groups">
        <div className="iugr-deck-count-group">
          <span className="iugr-deck-count-label">{COUNT_ROW.originals}</span>
          <span className="iugr-deck-count-value is-chartreuse">100</span>
        </div>
        <div className="iugr-deck-count-group">
          <span className="iugr-deck-count-label">{COUNT_ROW.copies}</span>
          <span
            className={[
              "iugr-deck-count-value",
              muted ? "is-muted" : "is-coral",
              strike ? "is-struck" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {formatWholeNumber(displayCopies)}
          </span>
        </div>
        <div className="iugr-deck-count-group">
          <span className="iugr-deck-count-label">{COUNT_ROW.copiedShare}</span>
          <span
            className={[
              "iugr-deck-count-value",
              muted ? "is-muted" : "is-coral",
              strike ? "is-struck" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {shareLabel}
          </span>
        </div>
      </div>
      <div className="iugr-deck-proportion" aria-hidden>
        <span
          className="iugr-deck-proportion-original"
          style={{ width: `${originalShare}%` }}
        />
        <span
          className="iugr-deck-proportion-copy"
          style={{ width: `${copyShare}%` }}
        />
      </div>
    </div>
  );
}

function ChallengeStrip({ copies }: { copies: number }) {
  if (copies >= 9) {
    return (
      <div className="iugr-deck-challenge is-done">
        <span className="iugr-deck-challenge-label">CHALLENGE COMPLETE</span>
        <span className="iugr-deck-challenge-text">
          Copies of you now outnumber the originals.
        </span>
        <span className="iugr-deck-pips" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="iugr-deck-pip is-on" />
          ))}
        </span>
      </div>
    );
  }
  if (copies === 1) {
    return (
      <div className="iugr-deck-challenge">
        <span className="iugr-deck-challenge-label">
          CHALLENGE - EVEN, NOT YET A MAJORITY
        </span>
        <span className="iugr-deck-challenge-text">
          Pull the lever until the copies outnumber the originals.
        </span>
        <span className="iugr-deck-pips" aria-hidden>
          <span className="iugr-deck-pip is-on" />
          <span className="iugr-deck-pip" />
          <span className="iugr-deck-pip" />
          <span className="iugr-deck-pip" />
        </span>
      </div>
    );
  }
  return (
    <div className="iugr-deck-challenge">
      <span className="iugr-deck-challenge-label">CHALLENGE</span>
      <span className="iugr-deck-challenge-text">
        Pull the lever until the copies outnumber the originals.
      </span>
      <span className="iugr-deck-pips" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="iugr-deck-pip" />
        ))}
      </span>
    </div>
  );
}

export function pullBodyLines(
  copies: number,
  premise: ConsciousnessPremise | null,
): string[] {
  if (premise === "no") return [PULL_BODY_NO];
  const main = PULL_BODY[copies] ?? PULL_BODY[0]!;
  if (premise === "unsure") return [main, PULL_BODY_UNSURE];
  return [main];
}

/**
 * Machine + rotating slot-machine arm + dot field.
 * Arm rotates about the pivot; it does not translate. Springs back to rest.
 */
export function CopyMachineStage({
  copies,
  showCounts,
  showLever,
  silent,
  leverArmed,
  leverDone,
  challengePips,
  premise,
  reducedMotion,
  onPull,
  leverLiveId,
  showChallenge = false,
}: Props) {
  const [armDeg, setArmDeg] = useState(ARM_REST_DEG);
  const [pulling, setPulling] = useState(false);

  const angleDeg = dialNeedleAngle(copies);
  const angleRad = (angleDeg * Math.PI) / 180;
  const needleX =
    APPARATUS.dialCx + Math.cos(angleRad) * APPARATUS.dialNeedleLength;
  const needleY =
    APPARATUS.dialCy + Math.sin(angleRad) * APPARATUS.dialNeedleLength;

  const firePull = () => {
    if (!leverArmed || leverDone || pulling) return;
    setPulling(true);
    setArmDeg(ARM_PULL_DEG);
    const down = reducedMotion ? 0 : PULL_MS;
    const back = reducedMotion ? 0 : RETURN_MS;
    window.setTimeout(() => {
      onPull();
      window.setTimeout(() => {
        setArmDeg(ARM_REST_DEG);
        setPulling(false);
      }, back);
    }, down);
  };

  return (
    <div
      className={[
        "iugr-deck-stage-copy",
        silent ? "is-silent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!silent && showChallenge ? <ChallengeStrip copies={copies} /> : null}

      <div className="iugr-deck-machine-row">
        <div className="iugr-deck-machine-wrap" aria-hidden>
          <svg
            className="iugr-deck-machine"
            viewBox={APPARATUS.viewBox}
            width="100%"
          >
            <g
              fill="none"
              stroke="#F2EDE3"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            >
              <rect x="52" y="16" width="150" height="72" rx="5" />
              <circle cx="79" cy="42" r="11" />
              <line x1="102" y1="34" x2="186" y2="34" />
              <line x1="102" y1="42" x2="186" y2="42" />
              <line x1="102" y1="50" x2="186" y2="50" />
              <path d="M84 88 L96 102 L158 102 L170 88" />
            </g>
            <line
              x1={APPARATUS.dialCx}
              y1={APPARATUS.dialCy}
              x2={needleX}
              y2={needleY}
              stroke="#C8F04A"
              strokeWidth="1.4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {showLever ? (
          <button
            type="button"
            className={[
              "iugr-deck-lever-arm",
              leverArmed && !leverDone ? "is-armed" : "is-idle",
              leverDone ? "is-done" : "",
              reducedMotion ? "is-static" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={leverDone || !leverArmed}
            style={
              leverDone || !leverArmed
                ? { pointerEvents: "none" }
                : undefined
            }
            aria-label={`Copy machine lever. Copied towns: ${formatWholeNumber(copies)}.${
              leverArmed && !leverDone ? " Tap to pull." : ""
            }`}
            aria-describedby={leverLiveId}
            onClick={(e) => {
              e.stopPropagation();
              firePull();
            }}
          >
            <span
              className="iugr-deck-arm"
              style={{
                transform: `rotate(${armDeg}deg)`,
                transition: reducedMotion
                  ? "none"
                  : `transform ${pulling && armDeg === ARM_PULL_DEG ? PULL_MS : RETURN_MS}ms ease`,
              }}
              aria-hidden
            >
              <span className="iugr-deck-arm-shaft" />
              <span
                className={[
                  "iugr-deck-arm-ball",
                  leverArmed && !leverDone && !reducedMotion
                    ? "is-pulse"
                    : "",
                  leverArmed && !leverDone && reducedMotion
                    ? "is-pulse-static"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </span>
          </button>
        ) : null}
      </div>

      <div className="iugr-deck-field-wrap">
        <DotField copies={copies} />
      </div>

      {showCounts && !silent ? (
        <CountRow
          copies={copies}
          reducedMotion={reducedMotion}
          premise={premise}
        />
      ) : null}

      {/* challengePips reserved for authored stage; strip derives from copies */}
      <span className="sr-only" aria-hidden>
        {challengePips}
      </span>
    </div>
  );
}
