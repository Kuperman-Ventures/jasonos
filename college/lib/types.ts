import { knownWebsite } from "./school-websites";

export type Choice = "top" | "middle" | "low" | "backup" | "unsure";
export type Plan = "" | "ed" | "ea" | "rd" | "rolling";
export type Owner = "kyle" | "jason" | "kat";
export type TabId =
  | "dashboard"
  | "colleges"
  | "projects"
  | "timeline"
  | "ingest"
  | "faq"
  | "apps"
  | "consultants"
  | "notes"
  | "testing"
  | "log";

export type SelectivityTier = "" | "extremely_selective" | "very_selective" | "competitive" | "less_competitive";
export type InterestLevel = "" | "top" | "high" | "moderate" | "safety";
export type ApplicationStatus = "" | "researching" | "applying" | "submitted" | "accepted" | "enrolled";
export type AdmissionTrack = "" | "ed1" | "ed2" | "ea" | "rd" | "rolling";
export type ListPhaseId = "exploration" | "consideration" | "applications";

export type Step = {
  id: string;
  label: string;
  owner: Owner;
  done: boolean;
  sortOrder: number;
};

export type Deadline = {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  sortOrder: number;
};

export type Contact = {
  name: string;
  role: string;
  email: string;
  phone: string;
};

export type SchoolContact = Contact & { id: string };

export type DeadlinePatch = {
  title?: string;
  dueDate?: string | null;
  completed?: boolean;
};

export type ContactPatch = Partial<Contact>;

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
  selectivityTier: SelectivityTier;
  interestLevel: InterestLevel;
  applicationStatus: ApplicationStatus;
  admissionTrack: AdmissionTrack;
  testPolicy: string;
  middle50: string;
  applicationPlatform: string;
  requiredEssays: string;
  teacherRecs: string;
  costOfAttendance: string;
  netPriceEstimate: string;
  meritAidNotes: string;
  researchSources: string;
  website: string;
  listPhase: ListPhaseId;
  phasesParticipated: ListPhaseId[];
  archived: boolean;
  archivedAt: string | null;
  steps: Step[];
  deadlines: Deadline[];
  contacts: SchoolContact[];
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

export const SELECTIVITY_TIERS: { id: SelectivityTier; label: string }[] = [
  { id: "", label: "Not set" },
  { id: "extremely_selective", label: "Extremely selective" },
  { id: "very_selective", label: "Very selective" },
  { id: "competitive", label: "Competitive" },
  { id: "less_competitive", label: "Less competitive" },
];

export const INTEREST_LEVELS: { id: InterestLevel; label: string }[] = [
  { id: "", label: "Not set" },
  { id: "top", label: "Top choice" },
  { id: "high", label: "High interest" },
  { id: "moderate", label: "Moderate interest" },
  { id: "safety", label: "Safety/backup" },
];

export const APPLICATION_STATUSES: { id: ApplicationStatus; label: string }[] = [
  { id: "", label: "Not set" },
  { id: "researching", label: "Researching" },
  { id: "applying", label: "Applying" },
  { id: "submitted", label: "Submitted" },
  { id: "accepted", label: "Accepted" },
  { id: "enrolled", label: "Enrolled" },
];

export const ADMISSION_TRACKS: { id: AdmissionTrack; label: string }[] = [
  { id: "", label: "Not chosen" },
  { id: "ed1", label: "ED1" },
  { id: "ed2", label: "ED2" },
  { id: "ea", label: "EA" },
  { id: "rd", label: "RD" },
  { id: "rolling", label: "Rolling" },
];

export const OWNERS: { id: Owner; label: string }[] = [
  { id: "kyle", label: "Kyle" },
  { id: "jason", label: "Jason" },
  { id: "kat", label: "Kat" },
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
  { id: "dashboard", label: "Dashboard" },
  { id: "colleges", label: "Colleges" },
  { id: "projects", label: "Project Management" },
  { id: "ingest", label: "Ingest" },
  { id: "notes", label: "Notes" },
  { id: "apps", label: "Apps & Materials" },
  { id: "log", label: "Log" },
  { id: "consultants", label: "Consultants" },
  { id: "faq", label: "FAQ" },
  { id: "testing", label: "Testing" },
];

