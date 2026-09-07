"use client";

import {
  APPARATUS,
  dialNeedleAngle,
  leverCyForCount,
} from "@/lib/iugr/copyMachine";
import { formatWholeNumber } from "@/lib/iugr/scenarioMath";

type CopyMachineStageProps = {
  copies: number;
  showLever: boolean;
  silent: boolean;
  leverArmed: boolean;
  reducedMotion: boolean;
  onPull: () => void;
  leverLiveId: string;
};

/** Dot field: one chartreuse town + coral copies. Grows with count. */
function DotField({ copies }: { copies: number }) {
  const total = Math.min(1000, 1 + Math.max(0, copies));
  const isDense = total > 100;
  const cols = isDense ? 40 : total <= 10 ? Math.min(total, 10) : 20;
  const rows = Math.ceil(total / cols);
  const cell = isDense ? 7.2 : total <= 10 ? 18 : 14;
  const origin = 8;
  const r = isDense ? 2.2 : total <= 10 ? 5.5 : 4;
  const readerR = isDense ? 2.8 : total <= 10 ? 6.5 : 5;
  const viewW = origin * 2 + (cols - 1) * cell;
  const viewH = origin * 2 + Math.max(0, rows - 1) * cell;

  return (
    <svg
      className="iugr-deck-dot-field"
      viewBox={`0 0 ${viewW} ${Math.max(viewH, origin * 2)}`}
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

/**
 * Copy Machine stage: machine drawing + real lever button + dot field.
 * Lever is a real <button> on the opted-in pointer layer — never an SVG shape.
 * Count row lives in the text area (shell), not here.
 */
export function CopyMachineStage({
  copies,
  showLever,
  silent,
  leverArmed,
  reducedMotion,
  onPull,
  leverLiveId,
}: CopyMachineStageProps) {
  const knobCy = leverCyForCount(copies);
  const angleDeg = dialNeedleAngle(copies);
  const angleRad = (angleDeg * Math.PI) / 180;
  const needleX =
    APPARATUS.dialCx + Math.cos(angleRad) * APPARATUS.dialNeedleLength;
  const needleY =
    APPARATUS.dialCy + Math.sin(angleRad) * APPARATUS.dialNeedleLength;

  const trackTop = 12;
  const trackBottom = 120;
  const knobTop =
    trackTop + ((knobCy - 26) / (78 - 26)) * (trackBottom - trackTop);

  return (
    <div
      className={[
        "iugr-deck-stage-copy",
        silent ? "is-silent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
              className={
                reducedMotion
                  ? "iugr-deck-dial-needle is-static"
                  : "iugr-deck-dial-needle"
              }
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
              "iugr-deck-lever",
              leverArmed ? "is-armed" : "is-idle",
              reducedMotion ? "is-static" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!leverArmed}
            aria-label={`Lever. Copied towns: ${formatWholeNumber(copies)}.${
              leverArmed ? " Tap to pull to the next stop." : ""
            }`}
            aria-describedby={leverLiveId}
            onClick={(e) => {
              e.stopPropagation();
              if (!leverArmed) return;
              onPull();
            }}
          >
            <span className="iugr-deck-lever-track" aria-hidden />
            {[0, 1, 9, 99, 999].map((stop) => {
              const cy = leverCyForCount(stop);
              const top =
                trackTop +
                ((cy - 26) / (78 - 26)) * (trackBottom - trackTop);
              return (
                <span
                  key={stop}
                  className="iugr-deck-lever-stop"
                  style={{ top: `${top}px` }}
                  data-stop={stop}
                  aria-hidden
                />
              );
            })}
            <span
              className={[
                "iugr-deck-lever-knob",
                leverArmed ? "is-armed" : "",
                reducedMotion ? "is-static" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ top: `${knobTop}px` }}
              aria-hidden
            />
          </button>
        ) : null}
      </div>

      <div className="iugr-deck-field-wrap">
        <DotField copies={copies} />
      </div>
    </div>
  );
}
