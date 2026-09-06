"use client";

import type { ChapterId, GuideId } from "@/lib/iugr/types";
import { stageAside } from "@/lib/iugr/copy";
import {
  getChapter,
  nextChapterId,
  prevChapterId,
} from "@/lib/iugr/episodes";

type ChapterPlaceholderProps = {
  chapterId: ChapterId;
  guideId: GuideId;
  onNavigate: (id: ChapterId) => void;
};

export function ChapterPlaceholder({
  chapterId,
  guideId,
  onNavigate,
}: ChapterPlaceholderProps) {
  const chapter = getChapter(chapterId);
  const prev = prevChapterId(chapterId);
  const next = nextChapterId(chapterId);
  const { placeholder } = chapter;
  const isOpening = chapterId === "opening";

  return (
    <section className="iugr-panel" aria-labelledby="iugr-chapter-title">
      {placeholder.kicker ? (
        <div className="iugr-label">{placeholder.kicker}</div>
      ) : (
        <div className="iugr-label">Chapter · {chapter.title}</div>
      )}

      <h1 id="iugr-chapter-title" className="iugr-headline">
        {placeholder.headline}
      </h1>

      <div className="iugr-body">
        {placeholder.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <p className="iugr-aside">{stageAside(guideId)}</p>

      <div className="iugr-actions">
        {isOpening && placeholder.ctaLabel ? (
          <button
            type="button"
            className="iugr-btn iugr-btn-primary"
            onClick={() => {
              if (next) onNavigate(next);
            }}
          >
            {placeholder.ctaLabel}
          </button>
        ) : null}

        {!isOpening && prev ? (
          <button
            type="button"
            className="iugr-btn iugr-btn-ghost"
            onClick={() => onNavigate(prev)}
          >
            Previous
          </button>
        ) : null}

        {!isOpening && next ? (
          <button
            type="button"
            className="iugr-btn iugr-btn-primary"
            onClick={() => onNavigate(next)}
          >
            Continue
          </button>
        ) : null}

        {!isOpening && !next ? (
          <button
            type="button"
            className="iugr-btn iugr-btn-ghost"
            onClick={() => onNavigate("opening")}
          >
            Return to opening
          </button>
        ) : null}
      </div>
    </section>
  );
}
