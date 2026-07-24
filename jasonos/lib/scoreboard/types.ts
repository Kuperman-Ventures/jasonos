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
  /** When status was last set by hand (ISO). Null = never manually set. */
  scoreboard_status_set_at: string | null;
}

/** Days a "submitted" (blue) status can sit before auto-aging to "no_reply". */
export const SCOREBOARD_SUBMITTED_STALE_DAYS = 30;

/**
 * Anchor date for the submitted→no_reply aging rule:
 * last manual set if present, otherwise the application date.
 */
export function scoreboardAgingAnchor(app: {
  date: string;
  scoreboard_status_set_at: string | null;
}): Date {
  if (app.scoreboard_status_set_at) {
    return new Date(app.scoreboard_status_set_at);
  }
  return new Date(`${app.date}T12:00:00`);
}

/** True when a submitted application should flip to no_reply. */
export function shouldAgeSubmittedToNoReply(
  app: {
    date: string;
    scoreboard_status: ScoreboardStatus;
    scoreboard_status_set_at: string | null;
  },
  now: Date = new Date()
): boolean {
  if (app.scoreboard_status !== "submitted") return false;
  const anchor = scoreboardAgingAnchor(app);
  const ageMs = now.getTime() - anchor.getTime();
  return ageMs >= SCOREBOARD_SUBMITTED_STALE_DAYS * 86_400_000;
}
