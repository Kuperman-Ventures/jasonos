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
