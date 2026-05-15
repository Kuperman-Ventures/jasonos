/**
 * Outreach-surface shared types and helpers.
 *
 * Lives outside server-actions/ so client components can import freely.
 * Server actions (which use "use server") re-export only async functions.
 */

import type { CadenceInterval, RelationshipType } from "@/lib/types";

export type { CadenceInterval, RelationshipType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Relationship-type taxonomy (migration 0013)
// ---------------------------------------------------------------------------

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "recruiter",
  "hiring_manager",
  "operator_peer",
  "mentor_advisor",
  "prospect",
  "personal",
];

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
  operator_peer: "Operator peer",
  mentor_advisor: "Mentor / Advisor",
  prospect: "Prospect",
  personal: "Personal",
};

export const RELATIONSHIP_TYPE_HELPERS: Record<RelationshipType, string> = {
  recruiter: "Search firm or in-house talent contacts",
  hiring_manager: "Decision-makers at target companies",
  operator_peer: "Peers doing the kind of work I want to do",
  mentor_advisor: "Mentors, advisors, board-level relationships",
  prospect: "New outreach I'm warming up",
  personal: "Friends, family, personal connections",
};

export function relationshipTypeLabel(value: RelationshipType | null | undefined): string {
  if (!value) return "Unclassified";
  return RELATIONSHIP_TYPE_LABELS[value] ?? value;
}

// ---------------------------------------------------------------------------
// Relationship-type METADATA (borrowed/condensed from EncoreOS).
// Each bucket has a default cadence, primary objective, tone guidance, and
// typical activities. These flow into the Classify menu helper copy AND the
// Draft Assist system prompt so generated drafts match the relationship.
// ---------------------------------------------------------------------------

export interface RelationshipMeta {
  /** What the relationship is for in one sentence. */
  objective: string;
  /** Default cadence applied when classifying a contact with no cadence yet. */
  defaultCadence: CadenceInterval;
  /** Voice / register guidance for the Draft Assist prompt. */
  tone: string;
  /** Canonical activities for this relationship. */
  typicalActivities: string;
}

export const RELATIONSHIP_TYPE_META: Record<RelationshipType, RelationshipMeta> = {
  recruiter: {
    objective:
      "Stay on radar for searches, exchange market intel, time-box transactional updates.",
    defaultCadence: "quarterly",
    tone: "Tight, business-appropriate. Lead with a fresh data point or a candidate referral.",
    typicalActivities:
      "Send concise update, share market intel, refer a candidate, ask about briefs that match.",
  },
  hiring_manager: {
    objective:
      "Build a peer relationship that converts when their team has the right opening.",
    defaultCadence: "monthly",
    tone: "Peer-to-peer. Substantive. Lead with what's relevant to their work, not what you want.",
    typicalActivities:
      "Share insight tied to their problem, offer help, suggest a 20-min call, follow up on prior threads.",
  },
  operator_peer: {
    objective:
      "Reciprocal exchange — intel, intros, problem-solving with people doing the work I want to be doing.",
    defaultCadence: "monthly",
    tone: "Warm, candid, operator-to-operator. No throat-clearing.",
    typicalActivities:
      "Trade intel, comment on their work, ask about their stack/process, swap intros, set up a working session.",
  },
  mentor_advisor: {
    objective:
      "Stay close to people whose judgment shapes my big decisions; let them invest in my trajectory.",
    defaultCadence: "monthly",
    tone: "Personal, appreciative, specific. Share progress and where stuck, not just headlines.",
    typicalActivities:
      "Share a real decision you're sitting with, ask one sharp question, update on the last advice you took.",
  },
  prospect: {
    objective: "Warm up a new connection to the point of a first real conversation.",
    defaultCadence: "biweekly",
    tone: "Specific reason for connecting. One value-add. No throat-clearing.",
    typicalActivities:
      "First-touch with a hook, comment on their content, share something relevant, suggest a brief call.",
  },
  personal: {
    objective: "Maintain personal relationships at the rhythm friendship deserves.",
    defaultCadence: "monthly",
    tone: "Personal voice. No work talk unless they bring it up.",
    typicalActivities:
      "Catch-up message, share life update, suggest a meal or call, react to their content.",
  },
};

// ---------------------------------------------------------------------------
// Cadence STAGE — orthogonal to cadence_interval. Tracks where you are in
// the arc of a single relationship: initial → followup_1 → followup_2 →
// ongoing. Advances when objective_achieved === 'yes' on a logged touch.
// ---------------------------------------------------------------------------

export type CadenceStage = "initial" | "followup_1" | "followup_2" | "ongoing";

export const CADENCE_STAGES: CadenceStage[] = [
  "initial",
  "followup_1",
  "followup_2",
  "ongoing",
];

export const CADENCE_STAGE_LABELS: Record<CadenceStage, string> = {
  initial: "Initial touch",
  followup_1: "Follow-up 1",
  followup_2: "Follow-up 2",
  ongoing: "Ongoing",
};

export const CADENCE_STAGE_SHORT: Record<CadenceStage, string> = {
  initial: "Initial",
  followup_1: "FU 1",
  followup_2: "FU 2",
  ongoing: "Ongoing",
};

