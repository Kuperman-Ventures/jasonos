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
  subtitle: "",
  townRevealTitle: "",
  townRevealBody: "",
  continueLabel: "Continue",
  beginLabel: "Take me to the town",
} as const;

export const ORIGINAL_TOWN = {
  beforeSelect1:
    "This is Original Town. One hundred residents, one bakery, and no reason to expect trouble.",
  beforeSelect2: "Pick someone. That one is you for the rest of the entry.",
  afterSelect: "Good. You live here now.",
  nextLabel: "Next",
  previousLabel: "Previous",
  statusBefore: "Every resident is in the original town.",
  statusYes: "Two towns, two hundred residents. Two of them are you.",
  statusUnsure:
    "A second town exists. Whether its residents are people is unsettled.",
  statusNo: "A second town exists. Its residents are not counted as people.",
  countWorlds: "Worlds",
  countResidents: "Residents",
  countCopies: "Copies",
  tapHint: "Tap a figure to choose yourself.",
  plateLabel: "Original Town",
  copyPlateLabel: "Copied Town",
  plateCaption: "Original Town · 100 residents",
  copyPlateCaption: "Copied town · 100 residents · one of them is also you",
  reactionYesAnnounce:
    "A second town appears. The copies look as real as the first, including you.",
  reactionUnsureAnnounce:
    "A second town appears as a dashed outline. The copy of you is marked uncertain.",
  reactionNoAnnounce:
    "A second town appears. The copies fade to outline. Their count is struck out.",
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
  mathClose: "",
  continueLabel: "Meet the Three Doors",
  previousLabel: "Previous",
  machineAria: "Copy Machine controls",
  clusterAria: "Town tokens for this scenario",
  countTransitionNote: "",
} as const;

export const THREE_DOORS = {
  chapterLabel: "Chapter · Three Doors",
  title: "Three Doors",
  transitionFromMachine: "",
  transitionBridge: "",
  guideWelcome: "",
  hubPrompt: "Open any door. Visit all three to see how the argument fits together.",
  hubProgress: "Doors explored",
  statusUnexplored: "Unexplored",
  statusOpen: "Currently open",
  statusExplored: "Explored",
  returnToHub: "Return to the doors",
  lookCloser: "Look closer",
  fieldNoteLabel: "Field note",
  completionTitle: "That is the argument.",
  completionOne: "",
  completionTwo: "",
  completionThree: "",
  completionClose: "",
  bostromNote: "",
  continueLabel: "Back to the machine",
  previousLabel: "Previous",
  hubAria: "Three Doors transit hub",
  detailAria: "Door detail",
} as const;

