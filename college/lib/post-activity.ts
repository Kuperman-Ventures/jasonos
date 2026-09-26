/** Client helper — fire-and-forget activity log writes. */

import type { ActivityEntityType } from "@/lib/activity-log";

export type ClientActivityInput = {
  action: string;
  entityType: ActivityEntityType;
  entityId?: string | null;
  summary: string;
  detail?: Record<string, unknown>;
};

/** Best-effort POST; never throws into the UI path. */
export function postActivity(input: ClientActivityInput): void {
  void fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => {
    /* ignore network errors */
  });
}
