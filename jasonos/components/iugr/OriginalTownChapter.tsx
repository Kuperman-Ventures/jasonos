"use client";

import type { ConsciousnessPremise } from "@/lib/iugr/types";
import { ORIGINAL_TOWN } from "@/lib/iugr/copy";
import { TownScene } from "@/components/iugr/TownScene";
import { CountCard } from "@/components/iugr/CountCard";
import { ConsciousnessPrompt } from "@/components/iugr/ConsciousnessPrompt";

type OriginalTownChapterProps = {
  consciousnessPremise: ConsciousnessPremise | null;
  onSelectPremise: (value: ConsciousnessPremise) => void;
  onOpenGuideSettings: () => void;
  onContinue: () => void;
  onPrevious: () => void;
};

export function OriginalTownChapter({
  consciousnessPremise,
  onSelectPremise,
  onOpenGuideSettings,
  onContinue,
  onPrevious,
}: OriginalTownChapterProps) {
  return (
    <section className="iugr-panel iugr-town-chapter" aria-labelledby="iugr-town-title">
      <div className="iugr-label">Chapter · Original Town</div>
      <h1 id="iugr-town-title" className="iugr-headline iugr-headline-sm">
        Original Town
      </h1>

      <TownScene figureNote={ORIGINAL_TOWN.figureNote} />

      <CountCard
        worlds={1}
        residents={100}
        copies={0}
        worldsLabel={ORIGINAL_TOWN.countWorlds}
        residentsLabel={ORIGINAL_TOWN.countResidents}
        copiesLabel={ORIGINAL_TOWN.countCopies}
        statusLine={ORIGINAL_TOWN.statusLine}
      />

      <div className="iugr-guide-lines">
        <p>{ORIGINAL_TOWN.guideLine1}</p>
        <p>{ORIGINAL_TOWN.guideLine2}</p>
      </div>

      <ConsciousnessPrompt
        value={consciousnessPremise}
        onSelect={onSelectPremise}
        onOpenGuideSettings={onOpenGuideSettings}
        onContinue={onContinue}
      />

      <div className="iugr-actions">
        <button type="button" className="iugr-btn iugr-btn-ghost" onClick={onPrevious}>
          {ORIGINAL_TOWN.previousLabel}
        </button>
      </div>
    </section>
  );
}
