/** Commitment Check types. Shared by the home panel, the publisher and the JasonOS MCP. */

export const COMMITMENT_SECTIONS = [
  "overdue",
  "due_today",
  "coming_up",
  "no_date",
  "scheduled",
] as const;
export type CommitmentSection = (typeof COMMITMENT_SECTIONS)[number];

export const SECTION_LABEL: Record<CommitmentSection, string> = {
  overdue: "Overdue",
  due_today: "Due Today",
  coming_up: "Coming Up",
  no_date: "Open Items Without A Date",
  scheduled: "Scheduled",
};

export const DELIVERY_STATES = ["not_delivered", "possibly_delivered"] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const ITEM_STATES = ["done", "dismissed", "snoozed", "scheduled"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export type CommitmentSource = "gmail" | "granola" | "other";

export interface CommitmentItem {
  /** Stable across days for the same promise. Derived from source_url and promise when omitted. */
  key: string;
  /** Jason's own words, short quote. */
  promise: string;
  /** Who it was promised to, by name. */
  to: string;
  /** YYYY-MM-DD, or null for meeting action items with no date. */
  due_date: string | null;
  delivery: DeliveryState;
  /** One plain sentence on the evidence, for possibly_delivered. */
  evidence: string | null;
  source: CommitmentSource;
  source_url: string | null;
  /** Email subject or meeting title. */
  context: string | null;
}

export interface CommitmentCheckPayload {
  generated_at: string;
  sources: { gmail: "ok" | "unavailable"; granola: "ok" | "unavailable" };
  delivered_count: number;
  items: CommitmentItem[];
  notes: string | null;
}

export interface CommitmentItemStateRow {
  item_key: string;
  state: ItemState;
  snoozed_until: string | null;
  note: string | null;
  updated_at: string;
  updated_by: string;
}

/** An item as shown on Home: section is recalculated from today's date at view time. */
export interface CommitmentView extends CommitmentItem {
  section: CommitmentSection;
  state: ItemState | null;
  snoozed_until: string | null;
}

export interface CommitmentCheckForHome {
  check_date: string | null;
  today: string;
  is_stale: boolean;
  generated_at: string | null;
  sources: CommitmentCheckPayload["sources"] | null;
  delivered_count: number;
  notes: string | null;
  /** Visible items, grouped order: overdue, due today, coming up, no date. */
  items: CommitmentView[];
  hidden_count: number;
}
