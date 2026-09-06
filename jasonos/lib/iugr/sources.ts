/**
 * Sources drawer — receipts for curious humans.
 */

import { SOURCES_SCRIPT } from "./script";

export type SourceEntry = {
  id: string;
  name: string;
  citation: string;
  guideNote: string;
  href?: string;
};

export const SOURCES = {
  title: SOURCES_SCRIPT.title,
  openingNote: SOURCES_SCRIPT.openingNote,
  closeLabel: "Close sources",
  openLabel: "Open Sources",
  linkLabel: "Open link",
  evidenceNoteTitle: "",
  evidenceNote: "",
  entries: [
    {
      id: "bostrom",
      name: "Nick Bostrom",
      citation:
        '"Are You Living in a Computer Simulation?" (2003), The Philosophical Quarterly.',
      guideNote:
        "The argument itself. The three propositions quoted on the doors are his words",
      href: "https://simulation-argument.com/simulation.pdf",
    },
    {
      id: "chalmers",
      name: "David Chalmers",
      citation: "Reality+: Virtual Worlds and the Problems of Philosophy (2022).",
      guideNote:
        "The case that a simulated world could still be a real world for the people living in it",
      href: "https://consc.net/reality/",
    },
    {
      id: "hanson",
      name: "Robin Hanson",
      citation: "On ancestor simulations",
      guideNote:
        "Why a civilization that could run these might not. Door 2's reasoning",
      href: "https://www.overcomingbias.com/p/am-i-a-simhtml",
    },
  ] satisfies SourceEntry[],
} as const;

export const CLOSING = {
  chapterLabel: "Chapter · Closing",
  title: "Closing",
  body: [] as string[],
  guideLine: "",
  exploreCopyLabel: "Run the machine again",
  openSourcesLabel: "Where this comes from",
  shareLabel: "Send this to someone",
  shareCopied: "Link copied. Dispatch it responsibly.",
  shareFailed: "Could not copy the link. You can share this page URL manually.",
  previousLabel: "Previous",
  shareTitle: "Are You an Original? - IUGR",
  shareText:
    "A guided thought experiment about copies, consciousness, and the simulation argument.",
} as const;
