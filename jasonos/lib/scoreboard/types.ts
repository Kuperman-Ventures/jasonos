/**
 * Scoreboard pipeline statuses for submitted job applications.
 * Shown as selectable colored dots next to each application row.
 */

export type ScoreboardStatus =
  | "submitted"
  | "no_reply"
  | "next_steps"
  | "rejected"
  | "offer";

export const SCOREBOARD_STATUSES: ScoreboardStatus[] = [
  "submitted",
  "no_reply",
  "next_steps",
  "rejected",
  "offer",
];

export const SCOREBOARD_STATUS_LABELS: Record<ScoreboardStatus, string> = {
  submitted: "Submitted",
  no_reply: "No reply",
  next_steps: "Taking next steps",
  rejected: "Rejected",
  offer: "Offer",
};

/** Tailwind background classes for the status dots. */
export const SCOREBOARD_STATUS_DOT: Record<ScoreboardStatus, string> = {
  submitted: "bg-sky-400",
  no_reply: "bg-orange-400",
  next_steps: "bg-amber-300",
  rejected: "bg-red-400",
  offer: "bg-emerald-400",
};

export interface ScoreboardApplication {
  id: string;
  date: string;
  company_name: string;
  position_applied: string;
  contact_method: string;
  result: string;
  scoreboard_status: ScoreboardStatus;
}
