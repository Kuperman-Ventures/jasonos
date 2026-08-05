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
