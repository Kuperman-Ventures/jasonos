import { REACTION_SHAPES, type ReactionShape } from "./reactions";

export const PLAYBOOK_FAMILIES = [
  "net102_first",
  "net102_second",
  "net101",
  "net103",
  "int101",
  "advisors",
  "pitch",
  "blank",
  "custom",
] as const;

export type PlaybookFamily = (typeof PLAYBOOK_FAMILIES)[number];

export const FAMILY_LABELS: Record<PlaybookFamily, string> = {
  net102_first: "Net 102 First Call",
  net102_second: "Net 102 Second Call",
  net101: "Net 101 Own Network",
  net103: "Net 103 Cold",
  int101: "Int 101 Interview",
  advisors: "Advisors Intro",
  pitch: "AgencyToolBox Pitch",
  blank: "Blank",
  custom: "Custom",
};

export const BROWNING_FAMILIES = new Set<PlaybookFamily>([
  "net102_first",
  "net102_second",
  "net101",
  "net103",
]);

/** Keys of the Browning ten-block template, in order. */
export const BROWNING_BLOCK_KEYS = [
  "who",
  "why",
  "what_how",
  "expectations",
  "rapport",
  "conversation",
  "turn_to_me",
  "ask",
  "close",
  "after",
] as const;

export const BLOCK_KINDS = ["text", "lines", "points", "ask", "after"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  text: "Text",
  lines: "Lines",
  points: "Points",
  ask: "Ask",
  after: "After",
};

export interface PlaybookLine {
  label: string;
  text: string;
}

export interface PlaybookBlock {
  key: string;
  title: string;
  kind: BlockKind;
  required: boolean;
  /** Text for text/ask/after blocks, lines for lines blocks, null for points. */
  default: string | PlaybookLine[] | null;
  rule: string | null;
}

export interface PlaybookTimeBudget {
  expectations?: number;
  rapport?: number;
  main?: number;
  close?: number;
}

export interface PlaybookObjection {
  shape: ReactionShape;
  soundsLike: string;
  pivot: string;
}

export const QUESTION_TOPICS = [
  "industry",
  "company",
  "contacts",
  "resources",
  "rapport",
  "turn_to_me",
  "other",
] as const;

export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

export const QUESTION_TOPIC_LABELS: Record<QuestionTopic, string> = {
  industry: "Industry",
  company: "Company",
  contacts: "Contacts",
  resources: "Resources",
  rapport: "Rapport",
  turn_to_me: "Turn to me",
  other: "Other",
};

const FAMILY_SET = new Set<string>(PLAYBOOK_FAMILIES);
const KIND_SET = new Set<string>(BLOCK_KINDS);
const SHAPE_SET = new Set<string>(REACTION_SHAPES);
const TOPIC_SET = new Set<string>(QUESTION_TOPICS);

export function asFamily(value: unknown): PlaybookFamily {
  return typeof value === "string" && FAMILY_SET.has(value) ? (value as PlaybookFamily) : "custom";
}

export function asTopic(value: unknown): QuestionTopic {
  return typeof value === "string" && TOPIC_SET.has(value) ? (value as QuestionTopic) : "other";
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\r\n/g, "\n").trim();
  return text.length <= max ? text : text.slice(0, max).trim();
}

function asLines(value: unknown): PlaybookLine[] {
  if (!Array.isArray(value)) return [];
  const lines: PlaybookLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const label = cleanText((item as { label?: unknown }).label, 120);
    const text = cleanText((item as { text?: unknown }).text, 2000);
    if (!label && !text) continue;
    lines.push({ label, text });
    if (lines.length === 12) break;
  }
  return lines;
}

export function parseBlocks(value: unknown): PlaybookBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: PlaybookBlock[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = cleanText(row.key, 80);
    const title = cleanText(row.title, 120);
    const kind = typeof row.kind === "string" && KIND_SET.has(row.kind) ? (row.kind as BlockKind) : null;
    if (!key || !title || !kind || seen.has(key)) continue;
    seen.add(key);
    let fallback: PlaybookBlock["default"] = null;
    if (kind === "lines") fallback = asLines(row.default);
    else if (kind !== "points") fallback = cleanText(row.default, 4000) || null;
    blocks.push({
      key,
      title,
      kind,
      required: row.required === true,
      default: fallback,
      rule: cleanText(row.rule, 400) || null,
    });
    if (blocks.length === 30) break;
  }
  return blocks;
}

export function parseTimeBudget(value: unknown): PlaybookTimeBudget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const budget: PlaybookTimeBudget = {};
  for (const key of ["expectations", "rapport", "main", "close"] as const) {
    const minutes = row[key];
    if (typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0 && minutes <= 240) {
      budget[key] = Math.round(minutes);
    }
  }
  return Object.keys(budget).length ? budget : null;
}

export function timeBudgetTotal(budget: PlaybookTimeBudget | null): number {
  if (!budget) return 0;
  return (budget.expectations ?? 0) + (budget.rapport ?? 0) + (budget.main ?? 0) + (budget.close ?? 0);
}

/** Objections may repeat a shape when a playbook has more than one ask. */
export function parseObjections(value: unknown): PlaybookObjection[] {
  if (!Array.isArray(value)) return [];
  const out: PlaybookObjection[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.shape !== "string" || !SHAPE_SET.has(row.shape)) continue;
    const soundsLike = cleanText(row.soundsLike, 240).replace(/\s+/g, " ");
    const pivot = cleanText(row.pivot, 400).replace(/\s+/g, " ");
    if (!soundsLike && !pivot) continue;
    out.push({ shape: row.shape as ReactionShape, soundsLike, pivot });
    if (out.length === 30) break;
  }
  return out;
}

/** Required block titles: the blocks that gate Ready on a call sheet. */
export function readyGates(blocks: PlaybookBlock[]): string[] {
  return blocks.filter((block) => block.required).map((block) => block.title);
}

export function blockKeyFromTitle(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base =
    "custom:" +
    (title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "block");
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

export function emptyDefault(kind: BlockKind): PlaybookBlock["default"] {
  if (kind === "lines") return [];
  return null;
}
