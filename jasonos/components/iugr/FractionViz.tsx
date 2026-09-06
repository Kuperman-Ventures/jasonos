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

/**
 * Single horizontal proportion bar for original vs copied share.
 * Replaces the duplicate 10×10 / token grids that competed with Copy Field.
 */
export function FractionViz({ census }: FractionVizProps) {
  const copies = census.copiedTowns;
  const shareLabel = formatSharePercent(census.copiedShare);
  const copiedPct = Math.max(0, Math.min(100, census.copiedShare * 100));
  const originalPct = copies === 0 ? 100 : Math.max(0, 100 - copiedPct);

  const summary =
    copies === 0
      ? "Visual fraction: all residents are in Original Town."
      : `Visual fraction: ${shareLabel} of residents are in copied towns (${formatWholeNumber(copies)} copied towns vs 1 original).`;

  return (
    <section className="iugr-fraction" aria-label={COPY_MACHINE.fractionTitle}>
      <div className="iugr-fraction-head">
        <h3>{COPY_MACHINE.fractionTitle}</h3>
        <p className="iugr-fraction-value" aria-hidden>
          {shareLabel}
        </p>
      </div>
      <p className="sr-only">{summary}</p>

      {copies === 0 ? (
        <div className="iugr-fraction-bar-empty" aria-hidden>
          <span className="iugr-fraction-swatch iugr-fraction-swatch-original" />
          <span>One town · all original</span>
        </div>
      ) : (
        <div className="iugr-fraction-bar" aria-hidden>
          <span
            className="iugr-fraction-bar-original"
            style={{ width: `${originalPct}%` }}
          />
          <span
            className="iugr-fraction-bar-copy"
            style={{ width: `${copiedPct}%` }}
          />
        </div>
      )}

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
