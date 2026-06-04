// Browning module — TypeScript shapes for the Browning Associates engagement
// coaching loop. Mirrors the schema in supabase/migrations/0021_browning_module.sql.

export type BrowningSource = "my_list" | "browning_referral";
export type BrowningTier = 1 | 2 | 3 | 4;

export type BrowningChannel =
  | "phone"
  | "video"
  | "in_person"
  | "email"
  | "linkedin";

export type ThankYouStatus = "yes" | "no" | "pending";

export type BrowningGateStatus =
  | "not_started"
  | "in_progress"
  | "blocked_browning"
  | "blocked_me"
  | "completed";

export type BrowningDeliveredStatus =
  | "yes_on_time"
  | "yes_late"
  | "partial"
  | "no"
  | "na";

export interface BrowningConversation {
  id: string;
  contact_id: string;
  linked_touch_id: string | null;
  conversation_date: string; // ISO date (YYYY-MM-DD)
  channel: BrowningChannel;
  duration_min: number | null;
  warmth: number;
  patience: number;
  advice_mode: number;
  two_referral_ask: number;
  reciprocity: number;
  referrals_received: number;
  thank_you_sent: ThankYouStatus;
  what_was_hard: string | null;
  what_to_do_differently: string | null;
  produced_lead: boolean;
  /** Average of the 5 dimensions, computed as a Postgres generated column. */
  avg_quality: number;
  scored_at: string;
}

export interface BrowningGate {
  gate_code: string; // '1A' .. '3D'
  step_number: number; // 1 | 2 | 3
  description: string;
  browning_sla: string | null;
  target_date: string | null;
  completed_date: string | null;
  status: BrowningGateStatus;
  notes: string | null;
  updated_at: string;
}

export interface BrowningDeliverable {
  id: string;
  month: string; // ISO date — first of the month
  promised: string;
  delivered_status: BrowningDeliveredStatus | null;
  on_time: boolean | null;
  quality: number | null;
  notes: string | null;
  escalate: boolean;
  inserted_at?: string;
}

export interface BrowningWeeklyKpi {
  week_ending_friday: string;
  conversations_count: number;
  avg_warmth: number | null;
  avg_quality_overall: number | null;
  referrals_received_total: number;
  thank_yous_sent_count: number;
  leads_produced_count: number;
}

export interface BrowningContactRow {
  contact_id: string;
  name: string;
  title: string | null;
  company: string | null;
  browning_source: BrowningSource;
  browning_tier: BrowningTier | null;
  intent: string | null;
  last_touch_at: string | null;
  conversations_count: number;
  avg_warmth: number | null;
  avg_quality_overall: number | null;
  has_draft: boolean;
}

export interface UnscoredTouch {
  touch_id: string;
  contact_id: string;
  contact_name: string;
  touched_at: string;
  channel: string;
}

export interface BrowningSummary {
  /** Current week (Friday-ending). */
  weekly: BrowningWeeklyKpi | null;
  /** Prior week, for delta sparkline. */
  prior_weekly: BrowningWeeklyKpi | null;
  /** First gate where status != 'completed'. */
  next_gate: BrowningGate | null;
  /** Touches >24h old on Browning contacts with no conversation row. */
  unscored_count: number;
  /** Current month deliverables not yet delivered. */
  pending_deliverables: BrowningDeliverable[];
  /** Per-target weekly conversation count for KPI strip / home card. */
  weekly_target: number;
}

export const BROWNING_WEEKLY_TARGET = 5;

// Score-row metadata. Order is meaningful for the dialog layout (Warmth first
// because Kupe explicitly named it as his coachable gap).
export const BROWNING_SCORE_KEYS = [
  "warmth",
  "patience",
  "advice_mode",
  "two_referral_ask",
  "reciprocity",
] as const;

export type BrowningScoreKey = (typeof BROWNING_SCORE_KEYS)[number];

export const BROWNING_SCORE_LABELS: Record<
  BrowningScoreKey,
  { label: string; hint: string }
> = {
  warmth: { label: "Warmth", hint: "Stepping stone → Human" },
  patience: { label: "Patience", hint: "Drove agenda → Let them talk" },
  advice_mode: {
    label: "Advice-mode",
    hint: '"Hire me" → "Your perspective"',
  },
  two_referral_ask: {
    label: "Two-Referral Ask",
    hint: "Fumbled → Got two names",
  },
  reciprocity: {
    label: "Reciprocity",
    hint: "Forgot → Offered something useful",
  },
};

export const BROWNING_CHANNEL_LABELS: Record<BrowningChannel, string> = {
  phone: "Phone",
  video: "Video",
  in_person: "In-person",
  email: "Email",
  linkedin: "LinkedIn",
};

export const BROWNING_GATE_STATUS_LABELS: Record<BrowningGateStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked_browning: "Blocked — Browning",
  blocked_me: "Blocked — me",
  completed: "Completed",
};

export const BROWNING_DELIVERED_STATUS_LABELS: Record<
  BrowningDeliveredStatus,
  string
> = {
  yes_on_time: "Yes — on time",
  yes_late: "Yes — late",
  partial: "Partial",
  no: "No",
  na: "N/A",
};

export const BROWNING_SOURCE_LABELS: Record<BrowningSource, string> = {
  my_list: "My List",
  browning_referral: "Browning Referral",
};
