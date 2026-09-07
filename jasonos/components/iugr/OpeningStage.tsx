"use client";

import { OPENING_SCRIPT, TRANSITION_1 } from "@/lib/iugr/script";
import { TownBubble } from "@/components/iugr/TownBubble";
import { TransitionBlock } from "@/components/iugr/TransitionBlock";

type OpeningStageProps = {
  onBegin: () => void;
};

/**
 * Manual, user-paced opening. No autoplay text.
 * Title furniture, approved opening body, Transition 1, then enter the town.
 * Library shelf lives in the chapter menu, not here.
 */
export function OpeningStage({ onBegin }: OpeningStageProps) {
  return (
    <section
      className="iugr-opening"
      data-wash="violet"
      aria-labelledby="iugr-opening-title"
    >
      <div className="iugr-opening-stage">
        <TownBubble className="iugr-town-bubble" />

        <div className="iugr-opening-copy">
          <div className="iugr-label">{OPENING_SCRIPT.entryLabel}</div>
          <h1 id="iugr-opening-title" className="iugr-headline">
            {OPENING_SCRIPT.title}
          </h1>

          <div className="iugr-opening-body">
            {OPENING_SCRIPT.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <TransitionBlock paragraphs={TRANSITION_1} />

          <div className="iugr-actions">
            <button
              type="button"
              className="iugr-btn iugr-btn-primary"
              onClick={onBegin}
            >
              {OPENING_SCRIPT.beginLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
