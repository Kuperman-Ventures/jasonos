/**
 * Commitment Check: payload parsing and pure helpers.
 * No database or Next.js imports, so the MCP stdio process and tests can use it.
 */
import { z } from "zod";
import {
  COMMITMENT_SECTIONS,
  DELIVERY_STATES,
  type CommitmentCheckPayload,
  type CommitmentItem,
  type CommitmentItemStateRow,
  type CommitmentSection,
  type CommitmentView,
} from "./types";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAYLOAD_CHARS = 200_000;

const text = (max: number) => z.string().trim().max(max);

const ItemInputSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9:_-]{0,159}$/, "key: lowercase letters, numbers, colon, underscore, hyphen")
    .optional(),
  promise: text(600).min(1),
  to: text(300).min(1),
  due_date: z.string().regex(YMD, "due_date must be YYYY-MM-DD").nullable().optional(),
  delivery: z.enum(DELIVERY_STATES).optional(),
  evidence: text(600).nullable().optional(),
  source: z.enum(["gmail", "granola", "other"]).optional(),
  source_url: text(2000).nullable().optional(),
  context: text(300).nullable().optional(),
});

const PayloadInputSchema = z.object({
  generated_at: z.string().optional(),
  sources: z
    .object({
      gmail: z.enum(["ok", "unavailable"]).optional(),
      granola: z.enum(["ok", "unavailable"]).optional(),
    })
    .optional(),
  delivered_count: z.number().int().min(0).max(10_000).optional(),
  items: z.array(ItemInputSchema).max(200),
  notes: text(2000).nullable().optional(),
});

/** Small stable string hash (djb2), hex. Used for item keys. */
export function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function normalizePromise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function deriveItemKey(item: { source?: string; source_url?: string | null; promise: string }): string {
  const source = item.source ?? "other";
  return `${source}:${stableHash(`${item.source_url ?? ""}|${normalizePromise(item.promise)}`)}`;
}

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Parse and normalize a published payload (JSON string or object). Throws plain-English errors. */
export function parseCommitmentPayload(raw: unknown): CommitmentCheckPayload {
  let value = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error("payload_json is empty.");
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      throw new Error("payload_json is not valid JSON.");
    }
  }
  const parsed = PayloadInputSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `Commitment check payload is invalid at ${first?.path.join(".") || "root"}: ${first?.message ?? "unknown error"}`
    );
  }
  const input = parsed.data;
  const seen = new Set<string>();
  const items: CommitmentItem[] = [];
  for (const item of input.items) {
    const key = item.key ?? deriveItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      promise: item.promise,
      to: item.to,
      due_date: item.due_date ?? null,
      delivery: item.delivery ?? "not_delivered",
      evidence: item.evidence ?? null,
      source: item.source ?? "other",
      source_url: isHttpUrl(item.source_url) ? item.source_url : null,
      context: item.context ?? null,
    });
  }
  const payload: CommitmentCheckPayload = {
    generated_at: input.generated_at ?? new Date().toISOString(),
    sources: {
      gmail: input.sources?.gmail ?? "ok",
      granola: input.sources?.granola ?? "ok",
    },
    delivered_count: input.delivered_count ?? 0,
    items,
    notes: input.notes ?? null,
  };
  if (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS) {
    throw new Error("Commitment check payload is too large.");
  }
  return payload;
}

/** Today's date in America/New_York as YYYY-MM-DD. */
export function etDate(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** Section from the due date and today's Eastern date (YYYY-MM-DD strings compare correctly). */
export function sectionFor(dueDate: string | null, today: string): CommitmentSection {
  if (!dueDate) return "no_date";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due_today";
  return "coming_up";
}

/** True when Jason's action on Home should hide the item today. */
export function isHidden(state: CommitmentItemStateRow | undefined, today: string): boolean {
  if (!state) return false;
  if (state.state === "done" || state.state === "dismissed") return true;
  return !!state.snoozed_until && today < state.snoozed_until;
}

/** Merge items with Home states, drop hidden ones, and sort by section then due date. */
export function buildViews(
  items: readonly CommitmentItem[],
  states: readonly CommitmentItemStateRow[],
  today: string
): { visible: CommitmentView[]; hidden: number } {
  const byKey = new Map(states.map((s) => [s.item_key, s]));
  const visible: CommitmentView[] = [];
  let hidden = 0;
  for (const item of items) {
    const state = byKey.get(item.key);
    if (isHidden(state, today)) {
      hidden += 1;
      continue;
    }
    visible.push({
      ...item,
      section: sectionFor(item.due_date, today),
      state: state?.state ?? null,
      snoozed_until: state?.snoozed_until ?? null,
    });
  }
  visible.sort(
    (a, b) =>
      COMMITMENT_SECTIONS.indexOf(a.section) - COMMITMENT_SECTIONS.indexOf(b.section) ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.to.localeCompare(b.to)
  );
  return { visible, hidden };
}

/** Tomorrow's Eastern date from a YYYY-MM-DD string. */
export function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function formatDue(ymd: string | null): string {
  if (!ymd) return "No date set";
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
