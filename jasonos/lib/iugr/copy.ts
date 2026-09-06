import type { GuideId } from "./types";
import { guideLine } from "./guides";

export const SERIES = {
  name: "The Improbably Useful Guide to Reality",
  shortName: "IUGR",
  pronunciation: "Eye-Ew-Gurr",
  libraryLabel: "The IUGR Library",
} as const;

export const EPISTEMIC = {
  pill: "A thought experiment",
  dialogTitle: "About this entry",
  dialogBody:
    "This entry walks through a philosophical argument step by step. It is an argument, not evidence about our universe.",
} as const;

export const GUIDE_SETTINGS = {
  heading: "Adjust Your Guide",
  subheading: "Different guides, same inconveniently large questions.",
  voicesNote:
    "Guide voices alter the route’s commentary, not the underlying claims.",
} as const;

export const OVERFLOW = {
  sources: "Sources",
  restart: "Restart entry",
  reducedMotion: "Reduce motion",
  highContrast: "High contrast (preview)",
} as const;

export function stageAside(guideId: GuideId): string {
  return guideLine(guideId, {
    guide:
      "Stay with the argument. Curiosity is allowed. Certainty is on a short leash.",
    mira: "Pack light. Ask loud questions. Leave the footnotes for later. For now.",
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
  guideLine2:
    "For the next few minutes, these residents stand in for people who have memories, choices, feelings, and - when necessary - sandwich preferences.",
  statusLine:
    "In this starting scenario, every resident is in the original town.",
  countWorlds: "Worlds",
  countResidents: "Residents",
  countCopies: "Copies",
  figureNote: "Each figure stands for 10 people · 10 × 10 = 100 residents",
  machineLabel: "Copy Machine · dormant",
  machineHint: "Unavailable for now. It is waiting its turn.",
  consciousnessQuestion:
    "If a machine made a perfect copy of this town - including every person’s memories, thoughts, and sandwich preferences - would the copied people count as people?",
  choiceYes: "Yes, for this thought experiment",
  choiceUnsure: "I’m not sure",
  choiceNo: "No. Tell me why that matters",
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
    "This is an unresolved question, not settled science. We treat it carefully.",
  previousLabel: "Previous",
} as const;

export const COPY_MACHINE = {
  chapterLabel: "Chapter · Copy Machine",
  title: "The Copy Machine",
  guideIntro:
    "The machine does one thing extremely well: it turns an innocent question into an increasingly large accounting problem.",
  sliderLabel: "Copied towns",
  snapHints: "Try 0, 1, 9, 99, or 999",
  resetLabel: "Reset",
  censusTitle: "Town Census",
  originalTowns: "Original towns",
  copiedTowns: "Copied towns",
  totalTowns: "Total towns",
  originalResidents: "Original residents",
  copiedResidents: "Residents in copied towns",
  totalResidents: "Total represented residents",
  fractionTitle: "Share of residents in copied towns",
  legendOriginal: "Original",
  legendCopied: "Copied",
  caveatYes: null,
  caveatUnsure:
    "This counting exercise assumes the copies have inner experience. You marked that as uncertain.",
  caveatNo:
    "If copied residents are not conscious, they may not belong in this observer count. The visual still shows copies, but the philosophical conclusion does not automatically follow.",
  anthropicReveal:
    "This is the counting intuition behind a philosophical idea sometimes called anthropic reasoning.",
  anthropicDefinition:
    "It means using the kind of observer you are - someone with experiences like yours - as part of a counting argument.",
  showMath: "Show me the math",
  hideMath: "Hide the math",
  mathPlain:
    "Copied residents divided by all residents gives the share of residents living in copied towns.",
  mathCurrentLabel: "Current arithmetic",
  mathGeneralLabel: "General formula for this example",
  mathSimplifiedLabel: "Because every town has 100 people, this simplifies to",
  mathWorkedTitle: "Worked example · 9 copies",
  mathWorked1: "9 copied towns × 100 people = 900 copied residents",
  mathWorked2: "100 original residents + 900 copied residents = 1,000 total residents",
  mathWorked3: "900 / 1,000 = 90%",
  mathClose:
    "This says nothing by itself about whether our universe has copies. It only shows why the number of copies matters if the assumptions are true.",
  continueLabel: "Meet the Three Doors",
  previousLabel: "Previous",
  machineAria: "Copy Machine controls",
  clusterAria: "Town tokens for this scenario",
  countTransitionNote:
    "The important part is not that copies are strange. It is that a large number of conscious copies changes the count.",
} as const;

export const THREE_DOORS = {
  chapterLabel: "Chapter · Three Doors",
  title: "Three Doors",
  transitionFromMachine:
    "The machine has shown one small thing: if conscious copies become numerous, they can dominate the count.",
  transitionBridge:
    "But that only matters if reality gets through a very particular set of doors.",
  guideWelcome:
    "Welcome to the Three Doors. The argument does not tell us which door is real. It says at least one of them probably is.",
  hubPrompt: "Open any door. Visit all three to see how the argument fits together.",
  hubProgress: "Doors explored",
  statusUnexplored: "Unexplored",
  statusOpen: "Currently open",
  statusExplored: "Explored",
  returnToHub: "Return to the doors",
  lookCloser: "Look closer",
  fieldNoteLabel: "Field note",
  completionTitle: "That is the three-door argument:",
  completionOne:
    "Almost nobody gets the ability to make vast conscious simulations.",
  completionTwo:
    "Those who do get the ability almost never make many of them.",
  completionThree:
    "Or, if they do make many, copied observers could become more common than original ones.",
  completionClose:
    "The argument does not tell us which door is true. It says the answer to the big question depends on which assumptions survive inspection.",
  bostromNote:
    "Philosopher Nick Bostrom made this three-part version of the simulation argument widely known.",
  continueLabel: "Inspect the Assumptions",
  previousLabel: "Previous",
  hubAria: "Three Doors transit hub",
  detailAria: "Door detail",
} as const;

