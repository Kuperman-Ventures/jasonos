/**
 * IUGR card deck — one ordered array for the whole entry.
 * Renderer is dumb: it renders what a card says; it does not diff.
 * Accumulation is authored: later cards in a run restate earlier lines.
 * Product copy is quote-block text from the Entry 01 script only.
 */

export type Tone = "lead" | "body" | "coral";

export type SectionId =
  | "opening"
  | "original-town"
  | "the-question"
  | "copy-machine"
  | "three-doors"
  | "back-to-machine"
  | "claims"
  | "closing";

export type StageState = {
  show: boolean;
  town?: boolean;
  townCompact?: boolean;
  secondTown?: boolean;
  copies?: number;
  showCounts?: boolean;
  showLever?: boolean;
  silent?: boolean;
  doors?: "intro" | "door1" | "door2" | "door3" | "synthesis";
  dials?: boolean;
  reading?: boolean;
  /** Claim index 0–4 when showing claim stage. */
  claims?: number;
  closingActions?: boolean;
  challengePips?: number;
};

export type Interaction =
  | { type: "pull"; stops: number[] }
  | {
      type: "choose";
      options: { id: string; label: string }[];
      stateKey: string;
    }
  | { type: "pick"; of: number; stateKey: string };

export type CardLine = {
  tone: Tone;
  text: string;
};

export type Card = {
  id: string;
  section: SectionId;
  kind: "section" | "stage" | "text";
  lines: CardLine[];
  stage?: StageState;
  interaction?: Interaction;
};

export type DeckSection = {
  id: SectionId;
  title: string;
  firstCardId: string;
};

// ─── Opening ───────────────────────────────────────────────────────────────

const OPENING_CARDS: Card[] = [
  {
    id: "open-section",
    section: "opening",
    kind: "section",
    lines: [
      { tone: "body", text: "ENTRY 01" },
      { tone: "lead", text: "ARE YOU AN ORIGINAL?" },
    ],
  },
  {
    id: "open-1",
    section: "opening",
    kind: "text",
    lines: [
      {
        tone: "lead",
        text: "You have met this idea before. It turns up in films, usually bent out of shape.",
      },
    ],
  },
  {
    id: "open-2",
    section: "opening",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: "You have met this idea before. It turns up in films, usually bent out of shape.",
      },
      {
        tone: "lead",
        text: "The real thing is smaller and stranger. A philosopher called Nick Bostrom wrote it down in 2003, and we are going to walk his reasoning, step by step.",
      },
    ],
  },
  {
    id: "open-3",
    section: "opening",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: "You have met this idea before. It turns up in films, usually bent out of shape.",
      },
      {
        tone: "body",
        text: "The real thing is smaller and stranger. A philosopher called Nick Bostrom wrote it down in 2003, and we are going to walk his reasoning, step by step.",
      },
      {
        tone: "lead",
        text: "It never claims reality is fake. It does something more awkward than that.",
      },
    ],
  },
  {
    id: "open-4",
    section: "opening",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: "You have met this idea before. It turns up in films, usually bent out of shape.",
      },
      {
        tone: "body",
        text: "The real thing is smaller and stranger. A philosopher called Nick Bostrom wrote it down in 2003, and we are going to walk his reasoning, step by step.",
      },
      {
        tone: "body",
        text: "It never claims reality is fake. It does something more awkward than that.",
      },
      {
        tone: "lead",
        text: "Eight minutes. There is a lever involved.",
      },
    ],
  },
  {
    id: "open-trans",
    section: "opening",
    kind: "text",
    lines: [
      {
        tone: "lead",
        text: "It starts with a town. Not ours. A smaller one, easier to count.",
      },
    ],
  },
];

// ─── Original Town ─────────────────────────────────────────────────────────

