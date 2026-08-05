export type TargetReader =
  | "Founder/CEO"
  | "VP Sales/CRO"
  | "PE/VC Operating Partner"
  | "General/Mixed";

export type LinkedInLength = "Short" | "Standard" | "Long";

export type ConfiguratorState = {
  directness: number; // 1–5
  contrarian: number; // 1–5
  dataDensity: number; // 1–5
  architectFraming: number; // 1–5
  costOfWaiting: number; // 1–5
  targetReader: TargetReader;
  linkedinLength: LinkedInLength;
};

export type Hook = {
  id: string;
  angle: string;
  text: string;
};

export type InputMode = "idea" | "research";

export type PostMachineStep =
  | "idea"
  | "research"
  | "config"
  | "hooks"
  | "output";

/** Full client state snapshot persisted for save/resume. */
export type PostMachineProjectState = {
  idea: string;
  topic: string;
  guidance: string;
  findings: ResearchFindings | null;
  config: ConfiguratorState;
  hooks: Hook[];
  selectedHook: Hook | null;
  linkedin: string;
  blog: string;
};

export type PostMachineProjectListItem = {
  id: string;
  title: string;
  step: PostMachineStep;
  inputMode: InputMode;
  ideaPreview: string;
  topic: string;
  updatedAt: string;
};

export type PostMachineProject = PostMachineProjectListItem & {
  state: PostMachineProjectState;
};

export function suggestProjectTitle(input: {
  title?: string;
  topic?: string;
  idea?: string;
}): string {
  const explicit = input.title?.trim();
  if (explicit) return explicit.slice(0, 80);

  const topic = input.topic?.trim();
  if (topic) return topic.slice(0, 80);

  const ideaLine =
    input.idea
      ?.split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("RESEARCH BRIEF")) ?? "";
  if (ideaLine) return ideaLine.replace(/^["“]+|["”]+$/g, "").slice(0, 80);

  return "Untitled post";
}


export type ResearchSource = {
  title: string | null;
  url: string;
};

export type ResearchFindings = {
  topic: string;
  guidance: string;
  whitespace: {
    title: string;
    summary: string;
    sources: ResearchSource[];
  }[];
  contradictions: {
    topic: string;
    sideA: string;
    sideB: string;
    sources: ResearchSource[];
  }[];
  /** Flat source list for the review UI. */
  sources: ResearchSource[];
  /**
   * Shaped brief that plugs into /api/post-machine/hooks as `idea`
   * without changing that endpoint's contract.
   */
  ideaText: string;
  searched: boolean;
};


export const DEFAULT_CONFIG: ConfiguratorState = {
  directness: 4,
  contrarian: 3,
  dataDensity: 3,
  architectFraming: 4,
  costOfWaiting: 3,
  targetReader: "General/Mixed",
  linkedinLength: "Standard",
};

export const TARGET_READERS: TargetReader[] = [
  "Founder/CEO",
  "VP Sales/CRO",
  "PE/VC Operating Partner",
  "General/Mixed",
];

export const LINKEDIN_LENGTHS: {
  value: LinkedInLength;
  label: string;
  words: number;
}[] = [
  { value: "Short", label: "Short (~75 words)", words: 75 },
  { value: "Standard", label: "Standard (~150 words)", words: 150 },
  { value: "Long", label: "Long (~300 words)", words: 300 },
];

export function clampDial(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function normalizeConfig(
  input: Partial<ConfiguratorState> | null | undefined
): ConfiguratorState {
  const base = { ...DEFAULT_CONFIG, ...(input ?? {}) };
  return {
    directness: clampDial(base.directness),
    contrarian: clampDial(base.contrarian),
    dataDensity: clampDial(base.dataDensity),
    architectFraming: clampDial(base.architectFraming),
    costOfWaiting: clampDial(base.costOfWaiting),
    targetReader: TARGET_READERS.includes(base.targetReader as TargetReader)
      ? (base.targetReader as TargetReader)
      : DEFAULT_CONFIG.targetReader,
    linkedinLength: LINKEDIN_LENGTHS.some((l) => l.value === base.linkedinLength)
      ? (base.linkedinLength as LinkedInLength)
      : DEFAULT_CONFIG.linkedinLength,
  };
}
