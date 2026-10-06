import type { HandoffStatus } from "./types";

export type HandoffLane = "reply" | "outreach" | "waiting" | "scheduled";

export function handoffLane(row: {
  status: HandoffStatus;
  callStartsAt: string | null;
  sourceKind?: string | null;
}): HandoffLane {
  if (
    row.callStartsAt ||
    row.status === "booked" ||
    row.status === "brief_ready" ||
    row.status === "thank_you_ready"
  ) {
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
  sourceKind?: string | null;
}): boolean {
  return handoffLane(row) === "reply" || handoffLane(row) === "outreach";
}