const ORIGINAL_TOWN_CARDS: Card[] = [
  {
    id: "town-section",
    section: "original-town",
    kind: "section",
    lines: [{ tone: "lead", text: "Original Town" }],
  },
  {
    id: "town-1",
    section: "original-town",
    kind: "stage",
    lines: [
      {
        tone: "lead",
        text: "This is Original Town. One hundred residents, one bakery, and no reason to expect trouble.",
      },
    ],
    stage: { show: true, town: true },
  },
  {
    id: "town-2",
    section: "original-town",
    kind: "stage",
    lines: [
      {
        tone: "body",
        text: "This is Original Town. One hundred residents, one bakery, and no reason to expect trouble.",
      },
      {
        tone: "lead",
        text: "Pick someone. That one is you for the rest of the entry.",
      },
    ],
    stage: { show: true, town: true },
  },
  {
    id: "town-pick",
    section: "original-town",
    kind: "stage",
    lines: [
      {
        tone: "body",
        text: "This is Original Town. One hundred residents, one bakery, and no reason to expect trouble.",
      },
      {
        tone: "lead",
        text: "Pick someone. That one is you for the rest of the entry.",
      },
    ],
    stage: { show: true, town: true },
    interaction: { type: "pick", of: 100, stateKey: "readerFigureIndex" },
  },
  {
    id: "town-after",
    section: "original-town",
    kind: "stage",
    lines: [{ tone: "lead", text: "Good. You live here now." }],
    stage: { show: true, town: true },
  },
];

// ─── The Question ──────────────────────────────────────────────────────────

const THE_QUESTION_CARDS: Card[] = [
  {
    id: "q-section",
    section: "the-question",
    kind: "section",
    lines: [{ tone: "lead", text: "The Question" }],
  },
  {
    id: "q-1",
    section: "the-question",
    kind: "stage",
    lines: [
      {
        tone: "lead",
        text: "Suppose a machine could copy this town exactly. Every building, every resident, every memory. Including yours.",
      },
    ],
    stage: { show: true, town: true, townCompact: true },
  },
  {
    id: "q-2",
    section: "the-question",
    kind: "stage",
    lines: [
      {
        tone: "body",
        text: "Suppose a machine could copy this town exactly. Every building, every resident, every memory. Including yours.",
      },
      { tone: "lead", text: "Would the copy of you be a person?" },
    ],
    stage: { show: true, town: true, townCompact: true },
  },
  {
    id: "q-choose",
    section: "the-question",
    kind: "stage",
    lines: [
      {
        tone: "body",
        text: "Suppose a machine could copy this town exactly. Every building, every resident, every memory. Including yours.",
      },
      { tone: "lead", text: "Would the copy of you be a person?" },
    ],
    stage: { show: true, town: true, townCompact: true, secondTown: true },
    interaction: {
      type: "choose",
      stateKey: "copiesAreConscious",
      options: [
        { id: "yes", label: "Yes, it would be a person" },
        { id: "unsure", label: "I am not sure" },
        { id: "no", label: "No, and I want to know why that matters" },
      ],
    },
  },
  {
    id: "q-field-note",
    section: "the-question",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: 'FIELD NOTE. Black Mirror\'s "White Christmas" spends a whole episode on this exact question, and does not enjoy the answer it finds.',
      },
    ],
  },
  {
    id: "q-trans",
    section: "the-question",
    kind: "text",
    lines: [
      {
        tone: "lead",
        text: "You have made the call. Now the machine gets to use it.",
      },
    ],
  },
];

// ─── Copy Machine ──────────────────────────────────────────────────────────

const CM_CHALLENGE = "Pull the lever until the copies outnumber the originals.";

const COPY_MACHINE_CARDS: Card[] = [
  {
    id: "cm-section",
    section: "copy-machine",
    kind: "section",
    lines: [{ tone: "lead", text: "The Copy Machine" }],
  },
  {
    id: "cm-challenge",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE" },
      { tone: "lead", text: CM_CHALLENGE },
    ],
    stage: {
      show: true,
      copies: 0,
      showCounts: true,
      showLever: true,
    },
  },
  {
    id: "cm-pull",
    section: "copy-machine",
    kind: "stage",
    lines: [
      { tone: "body", text: "CHALLENGE" },
      { tone: "lead", text: CM_CHALLENGE },
    ],
    stage: {
      show: true,
      copies: 0,
      showCounts: true,
      showLever: true,
    },
    interaction: { type: "pull", stops: [0, 1, 9, 99, 999] },
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
    stage: {
      show: true,
      copies: 999,
      showCounts: true,
      showLever: true,
    },
  },
  {
    id: "cm-trans-1",
    section: "copy-machine",
    kind: "text",
    lines: [
      {
        tone: "lead",
        text: "That is the whole trick, and it took one lever.",
      },
    ],
  },
  {
    id: "cm-trans-2",
    section: "copy-machine",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: "That is the whole trick, and it took one lever.",
      },
      {
        tone: "lead",
        text: "But it only counts for anything if a machine like that ever gets built, and gets used, and makes minds that are actually in there. Three separate ifs.",
      },
    ],
  },
  {
    id: "cm-trans-3",
    section: "copy-machine",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: "That is the whole trick, and it took one lever.",
      },
      {
        tone: "body",
        text: "But it only counts for anything if a machine like that ever gets built, and gets used, and makes minds that are actually in there. Three separate ifs.",
      },
      {
        tone: "lead",
        text: "Bostrom saw the same problem. So he did not argue that we are copies. He argued that one of three things has to be true.",
      },
    ],
  },
];

