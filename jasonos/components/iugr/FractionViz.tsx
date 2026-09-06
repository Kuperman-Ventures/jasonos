"use client";

import { COPY_MACHINE } from "@/lib/iugr/copy";
import {
  formatSharePercent,
  formatWholeNumber,
  type TownScenarioCensus,
} from "@/lib/iugr/scenarioMath";

type FractionVizProps = {
  census: TownScenarioCensus;
};

export function FractionViz({ census }: FractionVizProps) {
  const copies = census.copiedTowns;
  const shareLabel = formatSharePercent(census.copiedShare);

  let mode: "ten" | "hundred" | "thousand" | "empty" = "empty";
  if (copies === 0) mode = "empty";
  else if (copies <= 9) mode = "ten";
  else if (copies <= 99) mode = "hundred";
  else mode = "thousand";

  const totalSlots =
    mode === "ten" ? 10 : mode === "hundred" ? 100 : mode === "thousand" ? 1000 : 1;
  const copiedSlots = Math.min(copies, totalSlots - 1);
  const originalSlots = mode === "empty" ? 0 : 1;

  const summary =
    mode === "empty"
      ? "Visual fraction: all residents are in Original Town."
      : mode === "ten"
        ? `Visual fraction: 1 original part and ${copiedSlots} copied parts out of 10.`
        : mode === "hundred"
          ? `Visual fraction: condensed 10-by-10 grid standing in for 100 towns — 1 original and ${formatWholeNumber(copies)} copied.`
          : `Visual fraction: condensed summary for 1,000 towns — 1 original and ${formatWholeNumber(copies)} copied (${shareLabel} copied-town share).`;

  return (
    <section className="iugr-fraction" aria-label={COPY_MACHINE.fractionTitle}>
      <div className="iugr-fraction-head">
        <h3>{COPY_MACHINE.fractionTitle}</h3>
        <p className="iugr-fraction-value" aria-hidden>
          {shareLabel}
        </p>
      </div>
      <p className="sr-only">{summary}</p>

      {mode === "empty" ? (
        <div className="iugr-fraction-empty" aria-hidden>
          <span className="iugr-fraction-dot iugr-fraction-dot-original" />
          <span>One town · all original</span>
        </div>
      ) : null}

      {mode === "ten" ? (
        <div className="iugr-fraction-ten" aria-hidden>
          <span className="iugr-fraction-dot iugr-fraction-dot-original" title="Original" />
          {Array.from({ length: copiedSlots }, (_, i) => (
            <span
              key={`c-${i}`}
              className="iugr-fraction-dot iugr-fraction-dot-copy"
              title="Copied"
            />
          ))}
          {Array.from(
            { length: Math.max(0, 10 - originalSlots - copiedSlots) },
            (_, i) => (
              <span key={`e-${i}`} className="iugr-fraction-dot iugr-fraction-dot-empty" />
            ),
          )}
        </div>
      ) : null}

      {mode === "hundred" ? (
        <div className="iugr-fraction-grid" aria-hidden>
          <span className="iugr-fraction-cell iugr-fraction-cell-original" />
          {Array.from({ length: Math.min(copiedSlots, 99) }, (_, i) => (
            <span key={`g-${i}`} className="iugr-fraction-cell iugr-fraction-cell-copy" />
          ))}
        </div>
      ) : null}

      {mode === "thousand" ? (
        <div className="iugr-fraction-thousand" aria-hidden>
          <div className="iugr-fraction-thousand-bar">
            <span className="iugr-fraction-thousand-original" />
            <span
              className="iugr-fraction-thousand-copy"
              style={{ width: `${Math.min(99.9, census.copiedShare * 100)}%` }}
            />
          </div>
          <p className="iugr-fraction-thousand-label">
            1,000-town summary · {shareLabel} in copied towns
          </p>
        </div>
      ) : null}

      <ul className="iugr-fraction-legend">
        <li>
          <span className="iugr-fraction-swatch iugr-fraction-swatch-original" aria-hidden />
          {COPY_MACHINE.legendOriginal}
        </li>
        <li>
          <span className="iugr-fraction-swatch iugr-fraction-swatch-copy" aria-hidden />
          {COPY_MACHINE.legendCopied}
        </li>
      </ul>
    </section>
  );
}
