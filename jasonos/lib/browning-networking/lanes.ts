import type { HandoffStatus } from "./types";

export type HandoffLane = "reply" | "waiting" | "scheduled";

export function handoffLane(row: {
  status: HandoffStatus;
  callStartsAt: string | null;
}): HandoffLane {
  if (
    row.callStartsAt ||
    row.status === "booked" ||
    row.status === "brief_ready" ||
    row.status === "thank_you_ready"
  ) {
    return "scheduled";
  }
  if (row.status === "acted_on") return "waiting";
  return "reply";
}
