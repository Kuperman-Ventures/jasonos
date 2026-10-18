import type { PointKind } from "./points";

export const REACTION_SHAPES = [
  "agree",
  "soft_agree",
  "defer",
  "deflect",
  "counter_ask",
  "decline",
] as const;

export type ReactionShape = (typeof REACTION_SHAPES)[number];

export const REACTION_LABELS: Record<ReactionShape, string> = {
  agree: "Yes",
  soft_agree: "Yes, but no date",
  defer: "Later",
  deflect: "Someone else",
  counter_ask: "Asks me something back",
  decline: "No",
};

export interface Reaction {
  shape: ReactionShape;
  soundsLike: string;
  pivot: string;
}

const SHAPE_SET = new Set<string>(REACTION_SHAPES);
const FIELD_MAX = 160;

function unwrapFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (match ? match[1] : text).trim();
}

function extractJson(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

function clampField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || clean.length >= FIELD_MAX) return null;
  return clean;
}

/** JSON only. Exactly six reactions, one per shape. Each field under 160 characters. */
export function parseReactions(text: string): Reaction[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(unwrapFence(text)));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== REACTION_SHAPES.length) return null;

  const byShape = new Map<ReactionShape, Reaction>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") return null;
    const shape = (item as { shape?: unknown }).shape;
    if (typeof shape !== "string" || !SHAPE_SET.has(shape)) return null;
    if (byShape.has(shape as ReactionShape)) return null;
    const soundsLike = clampField((item as { soundsLike?: unknown }).soundsLike);
    const pivot = clampField((item as { pivot?: unknown }).pivot);
    if (!soundsLike || !pivot) return null;
    byShape.set(shape as ReactionShape, { shape: shape as ReactionShape, soundsLike, pivot });
  }

  if (byShape.size !== REACTION_SHAPES.length) return null;
  return REACTION_SHAPES.map((shape) => byShape.get(shape)!);
}

export function reactionsSystemPrompt(writingRules: string): string {
  const shapes = REACTION_SHAPES.join(", ");
  return `Jason is about to make this ask or question on a call. For each of the six shapes (${shapes}), write what this person would plausibly say (one sentence, in their voice) and Jason's pivot (one sentence, in Jason's voice, that moves back toward the success sentence). Do not invent new shapes. Return JSON only: [{"shape":"...","soundsLike":"...","pivot":"..."}] with all six shapes, in that order. Each soundsLike and pivot is under 160 characters.
${writingRules}`;
}

export function buildReactionsUserMessage(input: {
  headline: string;
  detail: string | null;
  kind: PointKind;
  situation: string | null;
  successSentence: string | null;
  person: { name: string; title: string | null; company: string | null } | null;
}): string {
  const lines = [
    `Kind: ${input.kind}`,
    `Line: ${input.headline.trim() || "Untitled"}`,
    input.detail?.trim() ? `Detail: ${input.detail.trim()}` : "Detail: None on file",
    input.situation?.trim() ? `Situation: ${input.situation.trim()}` : "Situation: None on file",
    input.successSentence?.trim()
      ? `What success looks like: ${input.successSentence.trim()}`
      : "What success looks like: None on file",
  ];

  if (input.person?.name?.trim()) {
    const who = [input.person.name.trim(), input.person.title?.trim(), input.person.company?.trim()]
      .filter(Boolean)
      .join(", ");
    lines.push(`Person: ${who}`);
    lines.push("Write soundsLike in this person's voice. Write pivot in Jason's voice.");
  } else {
    lines.push("Person: None on file");
    lines.push(
      "No named person. Where a name or company would go, write {{name}} and {{company}} so they can be filled later."
    );
  }

  return lines.join("\n");
}
