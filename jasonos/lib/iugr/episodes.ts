import type {
  ChapterDefinition,
  ChapterId,
  EpisodeDefinition,
  FutureEntryTeaser,
} from "./types";

export const CHAPTERS: Record<ChapterId, ChapterDefinition> = {
  opening: {
    id: "opening",
    order: 1,
    title: "Opening",
    shortLabel: "Open",
    placeholder: {
      kicker: "ENTRY 01",
      headline: "ARE YOU AN ORIGINAL?",
      body: [
        "A guided thought experiment about copies, consciousness, and the simulation argument.",
        "Useful for navigating reality. Some assembly of reality may have occurred before purchase.",
        "This is a thought experiment. It is not proof that your phone is lying to you. Your phone has enough other problems.",
      ],
      ctaLabel: "Begin the entry",
    },
  },
  "original-town": {
    id: "original-town",
    order: 2,
    title: "Original Town",
    shortLabel: "Town",
    placeholder: {
      headline: "Original Town",
      body: [
        "A quiet settlement where everyone seems to be the first of their kind.",
        "Later you will walk its streets and notice how oddly heavy the word “original” becomes.",
        "For now this is a pin on the map — the full visit arrives in a later build.",
      ],
    },
  },
  "copy-machine": {
    id: "copy-machine",
    order: 3,
    title: "Copy Machine",
    shortLabel: "Copy",
    placeholder: {
      headline: "The Copy Machine",
      body: [
        "A careful machine that can make another you — or something that looks that way.",
        "The point is not sci-fi spectacle. It is to feel how strange “the original” becomes under pressure.",
        "Interactive copy play waits in a later chapter build.",
      ],
    },
  },
  "three-doors": {
    id: "three-doors",
    order: 4,
    title: "Three Doors",
    shortLabel: "Doors",
    placeholder: {
      headline: "Three Doors",
      body: [
        "Three futures. One argument. You choose which door to open first.",
        "This remains a philosophical thought experiment — not a verdict about the universe.",
      ],
    },
  },
  "assumption-arcade": {
    id: "assumption-arcade",
    order: 5,
    title: "Assumption Arcade",
    shortLabel: "Arcade",
    placeholder: {
      headline: "Assumption Arcade",
      body: [
        "A sandbox for poking the quiet assumptions behind the copy-counting argument.",
        "Controls rearrange scenarios. They do not measure our universe.",
      ],
    },
  },
  "evidence-scanner": {
    id: "evidence-scanner",
    order: 6,
    title: "Scan the Claims",
    shortLabel: "Evidence",
    placeholder: {
      headline: "Scan the Claims",
      body: [
        "Classify popular claims as evidence, assumption, or interesting-but-not-proof.",
        "The scanner keeps us honest: an argument is not the same thing as an observation.",
      ],
    },
  },
  "the-catch": {
    id: "the-catch",
    order: 7,
    title: "The Catch",
    shortLabel: "Catch",
    placeholder: {
      headline: "The Catch",
      body: [
        "Inspect the caveats that keep the simulation argument clever rather than conclusive.",
        "You leave clearer about what the argument can and cannot do.",
      ],
    },
  },
  closing: {
    id: "closing",
    order: 8,
    title: "Closing Field Note",
    shortLabel: "Close",
    placeholder: {
      headline: "Field Note: Reality Remains Inconveniently Real",
      body: [
        "You have walked a philosophical argument, not a lab result.",
        "Take what was useful. Leave the rest on the shelf for another day.",
      ],
    },
  },
}

export const CHAPTER_SEQUENCE: ChapterId[] = [
  "opening",
  "original-town",
  "copy-machine",
  "three-doors",
  "assumption-arcade",
  "evidence-scanner",
  "the-catch",
  "closing",
];

export const EPISODE_01: EpisodeDefinition = {
  id: "are-you-an-original",
  entryNumber: 1,
  title: "Are You an Original?",
  subtitle:
    "A guided thought experiment about copies, consciousness, and the simulation argument.",
  seriesName: "The Improbably Useful Guide to Reality",
  seriesShortName: "IUGR",
  pronunciation: "Eye-Ew-Gurr",
  estimatedMinutes: { min: 8, max: 10 },
  chapterIds: CHAPTER_SEQUENCE,
};

export const FUTURE_ENTRIES: FutureEntryTeaser[] = [
  {
    id: "why-time-moves",
    title: "Why Does Time Feel Like It Moves?",
    statusLabel: "Coming soon",
  },
  {
    id: "same-person-at-8",
    title: "Are You the Same Person You Were at 8?",
    statusLabel: "Coming soon",
  },
  {
    id: "something-rather-than-nothing",
    title: "Why Is There Something Rather Than Nothing?",
    statusLabel: "Coming soon",
  },
];

export function getChapter(id: ChapterId): ChapterDefinition {
  return CHAPTERS[id];
}

export function chapterIndex(id: ChapterId): number {
  return CHAPTER_SEQUENCE.indexOf(id);
}

export function nextChapterId(id: ChapterId): ChapterId | null {
  const i = chapterIndex(id);
  if (i < 0 || i >= CHAPTER_SEQUENCE.length - 1) return null;
  return CHAPTER_SEQUENCE[i + 1] ?? null;
}

export function prevChapterId(id: ChapterId): ChapterId | null {
  const i = chapterIndex(id);
  if (i <= 0) return null;
  return CHAPTER_SEQUENCE[i - 1] ?? null;
}
