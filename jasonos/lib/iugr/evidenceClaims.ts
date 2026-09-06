/**
 * Evidence Scanner — classify popular “simulation evidence” claims.
 * Educational only. Never claims our universe is (or is not) simulated.
 */

export type ClaimClassId =
  | "evidence"
  | "assumption"
  | "interesting-not-proof";

export type EvidenceClaimId =
  | "light-speed"
  | "quantum-render"
  | "info-universe"
  | "conscious-computers"
  | "ancestor-desire"
  | "glitch-dejavu"
  | "many-sims";

export type EvidenceClaim = {
  id: EvidenceClaimId;
  claim: string;
  correctClass: ClaimClassId;
  explanation: string;
};

export const CLAIM_CLASS_LABELS: Record<ClaimClassId, string> = {
  evidence: "Evidence",
  assumption: "An assumption",
  "interesting-not-proof": "Interesting, but not proof",
};

export const CLAIM_CLASS_ORDER: ClaimClassId[] = [
  "evidence",
  "assumption",
  "interesting-not-proof",
];

export const EVIDENCE_CLAIMS: EvidenceClaim[] = [
  {
    id: "light-speed",
    claim: "The speed of light is a processing limit.",
    correctClass: "interesting-not-proof",
    explanation:
      "Physics can have limits without being computer software. A maximum speed does not demonstrate a computer running reality.",
  },
  {
    id: "quantum-render",
    claim:
      "Quantum physics proves someone only renders reality when we look.",
    correctClass: "interesting-not-proof",
    explanation:
      "Quantum theory does not establish that human consciousness triggers reality to “render.” That is a popular analogy, not a scientific conclusion.",
  },
  {
    id: "info-universe",
    claim: "The universe is made of information.",
    correctClass: "interesting-not-proof",
    explanation:
      "Physics can be described with information-like ideas. That does not demonstrate that an external computer is running the universe.",
  },
  {
    id: "conscious-computers",
    claim: "A computer can create conscious beings.",
    correctClass: "assumption",
    explanation:
      "This is a major unresolved question. A system might act intelligently, but whether it has inner experience is not settled.",
  },
  {
    id: "ancestor-desire",
    claim: "Future civilizations will want to simulate ancestors.",
    correctClass: "assumption",
    explanation:
      "Future people may have the ability to do this and still have no interest, permission, or reason to do it.",
  },
  {
    id: "glitch-dejavu",
    claim: "I saw a glitch or experienced déjà vu.",
    correctClass: "interesting-not-proof",
    explanation:
      "Strange experiences can be real experiences without uniquely pointing to a simulation. They have many possible explanations.",
  },
  {
    id: "many-sims",
    claim: "Many conscious historical simulations exist.",
    correctClass: "assumption",
    explanation:
      "This is the large premise that would make the counting argument powerful—if it were true.",
  },
];

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
  chapterLabel: "Chapter · Evidence Scanner",
  title: "Scan the Claims",
  welcome:
    "Humans are excellent at noticing strange things. We are slightly less excellent at deciding what those things prove.",
  bridgeFromArcade:
    "You have now met the assumptions. Next, let’s inspect some things people often mistake for evidence.",
  instruction:
    "Classify each claim. There is no timer and no score—only a clearer sense of evidence versus assumption.",
  progressLabel: "Claims classified",
  classifyPrompt: "How would you classify this claim?",
  correctLabel: "Correct classification",
  yourLabel: "Your choice",
  warmCorrection:
    "Close enough for curiosity; not quite right for the field notebook.",
  continueCard: "Next claim",
  returnToList: "Back to claims",
  openBadge: "Classify",
  doneBadge: "Classified",
  synthesisTitle: "Scanner summary",
  synthesisBody:
    "A strange idea can be interesting without becoming evidence.",
  synthesisNote:
    "The simulation argument gets its force from assumptions about copies and consciousness—not from having caught reality buffering.",
  continueHint: "Classify every claim to continue.",
  continueLabel: "Meet the Catch",
  previousLabel: "Previous",
  listAria: "Claims to classify",
  detailAria: "Claim classification",
} as const;

