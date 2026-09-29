// Shared formatting helpers for the Browning module. Centralised so
// BrowningCard, the KPI strip, the Pipeline table, and the score dialog
// all agree on color thresholds and tone.

import type {
  BrowningChannel,
  BrowningGateStatus,
  BrowningDeliveredStatus,
} from "@/lib/browning/types";

/**
 * Warmth color thresholds — applied everywhere a Warmth score (1–5) or its
 * weekly average is rendered.
 *
 *   ≤ 2.9  → red    ("stepping-stone vibe")
 *   3.0–3.9 → yellow ("middle ground; coachable")
 *   ≥ 4.0  → green  ("warm, present, human")
 */
export function warmthColorClass(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "text-muted-foreground";
  if (value <= 2.9) return "text-rung-1";
  if (value < 4.0) return "text-rung-ink";
  return "text-rung-ink";
}

/** Background-tinted variant for chips/pills. */
export function warmthBgClass(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "bg-muted/40 text-muted-foreground border-border";
  }
  if (value <= 2.9) {
    return "bg-rung-1  border-rung-1";
  }
  if (value < 4.0) {
    return "bg-rung-2  border-[var(--jos-line)]";
  }
  return "bg-rung-4  border-[var(--jos-line)]";
}

/** Single-score (1–5) color for the toggle group buttons. */
export function scoreButtonClass(value: number, active: boolean): string {
  if (!active) {
    return "border-border text-muted-foreground hover:text-foreground";
  }
  if (value <= 2) {
    return "border-rung-1 bg-rung-1 ";
  }
  if (value === 3) {
    return "border-[var(--jos-line)] bg-rung-2 ";
  }
  return "border-[var(--jos-line)] bg-rung-4 ";
}

export const GATE_STATUS_TONE: Record<
  BrowningGateStatus,
  { dot: string; chip: string }
> = {
  not_started: {
    dot: "bg-muted",
    chip: "bg-muted/40 text-muted-foreground border-border",
  },
  in_progress: {
    dot: "bg-rung-3",
    chip: "bg-rung-3  border-rung-3",
  },
  blocked_browning: {
    dot: "bg-rung-2",
    chip: "bg-rung-2  border-[var(--jos-line)]",
  },
  blocked_me: {
    dot: "bg-rung-2",
    chip: "bg-rung-2  border-[var(--jos-line)]",
  },
  completed: {
    dot: "bg-rung-4",
    chip: "bg-rung-4  border-[var(--jos-line)]",
  },
};

export const DELIVERED_STATUS_TONE: Record<
  BrowningDeliveredStatus,
  string
> = {
  yes_on_time:
    "bg-rung-4  border-[var(--jos-line)]",
  yes_late: "bg-rung-3  border-rung-3",
  partial: "bg-rung-2  border-[var(--jos-line)]",
  no: "bg-rung-1  border-rung-1",
  na: "bg-muted/40 text-muted-foreground border-border",
};

/**
 * Format an ISO date / timestamp as a short, locale-aware string. Falls back
 * to the input on parse failure rather than rendering "Invalid Date".
 */
export function fmtBrowningDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "3 hours ago" / "2 days ago" — tiny relative formatter for unscored alerts. */
export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso ?? "—";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

export const CHANNEL_TO_BROWNING: Record<string, BrowningChannel> = {
  email: "email",
  linkedin: "linkedin",
  phone: "phone",
  call: "phone",
  meeting: "video",
  zoom: "video",
  video: "video",
  in_person: "in_person",
  coffee_chat: "in_person",
};

export function toBrowningChannel(raw: string | null | undefined): BrowningChannel {
  if (!raw) return "phone";
  return CHANNEL_TO_BROWNING[raw.toLowerCase()] ?? "phone";
}

/**
 * "Friday of the week containing `d`" as a YYYY-MM-DD string. Mirrors the
 * `date_trunc('week', ...) + 4` definition in the SQL view so the client
 * can find "this week" / "last week" rows by exact key.
 */
export function fridayOfWeek(d: Date = new Date()): string {
  const ref = new Date(d);
  ref.setHours(0, 0, 0, 0);
  // Postgres date_trunc('week') is Monday-anchored — match that here.
  const dow = (ref.getDay() + 6) % 7; // 0 = Mon, ... 6 = Sun
  ref.setDate(ref.getDate() - dow + 4); // +4 days from Monday → Friday
  return ref.toISOString().slice(0, 10);
}

/** First day of the month containing `d`, as YYYY-MM-DD. */
export function firstOfMonth(d: Date = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}
