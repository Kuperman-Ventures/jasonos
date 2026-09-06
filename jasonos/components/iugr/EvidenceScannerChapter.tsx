"use client";

import {
  EVIDENCE_CLAIMS,
  EVIDENCE_SCANNER,
} from "@/lib/iugr/evidenceClaims";
import { SCANNER_SCRIPT, TRANSITION_6 } from "@/lib/iugr/script";
import { TransitionBlock } from "@/components/iugr/TransitionBlock";

export type EvidenceScannerChapterProps = {
  onContinue: () => void;
  onBack: () => void;
};

/**
 * Beat 6 — all five claims open in place with verdicts visible.
 * No card-to-detail navigation, sorting, scanned state, or continue gate.
 */
export function EvidenceScannerChapter({
  onContinue,
  onBack,
}: EvidenceScannerChapterProps) {
  return (
    <section
      className="iugr-panel iugr-evidence-scanner"
      data-wash="coral"
      aria-labelledby="iugr-scanner-title"
    >
      <div className="iugr-label">{EVIDENCE_SCANNER.chapterLabel}</div>
      <h1 id="iugr-scanner-title" className="iugr-headline iugr-headline-sm">
        {EVIDENCE_SCANNER.title}
      </h1>

      {SCANNER_SCRIPT.intro.map((paragraph) => (
        <p key={paragraph} className="iugr-lead">
          {paragraph}
        </p>
      ))}

      <div className="iugr-claims-open" role="list" aria-label={EVIDENCE_SCANNER.listAria}>
        {EVIDENCE_CLAIMS.map((claim) => (
          <article
            key={claim.id}
            className="iugr-claim-open"
            role="listitem"
            aria-labelledby={`iugr-claim-${claim.id}`}
          >
            <h2 id={`iugr-claim-${claim.id}`} className="iugr-claim-open-title">
              {claim.claim}
            </h2>
            <div className="iugr-claim-open-body">
              {claim.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div
        className="iugr-scanner-synthesis"
        aria-labelledby="iugr-scanner-synthesis-title"
      >
        <h2 id="iugr-scanner-synthesis-title" className="sr-only">
          Summary
        </h2>
        {SCANNER_SCRIPT.summary.map((paragraph) => (
          <p key={paragraph} className="iugr-body">
            {paragraph}
          </p>
        ))}
      </div>

      <TransitionBlock paragraphs={TRANSITION_6} />

      <div className="iugr-actions iugr-scanner-nav">
        <button
          type="button"
          className="iugr-btn iugr-btn-ghost"
          onClick={onBack}
        >
          {EVIDENCE_SCANNER.previousLabel}
        </button>
        <button
          type="button"
          className="iugr-btn iugr-btn-primary"
          onClick={onContinue}
        >
          {EVIDENCE_SCANNER.continueLabel}
        </button>
      </div>
    </section>
  );
}
