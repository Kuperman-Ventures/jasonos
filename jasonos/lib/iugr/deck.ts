/**
 * IUGR card deck — one ordered array for the whole entry.
 * Renderer is dumb: it renders what a card says; it does not diff.
 * Accumulation is authored: later cards restate earlier lines.
 */

export type Tone = "lead" | "body" | "coral";

export type StageState = {
  /** Stage area visible (hidden on pure text / section cards). */
  show: boolean;
  /** Copied-town count driving field, dial, and counts. */
  copies: number;
  showCounts: boolean;
  showLever: boolean;
  /** Silent 999 card: deep bg, no chrome/counts. */
  silent?: boolean;
};

export type Interaction =
  | { type: "pull"; to: number }
  | {
      type: "choose";
      options: { id: string; label: string }[];
      stateKey: string;
    }
  | { type: "pick"; of: number; stateKey: string }
  | { type: "dial"; options: string[]; stateKey: string };

export type CardLine = {
  tone: Tone;
  text: string;
};

export type Card = {
  id: string;
  section: string;
  kind: "section" | "stage" | "text";
  lines: CardLine[];
  stage?: StageState;
  interaction?: Interaction;
};

export type DeckSection = {
  id: string;
  title: string;
  firstCardId: string;
};

const STAGE0: StageState = {
  show: true,
  copies: 0,
  showCounts: true,
  showLever: true,
};

const CHALLENGE_OPEN =
  "Pull the lever until the copies outnumber the originals.";

/**
 * Copy Machine — reference section.
 * One change per card. Stage persists and accumulates.
 */
export const COPY_MACHINE_CARDS: Card[] = [
  {
    id: "cm-section",
    section: "copy-machine",
    kind: "section",
    lines: [{ tone: "lead", text: "The Copy Machine" }],
  },
  {
    id: "cm-stage",
    section: "copy-machine",
    kind: "stage",
    lines: [],
    stage: { ...STAGE0 },
  },
  {
    id: "cm-challenge-label",
    section: "copy-machine",
    kind: "stage",
    lines: [{ tone: "body", text: "CHALLENGE" }],
    stage: { ...STAGE0 },
  },
  {
    id: "cm-challenge-text",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE" },
      { tone: "body", text: CHALLENGE_OPEN },
    ],
    stage: { ...STAGE0 },
  },
  {
    id: "cm-body-0",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE" },
      { tone: "body", text: CHALLENGE_OPEN },
      {
        tone: "lead",
        text: "One lever. It does exactly one thing, and the thing it does is arithmetic.",
      },
    ],
    stage: { ...STAGE0 },
  },
  {
    id: "cm-pull-1",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE" },
      { tone: "body", text: CHALLENGE_OPEN },
      {
        tone: "lead",
        text: "One lever. It does exactly one thing, and the thing it does is arithmetic.",
      },
    ],
    stage: { ...STAGE0 },
    interaction: { type: "pull", to: 1 },
  },
  {
    id: "cm-at-1-challenge",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE - EVEN, NOT YET A MAJORITY" },
      { tone: "body", text: CHALLENGE_OPEN },
      {
        tone: "lead",
        text: "One lever. It does exactly one thing, and the thing it does is arithmetic.",
      },
    ],
    stage: { ...STAGE0, copies: 1 },
  },
  {
    id: "cm-body-1",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE - EVEN, NOT YET A MAJORITY" },
      { tone: "body", text: CHALLENGE_OPEN },
      {
        tone: "lead",
        text: "One copy and it is already even. You did not have to work very hard for that.",
      },
    ],
    stage: { ...STAGE0, copies: 1 },
  },
  {
    id: "cm-pull-9",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE - EVEN, NOT YET A MAJORITY" },
      { tone: "body", text: CHALLENGE_OPEN },
      {
        tone: "lead",
        text: "One copy and it is already even. You did not have to work very hard for that.",
      },
    ],
    stage: { ...STAGE0, copies: 1 },
    interaction: { type: "pull", to: 9 },
  },
  {
    id: "cm-at-9-challenge",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE COMPLETE" },
      {
        tone: "body",
        text: "Copies of you now outnumber the originals.",
      },
      {
        tone: "lead",
        text: "One copy and it is already even. You did not have to work very hard for that.",
      },
    ],
    stage: { ...STAGE0, copies: 9 },
  },
  {
    id: "cm-body-9",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE COMPLETE" },
      {
        tone: "body",
        text: "Copies of you now outnumber the originals.",
      },
      {
        tone: "lead",
        text: "Nine copies. Pick a resident at random and nine times out of ten you land in a copy.",
      },
    ],
    stage: { ...STAGE0, copies: 9 },
  },
  {
    id: "cm-pull-99",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE COMPLETE" },
      {
        tone: "body",
        text: "Copies of you now outnumber the originals.",
      },
      {
        tone: "lead",
        text: "Nine copies. Pick a resident at random and nine times out of ten you land in a copy.",
      },
    ],
    stage: { ...STAGE0, copies: 9 },
    interaction: { type: "pull", to: 99 },
  },
  {
    id: "cm-body-99",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE COMPLETE" },
      {
        tone: "body",
        text: "Copies of you now outnumber the originals.",
      },
      {
        tone: "lead",
        text: "Ninety-nine copies. Ninety-nine times out of a hundred you land in a copy.",
      },
    ],
    stage: { ...STAGE0, copies: 99 },
  },
  {
    id: "cm-pull-999",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE COMPLETE" },
      {
        tone: "body",
        text: "Copies of you now outnumber the originals.",
      },
      {
        tone: "lead",
        text: "Ninety-nine copies. Ninety-nine times out of a hundred you land in a copy.",
      },
    ],
    stage: { ...STAGE0, copies: 99 },
    interaction: { type: "pull", to: 999 },
  },
  {
    id: "cm-silent",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "lead", text: "One of these is you." },
      {
        tone: "coral",
        text: "The other 999 are also certain they are you.",
      },
    ],
    stage: {
      show: true,
      copies: 999,
      showCounts: false,
      showLever: false,
      silent: true,
    },
  },
  {
    id: "cm-body-999",
    section: "copy-machine",
    kind: "stage",
    lines: [
      {
        tone: "lead",
        text: "The lever stops here. The arithmetic does not.",
      },
    ],
    stage: { ...STAGE0, copies: 999 },
  },
  {
    id: "cm-end",
    section: "copy-machine",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: "That is the whole trick, and it took one lever.",
      },
    ],
  },
];

/** Full entry deck. Other sections land in later passes. */
export const DECK: Card[] = [...COPY_MACHINE_CARDS];

export const DECK_SECTIONS: DeckSection[] = [
  {
    id: "copy-machine",
    title: "The Copy Machine",
    firstCardId: "cm-section",
  },
];

export function cardIndexById(id: string): number {
  return DECK.findIndex((c) => c.id === id);
}

export function sectionStartIndex(sectionId: string): number {
  const section = DECK_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return 0;
  const idx = cardIndexById(section.firstCardId);
  return idx >= 0 ? idx : 0;
}
