export type GuideId = "guide" | "mira" | "dr-maybe";

export type GuideStatus = "available" | "coming-soon";

export type ChapterId =
  | "opening"
  | "original-town"
  | "the-question"
  | "copy-machine"
  | "three-doors"
  | "back-to-machine"
  | "evidence-scanner"
  | "closing";

export type GuideTheme = {
  accent: string;
  glow: string;
  panel: string;
};

export type GuideDefinition = {
  id: GuideId;
  name: string;
  tagline: string;
  status: GuideStatus;
  unavailableMessage: string;
  avatarDescription: string;
  theme: GuideTheme;
};

export type ChapterDefinition = {
  id: ChapterId;
  order: number;
  title: string;
  shortLabel: string;
  placeholder: {
    kicker?: string;
    headline: string;
    body: string[];
    ctaLabel?: string;
  };
};

export type EpisodeDefinition = {
  id: string;
  entryNumber: number;
  title: string;
  subtitle: string;
  seriesName: string;
  seriesShortName: string;
  pronunciation: string;
  estimatedMinutes: { min: number; max: number };
  chapterIds: ChapterId[];
};

export type FutureEntryTeaser = {
  id: string;
  title: string;
  statusLabel: string;
};

/** User stance on whether perfect copies count as conscious people. */
export type ConsciousnessPremise = "yes" | "unsure" | "no";

export type IugrPreferences = {
  guideId: GuideId;
  reducedMotion: boolean;
  highContrast: boolean;
  /** Persisted for later chapters that count copies. null = not yet chosen. */
  consciousnessPremise: ConsciousnessPremise | null;
  /** Which of the 100 town figures the reader chose. null = not yet chosen. */
  readerFigureIndex: number | null;
  /** Same stance as consciousnessPremise, stored under the entry-state name. */
  copiesAreConscious: ConsciousnessPremise | null;
};
