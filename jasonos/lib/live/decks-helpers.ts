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
  transcript_source: "granola" | "wispr" | null;
};

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJsonValue(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(stripJsonFence(raw)) };
  } catch {
    return { ok: false, error: "Claude returned invalid JSON." };
  }
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
  slideIds: string[]
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
        root.transcript_source === "granola" || root.transcript_source === "wispr"
          ? root.transcript_source
          : null,
    },
  };
}

export function parseTailorJson(
  raw: string
): { ok: true; value: { notes: string; slides: SlideInput[] } } | { ok: false; error: string } {
  const trimmed = raw.trim();
  const jsonText = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "Claude returned invalid JSON." };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "Claude returned invalid JSON." };
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
