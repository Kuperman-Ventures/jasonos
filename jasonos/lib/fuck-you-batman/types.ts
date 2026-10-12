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

export const FYB_ENTRY_STATUSES = ["draft", "approved", "changes_requested"] as const;
export type FybEntryStatus = (typeof FYB_ENTRY_STATUSES)[number];

export const FYB_ENTRY_STATUS_LABEL: Record<FybEntryStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const FYB_SCENE_DRAFT_STATUSES = ["outlined", "drafted", "revised"] as const;
export type FybSceneDraftStatus = (typeof FYB_SCENE_DRAFT_STATUSES)[number];

export const FYB_ACTORS = ["jasonos", "claude"] as const;
export type FybActor = (typeof FYB_ACTORS)[number];

export const FYB_BIBLE_KINDS: FybEntryKind[] = [
  "bible_character",
  "bible_world",
  "bible_rule",
  "bible_timeline",
];
export const FYB_DRIFT_KINDS: FybEntryKind[] = ["drift_stage", "drift_clue", "drift_pattern"];
export const FYB_SCENE_KINDS: FybEntryKind[] = ["scene"];

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
  change_request: string | null;
  change_requested_at: string | null;
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

export type FybCheckLevel = "problem" | "warning";

export interface FybCheck {
  level: FybCheckLevel;
  message: string;
}

export type FybDataField = { label: string; key: string };

export const ENTRY_CARD_FIELDS: Partial<Record<FybEntryKind, FybDataField[]>> = {
  bible_character: [
    { label: "Role", key: "role" },
    { label: "Voice", key: "voice" },
    { label: "First chapter", key: "first_chapter" },
  ],
  bible_timeline: [{ label: "When", key: "when" }],
  drift_stage: [
    { label: "Stage number", key: "stage_number" },
    { label: "Chapters", key: "chapters" },
    { label: "Reader believes", key: "reader_believes" },
    { label: "Actually true", key: "actually_true" },
  ],
  drift_clue: [
    { label: "Chapter", key: "chapter" },
    { label: "Example line", key: "example_line" },
    { label: "What it hides", key: "what_it_hides" },
  ],
  drift_pattern: [
    { label: "First chapter", key: "first_chapter" },
    { label: "Pattern", key: "pattern" },
    { label: "Example", key: "example" },
  ],
  scene: [
    { label: "Track", key: "track" },
    { label: "Drift stage", key: "drift_stage_key" },
    { label: "Purpose", key: "purpose" },
    { label: "What happens", key: "what_happens" },
    { label: "Computer reports", key: "computer_reports" },
    { label: "Actually true", key: "actually_true" },
    { label: "Place and time", key: "place_and_time" },
    { label: "Word target", key: "word_target" },
    { label: "Draft status", key: "draft_status" },
  ],
};