// ─── Three Doors ───────────────────────────────────────────────────────────

const DOOR1_PROP =
  "The human species is very likely to go extinct before reaching a 'posthuman' stage.";
const DOOR1_PLAIN =
  "In plain terms: almost nobody gets far enough to build the machine.";
const DOOR1_BODY_A =
  "Civilizations are fragile in boring ways and in interesting ones. They run out of things. They turn on themselves. Something else does it for them.";
const DOOR1_BODY_B =
  "If almost every civilization stops before it can run vast numbers of detailed minds, there are almost no copies to count.";
const DOOR1_FICTION =
  "You have seen this door. Battlestar Galactica runs the same civilization into the ground over and over. The Three-Body Problem has advanced civilizations removed by other advanced civilizations, on principle, before they get anywhere.";
const DOOR1_TAKE =
  "If the road ends early, the count never starts.";

const DOOR2_PROP =
  "Any posthuman civilization is extremely unlikely to run a significant number of simulations of their evolutionary history.";
const DOOR2_PLAIN =
  "In plain terms: they get there, and they choose not to.";
const DOOR2_BODY_A =
  "Being able to do a thing is not the same as wanting to.";
const DOOR2_BODY_B =
  "A civilization that could simulate its own past in detail might find it ruinously expensive, or grotesque, or illegal, or simply less interesting than whatever else is on offer by then.";
const DOOR2_FICTION =
  "Star Trek gives its most capable civilization a standing rule against interfering with less advanced ones. In Her, the intelligences we build become more interesting than us and leave.";
const DOOR2_TAKE =
  "If the archive stays closed, copied observers stay rare.";

const DOOR3_PROP = "We are almost certainly living in a computer simulation.";
const DOOR3_PLAIN =
  "In plain terms: they get there, they build them, and they build an enormous number.";
const DOOR3_BODY_A =
  "This is the door the Copy Machine was pointing at. If a computed mind can genuinely be a mind, and somebody runs vast numbers of them, then most minds like yours are copies. And yours is a mind like yours.";
const DOOR3_BODY_B =
  "This door needs three unsettled things at once: that a computed mind can have an inner life, that running one is affordable, and that someone wants to.";
const DOOR3_FICTION =
  "The Thirteenth Floor is the closest film to the real argument. Its characters simulate 1937, with people in it who do not know. Then it shows you what is above them.";
const DOOR3_TAKE = "Only then do copies outnumber originals.";

