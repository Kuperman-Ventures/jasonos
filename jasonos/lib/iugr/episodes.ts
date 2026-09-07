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
        "You have met this idea before. It turns up in films, usually bent out of shape.",
        "Eight minutes. There is a lever involved.",
      ],
      ctaLabel: "Take me to the town",
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
        "This is Original Town. One hundred residents, one bakery, and no reason to expect trouble.",
      ],
    },
  },
  "the-question": {
    id: "the-question",
    order: 3,
    title: "The Question",
    shortLabel: "Question",
    placeholder: {
      headline: "The Question",
      body: [
        "Suppose a machine could copy this town exactly. Would the copy of you be a person?",
      ],
    },
  },
  "copy-machine": {
    id: "copy-machine",
    order: 4,
    title: "Copy Machine",
    shortLabel: "Copy",
    placeholder: {
      headline: "The Copy Machine",
      body: [
        "One lever. It does exactly one thing, and the thing it does is arithmetic.",
      ],
    },
  },
  "three-doors": {
    id: "three-doors",
    order: 5,
    title: "Three Doors",
    shortLabel: "Doors",
    placeholder: {
      headline: "Three Doors",
      body: [
        "At least one of the three is true. Not all of them. At least one.",
      ],
    },
  },
  "back-to-machine": {
    id: "back-to-machine",
    order: 6,
    title: "Back To The Machine",
    shortLabel: "Back",
    placeholder: {
      headline: "Back To The Machine",
      body: [
        "Same machine. Same town. Three new dials, one for each door.",
      ],
    },
  },
  "evidence-scanner": {
    id: "evidence-scanner",
    order: 7,
    title: "What People Say At Parties",
    shortLabel: "Claims",
    placeholder: {
      headline: "What People Say At Parties",
      body: [
        "Five things people say when this comes up. None of them are stupid. None of them settle anything either.",
      ],
    },
  },
  closing: {
    id: "closing",
    order: 8,
    title: "Closing",
    shortLabel: "Close",
    placeholder: {
      headline: "Closing",
      body: [
        "You have walked an argument, not a result.",
      ],
    },
  },
};

export const CHAPTER_SEQUENCE: ChapterId[] = [
  "opening",
  "original-town",
  "the-question",
  "copy-machine",
  "three-doors",
  "back-to-machine",
  "evidence-scanner",
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
