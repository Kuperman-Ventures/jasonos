import {
  BROWNING_FAMILIES,
  type BlockKind,
  type PlaybookBlock,
  type PlaybookFamily,
  type PlaybookLine,
  type PlaybookTimeBudget,
} from "./playbook-blocks";

export interface CallSheetLine {
  label: string;
  text: string;
  /** Where Build found this line. Dropped when Jason edits the line. */
  sourceHint: string | null;
}

export interface CallSheetBlock {
  id: string;
  position: number;
  key: string;
  title: string;
  kind: BlockKind;
  required: boolean;
  body: string | null;
  lines: CallSheetLine[];
  rule: string | null;
  confirmedAt: string | null;
  updatedAt: string;
}

export interface CallSheetBlockDraft {
  position: number;
  key: string;
  title: string;
  kind: BlockKind;
  required: boolean;
  body: string | null;
  lines: CallSheetLine[];
  rule: string | null;
}

export const NETWORKING_STATUSES = [
  "referral",
  "first_contacted",
  "call_1",
  "call_2",
  "call_3",
  "ongoing",
  "closed",
] as const;

export type NetworkingStatus = (typeof NETWORKING_STATUSES)[number];

export const SOFT_ASK_LABEL = "Soft ask";

const MAX_BODY = 4000;
const MAX_LINE = 2000;
const MAX_LABEL = 120;

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\r\n/g, "\n").trim();
  return text.length <= max ? text : text.slice(0, max).trim();
}

export function cleanBody(value: string | null | undefined): string | null {
  return cleanText(value, MAX_BODY) || null;
}

export function parseSheetLines(value: unknown): CallSheetLine[] {
  if (!Array.isArray(value)) return [];
  const lines: CallSheetLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = cleanText(row.label, MAX_LABEL);
    const text = cleanText(row.text, MAX_LINE);
    if (!label && !text) continue;
    const hint = cleanText(row.sourceHint ?? row.source_hint, 240);
    lines.push({ label, text, sourceHint: hint || null });
    if (lines.length === 12) break;
  }
  return lines;
}

/** Keep a line's source hint only while its text is what Build wrote. */
export function editedLines(previous: CallSheetLine[], next: CallSheetLine[]): CallSheetLine[] {
  return next.map((line, index) => {
    const before = previous[index];
    const unchanged = before && before.text.trim() === line.text.trim() && before.label === line.label;
    return { label: line.label, text: line.text, sourceHint: unchanged ? before.sourceHint : null };
  });
}

/**
 * Playbook ask defaults may open with "Soft ask, only if ..." and may carry a second
 * paragraph like "If they offer to pass my resume along: ...". A soft-ask default moves
 * to the Soft ask line with its condition in the label; labeled follow-ups become lines.
 */
export function splitAskDefault(value: string | null): { body: string | null; lines: CallSheetLine[] } {
  const text = cleanText(value, MAX_BODY);
  const soft: CallSheetLine = { label: SOFT_ASK_LABEL, text: "", sourceHint: null };
  if (!text) return { body: null, lines: [soft] };
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  let first = paragraphs.shift() ?? "";
  const softMatch = first.match(/^soft ask\b([^.]*)\.\s*/i);
  if (softMatch) {
    const condition = softMatch[1].replace(/^[\s,]+/, "").trim();
    soft.label = condition ? `${SOFT_ASK_LABEL}, ${condition}` : SOFT_ASK_LABEL;
    soft.text = first.slice(softMatch[0].length).trim();
    first = "";
  }
  const extras: CallSheetLine[] = [];
  for (const paragraph of paragraphs) {
    const labeled = paragraph.match(/^([^:]{3,80}):\s*([\s\S]+)$/);
    if (labeled) extras.push({ label: labeled[1].trim(), text: labeled[2].trim(), sourceHint: null });
    else first = `${first}\n\n${paragraph}`.trim();
  }
  return { body: first || null, lines: [soft, ...extras] };
}

