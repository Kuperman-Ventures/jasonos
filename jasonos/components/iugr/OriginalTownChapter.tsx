"use client";

import { ORIGINAL_TOWN } from "@/lib/iugr/copy";
import { ORIGINAL_TOWN_SCRIPT } from "@/lib/iugr/script";
import { CountCard } from "@/components/iugr/CountCard";
import { Plate } from "@/components/iugr/plate/Plate";
import { PlateAnnotation } from "@/components/iugr/plate/PlateAnnotation";
import { TownResidents } from "@/components/iugr/TownResidents";
import { TownSketch } from "@/components/iugr/TownSketch";

type OriginalTownChapterProps = {
  readerFigureIndex: number | null;
  onSelectReaderFigure: (index: number | null) => void;
  onClearCopiesAreConscious?: () => void;
  reducedMotion: boolean;
  onContinue: () => void;
  onPrevious: () => void;
};

/**
 * Beat 2a — Original Town.
 * Town, 100 figures, census, script copy. Next after a figure is chosen.
 */
export function OriginalTownChapter({
  readerFigureIndex,
  onSelectReaderFigure,
  onClearCopiesAreConscious,
  reducedMotion,
  onContinue,
  onPrevious,
}: OriginalTownChapterProps) {
  const selected = readerFigureIndex != null;

  const handleResidentTap = (index: number) => {
    if (readerFigureIndex === index) {
      onSelectReaderFigure(null);
      onClearCopiesAreConscious?.();
      return;
    }
    onSelectReaderFigure(index);
  };

  return (
    <section
      className={`iugr-panel iugr-town-chapter${reducedMotion ? " is-static" : " is-enter"}`}
      data-wash="violet"
      aria-labelledby="iugr-town-title"
    >
      <div className="iugr-label">Chapter · Original Town</div>
      <h1 id="iugr-town-title" className="iugr-headline iugr-headline-sm">
        Original Town
      </h1>

      {!selected ? (
        <div className="iugr-town-copy">
          {ORIGINAL_TOWN_SCRIPT.beforeSelect.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <p className="iugr-town-copy">{ORIGINAL_TOWN_SCRIPT.afterSelect}</p>
      )}

      <div className="iugr-town-stack">
        <div className="iugr-town-original-layer">
          <Plate
            figureNumber={1}
            caption={ORIGINAL_TOWN.plateCaption}
            captionExtra={
              !selected ? (
                <PlateAnnotation text={ORIGINAL_TOWN.tapHint} />
              ) : null
            }
          >
            <TownSketch />
            <TownResidents
              readerFigureIndex={readerFigureIndex}
              interactive
              onSelect={handleResidentTap}
            />
          </Plate>
        </div>
      </div>

      <CountCard
        worlds={1}
        residents={100}
        copies={0}
        worldsLabel={ORIGINAL_TOWN.countWorlds}
        residentsLabel={ORIGINAL_TOWN.countResidents}
        copiesLabel={ORIGINAL_TOWN.countCopies}
        statusLine={ORIGINAL_TOWN.statusBefore}
        strikeCopies={false}
      />

      <div className="iugr-actions">
        <button
          type="button"
          className="iugr-btn iugr-btn-ghost"
          onClick={onPrevious}
        >
          {ORIGINAL_TOWN.previousLabel}
        </button>
        <button
          type="button"
          className="iugr-btn iugr-btn-primary"
          onClick={onContinue}
          disabled={!selected}
        >
          {ORIGINAL_TOWN_SCRIPT.nextLabel}
        </button>
      </div>
    </section>
  );
}
