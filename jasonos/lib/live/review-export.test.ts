import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REVIEW_PACKAGE_KIND,
  buildReviewFinetunePackage,
  reviewPackageFilename,
  reviewPackageToMarkdown,
} from "./review-export.ts";

type DeckInput = Parameters<typeof buildReviewFinetunePackage>[0]["deck"];

function sampleDeck(overrides: Partial<DeckInput> = {}): DeckInput {
  return {
    id: "deck-1",
    kind: "deck",
    name: "Jason / Alex Connect",
    description: null,
    goal: "Get a warm intro to their VP",
    meetingPrepId: "prep-1",
    sourcePlaybookId: null,
    slideCount: 1,
    updatedAt: "2026-10-27T12:00:00.000Z",
    runStartedAt: null,
    runEndedAt: null,
    aiNotes: null,
    hasTranscript: true,
    transcriptFetchedAt: "2026-10-27T12:05:00.000Z",
    reviewedAt: "2026-10-27T12:10:00.000Z",
    reviewGoalMark: "partly",
    reviewRubricAverage: 3.5,
    slides: [
      {
        id: "slide-1",
        position: 1,
        headline: "Open",
        bullets: ["Thanks for the time"],
      },
    ],
    transcript: "Jason: Hi.\nAlex: Hello.",
    transcriptSource: "granola",
    review: {
      slides: [
        {
          slide_id: "slide-1",
          mark: "covered",
          evidence: "Opened warmly",
          overridden: false,
        },
      ],
      goal: { mark: "partly", evidence: "Intro promised later", overridden: false },
      said: ["Budget is tight this quarter"],
      committed: ["Send one-pager"],
      next_time: ["Ask for the intro earlier"],
      model: "claude-sonnet-4-6",
      transcript_source: "granola",
      rubric: [
        {
          line: "Led with their context",
          score: 4,
          note: "Referenced their launch",
          na: false,
          overridden: false,
        },
        {
          line: "Asked for a clear next step",
          score: 3,
          note: "Soft close",
          na: false,
          overridden: false,
        },
      ],
      rubric_average: 3.5,
    },
    aiLastRun: null,
    hasAiUndo: false,
    rubric: ["Led with their context", "Asked for a clear next step"],
    ...overrides,
  };
}

describe("review finetune package", () => {
  it("bundles transcript, rubric lines, and analysis", () => {
    const pkg = buildReviewFinetunePackage({
      deck: sampleDeck(),
      meetingLabel: "Jason / Alex · Mon Oct 27",
      exportedAt: "2026-10-27T15:00:00.000Z",
    });

    assert.equal(pkg.kind, REVIEW_PACKAGE_KIND);
    assert.equal(pkg.version, 1);
    assert.equal(pkg.transcript.text, "Jason: Hi.\nAlex: Hello.");
    assert.equal(pkg.rubric_lines.length, 2);
    assert.equal(pkg.analysis?.rubric_average, 3.5);
    assert.equal(pkg.analysis?.slides[0]?.headline, "Open");
    assert.equal(pkg.analysis?.said[0], "Budget is tight this quarter");
    assert.equal(
      reviewPackageFilename(pkg),
      "live-review-jason-alex-connect-2026-10-27.json"
    );
  });

  it("allows missing analysis and still exports transcript", () => {
    const pkg = buildReviewFinetunePackage({
      deck: sampleDeck({ review: null, reviewedAt: null }),
      exportedAt: "2026-10-27T15:00:00.000Z",
    });
    assert.equal(pkg.analysis, null);
    assert.ok(pkg.transcript.text);
  });

  it("renders a markdown package with both sections", () => {
    const md = reviewPackageToMarkdown(
      buildReviewFinetunePackage({
        deck: sampleDeck(),
        exportedAt: "2026-10-27T15:00:00.000Z",
      })
    );
    assert.match(md, /## Transcript/);
    assert.match(md, /Jason: Hi/);
    assert.match(md, /## Analysis/);
    assert.match(md, /Rubric average: 3\.5 \/ 5/);
    assert.match(md, /Led with their context/);
  });
});
