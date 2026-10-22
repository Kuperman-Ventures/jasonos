import type { ReactionShape } from "./reactions";

export type SpokenMatch = "exact" | "close" | "none";

export interface SpokenPoint {
  pointId: string;
  spoken: boolean;
  match: SpokenMatch;
  nearest: string | null;
  quote: string | null;
  timestamp: string | null;
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

export interface CompanyFactAttendee {
  contactId: string | null;
  name: string | null;
  title: string | null;
  company: string | null;
  roleLine: string | null;
}

export interface CompanyFacts {
  attendees: CompanyFactAttendee[];
}

export interface ParsedMeetingReview {
  pointsSpoken: SpokenPoint[];
  rubricResults: RubricResult[];
  reactionsObserved: ObservedAsk[];
  suggestedMark: "hit" | "partial" | "missed" | null;
  suggestedReason: string | null;
  talkRatio: number | null;
  projectGoalNote: string | null;
  relationshipGoalNote: string | null;
  companyFacts: CompanyFacts;
  truncated: boolean;
}

const MARKS = new Set(["hit", "partial", "missed"]);
const MATCHES = new Set<string>(["exact", "close", "none"]);
const SHAPES = new Set<string>(["agree", "soft_agree", "defer", "deflect", "counter_ask", "decline"]);

function unwrapFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (match ? match[1] : text).trim();
}

function quoteOf(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= max ? text : text.slice(0, max).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Build checklist lines when no strategy was applied. */
export function fallbackRubricFromOutcome(
  outcomeSentence: string | null | undefined,
  asks: Array<{ headline: string }>
): string[] {
  const lines: string[] = [];
  const sentence = outcomeSentence?.trim() ?? "";
  if (sentence) {
    // Prefer comma / "; and" list splits so "A and B, C, and D" stays three checks.
    const parts = sentence
      .split(/,|;/)
      .map((part) =>
        part
          .trim()
          .replace(/^(and|or)\s+/i, "")
          .replace(/^[.]+|[.]+$/g, "")
          .trim()
      )
      .filter((part) => part.length >= 12);
    for (const part of parts.slice(0, 6)) {
      const line = part.charAt(0).toUpperCase() + part.slice(1);
      if (!lines.includes(line)) lines.push(line);
    }
    if (!lines.length) lines.push(sentence.slice(0, 160));
  }
  for (const ask of asks) {
    const headline = ask.headline.trim();
    if (!headline) continue;
    const line = `Made the ask: ${headline}`;
    if (!lines.includes(line)) lines.push(line);
  }
  return lines.slice(0, 12);
}

export function meetingReviewSystemPrompt(): string {
  return `You are checking a meeting record against Jason's plan. Match on meaning, not exact wording. Report only what the text supports. Never invent a commitment that is not stated.

Return JSON only, in this field order:
{"suggested_mark":"hit|partial|missed","suggested_reason":"...","points_spoken":[{"point_id":"...","match":"exact|close|none","nearest":"...","timestamp":null}],"rubric_results":[{"item":"...","met":false,"quote":null}],"reactions_observed":[{"point_id":"...","shape":"agree|soft_agree|defer|deflect|counter_ask|decline|null","quote":"..."}],"talk_ratio":0.62,"project_goal_note":null,"relationship_goal_note":null,"company_facts":{"attendees":[{"contact_id":null,"name":"...","title":null,"company":null,"role_line":null}]}}

Rules:
- suggested_mark and suggested_reason come first. suggested_reason is two complete sentences and cites quotes.
- For each markable point, find the closest thing Jason said. match is exact when he asked or said it, close when he said something with the same purpose in different words, none when nothing comes close. Always give nearest (closest quote, up to 200 characters) and timestamp when the transcript has one.
- Meaning beats wording. Example: a point "How is the collective handling AI?" is close when Jason says he does not know where they are in the arc of their AI evolution — same purpose, different words. Do not mark none when a clear paraphrase exists.
- Include every point id, every checklist item, and every ask id you were given.
- met is true only with a short quote from the text.
- talk_ratio is Jason's share of the words, from 0 to 1, or null when speakers are unclear. Jason is the speaker marked Jason or microphone.
- company_facts.attendees: for each person in the attendees list (plus others named plainly), set contact_id from the payload when known, plus title, company, and role_line when the transcript states them; otherwise null fields. Skip Jason himself unless the payload lists him as an attendee.
- project_goal_note and relationship_goal_note are each one sentence, or null.`;
}

/** Jason lines from a Granola-style speaker transcript. */
export function jasonUtterances(sourceText: string): string[] {
  const lines: string[] = [];
  for (const raw of sourceText.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(jason|microphone)\s*:\s*(.+)$/i);
    if (match?.[2]?.trim()) lines.push(match[2].trim().replace(/\s+/g, " "));
  }
  return lines;
}

