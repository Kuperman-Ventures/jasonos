import type { DeckDetail, DeckReview } from "@/lib/server-actions/decks";

export const REVIEW_PACKAGE_KIND = "jasonos.live.review_package" as const;
export const REVIEW_PACKAGE_VERSION = 1 as const;

export type ReviewFinetunePackage = {
  kind: typeof REVIEW_PACKAGE_KIND;
  version: typeof REVIEW_PACKAGE_VERSION;
  exported_at: string;
  meeting: { label: string } | null;
  deck: {
    id: string;
    name: string;
    goal: string | null;
    run_started_at: string | null;
    run_ended_at: string | null;
  };
  /** Rubric criteria used for scoring (ordered). */
  rubric_lines: string[];
  slides: Array<{
    position: number;
    headline: string;
    bullets: string[];
  }>;
  transcript: {
    text: string | null;
    source: "granola" | "wispr" | null;
    fetched_at: string | null;
  };
  analysis: {
    reviewed_at: string | null;
    model: string | null;
    goal: DeckReview["goal"];
    rubric: DeckReview["rubric"];
    rubric_average: number | null;
    slides: Array<{
      position: number;
      headline: string;
      mark: "covered" | "partly" | "skipped";
      evidence: string;
      overridden: boolean;
    }>;
    said: string[];
    committed: string[];
    next_time: string[];
  } | null;
};

export function buildReviewFinetunePackage(input: {
  deck: DeckDetail;
  meetingLabel?: string | null;
  transcript?: string | null;
  transcriptSource?: "granola" | "wispr" | "paste" | null;
  transcriptFetchedAt?: string | null;
  review?: DeckReview | null;
  reviewedAt?: string | null;
  exportedAt?: string;
}): ReviewFinetunePackage {
  const deck = input.deck;
  const review = input.review === undefined ? deck.review : input.review;
  const transcript =
    input.transcript === undefined ? deck.transcript : input.transcript;
  const transcriptSource =
    input.transcriptSource === undefined
      ? deck.transcriptSource
      : input.transcriptSource;
  const transcriptFetchedAt =
    input.transcriptFetchedAt === undefined
      ? deck.transcriptFetchedAt
      : input.transcriptFetchedAt;
  const reviewedAt =
    input.reviewedAt === undefined ? deck.reviewedAt : input.reviewedAt;

  const slidesById = new Map(deck.slides.map((slide) => [slide.id, slide]));

  return {
    kind: REVIEW_PACKAGE_KIND,
    version: REVIEW_PACKAGE_VERSION,
    exported_at: input.exportedAt ?? new Date().toISOString(),
    meeting: input.meetingLabel?.trim()
      ? { label: input.meetingLabel.trim() }
      : null,
    deck: {
      id: deck.id,
      name: deck.name,
      goal: deck.goal?.trim() || null,
      run_started_at: deck.runStartedAt,
      run_ended_at: deck.runEndedAt,
    },
    rubric_lines: [...deck.rubric],
    slides: deck.slides.map((slide, index) => ({
      position: index + 1,
      headline: slide.headline,
      bullets: [...slide.bullets],
    })),
    transcript: {
      text: transcript?.trim() || null,
      source: transcriptSource ?? null,
      fetched_at: transcriptFetchedAt ?? null,
    },
    analysis: review
      ? {
          reviewed_at: reviewedAt,
          model: review.model || null,
          goal: review.goal,
          rubric: review.rubric.map((row) => ({ ...row })),
          rubric_average: review.rubric_average,
          slides: review.slides.map((row) => {
            const slide = slidesById.get(row.slide_id);
            const position = slide
              ? deck.slides.findIndex((item) => item.id === slide.id) + 1
              : 0;
            return {
              position: position || 0,
              headline: slide?.headline ?? "(unknown slide)",
              mark: row.mark,
              evidence: row.evidence,
              overridden: row.overridden,
            };
          }),
          said: [...review.said],
          committed: [...review.committed],
          next_time: [...review.next_time],
        }
      : null,
  };
}

