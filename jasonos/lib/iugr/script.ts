/**
 * IUGR Entry 01 — approved product copy from the Full Script pass.
 * Quote-block text only. Do not invent or paraphrase.
 */

export const TRANSITION_1 = [
  "It starts with a town. Not ours. A smaller one, easier to count.",
] as const;

export const TRANSITION_2 = [
  "You have made the call. Now the machine gets to use it.",
] as const;

export const TRANSITION_3 = [
  "That is the whole trick, and it took one lever.",
  "But it only counts for anything if a machine like that ever gets built, and gets used, and makes minds that are actually in there. Three separate ifs.",
  "Bostrom saw the same problem. So he did not argue that we are copies. He argued that one of three things has to be true.",
] as const;

export const TRANSITION_4 = [
  "So which door?",
  "You already have opinions about that. Everyone does. Let us see what yours do to the count.",
] as const;

export const TRANSITION_5 = [
  "Which is a fair question. If three guesses move the answer that far, what would actually settle it?",
  "Short version: not the things people usually offer.",
] as const;

export const TRANSITION_6 = [
  "One thing left. What to actually do with this.",
] as const;

export const OPENING_BODY = [
  "You have met this idea before. It turns up in films, usually bent out of shape.",
  "The real thing is smaller and stranger. A philosopher called Nick Bostrom wrote it down in 2003, and we are going to walk his reasoning, step by step. It never claims reality is fake. It does something more awkward than that.",
  "Eight minutes. There is a lever involved.",
] as const;

export const OPENING_SCRIPT = {
  entryLabel: "ENTRY 01",
  title: "ARE YOU AN ORIGINAL?",
  body: OPENING_BODY,
  beginLabel: "Take me to the town",
} as const;

export const ORIGINAL_TOWN_SCRIPT = {
  beforeSelect: [
    "This is Original Town. One hundred residents, one bakery, and no reason to expect trouble.",
    "Pick someone. That one is you for the rest of the entry.",
  ],
  afterSelect: "Good. You live here now.",
  nextLabel: "Next",
  previousLabel: "Previous",
} as const;

export const THE_QUESTION_SCRIPT = {
  question: [
    "Suppose a machine could copy this town exactly. Every building, every resident, every memory. Including yours.",
    "Would the copy of you be a person?",
  ],
  choiceYes: "Yes, it would be a person",
  choiceUnsure: "I am not sure",
  choiceNo: "No, and I want to know why that matters",
  reactionYes:
    "Then there are two hundred people here now, and two of them are you. Hold on to that.",
  reactionUnsure:
    "Fair. Nobody has settled this one, including the people who do it for a living. We will carry the question with us.",
  reactionNo: "Then the second town is scenery. Watch what that does to the count.",
  fieldNote:
    'FIELD NOTE. Black Mirror\'s "White Christmas" spends a whole episode on this exact question, and does not enjoy the answer it finds.',
  continueLabel: "Start the machine",
  previousLabel: "Previous",
} as const;

export const THREE_DOORS_SCRIPT = {
  intro: [
    "Nick Bostrom, 2003. He did not claim we are simulated. He claimed this, and it is harder to get out of than it looks.",
    "At least one of the three is true. Not all of them. At least one.",
  ],
  doors: {
    "road-ends": {
      title: "The Road Ends Early",
      bostromQuote:
        "The human species is very likely to go extinct before reaching a 'posthuman' stage.",
      plainTranslation:
        "In plain terms: almost nobody gets far enough to build the machine.",
      body: [
        "Civilizations are fragile in boring ways and in interesting ones. They run out of things. They turn on themselves. Something else does it for them. If almost every civilization stops before it can run vast numbers of detailed minds, there are almost no copies to count.",
      ],
      sciFiAnchors: [
        "You have seen this door. Battlestar Galactica runs the same civilization into the ground over and over. The Three-Body Problem has advanced civilizations removed by other advanced civilizations, on principle, before they get anywhere.",
      ],
      takeaway: "If the road ends early, the count never starts.",
    },
    "archive-closed": {
      title: "The Archive Is Closed",
      bostromQuote:
        "Any posthuman civilization is extremely unlikely to run a significant number of simulations of their evolutionary history.",
      plainTranslation: "In plain terms: they get there, and they choose not to.",
      body: [
        "Being able to do a thing is not the same as wanting to. A civilization that could simulate its own past in detail might find it ruinously expensive, or grotesque, or illegal, or simply less interesting than whatever else is on offer by then.",
      ],
      sciFiAnchors: [
        "Star Trek gives its most capable civilization a standing rule against interfering with less advanced ones. In Her, the intelligences we build become more interesting than us and leave.",
      ],
      takeaway: "If the archive stays closed, copied observers stay rare.",
    },
    "copy-warehouse": {
      title: "The Copy Warehouse",
      bostromQuote:
        "We are almost certainly living in a computer simulation.",
      plainTranslation:
        "In plain terms: they get there, they build them, and they build an enormous number.",
      body: [
        "This is the door the Copy Machine was pointing at. If a computed mind can genuinely be a mind, and somebody runs vast numbers of them, then most minds like yours are copies. And yours is a mind like yours.",
        "This door needs three unsettled things at once: that a computed mind can have an inner life, that running one is affordable, and that someone wants to.",
      ],
      sciFiAnchors: [
        "The Thirteenth Floor is the closest film to the real argument. Its characters simulate 1937, with people in it who do not know. Then it shows you what is above them.",
      ],
      takeaway: "Only then do copies outnumber originals.",
    },
  },
  synthesis: [
    "That is the argument. Three doors, and at least one of them is the world you are in.",
    "It does not tell you which. That is not a hole in the argument. That is the argument.",
  ],
  continueLabel: "Back to the machine",
} as const;

