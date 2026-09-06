/**
 * The Catch — caveats that keep the simulation argument clever, not conclusive.
 */

export type CatchCaveatId =
  | "consciousness"
  | "survival"
  | "cost"
  | "motivation"
  | "who-counts"
  | "testability"
  | "next-question";

export type CatchCaveat = {
  id: CatchCaveatId;
  title: string;
  explanation: string;
  implication: string;
};

export const CATCH_CAVEATS: CatchCaveat[] = [
  {
    id: "consciousness",
    title: "Consciousness",
    explanation:
      "We do not know whether a sufficiently detailed computer simulation would create real inner experience.",
    implication:
      "If copied minds are not conscious, they may not belong in the observer count.",
  },
  {
    id: "survival",
    title: "Survival and capability",
    explanation:
      "We do not know whether civilizations survive long enough, cooperate well enough, or develop the required technology.",
    implication: "There may be few or no capable simulators.",
  },
  {
    id: "cost",
    title: "Cost",
    explanation:
      "We do not know how much computation a detailed world or conscious mind would require.",
    implication:
      "Even willing civilizations may be unable to create huge numbers of such simulations.",
  },
  {
    id: "motivation",
    title: "Motivation and ethics",
    explanation:
      "We do not know what future societies value, permit, or find interesting.",
    implication:
      "Capability does not mean they would choose to simulate large numbers of ancestors.",
  },
  {
    id: "who-counts",
    title: "Who counts?",
    explanation:
      "It is not obvious which observers belong in the relevant count: all conscious beings, human-like minds, or only observers with experiences very much like ours.",
    implication: "Different ways of counting can change the conclusion.",
  },
  {
    id: "testability",
    title: "Testability",
    explanation:
      "A hidden simulator hypothesis may be difficult or impossible to distinguish from ordinary reality if it makes no unique prediction.",
    implication:
      "The idea may remain philosophical rather than become a testable scientific theory.",
  },
  {
    id: "next-question",
    title: "The next question",
    explanation:
      "If our world were simulated, that would raise another question: what explains the simulator’s world?",
    implication:
      "The idea can move an origin question rather than answer it.",
  },
];

export const CATCH_CAVEAT_IDS: CatchCaveatId[] = CATCH_CAVEATS.map((c) => c.id);

export const THE_CATCH = {
  chapterLabel: "Chapter · The Catch",
  title: "The Catch",
  welcome:
    "The argument has a catch. In fact, it has several. This is not unusual for arguments about reality. Reality is famously difficult to put in a small box.",
  bridgeFromScanner:
    "The scanner kept evidence and assumption in different drawers. The Catch looks under the floorboards of the thought experiment.",
  mapLabel: "Caveats under the floorboards",
  implicationLabel: "Implication",
  inspectedBadge: "Inspected",
  inspectBadge: "Inspect",
  fieldNoteTitle: "Field note",
  fieldNote:
    "The argument is clever because it shows how numbers could matter. It is not conclusive because we do not know whether its biggest assumptions are true.",
  coda: "Possible is not the same species as proven. They rarely share a habitat.",
  continueLabel: "Close the Entry",
  previousLabel: "Previous",
  listAria: "Argument caveats",
  detailAria: "Caveat detail",
} as const;
