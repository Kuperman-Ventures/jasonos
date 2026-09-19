export type Choice = "top" | "middle" | "low" | "backup" | "unsure";
export type Plan = "" | "ed" | "ea" | "rd" | "rolling";
export type Owner = "kyle" | "jason" | "wife";
export type TabId = "colleges" | "timeline" | "faq" | "questions" | "consultants" | "notes";

export type Step = {
  id: string;
  label: string;
  owner: Owner;
  done: boolean;
  sortOrder: number;
};

export type School = {
  id: string;
  name: string;
  location: string;
  campusSize: string;
  mechanicalEngineering: string;
  materials: string;
  materialsOffering: string;
  admissionsContext: string;
  satContext: string;
  selectivity: string;
  notes: string;
  listOrder: number;
  choice: Choice;
  plan: Plan;
  visited: boolean;
  visitDate: string | null;
  visitNotes: string;
  deadline: string | null;
  deadlineLabel: string;
  steps: Step[];
};

export type SchoolSeed = {
  id: string;
  name: string;
  location: string;
  campusSize: string;
  mechanicalEngineering: string;
  materials: string;
  materialsOffering: string;
  admissionsContext: string;
  satContext: string;
  selectivity: string;
  notes: string;
  listOrder: number;
};

export type PhaseItem = { id: string; text: string };
export type Phase = { phase: string; window: string; items: PhaseItem[] };
export type FaqItem = { q: string; a: string };
export type FaqCategory = { cat: string; items: FaqItem[] };
export type TextBlock = { h: string; p: string };
export type Supplemental = { name: string; example: string; note: string };
export type Firm = {
  id: string;
  name: string;
  url: string;
  location: string;
  people: string;
  pricing: string;
  model: string;
};
export type Criterion = { id: string; name: string; weight: number; desc: string };
export type Scores = Record<string, Record<string, number>>;

export type SelectivityGuide = { term: string; meaning: string };

export const CHOICES: { id: Choice; label: string }[] = [
  { id: "top", label: "Top Choice" },
  { id: "middle", label: "Middle Choice" },
  { id: "low", label: "Low Choice" },
  { id: "backup", label: "Backup" },
  { id: "unsure", label: "Unsure" },
];

export const PLANS: { id: Plan; label: string }[] = [
  { id: "", label: "Not chosen yet" },
  { id: "ed", label: "Early Decision" },
  { id: "ea", label: "Early Action" },
  { id: "rd", label: "Regular" },
  { id: "rolling", label: "Rolling" },
];

export const OWNERS: { id: Owner; label: string }[] = [
  { id: "kyle", label: "Kyle" },
  { id: "jason", label: "Jason" },
  { id: "wife", label: "Wife" },
];

export const STEP_PRESETS = [
  "Campus visit",
  "Info session",
  "Interview",
  "Supplemental essay",
  "Scores sent",
  "Recommendations",
  "Application submitted",
  "Portal checked",
  "Decision",
  "Deposit",
];

export const TABS: { id: TabId; label: string }[] = [
  { id: "colleges", label: "Colleges" },
  { id: "timeline", label: "Timeline" },
  { id: "faq", label: "FAQ" },
  { id: "questions", label: "App Questions" },
  { id: "consultants", label: "Consultants" },
  { id: "notes", label: "Notes" },
];

const CHOICE_RANK: Record<Choice, number> = {
  top: 0,
  middle: 1,
  low: 2,
  backup: 3,
  unsure: 4,
};

const SELECTIVITY_RANK = [
  "Extreme Reach",
  "Reach",
  "Reach / High Target",
  "High Target",
  "Target",
  "Likely / Target",
  "Likely",
];

export function choiceLabel(id: Choice): string {
  return CHOICES.find((c) => c.id === id)?.label ?? id;
}

export function planLabel(id: Plan): string {
  return PLANS.find((p) => p.id === id)?.label ?? "";
}

export function ownerLabel(id: Owner): string {
  return OWNERS.find((o) => o.id === id)?.label ?? id;
}

export function choiceRank(id: Choice): number {
  return CHOICE_RANK[id] ?? 99;
}

export function selectivityRank(value: string): number {
  const idx = SELECTIVITY_RANK.indexOf(value);
  return idx === -1 ? 99 : idx;
}

export function selectivityTone(value: string): "reach" | "target" | "likely" | "neutral" {
  if (value.includes("Likely")) return "likely";
  if (value.includes("Reach")) return "reach";
  if (value.includes("Target")) return "target";
  return "neutral";
}

export function isChoice(value: string): value is Choice {
  return CHOICES.some((c) => c.id === value);
}

export function isPlan(value: string): value is Plan {
  return PLANS.some((p) => p.id === value);
}

export function isOwner(value: string): value is Owner {
  return OWNERS.some((o) => o.id === value);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fromSeed(seed: SchoolSeed): School {
  return {
    ...seed,
    choice: "unsure",
    plan: "",
    visited: false,
    visitDate: null,
    visitNotes: "",
    deadline: null,
    deadlineLabel: "",
    steps: [],
  };
}
