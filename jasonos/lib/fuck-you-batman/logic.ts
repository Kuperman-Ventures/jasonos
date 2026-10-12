/**
 * Fuck You Batman: payload parsing, snapshot markdown, and outline/drift checks.
 * No database or Next.js imports, so the MCP stdio process and tests can use it.
 */
import { z } from "zod";
import {
  ENTRY_CARD_FIELDS,
  FYB_DECISION_STATUSES,
  FYB_ENTRY_KIND_LABEL,
  FYB_ENTRY_KINDS,
  FYB_ENTRY_STATUSES,
  FYB_SCENE_DRAFT_STATUSES,
  type FybCheck,
  type FybDecision,
  type FybEntry,
  type FybEntryKind,
  type FybEntryStatus,
  type FybOption,
} from "./types";

const MAX_JSON_CHARS = 200_000;
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, missing: string) =>
  z.string({ error: missing }).trim().min(1, missing).max(max);
const chapterInt = (name: string) =>
  z.number({ error: `${name} must be a number.` }).int().min(1, `${name} must be 1 or higher`);

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

const CharacterDataSchema = z.object({
  role: requiredText(200, "role is required."),
  voice: requiredText(2000, "voice is required (how they talk)."),
  first_chapter: chapterInt("first_chapter").optional(),
});

const TimelineDataSchema = z.object({
  when: requiredText(300, "when is required (the label shown on the timeline)."),
});

const DriftStageDataSchema = z
  .object({
    stage_number: z.number({ error: "stage_number must be a number." }).int().min(1, "stage_number must be 1 or higher"),
    name: requiredText(200, "name is required."),
    chapter_from: chapterInt("chapter_from"),
    chapter_to: chapterInt("chapter_to"),
    reader_believes: requiredText(4000, "reader_believes is required."),
    actually_true: requiredText(4000, "actually_true is required."),
  })
  .superRefine((value, ctx) => {
    if (value.chapter_to < value.chapter_from) {
      ctx.addIssue({
        code: "custom",
        path: ["chapter_to"],
        message: "chapter_to must be greater than or equal to chapter_from.",
      });
    }
  });

const DriftClueDataSchema = z.object({
  stage_key: requiredText(80, "stage_key is required."),
  chapter: chapterInt("chapter"),
  example_line: text(2000).optional(),
  what_it_hides: requiredText(4000, "what_it_hides is required."),
});

const DriftPatternDataSchema = z.object({
  stage_key: requiredText(80, "stage_key is required."),
  first_chapter: chapterInt("first_chapter"),
  pattern: requiredText(2000, "pattern is required."),
  example: text(2000).optional(),
});

const SceneDataSchema = z.object({
  chapter: chapterInt("chapter"),
  scene_number: chapterInt("scene_number"),
  track: requiredText(200, "track is required (plot track name)."),
  drift_stage_key: requiredText(80, "drift_stage_key is required."),
  purpose: requiredText(2000, "purpose is required."),
  what_happens: requiredText(8000, "what_happens is required."),
  computer_reports: requiredText(8000, "computer_reports is required."),
  actually_true: requiredText(8000, "actually_true is required."),
  place_and_time: text(500).optional(),
  word_target: z.number().int().min(1).optional(),
  draft_status: z.enum(FYB_SCENE_DRAFT_STATUSES, {
    error: "draft_status must be outlined, drafted, or revised.",
  }),
  doc_url: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https:\/\//i.test(value), "doc_url must be an https link."),
});

const KIND_DATA_SCHEMA: Partial<Record<FybEntryKind, z.ZodType>> = {
  bible_character: CharacterDataSchema,
  bible_timeline: TimelineDataSchema,
  drift_stage: DriftStageDataSchema,
  drift_clue: DriftClueDataSchema,
  drift_pattern: DriftPatternDataSchema,
  scene: SceneDataSchema,
};

