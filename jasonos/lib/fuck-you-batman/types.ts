/** Fuck You Batman story types. Shared by the project pages, store, and MCP. */

export const FYB_ENTRY_KINDS = [
  "reference",
  "bible_character",
  "bible_world",
  "bible_rule",
  "bible_timeline",
  "drift_stage",
  "drift_clue",
  "drift_pattern",
  "scene",
] as const;
export type FybEntryKind = (typeof FYB_ENTRY_KINDS)[number];

export const FYB_ENTRY_KIND_LABEL: Record<FybEntryKind, string> = {
  reference: "Reference",
  bible_character: "Story Bible - characters",
  bible_world: "Story Bible - world",
  bible_rule: "Story Bible - rules",
  bible_timeline: "Story Bible - timeline",
  drift_stage: "Drift Map - stages",
  drift_clue: "Drift Map - clues",
  drift_pattern: "Drift Map - patterns",
  scene: "Scenes",
};

export const FYB_DECISION_STATUSES = ["open", "decided"] as const;
export type FybDecisionStatus = (typeof FYB_DECISION_STATUSES)[number];

export const FYB_ENTRY_STATUSES = ["draft", "approved"] as const;
export type FybEntryStatus = (typeof FYB_ENTRY_STATUSES)[number];

export const FYB_ACTORS = ["jasonos", "claude"] as const;
export type FybActor = (typeof FYB_ACTORS)[number];

export interface FybOption {
  key: string;
  label: string;
  summary: string;
  strengths: string[];
  holes: string[];
}

export interface FybDecision {
  id: string;
  decision_key: string;
  week: number;
  phase: number;
  question: string;
  context: string | null;
  options: FybOption[];
  status: FybDecisionStatus;
  chosen_option_key: string | null;
  custom_answer: string | null;
  jason_note: string | null;
  decided_at: string | null;
  decided_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FybEntry {
  id: string;
  kind: FybEntryKind;
  entry_key: string;
  title: string;
  body_md: string;
  data: Record<string, unknown>;
  links: string[];
  status: FybEntryStatus;
  approved_at: string | null;
  sort_order: number;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface FybPhase {
  number: number;
  name: string;
  startWeek: number;
  endWeek: number;
  start: string;
  end: string;
  output: string;
}

export interface FybSnapshot {
  week: number;
  phase: FybPhase | null;
  decisions: FybDecision[];
  entries: FybEntry[];
  markdown: string;
}
