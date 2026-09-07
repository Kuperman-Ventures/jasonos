"use client";

import { TownResidents } from "@/components/iugr/TownResidents";
import type { ConsciousnessPremise } from "@/lib/iugr/types";

type Props = {
  readerFigureIndex: number | null;
  interactive: boolean;
  compact?: boolean;
  secondTown?: boolean;
  premise?: ConsciousnessPremise | null;
  onPick: (index: number) => void;
};

export function TownStage({
  readerFigureIndex,
  interactive,
  compact = false,
  secondTown = false,
  premise = null,
  onPick,
}: Props) {
  const showSecond = secondTown && premise != null;
  const dashed = premise === "unsure";
  const muted = premise === "no";
  const copyPalette = premise === "yes" || premise === "unsure";

  return (
    <div className="iugr-deck-town-stage">
      <TownResidents
        readerFigureIndex={readerFigureIndex}
        interactive={interactive}
        compact={compact}
        readerTick="YOU"
        onSelect={onPick}
      />
      {showSecond ? (
        <div className="iugr-deck-second-town">
          <TownResidents
            readerFigureIndex={readerFigureIndex}
            interactive={false}
            compact
            dashed={dashed}
            muted={muted}
            copyPalette={copyPalette}
            readerTick="YOU"
          />
        </div>
      ) : null}
    </div>
  );
}
