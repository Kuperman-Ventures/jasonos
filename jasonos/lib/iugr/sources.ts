/**
 * Sources drawer — receipts for curious humans. Not proof of simulation.
 */

export type SourceEntry = {
  id: string;
  name: string;
  citation: string;
  guideNote: string;
  href?: string;
};

export const SOURCES = {
  title: "For Humans Who Would Like Receipts",
  openingNote:
    "This entry is based on serious philosophical work. It does not follow that the universe has been caught using questionable software practices.",
  closeLabel: "Close sources",
  openLabel: "Open Sources",
  linkLabel: "Open link",
  evidenceNoteTitle: "A note on evidence",
  evidenceNote:
    "The simulation argument is principally philosophical and conditional. It should not be confused with scientific evidence that our universe is simulated.",
  entries: [
    {
      id: "bostrom",
      name: "Nick Bostrom",
      citation:
        "“Are You Living in a Computer Simulation?” (2003), The Philosophical Quarterly.",
      guideNote:
        "This is the foundational paper for the three-way simulation argument explored in the Three Doors chapter.",
      href: "https://simulation-argument.com/simulation.pdf",
    },
    {
      id: "chalmers",
      name: "David Chalmers",
      citation:
        "Reality+: Virtual Worlds and the Problems of Philosophy (2022).",
      guideNote:
        "Chalmers explores what it would mean for virtual or simulated worlds to be real at their own level for the people living in them.",
      href: "https://consc.net/reality/",
    },
    {
      id: "hanson",
      name: "Robin Hanson",
      citation:
        "“How to Live in a Simulation” / related work on simulations and emulations.",
      guideNote:
        "Hanson’s work is useful for thinking about incentives: even if future societies could run simulations, why assume they would make large numbers of historical ones?",
      href: "https://www.overcomingbias.com/p/am-i-a-simhtml",
    },
  ] satisfies SourceEntry[],
} as const;

export const CLOSING = {
  chapterLabel: "Chapter · Closing Field Note",
  title: "Field Note: Reality Remains Inconveniently Real",
  body: [
    "You have now completed an official tour of a very strange argument.",
    "The simulation argument is not proof that reality is simulated. It is a conditional idea about what happens if conscious copies become extraordinarily common.",
    "Whatever reality is made of, your experiences, choices, relationships, and consequences remain real in the life you are living.",
  ],
  guideLine:
    "You may now explain this at a cocktail party, provided you do not claim quantum mechanics was buffering.",
  exploreCopyLabel: "Explore the Copy Machine Again",
  openSourcesLabel: "Open Sources",
  shareLabel: "Send This Guide to a Curious Human",
  shareCopied: "Link copied. Dispatch it responsibly.",
  shareFailed: "Could not copy the link. You can share this page URL manually.",
  previousLabel: "Previous",
  shareTitle: "Are You an Original? — IUGR",
  shareText:
    "A guided thought experiment about copies, consciousness, and the simulation argument.",
} as const;
