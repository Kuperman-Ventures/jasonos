import type { ReactionShape } from "./reactions";

export interface SpokenPoint {
  pointId: string;
  spoken: boolean;
  quote: string | null;
}

export interface RubricResult {
  item: string;
  met: boolean;
  quote: string | null;
}

export interface ObservedAsk {
  pointId: string;
  shape: ReactionShape | null;
  quote: string | null;
}

export interface ParsedMeetingReview {
  pointsSpoken: SpokenPoint[];
  rubricResults: RubricResult[];
  reactionsObserved: ObservedAsk[];
  suggestedMark: "hit" | "partial" | "missed" | null;
  suggestedReason: string | null;
  talkRatio: number | null;
}

const MARKS = new Set(["hit", "partial", "missed"]);
const SHAPES = new Set<string>(["agree", "soft_agree", "defer", "deflect", "counter_ask", "decline"]);

function unwrapFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (match ? match[1] : text).trim();
}

function quoteOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= 400 ? text : text.slice(0, 400).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function meetingReviewSystemPrompt(): string {
  return `You are checking a meeting record against Jason's plan. Report only what the text supports. A missing quote means false. Never infer a commitment that is not stated. Return JSON only:
{"points_spoken":[{"point_id":"...","spoken":true,"quote":"..."}],"rubric_results":[{"item":"...","met":false,"quote":null}],"reactions_observed":[{"point_id":"...","shape":"agree|soft_agree|defer|deflect|counter_ask|decline|null","quote":"..."}],"suggested_mark":"hit|partial|missed","suggested_reason":"...","talk_ratio":0.62}
Include every point id, every checklist item, and every ask id you were given. spoken and met are true only with a short quote from the text. suggested_reason is two sentences and cites quotes. talk_ratio is Jason's share of the words, from 0 to 1, or null when the text does not show who spoke. Jason is the speaker marked Jason or microphone.`;
}

export function parseMeetingReview(
  text: string,
  expected: { pointIds: string[]; rubric: string[]; askIds: string[] }
): ParsedMeetingReview | null {
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
  if (!body) return null;

  const spokenRows = Array.isArray(body.points_spoken) ? body.points_spoken : [];
  const spokenById = new Map<string, SpokenPoint>();
  for (const row of spokenRows) {
    const item = asRecord(row);
    if (!item || typeof item.point_id !== "string") continue;
    const quote = quoteOf(item.quote);
    spokenById.set(item.point_id, {
      pointId: item.point_id,
      spoken: item.spoken === true && Boolean(quote),
      quote,
    });
  }

  const rubricRows = Array.isArray(body.rubric_results) ? body.rubric_results : [];
  const rubricByItem = new Map<string, RubricResult>();
  for (const row of rubricRows) {
    const item = asRecord(row);
    if (!item || typeof item.item !== "string") continue;
    const quote = quoteOf(item.quote);
    rubricByItem.set(item.item, {
      item: item.item,
      met: item.met === true && Boolean(quote),
      quote,
    });
  }

  const reactionRows = Array.isArray(body.reactions_observed) ? body.reactions_observed : [];
  const reactionById = new Map<string, ObservedAsk>();
  for (const row of reactionRows) {
    const item = asRecord(row);
    if (!item || typeof item.point_id !== "string") continue;
    const shape = typeof item.shape === "string" && SHAPES.has(item.shape) ? (item.shape as ReactionShape) : null;
    reactionById.set(item.point_id, {
      pointId: item.point_id,
      shape,
      quote: quoteOf(item.quote),
    });
  }

  const suggested =
    typeof body.suggested_mark === "string" && MARKS.has(body.suggested_mark)
      ? (body.suggested_mark as ParsedMeetingReview["suggestedMark"])
      : null;
  const reason = quoteOf(body.suggested_reason);
  const ratio = typeof body.talk_ratio === "number" && body.talk_ratio >= 0 && body.talk_ratio <= 1
    ? body.talk_ratio
    : null;

  return {
    pointsSpoken: expected.pointIds.map(
      (pointId) => spokenById.get(pointId) ?? { pointId, spoken: false, quote: null }
    ),
    rubricResults: expected.rubric.map(
      (item) => rubricByItem.get(item) ?? { item, met: false, quote: null }
    ),
    reactionsObserved: expected.askIds.map(
      (pointId) => reactionById.get(pointId) ?? { pointId, shape: null, quote: null }
    ),
    suggestedMark: suggested,
    suggestedReason: reason,
    talkRatio: ratio,
  };
}
