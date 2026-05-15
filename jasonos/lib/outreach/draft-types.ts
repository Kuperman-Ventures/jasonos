// Types shared between the outreach-draft server action and its UI callers.
// Kept out of the "use server" module so we can export non-async values
// (interfaces, type aliases) without tripping Next.js' server-action loader.

import type { CadenceInterval, RelationshipType } from "@/lib/outreach/types";
import type { DraftSource } from "@/lib/server-actions/draft-from-history";

export type OutreachDraftMode =
  | "first_outreach"
  | "cadence_touchpoint"
  | "follow_up_no_reply"
  | "meeting_request";

export const OUTREACH_DRAFT_MODES: OutreachDraftMode[] = [
  "first_outreach",
  "cadence_touchpoint",
  "follow_up_no_reply",
  "meeting_request",
];

export const OUTREACH_DRAFT_MODE_LABELS: Record<OutreachDraftMode, string> = {
  first_outreach: "First outreach",
  cadence_touchpoint: "Rhythm check-in",
  follow_up_no_reply: "Follow up",
  meeting_request: "Meeting request",
};

export const OUTREACH_DRAFT_MODE_HELPERS: Record<OutreachDraftMode, string> = {
  first_outreach: "No prior history — cold reach with a specific reason.",
  cadence_touchpoint: "Warm, low-friction check-in. Don't restate context.",
  follow_up_no_reply: "Open thread, no reply — move the ball forward.",
  meeting_request: "Explicit ask for time on the calendar.",
};

export type OutreachDraftChannel =
  | "email_reply"
  | "email_new"
  | "linkedin"
  | "linkedin_reply";

export interface OutreachContact {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
  primaryEmail: string | null;
  linkedinUrl: string | null;
  relationshipType: RelationshipType | null;
  cadenceInterval: CadenceInterval;
  nextTouchDate: string | null;
  lastTouchDate: string | null;
}

export interface RecentTouch {
  id: string;
  channel: string;
  direction: string;
  touched_at: string;
  brief: string | null;
}

export interface OutreachDraftResult {
  ok: true;
  draft: string;
  rationale: string;
  channel: OutreachDraftChannel;
  mode: OutreachDraftMode;
  modeAutoSelected: boolean;
  sources: DraftSource[];
  recentTouches: RecentTouch[];
}

export interface OutreachDraftError {
  ok: false;
  error: string;
}

export type LogTouchChannel =
  | "email"
  | "linkedin"
  | "phone"
  | "in_person"
  | "calendar"
  | "other";

export const LOG_TOUCH_CHANNELS: { value: LogTouchChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "phone", label: "Phone" },
  { value: "calendar", label: "Meeting" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
];
