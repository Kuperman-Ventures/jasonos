"use client";

import { useState } from "react";
import { OPENING } from "@/lib/iugr/copy";
import { TownBubble } from "@/components/iugr/TownBubble";

type OpeningStageProps = {
  onBegin: () => void;
};

/**
 * Manual, user-paced opening. No autoplay text.
 * Step 0: title cards + drifting town specimen.
 * Step 1: Original Town intro + Begin CTA.
 */
export function OpeningStage({ onBegin }: OpeningStageProps) {
  const [step, setStep] = useState(0);

  return (
    <section className="iugr-opening" aria-labelledby="iugr-opening-title">
      <div className="iugr-opening-stage">
        <TownBubble className="iugr-town-bubble" />

        <div className="iugr-opening-copy">
          <div className="iugr-label">{OPENING.entryLabel}</div>
          <h1 id="iugr-opening-title" className="iugr-headline">
            {OPENING.title}
          </h1>
          <p className="iugr-subhead">{OPENING.subtitle}</p>

          {step >= 1 ? (
            <div className="iugr-opening-reveal" aria-live="polite">
              <p className="iugr-opening-reveal-title">
                {OPENING.townRevealTitle}
              </p>
              <p>{OPENING.townRevealBody}</p>
            </div>
          ) : null}

          <div className="iugr-actions">
            {step === 0 ? (
              <button
                type="button"
                className="iugr-btn iugr-btn-primary"
                onClick={() => setStep(1)}
              >
                {OPENING.continueLabel}
              </button>
            ) : (
              <button
                type="button"
                className="iugr-btn iugr-btn-primary"
                onClick={onBegin}
              >
                {OPENING.beginLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