export function reviewPackageFilename(pkg: ReviewFinetunePackage): string {
  const stamp = pkg.exported_at.slice(0, 10);
  const slug = pkg.deck.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `live-review-${slug || "deck"}-${stamp}.json`;
}

export function reviewPackageToMarkdown(pkg: ReviewFinetunePackage): string {
  const lines: string[] = [];
  lines.push(`# Live review package — ${pkg.deck.name}`);
  lines.push("");
  lines.push(`Exported: ${pkg.exported_at}`);
  if (pkg.meeting?.label) lines.push(`Meeting: ${pkg.meeting.label}`);
  if (pkg.deck.goal) {
    lines.push("");
    lines.push("## Goal");
    lines.push(pkg.deck.goal);
  }

  lines.push("");
  lines.push("## Rubric lines");
  if (!pkg.rubric_lines.length) {
    lines.push("(none)");
  } else {
    for (const [index, line] of pkg.rubric_lines.entries()) {
      lines.push(`${index + 1}. ${line}`);
    }
  }

  lines.push("");
  lines.push("## Slides");
  if (!pkg.slides.length) {
    lines.push("No slides. This meeting was not run in Live.");
  } else {
    for (const slide of pkg.slides) {
      lines.push("");
      lines.push(`### ${slide.position}. ${slide.headline}`);
      for (const bullet of slide.bullets) lines.push(`- ${bullet}`);
    }
  }

  lines.push("");
  lines.push("## Transcript");
  if (pkg.transcript.source) {
    lines.push(`Source: ${pkg.transcript.source}`);
  }
  if (pkg.transcript.fetched_at) {
    lines.push(`Fetched: ${pkg.transcript.fetched_at}`);
  }
  lines.push("");
  lines.push(pkg.transcript.text?.trim() || "(no transcript)");

  lines.push("");
  lines.push("## Analysis");
  if (!pkg.analysis) {
    lines.push("(no analysis yet)");
    return lines.join("\n");
  }

  const analysis = pkg.analysis;
  if (analysis.reviewed_at) lines.push(`Reviewed: ${analysis.reviewed_at}`);
  if (analysis.model) lines.push(`Model: ${analysis.model}`);
  if (analysis.rubric_average != null) {
    lines.push(`Rubric average: ${analysis.rubric_average} / 5`);
  }

  if (analysis.goal) {
    lines.push("");
    lines.push("### Goal mark");
    lines.push(`${analysis.goal.mark}${analysis.goal.overridden ? " (overridden)" : ""}`);
    if (analysis.goal.evidence) lines.push(analysis.goal.evidence);
  }

  lines.push("");
  lines.push("### Rubric scores");
  for (const row of analysis.rubric) {
    const score = row.na ? "NA" : String(row.score ?? "—");
    const note = row.note ? ` — ${row.note}` : "";
    const overridden = row.overridden ? " (overridden)" : "";
    lines.push(`- [${score}] ${row.line}${note}${overridden}`);
  }

  if (analysis.slides.length) {
    lines.push("");
    lines.push("### Slide marks");
    for (const row of analysis.slides) {
      const overridden = row.overridden ? " (overridden)" : "";
      lines.push(
        `- ${row.position}. ${row.headline}: ${row.mark}${overridden}${
          row.evidence ? ` — ${row.evidence}` : ""
        }`
      );
    }
  }

  const lists: Array<[string, string[]]> = [
    ["What they said that matters", analysis.said],
    ["What I committed to", analysis.committed],
    ["Do differently next time", analysis.next_time],
  ];
  for (const [title, items] of lists) {
    lines.push("");
    lines.push(`### ${title}`);
    if (!items.length) lines.push("(none)");
    else for (const item of items) lines.push(`- ${item}`);
  }

  return lines.join("\n");
}
