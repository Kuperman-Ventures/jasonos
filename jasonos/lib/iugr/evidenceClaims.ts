/**
 * Evidence Scanner — claims people often treat as “evidence” for simulation,
 * with field-guide verdicts. Educational only; never claims our universe is
 * (or is not) simulated.
 */

export type ClaimVerdictId =
  | "not-evidence"
  | "analogy-only"
  | "argument-not-observation"
  | "interesting-inconclusive";

export type EvidenceClaimId =
  | "glitches"
  | "games"
  | "quantum"
  | "pixels"
  | "celebrities"
  | "copy-machine";

export type EvidenceClaim = {
  id: EvidenceClaimId;
  claim: string;
  verdictId: ClaimVerdictId;
  verdictLabel: string;
  scan: string;
  why: string;
};

export const VERDICT_LABELS: Record<ClaimVerdictId, string> = {
  "not-evidence": "Not evidence",
  "analogy-only": "Analogy only",
  "argument-not-observation": "Argument ≠ observation",
  "interesting-inconclusive": "Interesting, inconclusive",
};

export const EVIDENCE_CLAIMS: EvidenceClaim[] = [
  {
    id: "glitches",
    claim:
      "“Déjà vu, odd coincidences, or ‘glitches’ mean we are in a simulation.”",
    verdictId: "not-evidence",
    verdictLabel: VERDICT_LABELS["not-evidence"],
    scan: "Familiar brain quirks and storytelling instincts can produce those feelings without a simulator.",
    why: "A personal weird moment is not a measurement of the universe’s substrate. Many ordinary explanations exist first.",
  },
  {
    id: "games",
    claim:
      "“Video games keep getting more realistic, so reality is probably a game too.”",
    verdictId: "analogy-only",
    verdictLabel: VERDICT_LABELS["analogy-only"],
    scan: "Better graphics show what humans can render—not that our world is rendered.",
    why: "Analogies can teach. They do not, by themselves, count as observations of a simulator.",
  },
  {
    id: "quantum",
    claim:
      "“Quantum weirdness looks computational, so the universe must be code.”",
    verdictId: "interesting-inconclusive",
    verdictLabel: VERDICT_LABELS["interesting-inconclusive"],
    scan: "Strange physics is real. ‘Looks like code’ is a metaphor, not a detection of a computer.",
    why: "Many non-simulated systems are also deeply mathematical. Weirdness alone does not identify a programmer.",
  },
  {
    id: "pixels",
    claim:
      "“Space seems pixelated / discrete, which proves a digital world.”",
    verdictId: "interesting-inconclusive",
    verdictLabel: VERDICT_LABELS["interesting-inconclusive"],
    scan: "Discrete models appear in physics debates—and also in human preference for tidy diagrams.",
    why: "Even if nature has smallest units, that would not automatically mean ‘simulated by someone.’",
  },
  {
    id: "celebrities",
    claim:
      "“Important people say we might be simulated, so it must be serious evidence.”",
    verdictId: "not-evidence",
    verdictLabel: VERDICT_LABELS["not-evidence"],
    scan: "Authority can flag a question as interesting. It cannot replace observation.",
    why: "Quotes are social signals. They are not detectors pointed at reality’s source code.",
  },
  {
    id: "copy-machine",
    claim:
      "“The Copy Machine showed copies can dominate, so we probably are copies.”",
    verdictId: "argument-not-observation",
    verdictLabel: VERDICT_LABELS["argument-not-observation"],
    scan: "The machine showed a conditional counting story in a made-up town—not a reading of our universe.",
    why: "An argument about what would follow if certain assumptions held is not the same thing as evidence that those assumptions hold here.",
  },
];

export const EVIDENCE_CLAIM_IDS: EvidenceClaimId[] = EVIDENCE_CLAIMS.map(
  (c) => c.id,
);

export function allClaimsScanned(
  scanned: readonly EvidenceClaimId[],
): boolean {
  return EVIDENCE_CLAIM_IDS.every((id) => scanned.includes(id));
}

export function markClaimScanned(
  scanned: readonly EvidenceClaimId[],
  id: EvidenceClaimId,
): EvidenceClaimId[] {
  if (scanned.includes(id)) return [...scanned];
  return [...scanned, id];
}

export const EVIDENCE_SCANNER = {
  chapterLabel: "Chapter · Evidence Scanner",
  title: "Evidence Scanner",
  welcome:
    "Welcome to the Evidence Scanner. Its job is impolite in a helpful way: it separates arguments from observations.",
  bridgeFromArcade:
    "You have poked the assumptions. Now scan a few claims people often treat as evidence—and see what the scanner actually finds.",
  instruction:
    "Open each claim. The scanner returns a field verdict, not a cosmic guilty verdict.",
  progressLabel: "Claims scanned",
  scanButton: "Scan this claim",
  scannedBadge: "Scanned",
  openBadge: "Open",
  returnToList: "Back to claims",
  verdictLabel: "Field verdict",
  lookCloser: "Look closer",
  whyLabel: "Why this verdict",
  synthesisTitle: "Scanner summary",
  synthesisBody:
    "None of these claims, by themselves, measure whether our universe is simulated. Some are analogies. Some are arguments. Some are just vibes wearing a lab coat.",
  synthesisNote:
    "Keeping ‘argument’ and ‘evidence’ separate is how a thought experiment stays useful instead of becoming a rumor.",
  continueHint: "Scan every claim to continue.",
  continueLabel: "Meet the Catch",
  previousLabel: "Previous",
  listAria: "Claims to scan",
  detailAria: "Claim scan result",
} as const;

export const THE_CATCH = {
  chapterLabel: "Chapter · The Catch",
  title: "The Catch",
  welcome:
    "Every neat story has a snag. Here are the snags that keep the simulation argument from turning into a finished fact.",
  bridgeFromScanner:
    "The scanner kept evidence and argument in different drawers. The Catch names what the drawers still cannot settle.",
  catchesTitle: "The catches, in plain language",
  catches: [
    {
      id: "conditional",
      title: "It is conditional",
      body: "The copy-counting story only gains force if several big assumptions all hold. If any major assumption fails, the drama shrinks.",
    },
    {
      id: "consciousness",
      title: "Consciousness is unsettled",
      body: "We do not know whether a simulated process can have an inner life. Without that, copied ‘observers’ may not belong in the count.",
    },
    {
      id: "motivation",
      title: "Future motives are unknown",
      body: "Even advanced civilizations might not run ancestor-style worlds. Capability is not the same as interest, permission, or habit.",
    },
    {
      id: "reference",
      title: "The counting frame is slippery",
      body: "Which observers belong in the tally? How you draw the circle can change the story—and philosophy has not handed us one official circle.",
    },
    {
      id: "not-evidence",
      title: "An argument is not a measurement",
      body: "A clear conditional argument can still be silent about our actual universe. Clarity is not the same thing as a reading on a detector.",
    },
  ] as const,
  bottomLineTitle: "Bottom line",
  bottomLine:
    "The simulation argument is a useful machine for thinking—not a verdict stamped on your Tuesday morning. It shows how assumptions matter. It does not tell you, by itself, whether you are an original.",
  fieldNoteTitle: "Field note",
  fieldNote:
    "Leaving with sharper questions is a successful ending for a thought experiment. Certainty was never the product.",
  bridgeNext:
    "You have walked the town, the machine, the doors, the arcade, the scanner, and the catch. Time for a short closing.",
  continueLabel: "Close the entry",
  previousLabel: "Previous",
} as const;
