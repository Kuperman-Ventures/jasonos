import { callHasEnded } from "./draft";
import type { HandoffStatus } from "./types";

export type HandoffLane = "reply" | "outreach" | "waiting" | "scheduled" | "held";

export function handoffLane(
  row: {
    status: HandoffStatus;
    callStartsAt: string | null;
    callEndsAt?: string | null;
    sourceKind?: string | null;
  },
  now: Date = new Date()
): HandoffLane {
  if (row.status === "thank_you_ready") return "held";

  const onCalendar =
    Boolean(row.callStartsAt) ||
    row.status === "booked" ||
    row.status === "brief_ready";

  if (onCalendar) {
    if (
      row.callStartsAt &&
      callHasEnded(row.callEndsAt ?? null, row.callStartsAt, now)
    ) {
      return "held";
    }
    return "scheduled";
  }

  if (row.status === "acted_on" || row.status === "follow_up") return "waiting";
  if (row.sourceKind === "packet") return "outreach";
  return "reply";
}

export function isFollowUp(row: { status: HandoffStatus; callStartsAt: string | null }): boolean {
  return row.status === "follow_up" && !row.callStartsAt;
}

/** Times can be moved only while the scheduling reply is still unsent. */
export function canEditOfferedTimes(row: {
  status: HandoffStatus;
  callStartsAt: string | null;
  callEndsAt?: string | null;
  sourceKind?: string | null;
}): boolean {
  const lane = handoffLane(row);
  return lane === "reply" || lane === "outreach";
}