const THREE_DOORS_CARDS: Card[] = [
  {
    id: "doors-section",
    section: "three-doors",
    kind: "section",
    lines: [{ tone: "lead", text: "Three Doors" }],
  },
  {
    id: "doors-intro-1",
    section: "three-doors",
    kind: "stage",
    lines: [
      {
        tone: "lead",
        text: "Nick Bostrom, 2003. He did not claim we are simulated. He claimed this, and it is harder to get out of than it looks.",
      },
    ],
    stage: { show: true, doors: "intro" },
  },
  {
    id: "doors-intro-2",
    section: "three-doors",
    kind: "stage",
    lines: [
      {
        tone: "body",
        text: "Nick Bostrom, 2003. He did not claim we are simulated. He claimed this, and it is harder to get out of than it looks.",
      },
      {
        tone: "lead",
        text: "At least one of the three is true. Not all of them. At least one.",
      },
    ],
    stage: { show: true, doors: "intro" },
  },

  // Door 1 run
  {
    id: "door1-prop",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: "The Road Ends Early" },
      { tone: "lead", text: DOOR1_PROP },
    ],
    stage: { show: true, doors: "door1" },
  },
  {
    id: "door1-plain",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR1_PROP },
      { tone: "lead", text: DOOR1_PLAIN },
    ],
    stage: { show: true, doors: "door1" },
  },
  {
    id: "door1-body-a",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR1_PROP },
      { tone: "body", text: DOOR1_PLAIN },
      { tone: "lead", text: DOOR1_BODY_A },
    ],
    stage: { show: true, doors: "door1" },
  },
  {
    id: "door1-body-b",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR1_PROP },
      { tone: "body", text: DOOR1_PLAIN },
      { tone: "body", text: DOOR1_BODY_A },
      { tone: "lead", text: DOOR1_BODY_B },
    ],
    stage: { show: true, doors: "door1" },
  },
  {
    id: "door1-fiction",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR1_PROP },
      { tone: "body", text: DOOR1_PLAIN },
      { tone: "body", text: DOOR1_BODY_A },
      { tone: "body", text: DOOR1_BODY_B },
      { tone: "lead", text: DOOR1_FICTION },
    ],
    stage: { show: true, doors: "door1" },
  },
  {
    id: "door1-take",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR1_PROP },
      { tone: "body", text: DOOR1_PLAIN },
      { tone: "body", text: DOOR1_BODY_A },
      { tone: "body", text: DOOR1_BODY_B },
      { tone: "body", text: DOOR1_FICTION },
      { tone: "coral", text: DOOR1_TAKE },
    ],
    stage: { show: true, doors: "door1" },
  },

  // Door 2 run
  {
    id: "door2-prop",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: "The Archive Is Closed" },
      { tone: "lead", text: DOOR2_PROP },
    ],
    stage: { show: true, doors: "door2" },
  },
  {
    id: "door2-plain",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR2_PROP },
      { tone: "lead", text: DOOR2_PLAIN },
    ],
    stage: { show: true, doors: "door2" },
  },
  {
    id: "door2-body-a",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR2_PROP },
      { tone: "body", text: DOOR2_PLAIN },
      { tone: "lead", text: DOOR2_BODY_A },
    ],
    stage: { show: true, doors: "door2" },
  },
  {
    id: "door2-body-b",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR2_PROP },
      { tone: "body", text: DOOR2_PLAIN },
      { tone: "body", text: DOOR2_BODY_A },
      { tone: "lead", text: DOOR2_BODY_B },
    ],
    stage: { show: true, doors: "door2" },
  },
  {
    id: "door2-fiction",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR2_PROP },
      { tone: "body", text: DOOR2_PLAIN },
      { tone: "body", text: DOOR2_BODY_A },
      { tone: "body", text: DOOR2_BODY_B },
      { tone: "lead", text: DOOR2_FICTION },
    ],
    stage: { show: true, doors: "door2" },
  },
  {
    id: "door2-take",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR2_PROP },
      { tone: "body", text: DOOR2_PLAIN },
      { tone: "body", text: DOOR2_BODY_A },
      { tone: "body", text: DOOR2_BODY_B },
      { tone: "body", text: DOOR2_FICTION },
      { tone: "coral", text: DOOR2_TAKE },
    ],
    stage: { show: true, doors: "door2" },
  },

  // Door 3 run
  {
    id: "door3-prop",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: "The Copy Warehouse" },
      { tone: "lead", text: DOOR3_PROP },
    ],
    stage: { show: true, doors: "door3" },
  },
  {
    id: "door3-plain",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR3_PROP },
      { tone: "lead", text: DOOR3_PLAIN },
    ],
    stage: { show: true, doors: "door3" },
  },
  {
    id: "door3-body-a",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR3_PROP },
      { tone: "body", text: DOOR3_PLAIN },
      { tone: "lead", text: DOOR3_BODY_A },
    ],
    stage: { show: true, doors: "door3" },
  },
  {
    id: "door3-body-b",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR3_PROP },
      { tone: "body", text: DOOR3_PLAIN },
      { tone: "body", text: DOOR3_BODY_A },
      { tone: "lead", text: DOOR3_BODY_B },
    ],
    stage: { show: true, doors: "door3" },
  },
  {
    id: "door3-fiction",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR3_PROP },
      { tone: "body", text: DOOR3_PLAIN },
      { tone: "body", text: DOOR3_BODY_A },
      { tone: "body", text: DOOR3_BODY_B },
      { tone: "lead", text: DOOR3_FICTION },
    ],
    stage: { show: true, doors: "door3" },
  },
  {
    id: "door3-take",
    section: "three-doors",
    kind: "stage",
    lines: [
      { tone: "body", text: DOOR3_PROP },
      { tone: "body", text: DOOR3_PLAIN },
      { tone: "body", text: DOOR3_BODY_A },
      { tone: "body", text: DOOR3_BODY_B },
      { tone: "body", text: DOOR3_FICTION },
      { tone: "coral", text: DOOR3_TAKE },
    ],
    stage: { show: true, doors: "door3" },
  },

  // Synthesis
  {
    id: "doors-synth-1",
    section: "three-doors",
    kind: "stage",
    lines: [
      {
        tone: "lead",
        text: "That is the argument. Three doors, and at least one of them is the world you are in.",
      },
    ],
    stage: { show: true, doors: "synthesis" },
  },
  {
    id: "doors-synth-2",
    section: "three-doors",
    kind: "stage",
    lines: [
      {
        tone: "body",
        text: "That is the argument. Three doors, and at least one of them is the world you are in.",
      },
      {
        tone: "lead",
        text: "It does not tell you which. That is not a hole in the argument. That is the argument.",
      },
    ],
    stage: { show: true, doors: "synthesis" },
  },
  {
    id: "doors-choose",
    section: "three-doors",
    kind: "stage",
    lines: [{ tone: "lead", text: "Which door do you think it is?" }],
    stage: { show: true, doors: "synthesis" },
    interaction: {
      type: "choose",
      stateKey: "chosenDoor",
      options: [
        { id: "road-ends", label: "The Road Ends Early" },
        { id: "archive-closed", label: "The Archive Is Closed" },
        { id: "copy-warehouse", label: "The Copy Warehouse" },
      ],
    },
  },
  {
    id: "doors-trans-1",
    section: "three-doors",
    kind: "text",
    lines: [{ tone: "lead", text: "So which door?" }],
  },
  {
    id: "doors-trans-2",
    section: "three-doors",
    kind: "text",
    lines: [
      { tone: "body", text: "So which door?" },
      {
        tone: "lead",
        text: "You already have opinions about that. Everyone does. Let us see what yours do to the count.",
      },
    ],
  },
];

