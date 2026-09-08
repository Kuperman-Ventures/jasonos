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

export function isScoreboardStatus(value: unknown): value is ScoreboardStatus {
  return (
    typeof value === "string" &&
    (SCOREBOARD_STATUSES as string[]).includes(value)
  );
}

/** NYUI `result` → Scoreboard pipeline status. */
export function defaultStatusFromResult(
  result: string | null | undefined
): ScoreboardStatus {
  switch (result) {
    case "Offer Received":
      return "offer";
    case "Rejected":
      return "rejected";
    case "Interview Scheduled":
      return "next_steps";
    case "Pending":
      return "no_reply";
    case "Application Submitted":
    default:
      return "submitted";
  }
}

/** Scoreboard pipeline status → NYUI `result`. Kept in lockstep on status changes. */
export function resultFromScoreboardStatus(status: ScoreboardStatus): string {
  switch (status) {
    case "offer":
      return "Offer Received";
    case "rejected":
      return "Rejected";
    case "next_steps":
      return "Interview Scheduled";
    case "no_reply":
      return "Pending";
    case "submitted":
      return "Application Submitted";
  }
}

export function resolvedScoreboardStatus(row: {
  scoreboard_status?: string | null;
  result?: string | null;
}): ScoreboardStatus {
  return isScoreboardStatus(row.scoreboard_status)
    ? row.scoreboard_status
    : defaultStatusFromResult(row.result);
}

export function applicationKey(company: string, role: string): string {
  return `${company.trim().toLowerCase()}\t${role.trim().toLowerCase()}`;
}

/** Rows that belong on the Scoreboard (applications, not networking). */
export function isApplicationWorkSearch(row: {
  scoreboard_status?: string | null;
  activity_tier?: string | null;
  contact_method?: string | null;
  result?: string | null;
}): boolean {
  if (isScoreboardStatus(row.scoreboard_status)) return true;
  if (row.activity_tier === "networking") return false;
  if (
    row.contact_method === "Online Portal" ||
    row.contact_method === "Direct Email"
  ) {
    return true;
  }
  return [
    "Application Submitted",
    "Rejected",
    "Offer Received",
    "Interview Scheduled",
    "Pending",
  ].includes(row.result ?? "");
}

const STATUS_RANK: Record<ScoreboardStatus, number> = {
  submitted: 1,
  no_reply: 2,
  next_steps: 3,
  rejected: 3,
  offer: 4,
};

/**
 * One Scoreboard row per real job. NYUI follow-ups stay as extra weekly
 * log rows (parent_activity_id set) but do not inflate application counts.
 */
export function canonicalApplicationRows<
  T extends {
    id: string;
    date: string;
    company_name: string;
    position_applied: string;
    parent_activity_id?: string | null;
    scoreboard_status?: string | null;
    result?: string | null;
  },
>(rows: T[]): T[] {
  const byKey = new Map<string, T>();

  for (const row of rows) {
    if (row.parent_activity_id) continue;
    const key = applicationKey(row.company_name, row.position_applied);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    const existingFirst =
      existing.date < row.date ||
      (existing.date === row.date && existing.id <= row.id);
    const earlier = existingFirst ? existing : row;
    const later = existingFirst ? row : existing;
    const earlierStatus = resolvedScoreboardStatus(earlier);
    const laterStatus = resolvedScoreboardStatus(later);
    const status =
      STATUS_RANK[laterStatus] >= STATUS_RANK[earlierStatus]
        ? laterStatus
        : earlierStatus;

    byKey.set(key, {
      ...earlier,
      scoreboard_status: status,
      result: resultFromScoreboardStatus(status),
    });
  }

  return [...byKey.values()].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1
  );
}

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