/** Normalize legacy tab ids (e.g. timeline → projects, questions → apps). */
export function normalizeTabId(value: string | null): TabId | null {
  if (!value) return null;
  if (value === "timeline") return "projects";
  if (value === "questions") return "apps";
  return TABS.some((item) => item.id === value) ? (value as TabId) : null;
}
const CHOICE_RANK: Record<Choice, number> = {
  top: 0,
  middle: 1,
  low: 2,
  backup: 3,
  unsure: 4,
};

const TIER_RANK: Record<SelectivityTier, number> = {
  extremely_selective: 0,
  very_selective: 1,
  competitive: 2,
  less_competitive: 3,
  "": 4,
};

const INTEREST_RANK: Record<InterestLevel, number> = {
  top: 0,
  high: 1,
  moderate: 2,
  safety: 3,
  "": 4,
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

export function tierLabel(id: SelectivityTier): string {
  return SELECTIVITY_TIERS.find((item) => item.id === id)?.label ?? "";
}

export function interestLabel(id: InterestLevel): string {
  return INTEREST_LEVELS.find((item) => item.id === id)?.label ?? "";
}

export function statusLabel(id: ApplicationStatus): string {
  return APPLICATION_STATUSES.find((item) => item.id === id)?.label ?? "";
}

export function trackLabel(id: AdmissionTrack): string {
  if (!id) return "";
  return ADMISSION_TRACKS.find((item) => item.id === id)?.label ?? "";
}

export function ownerLabel(id: Owner): string {
  return OWNERS.find((o) => o.id === id)?.label ?? id;
}

export function choiceRank(id: Choice): number {
  return CHOICE_RANK[id] ?? 99;
}

export function tierRank(id: SelectivityTier): number {
  return TIER_RANK[id] ?? 99;
}

export function interestRank(id: InterestLevel): number {
  return INTEREST_RANK[id] ?? 99;
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

export function selectivityTierFromContext(context: string): SelectivityTier {
  if (context === "Extremely selective" || context === "Engineering extremely selective") {
    return "extremely_selective";
  }
  if (
    context === "Very selective, especially out-of-state" ||
    context === "Very selective for out-of-state engineering" ||
    context === "Very selective out-of-state"
  ) {
    return "very_selective";
  }
  if (
    context === "Competitive" ||
    context === "Competitive engineering" ||
    context === "Competitive direct-to-engineering pathway"
  ) {
    return "competitive";
  }
  return "";
}

/** Short pathway line for the snapshot card, stripped of tier prefixes. */
export function pathwayFromContext(context: string): string {
  const trimmed = context.trim();
  if (!trimmed) return "";
  if (/^(extremely selective|very selective|competitive|less competitive)$/i.test(trimmed)) {
    return "";
  }
  const cleaned = trimmed
    .replace(/^(extremely selective|very selective|competitive|less competitive)\s+/i, "")
    .replace(/\s+pathway$/i, "")
    .trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
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

export function isSelectivityTier(value: string): value is SelectivityTier {
  return SELECTIVITY_TIERS.some((item) => item.id === value);
}

export function isInterestLevel(value: string): value is InterestLevel {
  return INTEREST_LEVELS.some((item) => item.id === value);
}

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return APPLICATION_STATUSES.some((item) => item.id === value);
}

export function isAdmissionTrack(value: string): value is AdmissionTrack {
  return ADMISSION_TRACKS.some((item) => item.id === value);
}

export function isListPhaseId(value: string): value is ListPhaseId {
  return value === "exploration" || value === "consideration" || value === "applications";
}

export function schoolFaviconUrl(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) return "";
  try {
    const host = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname;
    if (!host) return "";
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return "";
  }
}

export function schoolMark(name: string): string {
  const paren = name.match(/\(([^)]+)\)/);
  const source = (paren?.[1] ?? name).trim();
  const words = source.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
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
    selectivityTier: selectivityTierFromContext(seed.admissionsContext),
    interestLevel: "",
    applicationStatus: "",
    admissionTrack: "",
    testPolicy: "",
    middle50: "",
    applicationPlatform: "",
    requiredEssays: "",
    teacherRecs: "",
    costOfAttendance: "",
    netPriceEstimate: "",
    meritAidNotes: "",
    researchSources: "",
    website: knownWebsite(seed.id),
    listPhase: "exploration",
    phasesParticipated: ["exploration"],
    archived: false,
    archivedAt: null,
    steps: [],
    deadlines: [],
    contacts: [],
  };
}