// ─── Back To The Machine ───────────────────────────────────────────────────

const BACK_TO_MACHINE_CARDS: Card[] = [
  {
    id: "btm-section",
    section: "back-to-machine",
    kind: "section",
    lines: [{ tone: "lead", text: "Back To The Machine" }],
  },
  {
    id: "btm-intro",
    section: "back-to-machine",
    kind: "stage",
    lines: [
      {
        tone: "lead",
        text: "Same machine. Same town. Three new dials, one for each door.",
      },
    ],
    stage: { show: true, dials: true, copies: 0, showCounts: true },
  },
  {
    id: "btm-dial-civilizations",
    section: "back-to-machine",
    kind: "stage",
    lines: [
      { tone: "lead", text: "Do civilizations get that far?" },
    ],
    stage: { show: true, dials: true, copies: 0, showCounts: true },
    interaction: {
      type: "choose",
      stateKey: "civilizations",
      options: [
        { id: "rarely", label: "Rarely" },
        { id: "sometimes", label: "Sometimes" },
        { id: "often", label: "Often" },
      ],
    },
  },
  {
    id: "btm-dial-history",
    section: "back-to-machine",
    kind: "stage",
    lines: [
      { tone: "lead", text: "Do they choose to build these?" },
    ],
    stage: { show: true, dials: true, copies: 0, showCounts: true },
    interaction: {
      type: "choose",
      stateKey: "history",
      options: [
        { id: "almost-never", label: "Almost never" },
        { id: "sometimes", label: "Sometimes" },
        { id: "constantly", label: "Constantly" },
      ],
    },
  },
  {
    id: "btm-dial-consciousness",
    section: "back-to-machine",
    kind: "stage",
    lines: [
      { tone: "lead", text: "Can a copied mind have an inner life?" },
    ],
    stage: { show: true, dials: true, copies: 0, showCounts: true },
    interaction: {
      type: "choose",
      stateKey: "consciousness",
      options: [
        { id: "no", label: "No" },
        { id: "unknown", label: "Unknown" },
        { id: "yes", label: "Yes" },
      ],
    },
  },
  {
    id: "btm-reading",
    section: "back-to-machine",
    kind: "stage",
    lines: [],
    stage: { show: false, reading: true },
  },
  {
    id: "btm-note-1",
    section: "back-to-machine",
    kind: "text",
    lines: [
      {
        tone: "lead",
        text: 'Notice what just happened. You did not change a single fact about the universe. You changed three guesses, and the answer moved from "almost none" to "almost all".',
      },
    ],
  },
  {
    id: "btm-note-2",
    section: "back-to-machine",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: 'Notice what just happened. You did not change a single fact about the universe. You changed three guesses, and the answer moved from "almost none" to "almost all".',
      },
      {
        tone: "lead",
        text: "That is why this is an argument and not a measurement.",
      },
    ],
  },
  {
    id: "btm-trans-1",
    section: "back-to-machine",
    kind: "text",
    lines: [
      {
        tone: "lead",
        text: "Which is a fair question. If three guesses move the answer that far, what would actually settle it?",
      },
    ],
  },
  {
    id: "btm-trans-2",
    section: "back-to-machine",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: "Which is a fair question. If three guesses move the answer that far, what would actually settle it?",
      },
      {
        tone: "lead",
        text: "Short version: not the things people usually offer.",
      },
    ],
  },
];

