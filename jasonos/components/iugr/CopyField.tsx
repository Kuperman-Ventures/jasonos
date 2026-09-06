"use client";

import { Plate } from "@/components/iugr/plate/Plate";
import { PLATE_CAPTIONS } from "@/lib/iugr/copyMachine";
import type { ConsciousnessPremise } from "@/lib/iugr/types";

type CopyFieldProps = {
  copiedTowns: number;
  readerFigureIndex: number | null;
  consciousnessPremise: ConsciousnessPremise | null;
  reducedMotion: boolean;
};

type MachineResidentProps = {
  role: "ordinary" | "reader" | "copy" | "copy-reader";
  outlineOnly?: boolean;
  width?: number;
  index?: number;
  className?: string;
};

/**
 * Part 6 resident mark for Copy Machine town rows and count cards.
 * Geometry is exact — do not reshape to match Original Town.
 */
export function MachineResident({
  role,
  outlineOnly = false,
  width = 21,
  index = 0,
  className,
}: MachineResidentProps) {
  const isReader = role === "reader" || role === "copy-reader";
  const filled = isReader && !outlineOnly;

  return (
    <span
      className={[
        "iugr-machine-resident",
        `is-${role}`,
        outlineOnly ? "is-outline" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-index={index}
      style={{ width }}
      aria-hidden
    >
      <svg
        className="iugr-machine-resident-svg"
        viewBox="0 0 16 36"
        width={width}
        height={(width * 36) / 16}
      >
        <circle
          className="iugr-machine-resident-mark"
          cx="8"
          cy="5.4"
          r="3.5"
          fill={filled ? "currentColor" : "none"}
        />
        <line
          className="iugr-machine-resident-mark"
          x1="3.9"
          y1="12.4"
          x2="12.1"
          y2="12.4"
        />
        <path
          className="iugr-machine-resident-mark"
          d="M4.3 13 L3.4 33.4 L12.6 33.4 L11.7 13 Z"
          fill={filled ? "currentColor" : "none"}
        />
      </svg>
      {isReader ? (
        <span className="iugr-machine-resident-tick">YOU</span>
      ) : null}
    </span>
  );
}

function TownRow({
  variant,
  readerFigureIndex,
  outlineOnly,
  stagger,
  reducedMotion,
}: {
  variant: "original" | "copy";
  readerFigureIndex: number | null;
  outlineOnly?: boolean;
  stagger?: boolean;
  reducedMotion: boolean;
}) {
  const readerIdx = readerFigureIndex ?? 0;
  return (
    <div
      className={[
        "iugr-copy-town-row",
        `is-${variant}`,
        stagger && !reducedMotion ? "is-stagger" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      {Array.from({ length: 10 }, (_, i) => {
        const isReader = i === readerIdx;
        const role =
          variant === "original"
            ? isReader
              ? "reader"
              : "ordinary"
            : isReader
              ? "copy-reader"
              : "copy";
        return (
          <MachineResident
            key={i}
            role={role}
            outlineOnly={variant === "copy" ? outlineOnly : false}
            index={i}
          />
        );
      })}
    </div>
  );
}

function ModeA({
  copiedTowns,
  readerFigureIndex,
  outlineOnly,
  reducedMotion,
}: {
  copiedTowns: number;
  readerFigureIndex: number | null;
  outlineOnly: boolean;
  reducedMotion: boolean;
}) {
  return (
    <Plate figureNumber={3} caption={PLATE_CAPTIONS.apparatus}>
      <ApparatusGlyph />
      <div className="iugr-copy-plate-hairline" aria-hidden />
      <TownRow
        variant="original"
        readerFigureIndex={readerFigureIndex}
        reducedMotion={reducedMotion}
      />
      {copiedTowns >= 1 ? (
        <>
          <div className="iugr-copy-town-divider" aria-hidden>
            <span className="iugr-copy-town-divider-rule" />
            <span className="iugr-copy-town-divider-label">COPIED TOWN 01</span>
            <span className="iugr-copy-town-divider-rule" />
          </div>
          <TownRow
            variant="copy"
            readerFigureIndex={readerFigureIndex}
            outlineOnly={outlineOnly}
            stagger
            reducedMotion={reducedMotion}
          />
        </>
      ) : null}
    </Plate>
  );
}

function ModeB({
  outlineOnly,
  reducedMotion,
}: {
  outlineOnly: boolean;
  reducedMotion: boolean;
}) {
  return (
    <Plate figureNumber={4} caption={PLATE_CAPTIONS.count}>
      <div className="iugr-copy-count-mode">
        <div className="iugr-copy-count-original">
          <MachineResident
            role="reader"
            width={24}
            outlineOnly={false}
          />
          <span className="iugr-copy-count-original-label">
            ORIGINAL
            <br />
            TOWN
          </span>
        </div>
        <div
          className={[
            "iugr-copy-count-grid",
            !reducedMotion ? "is-stagger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="iugr-copy-count-card" data-index={i}>
              <MachineResident
                role="copy-reader"
                width={15}
                outlineOnly={outlineOnly}
                index={i}
              />
              <span className="iugr-copy-count-card-label">
                C{String(i + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="iugr-copy-count-rule" aria-hidden>
        TEN OF THEM ARE YOU
      </p>
    </Plate>
  );
}

function ModeC({
  copiedTowns,
}: {
  copiedTowns: number;
}) {
  const is999 = copiedTowns >= 999;
  const cols = is999 ? 40 : 20;
  const rows = is999 ? 25 : 5;
  const cell = is999 ? 8.2 : 16;
  const origin = 8;
  const r = is999 ? 2.5 : 5;
  const readerR = is999 ? 3.2 : 6.4;
  const ringR = is999 ? 6.4 : 10;
  const viewH = is999 ? 208 : 96;
  const caption = is999 ? PLATE_CAPTIONS.field1000 : PLATE_CAPTIONS.field100;
  const total = cols * rows;
  const readerCx = origin + 0 * cell;
  const readerCy = origin + 0 * cell;

  return (
    <Plate figureNumber={5} caption={caption}>
      <svg
        className="iugr-copy-field-dots"
        viewBox={`0 0 328 ${viewH}`}
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
              <g key="reader">
                <circle
                  cx={readerCx}
                  cy={readerCy}
                  r={ringR}
                  fill="none"
                  stroke="#C8F04A"
                  strokeWidth="1.2"
                />
                <circle cx={readerCx} cy={readerCy} r={readerR} fill="#C8F04A" />
                <line
                  x1={readerCx + ringR}
                  y1={readerCy}
                  x2={readerCx + ringR + 18}
                  y2={readerCy}
                  stroke="#C8F04A"
                  strokeWidth="1"
                />
                <text
                  x={readerCx + ringR + 22}
                  y={readerCy + 3}
                  className="iugr-copy-field-your-town"
                >
                  YOUR TOWN
                </text>
              </g>
            );
          }
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="rgba(232,131,111,0.62)"
            />
          );
        })}
      </svg>
    </Plate>
  );
}

function ApparatusGlyph() {
  return (
    <svg
      className="iugr-copy-apparatus-inline"
      viewBox="0 0 300 118"
      width="100%"
      aria-hidden
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
        <line x1="228" y1="20" x2="228" y2="84" />
        <line x1="222" y1="20" x2="234" y2="20" />
      </g>
    </svg>
  );
}

/**
 * Three display modes by count — the plate progression is the point.
 * Lives at components/iugr/CopyField.tsx (extracted from the chapter;
 * there was no separate file before this rebuild).
 */
export function CopyField({
  copiedTowns,
  readerFigureIndex,
  consciousnessPremise,
  reducedMotion,
}: CopyFieldProps) {
  const outlineOnly = consciousnessPremise === "no";

  if (copiedTowns >= 99) {
    return <ModeC copiedTowns={copiedTowns} />;
  }
  if (copiedTowns >= 9) {
    return (
      <ModeB outlineOnly={outlineOnly} reducedMotion={reducedMotion} />
    );
  }
  return (
    <ModeA
      copiedTowns={copiedTowns}
      readerFigureIndex={readerFigureIndex}
      outlineOnly={outlineOnly}
      reducedMotion={reducedMotion}
    />
  );
}
