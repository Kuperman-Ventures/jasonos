import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fallbackRubricFromOutcome,
  parseMeetingReview,
  rescueSpokenMatches,
} from "./review.ts";

describe("parseMeetingReview", () => {
  it("treats a missing quote as not met and fills every expected row", () => {
    const parsed = parseMeetingReview(
      JSON.stringify({
        suggested_mark: "partial",
        suggested_reason: "He asked. They did not set a date.",
        points_spoken: [
          {
            point_id: "a",
            match: "exact",
            nearest: "We should start the pilot.",
            timestamp: "15:27",
          },
          { point_id: "b", match: "none", nearest: null },
        ],
        rubric_results: [{ item: "Asked why", met: true, quote: null }],
        reactions_observed: [{ point_id: "c", shape: "later", quote: "Not now." }],
        talk_ratio: 0.62,
      }),
      { pointIds: ["a", "b", "missing"], rubric: ["Asked why", "Named a date"], askIds: ["c"] }
    );
    assert.ok(parsed);
    assert.equal(parsed!.pointsSpoken[0].spoken, true);
    assert.equal(parsed!.pointsSpoken[0].match, "exact");
    assert.equal(parsed!.pointsSpoken[0].timestamp, "15:27");
    assert.equal(parsed!.pointsSpoken[1].spoken, false);
    assert.equal(parsed!.pointsSpoken[2].spoken, false);
    assert.equal(parsed!.rubricResults[0].met, false);
    assert.equal(parsed!.rubricResults[1].met, false);
    assert.equal(parsed!.reactionsObserved[0].shape, null);
    assert.equal(parsed!.suggestedMark, "partial");
    assert.equal(parsed!.talkRatio, 0.62);
  });

  it("marks close matches as spoken", () => {
    const parsed = parseMeetingReview(
      JSON.stringify({
        suggested_mark: "hit",
        suggested_reason: "Close enough.",
        points_spoken: [
          {
            point_id: "a",
            match: "close",
            nearest: "I don't know where you guys are in the arc of your AI evolution",
          },
        ],
        rubric_results: [],
        reactions_observed: [],
      }),
      { pointIds: ["a"], rubric: [], askIds: [] }
    );
    assert.ok(parsed);
    assert.equal(parsed!.pointsSpoken[0].match, "close");
    assert.equal(parsed!.pointsSpoken[0].spoken, true);
  });
});

describe("fallbackRubricFromOutcome", () => {
  it("splits the outcome sentence and adds asks", () => {
    const lines = fallbackRubricFromOutcome(
      "I learn how work reaches Molly and what her first 30 days on an engagement look like, she sees one tool run live on a company she names, and I leave with an intro to whoever runs Crisp's tooling or a slot with the collective.",
      [{ headline: "An intro to whoever runs Crisp's tooling, or a slot with the collective" }]
    );
    assert.equal(lines.length, 4);
    assert.ok(lines.some((line) => /Made the ask:/i.test(line)));
  });
});

describe("rescueSpokenMatches", () => {
  it("upgrades an AI paraphrase from none to close", () => {
    const rescued = rescueSpokenMatches(
      [
        {
          pointId: "ai",
          spoken: false,
          match: "none",
          nearest: null,
          quote: null,
          timestamp: null,
        },
      ],
      [{ id: "ai", headline: "How is the collective handling AI?", detail: null }],
      [
        "Jason: Hi, Molly.",
        "Molly Millar: Hello.",
        "Jason: And I don't know where you guys are in the arc of your AI evolution.",
        "Molly Millar: Yeah.",
      ].join("\n")
    );
    assert.equal(rescued[0].match, "close");
    assert.equal(rescued[0].spoken, true);
    assert.match(rescued[0].nearest ?? "", /AI evolution/i);
  });

  it("replaces a weak close nearest with the AI paraphrase", () => {
    const rescued = rescueSpokenMatches(
      [
        {
          pointId: "ai",
          spoken: true,
          match: "close",
          nearest: "I'll send you a demo account",
          quote: "I'll send you a demo account",
          timestamp: null,
        },
      ],
      [{ id: "ai", headline: "How is the collective handling AI?", detail: null }],
      [
        "Jason: I'll send you a demo account.",
        "Jason: And I don't know where you guys are in the arc of your AI evolution.",
      ].join("\n")
    );
    assert.equal(rescued[0].match, "close");
    assert.match(rescued[0].nearest ?? "", /AI evolution/i);
  });
});