// ─── Claims ────────────────────────────────────────────────────────────────

const CLAIM_MATRIX = "The Matrix is basically this.";
const CLAIM_GRAPHICS =
  "Graphics keep getting better, so reality is probably rendered too.";
const CLAIM_QUANTUM =
  "Quantum physics proves the universe only renders when someone looks.";
const CLAIM_MUSK =
  "Elon Musk says the odds we are in base reality are one in billions.";
const CLAIM_NOTHING = "If we are simulated, then nothing matters.";

const CLAIMS_CARDS: Card[] = [
  {
    id: "claims-section",
    section: "claims",
    kind: "section",
    lines: [{ tone: "lead", text: "What People Say At Parties" }],
  },
  {
    id: "claims-intro-1",
    section: "claims",
    kind: "text",
    lines: [
      {
        tone: "lead",
        text: "Five things people say when this comes up. None of them are stupid. None of them settle anything either.",
      },
    ],
  },
  {
    id: "claims-intro-2",
    section: "claims",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: "Five things people say when this comes up. None of them are stupid. None of them settle anything either.",
      },
      {
        tone: "lead",
        text: "Open whichever ones you have said yourself. Nothing to sort, nothing to complete.",
      },
    ],
  },

  // Claim 0 — Matrix
  {
    id: "claim-0",
    section: "claims",
    kind: "stage",
    lines: [{ tone: "lead", text: CLAIM_MATRIX }],
    stage: { show: true, claims: 0 },
  },
  {
    id: "claim-0-verdict",
    section: "claims",
    kind: "stage",
    lines: [
      { tone: "body", text: CLAIM_MATRIX },
      { tone: "coral", text: "Close, and wrong in a useful way." },
    ],
    stage: { show: true, claims: 0 },
  },
  {
    id: "claim-0-a",
    section: "claims",
    kind: "stage",
    lines: [
      { tone: "body", text: CLAIM_MATRIX },
      { tone: "coral", text: "Close, and wrong in a useful way." },
      {
        tone: "lead",
        text: "In The Matrix your brain is real. It is in a tank, and it is being fed a false world. You are being lied to.",
      },
    ],
    stage: { show: true, claims: 0 },
  },
  {
    id: "claim-0-b",
    section: "claims",
    kind: "stage",
    lines: [
      { tone: "body", text: CLAIM_MATRIX },
      { tone: "coral", text: "Close, and wrong in a useful way." },
      {
        tone: "body",
        text: "In The Matrix your brain is real. It is in a tank, and it is being fed a false world. You are being lied to.",
      },
      {
        tone: "lead",
        text: "The argument is about people who are computed all the way down. No tank, no brain, nothing underneath.",
      },
    ],
    stage: { show: true, claims: 0 },
  },
  {
    id: "claim-0-c",
    section: "claims",
    kind: "stage",
    lines: [
      { tone: "body", text: CLAIM_MATRIX },
      { tone: "coral", text: "Close, and wrong in a useful way." },
      {
        tone: "body",
        text: "In The Matrix your brain is real. It is in a tank, and it is being fed a false world. You are being lied to.",
      },
      {
        tone: "body",
        text: "The argument is about people who are computed all the way down. No tank, no brain, nothing underneath.",
      },
      {
        tone: "lead",
        text: "Knowing that difference is most of what this entry is for.",
      },
    ],
    stage: { show: true, claims: 0 },
  },

  // Claim 1 — Graphics
  {
    id: "claim-1",
    section: "claims",
    kind: "stage",
    lines: [{ tone: "lead", text: CLAIM_GRAPHICS }],
    stage: { show: true, claims: 1 },
  },
  {
    id: "claim-1-verdict",
    section: "claims",
    kind: "stage",
    lines: [
      { tone: "body", text: CLAIM_GRAPHICS },
      { tone: "coral", text: "An analogy, not evidence." },
      {
        tone: "lead",
        text: "Better graphics tell you what we can render. They tell you nothing about what renders us. A convincing painting is not evidence that you are paint.",
      },
    ],
    stage: { show: true, claims: 1 },
  },

  // Claim 2 — Quantum
  {
    id: "claim-2",
    section: "claims",
    kind: "stage",
    lines: [{ tone: "lead", text: CLAIM_QUANTUM }],
    stage: { show: true, claims: 2 },
  },
  {
    id: "claim-2-verdict",
    section: "claims",
    kind: "stage",
    lines: [
      { tone: "body", text: CLAIM_QUANTUM },
      { tone: "coral", text: "Not what the physics says." },
      {
        tone: "lead",
        text: "This is a retelling that drifted a long way from the source. Measurement in quantum mechanics is genuinely strange, and it is strange in a way that has nothing to do with a renderer waiting for an observer.",
      },
    ],
    stage: { show: true, claims: 2 },
  },

  // Claim 3 — Musk
  {
    id: "claim-3",
    section: "claims",
    kind: "stage",
    lines: [{ tone: "lead", text: CLAIM_MUSK }],
    stage: { show: true, claims: 3 },
  },
  {
    id: "claim-3-verdict",
    section: "claims",
    kind: "stage",
    lines: [
      { tone: "body", text: CLAIM_MUSK },
      {
        tone: "coral",
        text: "He did say it, at a conference in 2016, and it traveled further than the argument did.",
      },
    ],
    stage: { show: true, claims: 3 },
  },
  {
    id: "claim-3-a",
    section: "claims",
    kind: "stage",
    lines: [
      { tone: "body", text: CLAIM_MUSK },
      {
        tone: "coral",
        text: "He did say it, at a conference in 2016, and it traveled further than the argument did.",
      },
      {
        tone: "lead",
        text: "A number from a confident person is not a reading from an instrument. Bostrom, who wrote the thing, spreads his own confidence roughly evenly across all three doors.",
      },
    ],
    stage: { show: true, claims: 3 },
  },

  // Claim 4 — Nothing matters
  {
    id: "claim-4",
    section: "claims",
    kind: "stage",
    lines: [{ tone: "lead", text: CLAIM_NOTHING }],
    stage: { show: true, claims: 4 },
  },
  {
    id: "claim-4-verdict",
    section: "claims",
    kind: "stage",
    lines: [
      { tone: "body", text: CLAIM_NOTHING },
      { tone: "coral", text: "The argument does not go there." },
      {
        tone: "lead",
        text: "Nothing in the three doors makes your experiences less yours, or stops consequences being consequences. Whatever the substrate, this is the life you are in.",
      },
    ],
    stage: { show: true, claims: 4 },
  },

  // Summary
  {
    id: "claims-summary-1",
    section: "claims",
    kind: "text",
    lines: [
      {
        tone: "lead",
        text: "None of those five measure anything. Some are analogies, one is an argument, one is a famous person being confident.",
      },
    ],
  },
  {
    id: "claims-summary-2",
    section: "claims",
    kind: "text",
    lines: [
      {
        tone: "body",
        text: "None of those five measure anything. Some are analogies, one is an argument, one is a famous person being confident.",
      },
      {
        tone: "lead",
        text: "Keeping argument and evidence in separate pockets is the difference between being the interesting person at the party and being the tiring one.",
      },
    ],
  },
  {
    id: "claims-trans",
    section: "claims",
    kind: "text",
    lines: [
      {
        tone: "lead",
        text: "One thing left. What to actually do with this.",
      },
    ],
  },
];

