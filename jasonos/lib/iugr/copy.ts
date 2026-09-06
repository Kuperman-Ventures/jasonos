import type { GuideId } from "./types";
import { guideLine } from "./guides";

export const SERIES = {
  name: "The Improbably Useful Guide to Reality",
  shortName: "IUGR",
  pronunciation: "Eye-Ew-Gurr",
  libraryLabel: "The IUGR Library",
} as const;

export const EPISTEMIC = {
  pill: "Thought experiment · not proof",
  dialogTitle: "About this entry",
  dialogBody:
    "This entry explains a philosophical argument. It does not present evidence that our universe is simulated.",
} as const;

export const GUIDE_SETTINGS = {
  heading: "Adjust Your Guide",
  subheading: "Different guides, same inconveniently large questions.",
  voicesNote:
    "Guide voices alter the route’s commentary, not the underlying claims.",
  detailLabel: "Detail level",
  detailOptions: [
    { id: "story" as const, label: "Story first" },
    { id: "balanced" as const, label: "Balanced" },
    { id: "machinery" as const, label: "Show me the machinery" },
  ],
} as const;

export const OVERFLOW = {
  sources: "Sources (coming soon)",
  restart: "Restart entry",
  reducedMotion: "Reduce motion",
  highContrast: "High contrast (preview)",
} as const;

export function stageAside(guideId: GuideId): string {
  return guideLine(guideId, {
    guide:
      "Stay with the argument. Curiosity is allowed. Certainty is on a short leash.",
    mira: "Pack light. Ask loud questions. Leave the footnotes for later — for now.",
    "dr-maybe":
      "Interesting claim. Let us see what it needs before we believe it.",
  });
}

export const OPENING = {
  entryLabel: "ENTRY 01",
  title: "ARE YOU AN ORIGINAL?",
  subtitle:
    "A guided thought experiment about copies, consciousness, and the simulation argument.",
  townRevealTitle: "This is Original Town.",
  townRevealBody:
    "It has 100 residents, one bakery, and no idea it is about to become a math problem.",
  continueLabel: "Continue",
  beginLabel: "Begin the entry",
} as const;

export const ORIGINAL_TOWN = {
  guideLine1:
    "Original Town is not supposed to be Earth. It is a smaller, friendlier place to test a very large idea.",
  guideLine2:
    "For the next few minutes, these residents stand in for people who have memories, choices, feelings, and—when necessary—sandwich preferences.",
  statusLine:
    "In this starting scenario, every resident is in the original town.",
  countWorlds: "Worlds",
  countResidents: "Residents",
  countCopies: "Copies",
  figureNote: "Each figure stands for 10 people · 10 × 10 = 100 residents",
  machineLabel: "Copy Machine · dormant",
  machineHint: "Unavailable for now. It is waiting its turn.",
  consciousnessQuestion:
    "If a machine made a perfect copy of this town—including every person’s memories, thoughts, and sandwich preferences—would the copied people count as people?",
  choiceYes: "Yes, for this thought experiment",
  choiceUnsure: "I’m not sure",
  choiceNo: "No—tell me why that matters",
  ackYes:
    "All right. In the next section, we will count those copies as conscious residents.",
  ackUnsure:
    "Reasonable. Whether a simulated mind could truly be conscious is one of the argument’s biggest unanswered questions.",
  ackNo:
    "The copy-counting argument only grows stronger if the copied residents have real inner experience. If they are only convincing puppets, they may not belong in the count at all.",
  continueWithQuestion: "Continue with that question in view",
  continueLabel: "Continue to the Copy Machine",
  guideSettingsNudge:
    "Prefer a different level of detail? The Guide is adjustable.",
  fieldNoteTitle: "Field note · substrate independence",
  fieldNoteTerm:
    "Philosophers sometimes ask whether consciousness is substrate-independent: could the same kind of mind exist in something other than a biological brain?",
  fieldNotePlain:
    "In ordinary language: could a mind work in a different kind of material, if its thinking and experience were organized the right way?",
  fieldNoteCaveat:
    "This is an unresolved question — not settled science. We treat it carefully.",
  previousLabel: "Previous",
} as const;
