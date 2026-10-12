/**
 * Fuck You Batman: payload parsing and snapshot markdown.
 * No database or Next.js imports, so the MCP stdio process and tests can use it.
 */
import { z } from "zod";
import {
  FYB_DECISION_STATUSES,
  FYB_ENTRY_KIND_LABEL,
  FYB_ENTRY_KINDS,
  type FybDecision,
  type FybEntry,
  type FybEntryKind,
  type FybOption,
} from "./types";

const MAX_JSON_CHARS = 200_000;
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, missing: string) =>
  z.string({ error: missing }).trim().min(1, missing).max(max);

const OptionSchema = z.object({
  key: z.string().trim().regex(SLUG, "option key: lowercase letters, numbers, hyphens"),
  label: requiredText(200, "Each option needs a label."),
  summary: requiredText(2000, "Each option needs a summary."),
  strengths: z.array(text(400)).max(20).default([]),
  holes: z.array(text(400)).max(20).default([]),
});

const DecisionInputSchema = z
  .object({
    decision_key: z
      .string()
      .trim()
      .regex(SLUG, "decision_key: lowercase letters, numbers, hyphens (e.g. ending, hidden-purpose)"),
    week: z.number().int().min(0).max(99),
    phase: z.number().int().min(1).max(8),
    question: requiredText(600, "Question is required."),
    context: text(20_000).nullable().optional(),
    options: z.array(OptionSchema).max(20).default([]),
    sort_order: z.number().int().min(0).max(10_000).optional(),
    status: z.enum(FYB_DECISION_STATUSES).optional(),
    chosen_option_key: text(80).nullable().optional(),
    custom_answer: text(8000).nullable().optional(),
    jason_note: text(4000).nullable().optional(),
    reopen: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const chosen = value.chosen_option_key?.trim() || null;
    if (chosen === "custom") {
      if (!value.custom_answer?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["custom_answer"],
          message: "Write your own answer, or pick one of the options.",
        });
      }
      return;
    }
    if (chosen && !value.options.some((option) => option.key === chosen)) {
      ctx.addIssue({
        code: "custom",
        path: ["chosen_option_key"],
        message: `chosen_option_key "${chosen}" is not one of the option keys, and is not "custom".`,
      });
    }
  });

const EntryInputSchema = z.object({
  kind: z.enum(FYB_ENTRY_KINDS),
  entry_key: z
    .string()
    .trim()
    .regex(SLUG, "entry_key: lowercase letters, numbers, hyphens"),
  title: requiredText(300, "Title is required."),
  body_md: text(100_000).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  links: z.array(text(160)).max(50).optional(),
  sort_order: z.number().int().min(0).max(10_000).optional(),
});

export type DecisionInput = z.infer<typeof DecisionInputSchema>;
export type EntryInput = z.infer<typeof EntryInputSchema>;

function parseJson(raw: unknown, emptyMessage: string, invalidMessage: string): unknown {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error(emptyMessage);
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      throw new Error(invalidMessage);
    }
  }
  return raw;
}

function firstIssue(error: z.ZodError): string {
  const first = error.issues[0];
  const path = first?.path.length ? first.path.join(".") : "root";
  let message = first?.message ?? "unknown error";
  if (/expected string, received undefined/i.test(message)) {
    message = "this field is required.";
  }
  return `${path}: ${message}`;
}

function assertSize(value: unknown, label: string) {
  if (JSON.stringify(value).length > MAX_JSON_CHARS) {
    throw new Error(`${label} is too large.`);
  }
}

/** Parse a published decision (JSON string or object). Throws plain-English errors. */
export function parseDecisionInput(raw: unknown): DecisionInput {
  const value = parseJson(raw, "decision_json is empty.", "decision_json is not valid JSON.");
  const parsed = DecisionInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Decision is invalid at ${firstIssue(parsed.error)}`);
  }
  assertSize(parsed.data, "Decision");
  return parsed.data;
}

/** Parse a published story entry (JSON string or object). Throws plain-English errors. */
export function parseEntryInput(raw: unknown): EntryInput {
  const value = parseJson(raw, "entry_json is empty.", "entry_json is not valid JSON.");
  const parsed = EntryInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Entry is invalid at ${firstIssue(parsed.error)}`);
  }
  assertSize(parsed.data, "Entry");
  return parsed.data;
}

