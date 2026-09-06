"use client";

import { useEffect, useId, useRef } from "react";
import {
  EVIDENCE_CLAIMS,
  EVIDENCE_CLAIM_IDS,
  EVIDENCE_SCANNER,
  allClaimsScanned,
  type EvidenceClaim,
  type EvidenceClaimId,
} from "@/lib/iugr/evidenceClaims";

export type EvidenceScannerChapterProps = {
  scannedClaimIds: readonly EvidenceClaimId[];
  activeClaimId: EvidenceClaimId | null;
  onOpenClaim: (id: EvidenceClaimId) => void;
  onCloseClaim: (id: EvidenceClaimId) => void;
  onContinue: () => void;
  onBack: () => void;
  reducedMotion: boolean;
};

type ClaimStatus = "unscanned" | "open" | "scanned";

function getClaimStatus(
  id: EvidenceClaimId,
  scanned: readonly EvidenceClaimId[],
  active: EvidenceClaimId | null,
): ClaimStatus {
  if (active === id) return "open";
  if (scanned.includes(id)) return "scanned";
  return "unscanned";
}

function statusLabel(status: ClaimStatus): string {
  if (status === "open") return EVIDENCE_SCANNER.openBadge;
  if (status === "scanned") return EVIDENCE_SCANNER.scannedBadge;
  return EVIDENCE_SCANNER.scanButton;
}

function ClaimCard({
  claim,
  status,
  onOpen,
  buttonRef,
}: {
  claim: EvidenceClaim;
  status: ClaimStatus;
  onOpen: () => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      className={`iugr-claim-card is-${status} iugr-claim-verdict-${claim.verdictId}`}
      onClick={onOpen}
      aria-label={`${claim.claim} ${statusLabel(status)}.`}
      data-status={status}
    >
      <span className="iugr-claim-card-copy">
        <span className="iugr-claim-card-text">{claim.claim}</span>
        <span className="iugr-claim-card-status">{statusLabel(status)}</span>
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
      <p className="iugr-claim-detail-label">{EVIDENCE_SCANNER.verdictLabel}</p>
      <h2
        id={titleId}
        ref={headingRef}
        className="iugr-claim-detail-title"
        tabIndex={-1}
      >
        {claim.claim}
      </h2>

      <p className={`iugr-claim-verdict iugr-claim-verdict--${claim.verdictId}`}>
        <strong>{claim.verdictLabel}</strong>
      </p>

      <p className="iugr-claim-detail-scan">{claim.scan}</p>

      <details className="iugr-claim-why">
        <summary>{EVIDENCE_SCANNER.lookCloser}</summary>
        <p>
          <span className="iugr-claim-why-kicker">{EVIDENCE_SCANNER.whyLabel}. </span>
          {claim.why}
        </p>
      </details>

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
  scannedClaimIds,
  activeClaimId,
  onOpenClaim,
  onCloseClaim,
  onContinue,
  onBack,
  reducedMotion,
}: EvidenceScannerChapterProps) {
  const complete = allClaimsScanned(scannedClaimIds);
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
    onCloseClaim(id);
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
          {EVIDENCE_SCANNER.title}: scan result
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
        {EVIDENCE_SCANNER.progressLabel}: {scannedClaimIds.length} /{" "}
        {EVIDENCE_CLAIM_IDS.length}
      </p>

      <div
        className="iugr-claims-hub"
        role="group"
        aria-label={EVIDENCE_SCANNER.listAria}
      >
        {EVIDENCE_CLAIMS.map((claim) => {
          const status = getClaimStatus(
            claim.id,
            scannedClaimIds,
            activeClaimId,
          );
          return (
            <ClaimCard
              key={claim.id}
              claim={claim}
              status={status}
              onOpen={() => onOpenClaim(claim.id)}
              buttonRef={(node) => {
                claimButtonRefs.current[claim.id] = node;
              }}
            />
          );
        })}
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
        {complete ? (
          <button
            type="button"
            className="iugr-btn iugr-btn-primary"
            onClick={onContinue}
          >
            {EVIDENCE_SCANNER.continueLabel}
          </button>
        ) : (
          <p className="iugr-scanner-continue-hint">
            {EVIDENCE_SCANNER.continueHint}
          </p>
        )}
      </div>
    </section>
  );
}