/** Where does this contact go after a successful (`yes`) touch? */
export function advanceCadenceStage(current: CadenceStage | null): CadenceStage {
  if (!current) return "initial";
  const idx = CADENCE_STAGES.indexOf(current);
  if (idx < 0) return "initial";
  if (idx >= CADENCE_STAGES.length - 1) return "ongoing";
  return CADENCE_STAGES[idx + 1];
}

export function cadenceStageLabel(value: CadenceStage | null | undefined): string {
  if (!value) return "—";
  return CADENCE_STAGE_LABELS[value] ?? value;
}

// ---------------------------------------------------------------------------
// Touch objective — tri-state ("did this touch achieve its goal?"). The
// answer drives whether cadence_stage advances. Borrowed from EncoreOS's
// LogTouchModal, adapted for CoSA's stage progression.
// ---------------------------------------------------------------------------

export type TouchObjective = "yes" | "no" | "neutral";

export const TOUCH_OBJECTIVES: TouchObjective[] = ["yes", "no", "neutral"];

export const TOUCH_OBJECTIVE_LABELS: Record<TouchObjective, string> = {
  yes: "Yes — goal achieved",
  no: "Not yet — still working on it",
  neutral: "Just keeping in touch",
};

export const TOUCH_OBJECTIVE_HELPERS: Record<TouchObjective, string> = {
  yes: "Move me to the next cadence stage.",
  no: "Made contact but not there yet. Stay at the same stage.",
  neutral: "Check-in or social touch — no specific goal this time.",
};

// ---------------------------------------------------------------------------
// Classifier decision tree — "Help me classify" Q&A that walks to one of
// the 6 buckets. Borrowed from EncoreOS's CLASSIFIER_STEPS, condensed for
// CoSA's 6-bucket taxonomy.
// ---------------------------------------------------------------------------

export interface ClassifierOption {
  label: string;
  /** Next step id; null = terminal (result populated). */
  next: string | null;
  /** Bucket assigned when this branch terminates. */
  result?: RelationshipType;
}

export interface ClassifierStep {
  id: string;
  question: string;
  subtext?: string;
  options: ClassifierOption[];
}

export const CLASSIFIER_STEPS: ClassifierStep[] = [
  {
    id: "start",
    question: "Is this person a recruiter, headhunter, or in-house talent leader?",
    subtext: "Retained search, agency, or corporate TA.",
    options: [
      { label: "Yes", next: null, result: "recruiter" },
      { label: "No", next: "personal_check" },
    ],
  },
  {
    id: "personal_check",
    question: "Is this relationship primarily personal / social (not work)?",
    subtext: "Close friend, family, friend-of-friend you'd see outside work.",
    options: [
      { label: "Yes — personal", next: null, result: "personal" },
      { label: "No — work-anchored", next: "decision_maker" },
    ],
  },
  {
    id: "decision_maker",
    question:
      "Are they a decision-maker at a company you'd want to work at or sell into?",
    subtext: "C-suite, VP-level, or anyone with hiring/budget authority for your work.",
    options: [
      { label: "Yes", next: null, result: "hiring_manager" },
      { label: "No", next: "mentor_check" },
    ],
  },
  {
    id: "mentor_check",
    question:
      "Is this someone whose judgment shapes your big decisions — a mentor, advisor, or board-level relationship?",
    options: [
      { label: "Yes", next: null, result: "mentor_advisor" },
      { label: "No", next: "existing_relationship" },
    ],
  },
  {
    id: "existing_relationship",
    question:
      "Do you already have a real working relationship — someone you've collaborated with or know well?",
    subtext: "Past colleagues, peers, people you've actually shipped work with.",
    options: [
      { label: "Yes", next: null, result: "operator_peer" },
      { label: "No — new connection", next: null, result: "prospect" },
    ],
  },
];

export const CLASSIFIER_START_STEP_ID = "start";

// ---------------------------------------------------------------------------
// Cadence helpers (migration 0013)
// ---------------------------------------------------------------------------

export const CADENCE_INTERVALS: CadenceInterval[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "none",
];

export const CADENCE_DAYS: Record<Exclude<CadenceInterval, "none">, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
};

export const CADENCE_LABELS: Record<CadenceInterval, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  none: "No cadence",
};

export const CADENCE_HELPERS: Record<CadenceInterval, string> = {
  weekly: "every 7 days",
  biweekly: "every 2 weeks",
  monthly: "every 30 days",
  quarterly: "every 90 days",
  none: "I'll schedule manually",
};

export function cadenceLabel(value: CadenceInterval | null | undefined): string {
  if (!value) return "No cadence";
  return CADENCE_LABELS[value] ?? value;
}

/**
 * Compute the next-touch date for a given cadence, starting from `from` (default today).
 * Returns null for `none` (no rhythm). Returns a YYYY-MM-DD string.
 */
export function nextTouchFromCadence(
  cadence: CadenceInterval,
  from: Date = new Date()
): string | null {
  if (cadence === "none") return null;
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + CADENCE_DAYS[cadence]);
  return base.toISOString().split("T")[0];
}
