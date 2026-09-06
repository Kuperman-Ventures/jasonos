/**
 * Evidence Scanner — five party claims from Beat 6.
 * Educational only. Open in place; nothing to sort or complete.
 */

import { SCANNER_SCRIPT } from "./script";

export type ClaimClassId =
  | "evidence"
  | "assumption"
  | "interesting-not-proof";

export type EvidenceClaimId =
  | "matrix"
  | "graphics"
  | "quantum"
  | "musk"
  | "nothing-matters";

export type EvidenceClaim = {
  id: EvidenceClaimId;
  claim: string;
  /** Script verdict paragraphs shown when the claim is opened. */
  paragraphs: readonly string[];
  /** Kept for classify UI compatibility; all party claims are non-settling. */
  correctClass: ClaimClassId;
  explanation: string;
};

export const CLAIM_CLASS_LABELS: Record<ClaimClassId, string> = {
  evidence: "Evidence",
  assumption: "An assumption",
  "interesting-not-proof": "Interesting, but not settling",
};

export const CLAIM_CLASS_ORDER: ClaimClassId[] = [
  "evidence",
  "assumption",
  "interesting-not-proof",
];

export const EVIDENCE_CLAIMS: EvidenceClaim[] = SCANNER_SCRIPT.claims.map(
  (claim) => ({
    id: claim.id,
    claim: claim.claim,
    paragraphs: claim.paragraphs,
    correctClass: "interesting-not-proof" as const,
    explanation: claim.paragraphs.join(" "),
  }),
);

export const EVIDENCE_CLAIM_IDS: EvidenceClaimId[] = EVIDENCE_CLAIMS.map(
  (c) => c.id,
);

export function allClaimsClassified(
  classified: Readonly<Partial<Record<EvidenceClaimId, ClaimClassId>>>,
): boolean {
  return EVIDENCE_CLAIM_IDS.every((id) => classified[id] != null);
}

export function isCorrectClassification(
  claimId: EvidenceClaimId,
  choice: ClaimClassId,
): boolean {
  const claim = EVIDENCE_CLAIMS.find((c) => c.id === claimId);
  return claim?.correctClass === choice;
}

export const EVIDENCE_SCANNER = {
  chapterLabel: "Chapter · What People Say At Parties",
  title: "What People Say At Parties",
  welcome: SCANNER_SCRIPT.intro[0],
  bridgeFromArcade: SCANNER_SCRIPT.intro[1],
  instruction: SCANNER_SCRIPT.intro[1],
  progressLabel: "Claims opened",
  classifyPrompt: "Open this claim",
  correctLabel: "Noted",
  yourLabel: "Your choice",
  warmCorrection: "Worth reading carefully.",
  continueCard: "Next claim",
  returnToList: "Back to claims",
  openBadge: "Open",
  doneBadge: "Opened",
  synthesisTitle: "",
  synthesisBody: SCANNER_SCRIPT.summary[0],
  synthesisNote: SCANNER_SCRIPT.summary[1],
  continueLabel: SCANNER_SCRIPT.continueLabel,
  previousLabel: "Previous",
  listAria: "Party claims",
  detailAria: "Claim response",
} as const;
