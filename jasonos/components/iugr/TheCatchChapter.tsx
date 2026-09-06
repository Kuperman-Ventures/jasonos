"use client";

import { THE_CATCH } from "@/lib/iugr/evidenceClaims";

export type TheCatchChapterProps = {
  onContinue: () => void;
  onBack: () => void;
};

export function TheCatchChapter({ onContinue, onBack }: TheCatchChapterProps) {
  return (
    <section className="iugr-panel iugr-the-catch" aria-labelledby="iugr-catch-title">
      <div className="iugr-label">{THE_CATCH.chapterLabel}</div>
      <h1 id="iugr-catch-title" className="iugr-headline iugr-headline-sm">
        {THE_CATCH.title}
      </h1>
      <p className="iugr-lead">{THE_CATCH.welcome}</p>
      <p className="iugr-body">{THE_CATCH.bridgeFromScanner}</p>

      <h2 className="iugr-catch-list-title">{THE_CATCH.catchesTitle}</h2>
      <ol className="iugr-catch-list">
        {THE_CATCH.catches.map((item, index) => (
          <li key={item.id} className="iugr-catch-item">
            <p className="iugr-catch-item-title">
              <span className="iugr-catch-item-num" aria-hidden>
                {index + 1}.
              </span>{" "}
              {item.title}
            </p>
            <p className="iugr-catch-item-body">{item.body}</p>
          </li>
        ))}
      </ol>

      <div className="iugr-catch-bottom" aria-labelledby="iugr-catch-bottom-title">
        <h2 id="iugr-catch-bottom-title">{THE_CATCH.bottomLineTitle}</h2>
        <p>{THE_CATCH.bottomLine}</p>
      </div>

      <details className="iugr-catch-fieldnote">
        <summary>{THE_CATCH.fieldNoteTitle}</summary>
        <p>{THE_CATCH.fieldNote}</p>
      </details>

      <p className="iugr-body">{THE_CATCH.bridgeNext}</p>

      <div className="iugr-actions iugr-catch-nav">
        <button type="button" className="iugr-btn iugr-btn-ghost" onClick={onBack}>
          {THE_CATCH.previousLabel}
        </button>
        <button type="button" className="iugr-btn iugr-btn-primary" onClick={onContinue}>
          {THE_CATCH.continueLabel}
        </button>
      </div>
    </section>
  );
}
