export type SlideInput = { headline: string; bullets: string[] };

export function bulletsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const line = item.trim().replace(/\s+/g, " ");
    if (line) out.push(line);
  }
  return out;
}

export function toJsonBullets(bullets: string[]): string[] {
  return bullets.map((line) => line.trim()).filter(Boolean);
}

export function bulletsTextToLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function bulletsLinesToText(bullets: string[]): string {
  return bullets.join("\n");
}

export function capWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function normalizeSlideInputs(
  slides: SlideInput[]
): { ok: true; value: SlideInput[] } | { ok: false; error: string } {
  if (!Array.isArray(slides)) return { ok: false, error: "Slides must be a list." };
  if (slides.length > 80) return { ok: false, error: "Too many slides (max 80)." };
  const out: SlideInput[] = [];
  for (const slide of slides) {
    const headline = (slide.headline ?? "").trim().slice(0, 240) || "Untitled";
    const bullets = toJsonBullets(slide.bullets ?? []).map((line) => line.slice(0, 800));
    if (bullets.length > 24) return { ok: false, error: "Too many bullets on one slide (max 24)." };
    out.push({ headline, bullets });
  }
  return { ok: true, value: out };
}

export type ParsedRubricScore = {
  line: string;
  score: number | null;
  note: string;
  na: boolean;
  overridden: boolean;
};

export type ParsedDeckReview = {
  slides: Array<{
    slide_id: string;
    mark: "covered" | "partly" | "skipped";
    evidence: string;
    overridden: boolean;
  }>;
  goal: { mark: "hit" | "partly" | "missed"; evidence: string; overridden: boolean } | null;
  said: string[];
  committed: string[];
  next_time: string[];
  model: string;
  transcript_source: "granola" | "wispr" | "paste" | null;
  rubric: ParsedRubricScore[];
  rubric_average: number | null;
};

/** Trim, drop blanks, cap length. */
export function normalizeRubricLines(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  const out: string[] = [];
  for (const row of lines) {
    if (typeof row !== "string") continue;
    const line = row.trim().replace(/\s+/g, " ").slice(0, 500);
    if (line) out.push(line);
  }
  return out.slice(0, 40);
}

/** Mean of scored (non-na) lines, one decimal; null when all na or empty. */
export function averageRubricScores(
  rows: Array<{ score: number | null; na: boolean }>
): number | null {
  const scored = rows.filter((row) => !row.na && typeof row.score === "number");
  if (!scored.length) return null;
  const sum = scored.reduce((acc, row) => acc + (row.score as number), 0);
  return Math.round((sum / scored.length) * 10) / 10;
}

export function parseRubricFromJson(value: unknown): string[] {
  return normalizeRubricLines(value);
}

/** Align model rubric scores to the deck's rubric lines (same length/order). */
export function alignRubricScores(
  lines: string[],
  raw: unknown
): ParsedRubricScore[] {
  const rows = Array.isArray(raw) ? raw : [];
  return lines.map((line, index) => {
    const item = rows[index];
    if (!item || typeof item !== "object") {
      return { line, score: 1, note: "Not scored.", na: false, overridden: false };
    }
    const row = item as Record<string, unknown>;
    const na = Boolean(row.na);
    const note =
      typeof row.note === "string" && row.note.trim()
        ? row.note.trim().replace(/\s+/g, " ").slice(0, 400)
        : na
          ? "Not applicable."
          : "Not scored.";
    if (na) {
      return { line, score: null, note, na: true, overridden: false };
    }
    const scoreNum = typeof row.score === "number" ? row.score : Number(row.score);
    const score =
      Number.isFinite(scoreNum) && scoreNum >= 1 && scoreNum <= 5
        ? Math.round(scoreNum)
        : 1;
    return {
      line,
      score: score as number,
      note: note === "Not applicable." ? "Not scored." : note,
      na: false,
      overridden: false,
    };
  });
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

/** Soft cleanup for common model JSON nits (trailing commas). */
function softenJson(text: string): string {
  return text.replace(/,\s*([\]}])/g, "$1");
}

function tryParseJson(text: string): unknown | null {
  const candidates = [text, softenJson(text)];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Pull a JSON value out of a Claude reply that may include prose or fences.
 * Prefers arrays (AI help slides) when both an array and object are present.
 */
export function extractJsonValue(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = tryParseJson(stripJsonFence(trimmed));
  if (direct !== null) return direct;

  const fenceBodies = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) =>
    m[1]?.trim()
  );
  for (const body of fenceBodies) {
    if (!body) continue;
    const parsed = tryParseJson(body);
    if (parsed !== null) return parsed;
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const parsed = tryParseJson(trimmed.slice(arrayStart, arrayEnd + 1));
    if (parsed !== null) return parsed;
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    const parsed = tryParseJson(trimmed.slice(objectStart, objectEnd + 1));
    if (parsed !== null) return parsed;
  }

  return null;
}

function parseJsonValue(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const value = extractJsonValue(raw);
  if (value === null) return { ok: false, error: "Claude returned invalid JSON." };
  return { ok: true, value };
}

function capEvidence(text: string): string {
  return capWords(text.trim().replace(/\s+/g, " "), 30);
}

function reviewStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function parseAiHelpSlidesJson(
  raw: string
): { ok: true; value: SlideInput[] } | { ok: false; error: string } {
  const parsed = parseJsonValue(raw);
  if (!parsed.ok) return parsed;
  let slidesRaw: unknown;
  if (Array.isArray(parsed.value)) {
    slidesRaw = parsed.value;
  } else if (parsed.value && typeof parsed.value === "object") {
    slidesRaw = (parsed.value as { slides?: unknown }).slides;
  } else {
    return { ok: false, error: "Claude returned invalid JSON." };
  }
  if (!Array.isArray(slidesRaw) || !slidesRaw.length) {
    return { ok: false, error: "Claude returned no slides." };
  }
  const slides: SlideInput[] = [];
  for (const row of slidesRaw) {
    if (!row || typeof row !== "object") continue;
    const headline =
      typeof (row as { headline?: unknown }).headline === "string"
        ? (row as { headline: string }).headline
        : "";
    const bulletsRaw = (row as { bullets?: unknown }).bullets;
    const bullets = Array.isArray(bulletsRaw)
      ? bulletsRaw.filter((line): line is string => typeof line === "string")
      : [];
    const trimmedBullets = bullets
      .map((line) => capWords(line.trim().replace(/\s+/g, " "), 14))
      .filter(Boolean)
      .slice(0, 6);
    slides.push({ headline, bullets: trimmedBullets });
  }
  const normalized = normalizeSlideInputs(slides);
  if (!normalized.ok) return normalized;
  return { ok: true, value: normalized.value };
}

export function parseReviewJson(
  raw: string,
  slideIds: string[],
  rubricLines: string[] = []
): { ok: true; value: ParsedDeckReview } | { ok: false; error: string } {
  const parsed = parseJsonValue(raw);
  if (!parsed.ok) return parsed;
  if (!parsed.value || typeof parsed.value !== "object") {
    return { ok: false, error: "Claude returned invalid JSON." };
  }
  const root = parsed.value as Record<string, unknown>;
  const slidesRaw = Array.isArray(root.slides) ? root.slides : [];
  const byId = new Map<string, { mark: "covered" | "partly" | "skipped"; evidence: string }>();
  for (let index = 0; index < slidesRaw.length; index++) {
    const row = slidesRaw[index];
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const mark = item.mark;
    if (mark !== "covered" && mark !== "partly" && mark !== "skipped") continue;
    const evidence = capEvidence(typeof item.evidence === "string" ? item.evidence : "");
    const slideId =
      typeof item.slide_id === "string"
        ? item.slide_id
        : index < slideIds.length
          ? slideIds[index]
          : null;
    if (!slideId) continue;
    byId.set(slideId, { mark, evidence });
  }

  const slides = slideIds.map((slide_id) => {
    const hit = byId.get(slide_id);
    if (hit) {
      return { slide_id, mark: hit.mark, evidence: hit.evidence, overridden: false };
    }
    return { slide_id, mark: "skipped" as const, evidence: "", overridden: false };
  });

  let goal: ParsedDeckReview["goal"] = null;
  if (root.goal && typeof root.goal === "object") {
    const g = root.goal as Record<string, unknown>;
    if (g.mark === "hit" || g.mark === "partly" || g.mark === "missed") {
      goal = {
        mark: g.mark,
        evidence: capEvidence(typeof g.evidence === "string" ? g.evidence : ""),
        overridden: false,
      };
    }
  }

  const rubric = alignRubricScores(normalizeRubricLines(rubricLines), root.rubric);
  return {
    ok: true,
    value: {
      slides,
      goal,
      said: reviewStringList(root.said, 6),
      committed: reviewStringList(root.committed, 6),
      next_time: reviewStringList(root.next_time, 6),
      model: typeof root.model === "string" ? root.model : "claude-sonnet-4-6",
      transcript_source:
        root.transcript_source === "granola" ||
        root.transcript_source === "wispr" ||
        root.transcript_source === "paste"
          ? root.transcript_source
          : null,
      rubric,
      rubric_average: averageRubricScores(rubric),
    },
  };
}

export function parseTailorJson(
  raw: string
): { ok: true; value: { notes: string; slides: SlideInput[] } } | { ok: false; error: string } {
  const parsed = extractJsonValue(raw);
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Claude returned invalid JSON." };
  }
  const notes =
    typeof (parsed as { notes?: unknown }).notes === "string"
      ? (parsed as { notes: string }).notes.trim()
      : "";
  const slidesRaw = (parsed as { slides?: unknown }).slides;
  if (!Array.isArray(slidesRaw) || !slidesRaw.length) {
    return { ok: false, error: "Claude returned no slides." };
  }
  const slides: SlideInput[] = [];
  for (const row of slidesRaw) {
    if (!row || typeof row !== "object") continue;
    const headline =
      typeof (row as { headline?: unknown }).headline === "string"
        ? (row as { headline: string }).headline
        : "";
    const bulletsRaw = (row as { bullets?: unknown }).bullets;
    const bullets = Array.isArray(bulletsRaw)
      ? bulletsRaw.filter((line): line is string => typeof line === "string")
      : [];
    slides.push({ headline, bullets });
  }
  const normalized = normalizeSlideInputs(slides);
  if (!normalized.ok) return normalized;
  return { ok: true, value: { notes: notes || "Tailored slides.", slides: normalized.value } };
}

export function extractTranscriptSection(summary: string | undefined): string | null {
  if (!summary?.trim()) return null;
  const marker = "--- Transcript ---";
  const index = summary.indexOf(marker);
  if (index < 0) return null;
  const text = summary.slice(index + marker.length).trim();
  return text || null;
}

export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
