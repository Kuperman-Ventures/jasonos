import {
  buildMeetingPointsUserMessage,
  clampDetail,
  clampHeadline,
  type DraftPromptInput,
  type PointKind,
  POINT_KINDS,
} from "./points";
import { parseReactions, type Reaction } from "./reactions";

export interface AdaptStrategyItem {
  kind: PointKind;
  headline: string;
  detail: string | null;
  prepareReactions: boolean;
  reactions: Reaction[];
}

export interface AdaptInput extends DraftPromptInput {
  strategy: {
    name: string;
    situation: string | null;
    successSentence: string | null;
    rubric: string[];
    items: AdaptStrategyItem[];
  };
  liveSettings: { snapshot: string | null; targetCompanies: string[] };
}

export interface AdaptedItem {
  kind: PointKind;
  headline: string;
  detail: string | null;
  prepareReactions: boolean;
  reactions: Reaction[];
  sourceHint: string | null;
  dropped: boolean;
  droppedReason: string | null;
  added: boolean;
}

const KIND_SET = new Set<string>(POINT_KINDS);
const PLACEHOLDER = /\{\{\s*(?:name|company|title|targets|snapshot|narrative:[a-z0-9_]+)\s*\}\}/i;

export function adaptSystemPrompt(writingRules: string, companyVerified = true): string {
  const unverified = companyVerified
    ? ""
    : " Company research is unverified (JasonOS could not read the company website). Prefer a first question that establishes what the company is and what the person does there, and do not assume either in later points.";
  return `Jason has a strategy for this kind of meeting and is about to have it with a specific person. Rewrite each item's detail so it is what Jason would say to this person, using facts from the context and nothing invented. Keep kind, order and headline. If a headline contains {{name}}, {{company}}, {{title}}, {{targets}} or {{snapshot}}, fill that placeholder from the context and leave the token when the value is missing. When the strategy has a placeholder in square brackets such as [specific accomplishment] or [one specific thing from their background], replace it with a real item from the resume. Never leave a square-bracket placeholder in the output. For items with prepare_reactions true, rewrite the six reactions for this person: [{"shape":"agree|soft_agree|defer|deflect|counter_ask|decline","soundsLike":"...","pivot":"..."}]. Drop an item only when the context makes it moot, set dropped true, and give the reason in dropped_reason and source_hint. Add at most two items from the context, each with a source_hint. Every rewritten detail that uses a fact gets a one-line source_hint naming that fact. For question items, set listen_for when the detail says what to listen for.${unverified} Return JSON only: {"items":[{"kind":"agenda|point|question|ask","headline":"...","detail":"...","prepare_reactions":false,"reactions":[],"source_hint":"...","listen_for":null,"dropped":false,"dropped_reason":null}]} in the strategy's order, dropped items included and flagged, then any added items.
${writingRules}`;
}

