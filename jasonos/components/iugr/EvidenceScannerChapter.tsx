"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CLAIM_CLASS_LABELS,
  CLAIM_CLASS_ORDER,
  EVIDENCE_CLAIMS,
  EVIDENCE_CLAIM_IDS,
  EVIDENCE_SCANNER,
  allClaimsClassified,
  isCorrectClassification,
  type ClaimClassId,
  type EvidenceClaim,
  type EvidenceClaimId,
} from "@/lib/iugr/evidenceClaims";

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

function ClaimClassifyDetail({
  claim,
  priorChoice,
  onClassify,
  onReturn,
  reducedMotion,
}: {
  claim: EvidenceClaim;
  priorChoice: ClaimClassId | undefined;
  onClassify: (choice: ClaimClassId) => void;
  onReturn: () => void;
  reducedMotion: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const [choice, setChoice] = useState<ClaimClassId | null>(priorChoice ?? null);
  const revealed = choice != null;
  const correct = choice ? isCorrectClassification(claim.id, choice) : false;

  useEffect(() => {
    headingRef.current?.focus();
  }, [claim.id]);

  return (
    <article
      className={`iugr-claim-detail${reducedMotion ? " is-static" : " is-enter"}`}
      aria-labelledby={titleId}
      aria-label={EVIDENCE_SCANNER.detailAria}
    >
      <p className="iugr-claim-detail-label">{EVIDENCE_SCANNER.classifyPrompt}</p>
      <h2
        id={titleId}
        ref={headingRef}
        className="iugr-claim-detail-title"
        tabIndex={-1}
      >
        {claim.claim}
      </h2>

      <div
        className="iugr-classify-options"
        role="group"
        aria-label={EVIDENCE_SCANNER.classifyPrompt}
      >
        {CLAIM_CLASS_ORDER.map((id) => {
          const selected = choice === id;
          const isCorrectOption = claim.correctClass === id;
          return (
            <button
              key={id}
              type="button"
              className={[
                "iugr-classify-option",
                selected ? "is-selected" : "",
                revealed && isCorrectOption ? "is-correct" : "",
                revealed && selected && !correct ? "is-incorrect" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={selected}
              disabled={revealed}
              onClick={() => {
                setChoice(id);
                onClassify(id);
              }}
            >
              {CLAIM_CLASS_LABELS[id]}
            </button>
          );
        })}
      </div>

      {revealed && choice ? (
        <div
          className={`iugr-classify-feedback${correct ? " is-correct" : " is-incorrect"}`}
          aria-live="polite"
        >
          <p className="iugr-classify-feedback-status">
            {correct
              ? EVIDENCE_SCANNER.correctLabel
              : EVIDENCE_SCANNER.warmCorrection}
          </p>
          {!correct ? (
            <p className="iugr-classify-feedback-answer">
              <span className="iugr-claim-why-kicker">
                {EVIDENCE_SCANNER.correctLabel}:{" "}
              </span>
              {CLAIM_CLASS_LABELS[claim.correctClass]}
            </p>
          ) : null}
          <p className="iugr-claim-detail-scan">{claim.explanation}</p>
        </div>
      ) : null}

      <div className="iugr-actions">
        <button
          type="button"
          className="iugr-btn iugr-btn-primary"
          onClick={onReturn}
          disabled={!revealed}
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
  const complete = allClaimsClassified(classifiedClaims);
  const classifiedCount = EVIDENCE_CLAIM_IDS.filter(
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
        aria-labelledby="iugr-scanner-title"
      >
        <div className="iugr-label">{EVIDENCE_SCANNER.chapterLabel}</div>
        <h1 id="iugr-scanner-title" className="sr-only">
          {EVIDENCE_SCANNER.title}: classify claim
        </h1>
        <ClaimClassifyDetail
          claim={claim}
          priorChoice={classifiedClaims[activeClaimId]}
          onClassify={(choice) => onClassifyClaim(activeClaimId, choice)}
          onReturn={() => handleReturn(activeClaimId)}
          reducedMotion={reducedMotion}
        />
      </section>
    );
  }

  return (
    <section
      className="iugr-panel iugr-evidence-scanner"
      aria-labelledby="iugr-scanner-title"
    >
      <div className="iugr-label">{EVIDENCE_SCANNER.chapterLabel}</div>
      <h1 id="iugr-scanner-title" className="iugr-headline iugr-headline-sm">
        {EVIDENCE_SCANNER.title}
      </h1>

      <p className="iugr-lead">{EVIDENCE_SCANNER.welcome}</p>
      <p className="iugr-body">{EVIDENCE_SCANNER.bridgeFromArcade}</p>
      <p className="iugr-body">{EVIDENCE_SCANNER.instruction}</p>

      <p className="iugr-claims-progress" aria-live="polite">
        {EVIDENCE_SCANNER.progressLabel}: {classifiedCount} /{" "}
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
            onOpen={() => onOpenClaim(claim.id)}
            buttonRef={(node) => {
              claimButtonRefs.current[claim.id] = node;
            }}
          />
        ))}
      </div>

      {complete ? (
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
          <p className="iugr-body">{EVIDENCE_SCANNER.synthesisBody}</p>
          <p className="iugr-note" role="note">
            {EVIDENCE_SCANNER.synthesisNote}
          </p>
        </div>
      ) : null}

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