function linesFrom(value: PlaybookBlock["default"]): PlaybookLine[] {
  return Array.isArray(value) ? value : [];
}

/** Block rows for a new sheet, in playbook order, with placeholders filled by `fill`. */
export function blockRowsFromPlaybook(
  blocks: PlaybookBlock[],
  fill: (value: string | null) => string | null = (value) => value
): CallSheetBlockDraft[] {
  return blocks.map((block, index) => {
    const base = {
      position: index + 1,
      key: block.key,
      title: block.title,
      kind: block.kind,
      required: block.required,
      rule: block.rule,
    };
    if (block.kind === "lines") {
      return {
        ...base,
        body: null,
        lines: linesFrom(block.default).map((line) => ({
          label: line.label,
          text: fill(line.text) ?? "",
          sourceHint: null,
        })),
      };
    }
    if (block.kind === "points") return { ...base, body: null, lines: [] };
    if (block.kind === "ask") {
      const split = splitAskDefault(typeof block.default === "string" ? block.default : null);
      return {
        ...base,
        body: fill(split.body),
        lines: split.lines.map((line) => ({ ...line, text: fill(line.text) ?? "" })),
      };
    }
    return {
      ...base,
      body: fill(typeof block.default === "string" ? block.default : null),
      lines: [],
    };
  });
}

/** Whether a block has what it needs. After is filled on Debrief, so it never counts as empty. */
export function blockIsFilled(
  block: Pick<CallSheetBlock, "kind" | "body" | "lines">,
  pointCount = 0
): boolean {
  if (block.kind === "after") return true;
  if (block.kind === "points") return pointCount > 0;
  if (block.kind === "lines") {
    return block.lines.length > 0 && block.lines.every((line) => line.text.trim().length > 0);
  }
  return Boolean(block.body?.trim());
}