// ─── Closing ───────────────────────────────────────────────────────────────

const KEEP_1 =
  "The simulation argument is not a claim that we are simulated. It is a claim that one of three things has to be true.";
const KEEP_2 =
  "Either almost no civilization gets that far. Or they get there and almost never build these. Or copies outnumber originals, and you are probably one.";
const KEEP_3 =
  "Bostrom splits his own confidence roughly evenly across the three. That is a better answer than picking one, and a better line than any of them.";

const CLOSING_CARDS: Card[] = [
  {
    id: "close-section",
    section: "closing",
    kind: "section",
    lines: [{ tone: "lead", text: "Closing" }],
  },
  {
    id: "close-1",
    section: "closing",
    kind: "text",
    lines: [
      { tone: "lead", text: "You have walked an argument, not a result." },
      { tone: "body", text: "Three lines worth keeping:" },
    ],
  },
  {
    id: "close-2",
    section: "closing",
    kind: "text",
    lines: [
      { tone: "body", text: "You have walked an argument, not a result." },
      { tone: "body", text: "Three lines worth keeping:" },
      { tone: "lead", text: KEEP_1 },
    ],
  },
  {
    id: "close-3",
    section: "closing",
    kind: "text",
    lines: [
      { tone: "body", text: "You have walked an argument, not a result." },
      { tone: "body", text: "Three lines worth keeping:" },
      { tone: "body", text: KEEP_1 },
      { tone: "lead", text: KEEP_2 },
    ],
  },
  {
    id: "close-4",
    section: "closing",
    kind: "text",
    lines: [
      { tone: "body", text: "You have walked an argument, not a result." },
      { tone: "body", text: "Three lines worth keeping:" },
      { tone: "body", text: KEEP_1 },
      { tone: "body", text: KEEP_2 },
      { tone: "lead", text: KEEP_3 },
    ],
  },
  {
    id: "close-actions",
    section: "closing",
    kind: "stage",
    lines: [
      { tone: "body", text: KEEP_1 },
      { tone: "body", text: KEEP_2 },
      { tone: "body", text: KEEP_3 },
    ],
    stage: { show: false, closingActions: true },
  },
];