export const ARCADE_SCRIPT = {
  intro: [
    "Same machine. Same town. Three new dials, one for each door.",
  ],
  dials: {
    civilizations: {
      title: "Do civilizations get that far?",
      options: [
        { id: "rarely" as const, label: "Rarely" },
        { id: "sometimes" as const, label: "Sometimes" },
        { id: "often" as const, label: "Often" },
      ],
    },
    history: {
      title: "Do they choose to build these?",
      options: [
        { id: "almost-never" as const, label: "Almost never" },
        { id: "sometimes" as const, label: "Sometimes" },
        { id: "constantly" as const, label: "Constantly" },
      ],
    },
    consciousness: {
      title: "Can a copied mind have an inner life?",
      options: [
        { id: "no" as const, label: "No" },
        { id: "unknown" as const, label: "Unknown" },
        { id: "yes" as const, label: "Yes" },
      ],
    },
  },
  challengeFindUnsettled: [
    "CHALLENGE",
    "Find a setting where the count refuses to settle.",
  ],
  challengeFindCopiesWin: [
    "CHALLENGE",
    "Now find one where the copies win.",
  ],
  readings: {
    "copies-stay-rare": {
      label: "Copies stay rare.",
      body: "In this setting the copies stay rare. Something upstream shuts the tap off before the numbers get anywhere.",
    },
    "will-not-settle": {
      label: "Will not settle.",
      body: "In this setting the count will not settle. You have left the mind question open, and everything downstream of it depends on the answer.",
    },
    "count-breaks": {
      label: "Count breaks.",
      body: "In this setting the count does not work at all. You said a copied mind is not a mind, so there is nothing inside the copies to count.",
    },
    "copies-win": {
      label: "Copies win.",
      body: "In this setting copies of you outnumber originals. That is the third door, and it needs all three dials pushed hard.",
    },
  },
  closingNote: [
    "Notice what just happened. You did not change a single fact about the universe. You changed three guesses, and the answer moved from \"almost none\" to \"almost all\".",
    "That is why this is an argument and not a measurement.",
  ],
  continueLabel: "Hear the usual answers",
} as const;

export const SCANNER_SCRIPT = {
  intro: [
    "Five things people say when this comes up. None of them are stupid. None of them settle anything either.",
    "Open whichever ones you have said yourself. Nothing to sort, nothing to complete.",
  ],
  claims: [
    {
      id: "matrix" as const,
      claim: "The Matrix is basically this.",
      paragraphs: [
        "Close, and wrong in a useful way.",
        "In The Matrix your brain is real. It is in a tank, and it is being fed a false world. You are being lied to.",
        "The argument is about people who are computed all the way down. No tank, no brain, nothing underneath.",
        "Knowing that difference is most of what this entry is for.",
      ],
    },
    {
      id: "graphics" as const,
      claim: "Graphics keep getting better, so reality is probably rendered too.",
      paragraphs: [
        "An analogy, not evidence.",
        "Better graphics tell you what we can render. They tell you nothing about what renders us. A convincing painting is not evidence that you are paint.",
      ],
    },
    {
      id: "quantum" as const,
      claim: "Quantum physics proves the universe only renders when someone looks.",
      paragraphs: [
        "Not what the physics says.",
        "This is a retelling that drifted a long way from the source. Measurement in quantum mechanics is genuinely strange, and it is strange in a way that has nothing to do with a renderer waiting for an observer.",
      ],
    },
    {
      id: "musk" as const,
      claim:
        "Elon Musk says the odds we are in base reality are one in billions.",
      paragraphs: [
        "He did say it, at a conference in 2016, and it traveled further than the argument did.",
        "A number from a confident person is not a reading from an instrument. Bostrom, who wrote the thing, spreads his own confidence roughly evenly across all three doors.",
      ],
    },
    {
      id: "nothing-matters" as const,
      claim: "If we are simulated, then nothing matters.",
      paragraphs: [
        "The argument does not go there.",
        "Nothing in the three doors makes your experiences less yours, or stops consequences being consequences. Whatever the substrate, this is the life you are in.",
      ],
    },
  ],
  summary: [
    "None of those five measure anything. Some are analogies, one is an argument, one is a famous person being confident.",
    "Keeping argument and evidence in separate pockets is the difference between being the interesting person at the party and being the tiring one.",
  ],
  continueLabel: "Close the entry",
} as const;

export const CLOSING_SCRIPT = {
  lead: "You have walked an argument, not a result.",
  keepIntro: "Three lines worth keeping:",
  keepLines: [
    "The simulation argument is not a claim that we are simulated. It is a claim that one of three things has to be true.",
    "Either almost no civilization gets that far. Or they get there and almost never build these. Or copies outnumber originals, and you are probably one.",
    "Bostrom splits his own confidence roughly evenly across the three. That is a better answer than picking one, and a better line than any of them.",
  ],
  actions: {
    runAgain: "Run the machine again",
    sources: "Where this comes from",
    send: "Send this to someone",
  },
} as const;

export const SOURCES_SCRIPT = {
  title: "Where This Comes From",
  openingNote:
    "Three pieces of real work sit under this entry. None of them claim the universe has been caught running on borrowed hardware.",
} as const;
