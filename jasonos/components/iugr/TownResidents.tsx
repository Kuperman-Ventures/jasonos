"use client";

import { ResidentFigure } from "@/components/iugr/plate/ResidentFigure";

export const RESIDENT_COUNT = 100;

/** Deterministic height scale in [0.92, 1.08] from figure index. */
export function figureHeightScale(index: number): number {
  const step = (index * 7 + 3) % 9; // 0..8
  return 0.92 + step * 0.02;
}

type TownResidentsProps = {
  readerFigureIndex: number | null;
  interactive: boolean;
  dashed?: boolean;
  muted?: boolean;
  copyPalette?: boolean;
  readerTick?: string;
  compact?: boolean;
  onSelect?: (index: number) => void;
};

export function TownResidents({
  readerFigureIndex,
  interactive,
  dashed,
  muted,
  copyPalette,
  readerTick,
  compact = false,
  onSelect,
}: TownResidentsProps) {
  return (
    <div
      className={[
        "iugr-town-residents",
        compact ? "is-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Array.from({ length: RESIDENT_COUNT }, (_, index) => {
        const isReader = readerFigureIndex === index;
        const scale = figureHeightScale(index);
        const figure = (
          <ResidentFigure
            variant={compact ? "token" : "full"}
            isReader={isReader}
            index={index}
            dashed={dashed}
            muted={muted}
            copyPalette={copyPalette}
            selectable={interactive && !isReader}
            tickLabel={isReader ? readerTick : undefined}
            heightScale={scale}
          />
        );

        if (!interactive) {
          return (
            <div
              key={index}
              className="iugr-town-resident-slot"
              aria-hidden
              style={{ ["--figure-scale" as string]: String(scale) }}
            >
              {figure}
            </div>
          );
        }

        return (
          <button
            key={index}
            type="button"
            className="iugr-town-resident-btn"
            data-selected={isReader ? "true" : "false"}
            style={{ ["--figure-scale" as string]: String(scale) }}
            aria-label={
              isReader
                ? `Resident ${index + 1} of ${RESIDENT_COUNT}. Selected as yourself. Tap to deselect.`
                : `Resident ${index + 1} of ${RESIDENT_COUNT}. Select as yourself.`
            }
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
