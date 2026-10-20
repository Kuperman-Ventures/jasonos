import type { PointKind, PointState } from "@/lib/meeting-prep/points";

/** Live UI kind map — icon name, label, text/icon colors. */
export const LIVE_KIND = {
  agenda: {
    label: "Agenda",
    icon: "list-bullets",
    text: "var(--jos-ink)",
    iconColor: "var(--jos-ink)",
    band: "var(--jos-ink)",
  },
  point: {
    label: "Point",
    icon: "chat-circle-text",
    text: "var(--jos-ink)",
    iconColor: "var(--jos-ink)",
    band: "var(--jos-ink)",
  },
  question: {
    label: "Question",
    icon: "question",
    text: "var(--color-accent-700)",
    iconColor: "var(--color-accent)",
    band: "var(--color-accent-700)",
  },
  ask: {
    label: "Ask",
    icon: "target",
    text: "var(--color-accent-2)",
    iconColor: "var(--color-accent-2)",
    band: "var(--color-accent-2)",
  },
} as const satisfies Record<
  PointKind,
  {
    label: string;
    icon: string;
    text: string;
    iconColor: string;
    band: string;
  }
>;

export type LiveRailState = "done" | "current" | "open" | "skipped";

export function railStateFor(point: { state: PointState }, isCurrent: boolean): LiveRailState {
  if (isCurrent && point.state === "open") return "current";
  if (point.state === "covered") return "done";
  if (point.state === "skipped") return "skipped";
  return "open";
}

export const LIVE_OUTCOME = {
  hit: {
    label: "Hit",
    fill: "var(--color-done)",
    text: "var(--color-on-action)",
  },
  partial: {
    label: "Partial",
    fill: "var(--color-process-yellow)",
    text: "var(--jos-ink)",
  },
  missed: {
    label: "Missed",
    fill: "var(--color-accent-2)",
    text: "var(--color-on-action)",
  },
} as const;

export const LIVE_REVIEW_STATUS = {
  covered: {
    label: "Covered",
    fill: "var(--color-done-100)",
    text: "var(--color-done)",
  },
  said_differently: {
    label: "Said differently",
    fill: "var(--jos-warn-tint)",
    text: "var(--jos-ink)",
  },
  skipped: {
    label: "Skipped",
    fill: "#d8d6d6",
    text: "var(--jos-muted)",
  },
} as const;

export const LIVE_SECTION_LABEL =
  "text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--jos-muted)]";

export const LIVE_FIELD =
  "w-full rounded-[2px] border-0 border-b-2 border-[#b5b2b2] bg-[var(--jos-surface)] px-3.5 text-[var(--jos-ink)] outline-none placeholder:text-[var(--jos-muted)] focus-visible:border-[var(--color-accent-700)]";

export const LIVE_FIELD_UNFINISHED =
  "border-[var(--color-accent-2-400)] bg-[var(--color-accent-2-100)] placeholder:text-[var(--color-accent-2-text)]";

export const LIVE_RAIL_W = 300;
export const LIVE_HEADER_H = 56;
export const LIVE_NARROW = 1100;