// ─── Deck exports ──────────────────────────────────────────────────────────

/** Copy Machine body lines keyed by lever stop. */
export const PULL_BODY: Record<number, string> = {
  0: "One lever. It does exactly one thing, and the thing it does is arithmetic.",
  1: "One copy and it is already even. You did not have to work very hard for that.",
  9: "Nine copies. Pick a resident at random and nine times out of ten you land in a copy.",
  99: "Ninety-nine copies. Ninety-nine times out of a hundred you land in a copy.",
  999: "The lever stops here. The arithmetic does not.",
};

export const PULL_BODY_UNSURE =
  "You left the mind question open. The count runs, but it does not settle anything.";

export const PULL_BODY_NO =
  "You said copies are not people. The machine still makes them. It just has nothing to count.";

export const QUESTION_REACTIONS: Record<string, string> = {
  yes: "Then there are two hundred people here now, and two of them are you. Hold on to that.",
  unsure:
    "Fair. Nobody has settled this one, including the people who do it for a living. We will carry the question with us.",
  no: "Then the second town is scenery. Watch what that does to the count.",
};

export const DECK: Card[] = [
  ...OPENING_CARDS,
  ...ORIGINAL_TOWN_CARDS,
  ...THE_QUESTION_CARDS,
  ...COPY_MACHINE_CARDS,
  ...THREE_DOORS_CARDS,
  ...BACK_TO_MACHINE_CARDS,
  ...CLAIMS_CARDS,
  ...CLOSING_CARDS,
];

export const DECK_SECTIONS: DeckSection[] = [
  {
    id: "opening",
    title: "Are You an Original?",
    firstCardId: "open-section",
  },
  {
    id: "original-town",
    title: "Original Town",
    firstCardId: "town-section",
  },
  {
    id: "the-question",
    title: "The Question",
    firstCardId: "q-section",
  },
  {
    id: "copy-machine",
    title: "The Copy Machine",
    firstCardId: "cm-section",
  },
  {
    id: "three-doors",
    title: "Three Doors",
    firstCardId: "doors-section",
  },
  {
    id: "back-to-machine",
    title: "Back To The Machine",
    firstCardId: "btm-section",
  },
  {
    id: "claims",
    title: "What People Say At Parties",
    firstCardId: "claims-section",
  },
  {
    id: "closing",
    title: "Closing",
    firstCardId: "close-section",
  },
];

export function cardIndexById(id: string): number {
  return DECK.findIndex((c) => c.id === id);
}

export function sectionStartIndex(sectionId: SectionId): number {
  const section = DECK_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return 0;
  const idx = cardIndexById(section.firstCardId);
  return idx >= 0 ? idx : 0;
}