export function buildAdaptUserMessage(input: AdaptInput): string {
  const items = input.strategy.items.map((item) => ({
    kind: item.kind,
    headline: item.headline,
    detail: item.detail,
    prepare_reactions: item.prepareReactions,
    reactions: item.reactions,
  }));
  const strategy = [
    `Strategy: ${input.strategy.name.trim() || "Strategy"}`,
    input.strategy.situation?.trim() ? `Situation: ${input.strategy.situation.trim()}` : null,
    input.strategy.successSentence?.trim()
      ? `Success sentence: ${input.strategy.successSentence.trim()}`
      : null,
    input.strategy.rubric.length
      ? `Checklist:\n${input.strategy.rubric.map((line) => `- ${line}`).join("\n")}`
      : null,
    `Items:\n${JSON.stringify(items)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const targets = input.liveSettings.targetCompanies.map((company) => company.trim()).filter(Boolean);
  const settings = [
    `Snapshot: ${input.liveSettings.snapshot?.trim() || "None on file"}`,
    `Target companies: ${targets.join(", ") || "None on file"}`,
  ].join("\n");
  return `${strategy}\n\n${settings}\n\n${buildMeetingPointsUserMessage(input)}`;
}

function unwrapFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (match ? match[1] : text).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function oneLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= max ? text : text.slice(0, max).trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function headlinesMatch(strategyHeadline: string, returned: string): boolean {
  const left = strategyHeadline.trim().replace(/\s+/g, " ").toLowerCase();
  const right = returned.trim().replace(/\s+/g, " ").toLowerCase();
  if (left === right) return true;
  if (!PLACEHOLDER.test(strategyHeadline)) return false;
  const parts = left.split(/\{\{\s*(?:name|company|title|targets|snapshot|narrative:[a-z0-9_]+)\s*\}\}/);
  const pattern = parts.map(escapeRegExp).join("(?:\\{\\{[^}]+\\}\\}|.+)");
  return new RegExp(`^${pattern}$`).test(right);
}

/** null means no reactions were sent. "invalid" means a list was sent and it is not the six shapes. */
function readReactions(value: unknown): Reaction[] | "invalid" | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return "invalid";
  if (value.length === 0) return null;
  const normalized = value.map((item) => {
    const row = asRecord(item);
    if (!row) return item;
    return {
      shape: row.shape,
      soundsLike: row.soundsLike ?? row.sounds_like,
      pivot: row.pivot,
    };
  });
  return parseReactions(JSON.stringify(normalized)) ?? "invalid";
}

interface Candidate {
  kind: PointKind;
  headline: string;
  detail: string | null;
  reactions: Reaction[] | "invalid" | null;
  sourceHint: string | null;
  dropped: boolean;
  droppedReason: string | null;
}

function readCandidate(value: unknown): Candidate | null {
  const row = asRecord(value);
  if (!row) return null;
  const kind = row.kind;
  if (typeof kind !== "string" || !KIND_SET.has(kind)) return null;
  if (typeof row.headline !== "string") return null;
  const headline = row.headline.trim().replace(/\s+/g, " ");
  if (!headline) return null;
  const detail =
    typeof row.detail === "string" && row.detail.trim() ? clampDetail(row.detail) : null;
  const dropped = row.dropped === true;
  return {
    kind: kind as PointKind,
    headline,
    detail,
    reactions: readReactions(row.reactions),
    sourceHint: oneLine(row.source_hint ?? row.sourceHint, 160),
    dropped,
    droppedReason: oneLine(row.dropped_reason ?? row.droppedReason, 240),
  };
}

/** Every strategy item once, in order, plus at most two extras. Null when the shape is wrong. */
export function parseAdaptation(
  text: string,
  strategyItems: AdaptStrategyItem[]
): AdaptedItem[] | null {
  let parsed: unknown;
  try {
    const raw = unwrapFence(text);
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
  } catch {
    return null;
  }
  const body = asRecord(parsed);
  const list = body && Array.isArray(body.items) ? body.items : Array.isArray(parsed) ? parsed : null;
  if (!list) return null;

  const candidates: Candidate[] = [];
  for (const item of list) {
    const candidate = readCandidate(item);
    if (!candidate) return null;
    candidates.push(candidate);
  }

  const used = new Set<number>();
  const matched: AdaptedItem[] = [];
  for (const strategy of strategyItems) {
    const index = candidates.findIndex(
      (candidate, candidateIndex) =>
        !used.has(candidateIndex) &&
        candidate.kind === strategy.kind &&
        headlinesMatch(strategy.headline, candidate.headline)
    );
    if (index === -1) return null;
    used.add(index);
    const candidate = candidates[index];
    if (candidate.dropped && !candidate.droppedReason && !candidate.sourceHint) return null;
    if (candidate.reactions === "invalid") return null;
    if (strategy.prepareReactions && !candidate.dropped && !candidate.reactions) return null;
    const placeholder = PLACEHOLDER.test(strategy.headline);
    const reason = candidate.droppedReason || (candidate.dropped ? candidate.sourceHint : null);
    const reactions = Array.isArray(candidate.reactions) ? candidate.reactions : [];
    matched.push({
      kind: strategy.kind,
      headline: placeholder ? clampHeadline(candidate.headline) : strategy.headline,
      detail: candidate.detail,
      prepareReactions: strategy.prepareReactions,
      reactions: strategy.prepareReactions ? reactions : [],
      sourceHint: candidate.dropped ? reason : candidate.sourceHint,
      dropped: candidate.dropped,
      droppedReason: reason,
      added: false,
    });
  }

  const extras = candidates.filter((_, index) => !used.has(index));
  if (extras.length > 2) return null;
  const added: AdaptedItem[] = [];
  for (const extra of extras) {
    if (extra.dropped || extra.reactions === "invalid") return null;
    const headline = clampHeadline(extra.headline);
    if (!headline || !extra.sourceHint) return null;
    added.push({
      kind: extra.kind,
      headline,
      detail: extra.detail,
      prepareReactions: Boolean(extra.reactions),
      reactions: extra.reactions ?? [],
      sourceHint: extra.sourceHint,
      dropped: false,
      droppedReason: null,
      added: true,
    });
  }

  return [...matched, ...added];
}
