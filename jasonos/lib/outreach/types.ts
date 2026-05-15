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