export function filledLineCount(block: Pick<CallSheetBlock, "lines">): number {
  return block.lines.filter((line) => line.text.trim()).length;
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** Plain refusal for the first empty required block, or null when every gate passes. */
export function readyProblem(
  blocks: Array<Pick<CallSheetBlock, "kind" | "title" | "required" | "body" | "lines">>,
  pointCount = 0
): string | null {
  for (const block of blocks) {
    if (!block.required || blockIsFilled(block, pointCount)) continue;
    if (block.kind === "lines") {
      if (!block.lines.length) return `Add a line to ${block.title} before the sheet is ready.`;
      const n = block.lines.length;
      return `Write the ${countWord(n)} ${block.title} line${n === 1 ? "" : "s"} before the sheet is ready.`;
    }
    if (block.kind === "points") return `Add points to ${block.title} before the sheet is ready.`;
    if (block.kind === "ask") return "Write the ask before the sheet is ready.";
    return `Write ${block.title} before the sheet is ready.`;
  }
  return null;
}

export function unsavedProblem(titles: string[]): string | null {
  if (!titles.length) return null;
  if (titles.length === 1) return `${titles[0]} has unsaved changes. Save it first.`;
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]} have unsaved changes. Save them first.`;
}

/** Which playbook to suggest from the person's Browning status. */
export function suggestedFamily(
  status: NetworkingStatus | string | null | undefined,
  touchCount = 0
): PlaybookFamily {
  if (status === "referral" || status === "first_contacted") return "net102_first";
  if (status === "call_1") return "net102_second";
  if (!status && touchCount === 0) return "net102_first";
  return "net102_second";
}

export function asNetworkingStatus(value: unknown): NetworkingStatus | null {
  return typeof value === "string" && (NETWORKING_STATUSES as readonly string[]).includes(value)
    ? (value as NetworkingStatus)
    : null;
}

/** "CALL 2 OF 3" for Browning playbooks; "CALL 4" past the third. */
export function callNumberLabel(family: PlaybookFamily | null, touchNumber: number): string | null {
  if (!family || !BROWNING_FAMILIES.has(family) || touchNumber < 1) return null;
  return touchNumber <= 3 ? `Call ${touchNumber} of 3` : `Call ${touchNumber}`;
}

const BUDGET_KEY: Record<string, keyof PlaybookTimeBudget> = {
  expectations: "expectations",
  rapport: "rapport",
  conversation: "main",
  points: "main",
  close: "close",
};

export function blockMinutes(key: string, budget: PlaybookTimeBudget | null): number | null {
  const field = BUDGET_KEY[key];
  if (!field || !budget) return null;
  const minutes = budget[field];
  return typeof minutes === "number" && minutes > 0 ? minutes : null;
}

/** Fill only empty lines. Match by label first, then by position. */
export function mergeDraftLines(
  existing: CallSheetLine[],
  drafted: Array<{ label: string; text: string; source: string | null }>
): { lines: CallSheetLine[]; changed: number } {
  let changed = 0;
  const byLabel = new Map(drafted.map((line) => [line.label.trim().toLowerCase(), line]));
  const lines = existing.map((line, index) => {
    if (line.text.trim()) return line;
    const match = byLabel.get(line.label.trim().toLowerCase()) ?? drafted[index];
    const text = match?.text.trim();
    if (!text) return line;
    changed += 1;
    return { label: line.label, text, sourceHint: match?.source?.trim() || null };
  });
  return { lines, changed };
}

export interface SheetDraft {
  who: { text: string; source: string | null } | null;
  lines: Record<string, Array<{ label: string; text: string; source: string | null }>>;
}

export const DRAFT_BLOCK_KEYS = ["what_how", "rapport", "turn_to_me"] as const;

function unwrapJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export function parseSheetDraft(text: string): SheetDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapJson(text));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const row = parsed as Record<string, unknown>;
  const whoRow = row.who && typeof row.who === "object" ? (row.who as Record<string, unknown>) : null;
  const whoText = cleanText(whoRow?.text, MAX_BODY);
  const draft: SheetDraft = {
    who: whoText ? { text: whoText, source: cleanText(whoRow?.source, 240) || null } : null,
    lines: {},
  };
  for (const key of DRAFT_BLOCK_KEYS) {
    const value = row[key];
    if (!Array.isArray(value)) continue;
    draft.lines[key] = value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        label: cleanText(item.label, MAX_LABEL),
        text: cleanText(item.text, MAX_LINE),
        source: cleanText(item.source, 240) || null,
      }))
      .filter((item) => item.text);
  }
  return draft;
}

export function sheetDraftSystemPrompt(writingRules: string): string {
  return `Jason is preparing a call sheet. Fill the empty lines he lists from the context only. Return JSON only:
{"who":{"text":"...","source":"..."},"what_how":[{"label":"...","text":"...","source":"..."}],"rapport":[...],"turn_to_me":[...]}
Rules:
- "who" is two or three plain sentences: who they are, what they do now, one accomplishment worth asking about. Omit "who" when it is not asked for.
- Only return lines whose labels Jason lists as empty. Use the exact labels.
- Each line is one or two sentences in Jason's voice, ready to say out loud.
- Every item carries a short "source" naming where the fact came from ("Their resume", "Tracy's intro", "LinkedIn research", "Email thread Oct 12").
- Leave a line out when the context has nothing for it. Never invent facts, names, numbers, or companies.
- Keep [square bracket] placeholders when Jason must fill something himself.
${writingRules}`;
}

export function buildSheetDraftMessage(input: {
  context: string;
  wantWho: boolean;
  empty: Record<string, string[]>;
}): string {
  const asks: string[] = [];
  if (input.wantWho) asks.push("who: write it");
  for (const [key, labels] of Object.entries(input.empty)) {
    if (labels.length) asks.push(`${key}: ${labels.map((label) => `"${label}"`).join(", ")}`);
  }
  return `${input.context}\n\nEmpty lines to fill:\n${asks.map((line) => `- ${line}`).join("\n") || "- none"}`;
}
