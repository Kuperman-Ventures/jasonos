import type { HandoffStatus } from "./types";

export type SentOutreach = {
  subject: string | null;
  sentAt: string;
};

/** When Sync finds mail Jason already sent to this person, move them to Waiting. */
export function sentReplyPatch(input: {
  status: HandoffStatus | string;
  callStartsAt: string | null;
  contactEmail: string | null;
  outreach: SentOutreach | null;
}): {
  status: "acted_on";
  last_outreach_subject: string | null;
  last_outreach_sent_at: string;
} | null {
  if (input.callStartsAt) return null;
  if (input.status !== "times_ready" && input.status !== "draft_ready") return null;
  const email = (input.contactEmail ?? "").trim();
  if (!email.includes("@")) return null;
  if (!input.outreach?.sentAt) return null;
  if (!Number.isFinite(Date.parse(input.outreach.sentAt))) return null;
  return {
    status: "acted_on",
    last_outreach_subject: input.outreach.subject,
    last_outreach_sent_at: input.outreach.sentAt,
  };
}
