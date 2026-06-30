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
  | "call"
  | "video"
  | "calendar"
  | "in_person"
  | "coffee_chat"
  | "text"
  | "thank_you_note"
  | "value_sharing"
  | "other";

// The manual "Log a touch" picker buttons (in display order). Other channel
// values (calendar, coffee_chat, thank_you_note, value_sharing, other) remain
// valid for sync flows and historical rows — they're just not offered here.
export const LOG_TOUCH_CHANNELS: { value: LogTouchChannel; label: string; hint?: string }[] = [
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "phone", label: "Phone" },
  { value: "text", label: "Text" },
  { value: "video", label: "Video Call", hint: "Zoom / Teams / Meet" },
  { value: "in_person", label: "In Person Meeting" },
];

/**
 * Touch channels that are interpretable as "we actually had a conversation"
 * (vs a one-way send). Used in cadence-stage progression heuristics and the
 * Draft Assist mode auto-selector.
 */
export const CONVERSATIONAL_CHANNELS: LogTouchChannel[] = [
  "calendar",
  "coffee_chat",
  "in_person",
  "phone",
  "call",
  "video",
];