/** Split a long turn into sentence-sized windows for matching. */
function sentenceWindows(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12);
  return parts.length ? parts : [text];
}

function tokens(text: string): Set<string> {
  const stop = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "is",
    "are",
    "was",
    "were",
    "how",
    "what",
    "who",
    "your",
    "you",
    "they",
    "their",
    "this",
    "that",
    "with",
    "from",
    "about",
    "do",
    "did",
    "does",
    "me",
    "my",
    "i",
  ]);
  const keepShort = new Set(["ai", "geo", "seo", "crm", "b2b", "sme"]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => (token.length >= 3 || keepShort.has(token)) && !stop.has(token))
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let hits = 0;
  for (const token of a) if (b.has(token)) hits += 1;
  return hits;
}

function isAiTopicHit(headlineTokens: Set<string>, text: string): boolean {
  if (!headlineTokens.has("ai")) return false;
  // Ignore domain suffixes like agencytoolbox.ai after punctuation stripping.
  const normalized = text.replace(/\b\w+\.ai\b/gi, " ");
  if (!/\bai\b/i.test(normalized)) return false;
  return /(ai evolution|arc of your ai|handling ai|adopting ai|adoption of ai|using ai|ai workflow)/i.test(
    normalized
  );
}

function bestJasonLineForPoint(
  point: { headline: string; detail: string | null },
  utterances: string[]
): { text: string; score: number; aiTopic: boolean } | null {
  const headlineTokens = tokens(point.headline);
  const needle = tokens(`${point.headline} ${point.detail ?? ""}`);
  if (!needle.size) return null;
  const isQuestion = /\?/.test(point.headline) || /^(how|what|who|where|why)\b/i.test(point.headline);
  let best: { text: string; score: number; aiTopic: boolean } | null = null;
  for (const utterance of utterances) {
    for (const text of sentenceWindows(utterance)) {
      const cleaned = text.replace(/\b\w+\.ai\b/gi, " ");
      const score = overlapScore(needle, tokens(cleaned));
      const headlineScore = overlapScore(headlineTokens, tokens(cleaned));
      const aiTopic = isAiTopicHit(headlineTokens, text);
      // Direct paraphrase of where they are with AI — only for AI-headed points.
      const directAiAsk =
        headlineTokens.has("ai") &&
        /arc of your ai|ai evolution|where you .*ai|how .*handling ai/i.test(cleaned);
      const addressed =
        isQuestion && /\b(you|you guys|your)\b/i.test(cleaned) && !/\b(he|she|they'|client)\b/i.test(cleaned);
      const enough = score >= 2 || aiTopic || directAiAsk;
      if (!enough) continue;
      const ranked =
        score +
        headlineScore * 2 +
        (aiTopic ? 3 : 0) +
        (directAiAsk ? 6 : 0) +
        (addressed ? 2 : 0) -
        (text.length > 220 ? 1 : 0);
      if (!best || ranked > best.score) best = { text, score: ranked, aiTopic: aiTopic || directAiAsk };
    }
  }
  return best;
}

/**
 * When the model marks none (or attaches a weak nearest), prefer a Jason
 * line that clearly paraphrases the point. Also drop close marks whose
 * nearest quote barely overlaps the planned point.
 */
export function rescueSpokenMatches(
  points: SpokenPoint[],
  markable: Array<{ id: string; headline: string; detail: string | null }>,
  sourceText: string
): SpokenPoint[] {
  const utterances = jasonUtterances(sourceText);
  if (!utterances.length) return points;
  const byId = new Map(markable.map((point) => [point.id, point]));

  return points.map((row) => {
    const point = byId.get(row.pointId);
    if (!point) return row;
    const needle = tokens(`${point.headline} ${point.detail ?? ""}`);
    const currentOverlap = row.nearest ? overlapScore(needle, tokens(row.nearest)) : 0;
    const best = bestJasonLineForPoint(point, utterances);

    if (row.match === "close" || row.match === "exact") {
      // Model claimed a match but the quote does not support it.
      if (currentOverlap === 0 && !best) {
        return {
          ...row,
          match: "none",
          spoken: false,
          nearest: null,
          quote: null,
        };
      }
      if (best && (row.match === "close" || currentOverlap === 0) && best.score > currentOverlap + 1) {
        const nearest = best.text.length <= 200 ? best.text : best.text.slice(0, 200).trim();
        return {
          ...row,
          match: row.match === "exact" && currentOverlap > 0 ? "exact" : "close",
          spoken: true,
          nearest,
          quote: nearest,
        };
      }
      return row;
    }

    if (!best) return row;
    const nearest = best.text.length <= 200 ? best.text : best.text.slice(0, 200).trim();
    return {
      ...row,
      match: "close",
      spoken: true,
      nearest,
      quote: nearest,
    };
  });
}

function tryParseObject(raw: string): { body: Record<string, unknown> | null; truncated: boolean } {
  const text = unwrapFence(raw);
  const start = text.indexOf("{");
  if (start < 0) return { body: null, truncated: false };
  const slice = text.slice(start);
  try {
    const parsed = JSON.parse(slice);
    const body = asRecord(parsed);
    return { body, truncated: false };
  } catch {
    // Truncated model output: close open braces/brackets and retry.
    let candidate = slice.trim();
    // Trim to last complete-looking string/object boundary.
    const lastBrace = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (lastBrace > 0) candidate = candidate.slice(0, lastBrace + 1);
    const opens = (candidate.match(/\{/g) || []).length;
    const closes = (candidate.match(/\}/g) || []).length;
    const openArr = (candidate.match(/\[/g) || []).length;
    const closeArr = (candidate.match(/\]/g) || []).length;
    candidate += "]".repeat(Math.max(0, openArr - closeArr));
    candidate += "}".repeat(Math.max(0, opens - closes));
    try {
      const parsed = JSON.parse(candidate);
      return { body: asRecord(parsed), truncated: true };
    } catch {
      return { body: null, truncated: true };
    }
  }
}

function asMatch(value: unknown, spoken: boolean, nearest: string | null): SpokenMatch {
  if (typeof value === "string" && MATCHES.has(value)) return value as SpokenMatch;
  if (spoken && nearest) return "exact";
  if (spoken) return "close";
  return "none";
}

function parseCompanyFacts(value: unknown): CompanyFacts {
  const root = asRecord(value);
  const rows = Array.isArray(root?.attendees) ? root!.attendees : Array.isArray(value) ? value : [];
  const attendees: CompanyFactAttendee[] = [];
  for (const row of rows) {
    const item = asRecord(row);
    if (!item) continue;
    attendees.push({
      contactId: typeof item.contact_id === "string" ? item.contact_id : null,
      name: quoteOf(item.name, 120),
      title: quoteOf(item.title, 160),
      company: quoteOf(item.company, 160),
      roleLine: quoteOf(item.role_line ?? item.roleLine, 240),
    });
  }
  return { attendees };
}

export function parseMeetingReview(
  text: string,
  expected: { pointIds: string[]; rubric: string[]; askIds: string[] }
): ParsedMeetingReview | null {
  const { body, truncated } = tryParseObject(text);
  if (!body) return null;

  const spokenRows = Array.isArray(body.points_spoken) ? body.points_spoken : [];
  const spokenById = new Map<string, SpokenPoint>();
  for (const row of spokenRows) {
    const item = asRecord(row);
    if (!item || typeof item.point_id !== "string") continue;
    const nearest =
      quoteOf(item.nearest, 200) || quoteOf(item.quote, 200);
    const quote = quoteOf(item.quote, 400) || nearest;
    const match = asMatch(item.match, item.spoken === true, nearest);
    const spoken = match === "exact" || match === "close";
    spokenById.set(item.point_id, {
      pointId: item.point_id,
      spoken,
      match,
      nearest,
      quote: spoken ? quote : nearest,
      timestamp: quoteOf(item.timestamp, 40),
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
    const shape =
      typeof item.shape === "string" && SHAPES.has(item.shape)
        ? (item.shape as ReactionShape)
        : null;
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
  const reason = quoteOf(body.suggested_reason, 800);
  const ratio =
    typeof body.talk_ratio === "number" && body.talk_ratio >= 0 && body.talk_ratio <= 1
      ? body.talk_ratio
      : null;

  return {
    pointsSpoken: expected.pointIds.map(
      (pointId) =>
        spokenById.get(pointId) ?? {
          pointId,
          spoken: false,
          match: "none",
          nearest: null,
          quote: null,
          timestamp: null,
        }
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
    projectGoalNote: quoteOf(body.project_goal_note),
    relationshipGoalNote: quoteOf(body.relationship_goal_note),
    companyFacts: parseCompanyFacts(body.company_facts),
    truncated,
  };
}
