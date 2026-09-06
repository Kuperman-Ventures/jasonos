"use client";

import { useEffect, useId, useRef } from "react";
import {
  EVIDENCE_CLAIMS,
  EVIDENCE_CLAIM_IDS,
  EVIDENCE_SCANNER,
  type ClaimClassId,
  type EvidenceClaim,
  type EvidenceClaimId,
} from "@/lib/iugr/evidenceClaims";
import { SCANNER_SCRIPT, TRANSITION_6 } from "@/lib/iugr/script";
import { TransitionBlock } from "@/components/iugr/TransitionBlock";

export type EvidenceScannerChapterProps = {
  classifiedClaims: Readonly<Partial<Record<EvidenceClaimId, ClaimClassId>>>;
  activeClaimId: EvidenceClaimId | null;
  onOpenClaim: (id: EvidenceClaimId) => void;
  onClassifyClaim: (id: EvidenceClaimId, choice: ClaimClassId) => void;
  onCloseClaim: () => void;
  onContinue: () => void;
  onBack: () => void;
  reducedMotion: boolean;
};

function ClaimCard({
  claim,
  classified,
  onOpen,
  buttonRef,
}: {
  claim: EvidenceClaim;
  classified: boolean;
  onOpen: () => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      className={`iugr-claim-card${classified ? " is-scanned" : ""}`}
      onClick={onOpen}
      aria-label={`${claim.claim} ${classified ? EVIDENCE_SCANNER.doneBadge : EVIDENCE_SCANNER.openBadge}.`}
    >
      {classified ? (
        <span className="iugr-card-done" aria-hidden>
          <span className="iugr-card-done-check">✓</span>
        </span>
      ) : null}
      <span className="iugr-claim-card-copy">
        <span className="iugr-claim-card-text">{claim.claim}</span>
        <span className="iugr-claim-card-status">
          {classified ? EVIDENCE_SCANNER.doneBadge : EVIDENCE_SCANNER.openBadge}
        </span>
      </span>
    </button>
  );
}

function ClaimDetail({
  claim,
  onReturn,
  reducedMotion,
}: {
  claim: EvidenceClaim;
  onReturn: () => void;
  reducedMotion: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, [claim.id]);

  return (
    <article
      className={`iugr-claim-detail${reducedMotion ? " is-static" : " is-enter"}`}
      aria-labelledby={titleId}
      aria-label={EVIDENCE_SCANNER.detailAria}
    >
      <h2
        id={titleId}
        ref={headingRef}
        className="iugr-claim-detail-title"
        tabIndex={-1}
      >
        {claim.claim}
      </h2>

      <div className="iugr-claim-detail-body">
        {claim.paragraphs.map((paragraph) => (
          <p key={paragraph} className="iugr-claim-detail-scan">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="iugr-actions">
        <button
          type="button"
          className="iugr-btn iugr-btn-primary"
          onClick={onReturn}
        >
          {EVIDENCE_SCANNER.returnToList}
        </button>
      </div>
    </article>
  );
}

export function EvidenceScannerChapter({
  classifiedClaims,
  activeClaimId,
  onOpenClaim,
  onClassifyClaim,
  onCloseClaim,
  onContinue,
  onBack,
  reducedMotion,
}: EvidenceScannerChapterProps) {
  const openedCount = EVIDENCE_CLAIM_IDS.filter(
    (id) => classifiedClaims[id] != null,
  ).length;
  const claimButtonRefs = useRef<
    Partial<Record<EvidenceClaimId, HTMLButtonElement | null>>
  >({});
  const returnFocusId = useRef<EvidenceClaimId | null>(null);

  useEffect(() => {
    if (activeClaimId === null && returnFocusId.current) {
      claimButtonRefs.current[returnFocusId.current]?.focus();
      returnFocusId.current = null;
    }
  }, [activeClaimId]);

  const handleOpen = (id: EvidenceClaimId) => {
    onOpenClaim(id);
    onClassifyClaim(id, "interesting-not-proof");
  };

  const handleReturn = (id: EvidenceClaimId) => {
    returnFocusId.current = id;
    onCloseClaim();
  };

  if (activeClaimId) {
    const claim = EVIDENCE_CLAIMS.find((c) => c.id === activeClaimId);
    if (!claim) return null;

    return (
      <section
        className="iugr-panel iugr-evidence-scanner"
        data-wash="coral"
        aria-labelledby="iugr-scanner-title"
      >
        <div className="iugr-label">{EVIDENCE_SCANNER.chapterLabel}</div>
        <h1 id="iugr-scanner-title" className="sr-only">
          {EVIDENCE_SCANNER.title}: claim
        </h1>
        <ClaimDetail
          claim={claim}
          onReturn={() => handleReturn(activeClaimId)}
          reducedMotion={reducedMotion}
        />
      </section>
    );
  }

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

      <p className="iugr-claims-progress" aria-live="polite">
        {EVIDENCE_SCANNER.progressLabel}: {openedCount} /{" "}
        {EVIDENCE_CLAIM_IDS.length}
      </p>

      <div
        className="iugr-claims-hub"
        role="group"
        aria-label={EVIDENCE_SCANNER.listAria}
      >
        {EVIDENCE_CLAIMS.map((claim) => (
          <ClaimCard
            key={claim.id}
            claim={claim}
            classified={classifiedClaims[claim.id] != null}
            onOpen={() => handleOpen(claim.id)}
            buttonRef={(node) => {
              claimButtonRefs.current[claim.id] = node;
            }}
          />
        ))}
      </div>

      <div
        className="iugr-scanner-synthesis"
        aria-labelledby="iugr-scanner-synthesis-title"
      >
        <h2
          id="iugr-scanner-synthesis-title"
          className="iugr-scanner-synthesis-title"
        >
          {EVIDENCE_SCANNER.synthesisTitle}
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