export function chosenAnswerLabel(decision: FybDecision): string {
  if (decision.chosen_option_key === "custom") return (decision.custom_answer ?? "").trim();
  const option = decision.options.find((item) => item.key === decision.chosen_option_key);
  return option?.label ?? decision.chosen_option_key ?? "";
}

function formatDecidedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function optionsFromUnknown(value: unknown): FybOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is FybOption => {
    if (!item || typeof item !== "object") return false;
    const row = item as FybOption;
    return typeof row.key === "string" && typeof row.label === "string";
  });
}

export function asDecision(row: Record<string, unknown>): FybDecision {
  return {
    id: String(row.id),
    decision_key: String(row.decision_key),
    week: Number(row.week),
    phase: Number(row.phase),
    question: String(row.question),
    context: typeof row.context === "string" ? row.context : null,
    options: optionsFromUnknown(row.options),
    status: row.status === "decided" ? "decided" : "open",
    chosen_option_key: typeof row.chosen_option_key === "string" ? row.chosen_option_key : null,
    custom_answer: typeof row.custom_answer === "string" ? row.custom_answer : null,
    jason_note: typeof row.jason_note === "string" ? row.jason_note : null,
    decided_at: typeof row.decided_at === "string" ? row.decided_at : null,
    decided_by: typeof row.decided_by === "string" ? row.decided_by : null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function asEntry(row: Record<string, unknown>): FybEntry {
  const kind = FYB_ENTRY_KINDS.includes(row.kind as FybEntryKind)
    ? (row.kind as FybEntryKind)
    : "reference";
  const data =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    kind,
    entry_key: String(row.entry_key),
    title: String(row.title),
    body_md: typeof row.body_md === "string" ? row.body_md : "",
    data,
    links: Array.isArray(row.links) ? row.links.map((item) => String(item)) : [],
    status: row.status === "approved" ? "approved" : "draft",
    approved_at: typeof row.approved_at === "string" ? row.approved_at : null,
    sort_order: Number(row.sort_order ?? 0),
    updated_by: typeof row.updated_by === "string" ? row.updated_by : "jasonos",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** One markdown document: decided, then open, then entries grouped by kind. */
export function buildSnapshotMarkdown(decisions: readonly FybDecision[], entries: readonly FybEntry[]): string {
  const decided = decisions
    .filter((d) => d.status === "decided")
    .slice()
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));
  const open = decisions
    .filter((d) => d.status === "open")
    .slice()
    .sort((a, b) => a.week - b.week || a.sort_order - b.sort_order);

  const lines: string[] = ["# Fuck You Batman snapshot", ""];

  lines.push("## Decisions made");
  if (!decided.length) {
    lines.push("", "None yet.");
  } else {
    for (const d of decided) {
      const date = formatDecidedDate(d.decided_at) || "undated";
      lines.push("", `### ${date} - ${d.question}`);
      lines.push("", `**Answer:** ${chosenAnswerLabel(d) || "(none)"}`);
      if (d.jason_note?.trim()) lines.push("", d.jason_note.trim());
    }
  }

  lines.push("", "## Open decisions");
  if (!open.length) {
    lines.push("", "None.");
  } else {
    lines.push("");
    for (const d of open) {
      lines.push(`- **${d.decision_key}** (week ${d.week}, phase ${d.phase}) — ${d.question}`);
    }
  }

  for (const kind of FYB_ENTRY_KINDS) {
    const group = entries
      .filter((e) => e.kind === kind)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    if (!group.length) continue;
    lines.push("", `## ${FYB_ENTRY_KIND_LABEL[kind]}`);
    for (const entry of group) {
      lines.push("", `### ${entry.title} (${entry.status})`);
      if (entry.body_md.trim()) {
        lines.push("", entry.body_md.trim());
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}