const EntryInputSchema = z
  .object({
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
  })
  .superRefine((value, ctx) => {
    const schema = KIND_DATA_SCHEMA[value.kind];
    if (!schema) return;
    const parsed = schema.safeParse(value.data ?? {});
    if (parsed.success) return;
    const first = parsed.error.issues[0];
    const path = ["data", ...(first?.path ?? [])];
    let message = first?.message ?? "invalid data";
    if (/expected string, received undefined/i.test(message)) message = "this field is required.";
    ctx.addIssue({ code: "custom", path, message });
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

function asStatus(value: unknown): FybEntryStatus {
  return (FYB_ENTRY_STATUSES as readonly string[]).includes(String(value))
    ? (value as FybEntryStatus)
    : "draft";
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
    status: asStatus(row.status),
    approved_at: typeof row.approved_at === "string" ? row.approved_at : null,
    change_request: typeof row.change_request === "string" ? row.change_request : null,
    change_requested_at: typeof row.change_requested_at === "string" ? row.change_requested_at : null,
    sort_order: Number(row.sort_order ?? 0),
    updated_by: typeof row.updated_by === "string" ? row.updated_by : "jasonos",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function intField(data: Record<string, unknown>, key: string): number | null {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function strField(data: Record<string, unknown>, key: string): string {
  return typeof data[key] === "string" ? data[key].trim() : "";
}

export function stageNameByKey(entries: readonly FybEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind !== "drift_stage") continue;
    map.set(entry.entry_key, strField(entry.data, "name") || entry.title);
  }
  return map;
}

export function dataFieldValue(
  entry: FybEntry,
  key: string,
  names: Map<string, string> = new Map()
): string {
  if (key === "chapters") {
    const from = intField(entry.data, "chapter_from");
    const to = intField(entry.data, "chapter_to");
    if (from == null) return "";
    if (to == null || to === from) return String(from);
    return `${from}-${to}`;
  }
  if (key === "drift_stage_key") {
    const stageKey = strField(entry.data, "drift_stage_key");
    return names.get(stageKey) || stageKey;
  }
  const value = entry.data[key];
  if (value == null || value === "") return "";
  return String(value);
}

export function entryDataRows(
  entry: FybEntry,
  names: Map<string, string> = new Map()
): { label: string; value: string }[] {
  const fields = ENTRY_CARD_FIELDS[entry.kind] ?? [];
  return fields
    .map((field) => ({ label: field.label, value: dataFieldValue(entry, field.key, names) }))
    .filter((row) => row.value !== "");
}

type StageRow = {
  entry: FybEntry;
  number: number;
  from: number;
  to: number;
};

function stagesOf(entries: readonly FybEntry[]): StageRow[] {
  return entries
    .filter((e) => e.kind === "drift_stage")
    .map((entry) => ({
      entry,
      number: intField(entry.data, "stage_number") ?? 0,
      from: intField(entry.data, "chapter_from") ?? 0,
      to: intField(entry.data, "chapter_to") ?? 0,
    }))
    .sort((a, b) => a.number - b.number || a.from - b.from);
}

function covering(stages: StageRow[], chapter: number): StageRow[] {
  return stages.filter((stage) => chapter >= stage.from && chapter <= stage.to);
}

/** Drift Map coverage and escalation checks. */
export function driftChecks(entries: readonly FybEntry[]): FybCheck[] {
  const checks: FybCheck[] = [];
  const stages = stagesOf(entries);
  const clues = entries.filter((e) => e.kind === "drift_clue");
  const patterns = entries.filter((e) => e.kind === "drift_pattern");
  const keys = new Set(stages.map((s) => s.entry.entry_key));
  const highest = stages.reduce((max, stage) => Math.max(max, stage.to), 0);

  for (let chapter = 1; chapter <= highest; chapter += 1) {
    const cover = covering(stages, chapter);
    if (cover.length === 0) {
      checks.push({ level: "problem", message: `Chapter ${chapter} has no drift stage.` });
    } else if (cover.length > 1) {
      checks.push({
        level: "problem",
        message: `Chapter ${chapter} is covered by more than one stage.`,
      });
    }
  }

  for (const stage of stages) {
    const key = stage.entry.entry_key;
    const stageClues = clues.filter((c) => strField(c.data, "stage_key") === key);
    if (stageClues.length === 0) {
      checks.push({ level: "warning", message: `Stage ${stage.number} has no clues.` });
    }
    if (stage.number > 1) {
      const hasPattern = patterns.some((p) => {
        if (strField(p.data, "stage_key") !== key) return false;
        const first = intField(p.data, "first_chapter");
        return first != null && first >= stage.from && first <= stage.to;
      });
      if (!hasPattern) {
        checks.push({
          level: "warning",
          message: `Stage ${stage.number} adds no new machine pattern - escalation may read as flat`,
        });
      }
    }
  }

  for (const clue of clues) {
    const key = strField(clue.data, "stage_key");
    if (key && !keys.has(key)) {
      checks.push({
        level: "problem",
        message: `Clue "${clue.title}" points at unknown stage ${key}.`,
      });
    }
  }
  for (const pattern of patterns) {
    const key = strField(pattern.data, "stage_key");
    if (key && !keys.has(key)) {
      checks.push({
        level: "problem",
        message: `Pattern "${pattern.title}" points at unknown stage ${key}.`,
      });
    }
  }

  return checks;
}

function sceneLabel(entry: FybEntry): string {
  const chapter = intField(entry.data, "chapter");
  const number = intField(entry.data, "scene_number");
  if (chapter != null && number != null) return `Chapter ${chapter} scene ${number}`;
  return entry.title;
}

/** Scene outline checks against the Drift Map. */
export function outlineChecks(entries: readonly FybEntry[]): FybCheck[] {
  const checks: FybCheck[] = [];
  const stages = stagesOf(entries);
  const byKey = new Map(stages.map((s) => [s.entry.entry_key, s]));
  const scenes = entries.filter((e) => e.kind === "scene");
  const highest = scenes.reduce((max, scene) => Math.max(max, intField(scene.data, "chapter") ?? 0), 0);

  for (const scene of scenes) {
    const chapter = intField(scene.data, "chapter");
    const stageKey = strField(scene.data, "drift_stage_key");
    const stage = byKey.get(stageKey);
    if (!stage) {
      checks.push({
        level: "problem",
        message: `${sceneLabel(scene)} points at unknown drift stage ${stageKey || "(none)"}.`,
      });
    } else if (chapter != null && (chapter < stage.from || chapter > stage.to)) {
      checks.push({
        level: "problem",
        message: `${sceneLabel(scene)} sits outside its drift stage's chapter range.`,
      });
    }
    if (!strField(scene.data, "computer_reports")) {
      checks.push({
        level: "problem",
        message: `${sceneLabel(scene)} is missing computer_reports.`,
      });
    }
    if (!strField(scene.data, "actually_true")) {
      checks.push({
        level: "problem",
        message: `${sceneLabel(scene)} is missing actually_true.`,
      });
    }
  }

  const byChapter = new Map<number, FybEntry[]>();
  for (const scene of scenes) {
    const chapter = intField(scene.data, "chapter");
    if (chapter == null) continue;
    const list = byChapter.get(chapter) ?? [];
    list.push(scene);
    byChapter.set(chapter, list);
  }

  for (let chapter = 1; chapter <= highest; chapter += 1) {
    const group = byChapter.get(chapter) ?? [];
    if (group.length === 0) {
      checks.push({ level: "problem", message: `Chapter ${chapter} has no scenes.` });
      continue;
    }
    const tracks = new Set(group.map((s) => strField(s.data, "track")).filter(Boolean));
    if (tracks.size === 1) {
      checks.push({
        level: "warning",
        message: `Chapter ${chapter} runs a single plot track`,
      });
    }
  }

  return checks;
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
  const names = stageNameByKey(entries);

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
      lines.push(`- **${d.decision_key}** (week ${d.week}, phase ${d.phase}) - ${d.question}`);
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
      for (const row of entryDataRows(entry, names)) {
        lines.push(`- ${row.label}: ${row.value}`);
      }
      if (entry.change_request?.trim()) {
        lines.push(`- Change request: ${entry.change_request.trim()}`);
      }
      if (entry.body_md.trim()) {
        lines.push("", entry.body_md.trim());
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}
