import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMeetingReview } from "./review.ts";

describe("parseMeetingReview", () => {
  it("treats a missing quote as not met and fills every expected row", () => {
    const parsed = parseMeetingReview(
      JSON.stringify({
        points_spoken: [
          { point_id: "a", spoken: true, quote: "We should start the pilot." },
          { point_id: "b", spoken: true, quote: "" },
        ],
        rubric_results: [{ item: "Asked why", met: true, quote: null }],
        reactions_observed: [{ point_id: "c", shape: "later", quote: "Not now." }],
        suggested_mark: "partial",
        suggested_reason: "He asked. They did not set a date.",
        talk_ratio: 0.62,
      }),
      { pointIds: ["a", "b", "missing"], rubric: ["Asked why", "Named a date"], askIds: ["c"] }
    );
    assert.ok(parsed);
    assert.equal(parsed!.pointsSpoken[0].spoken, true);
    assert.equal(parsed!.pointsSpoken[1].spoken, false);
    assert.equal(parsed!.pointsSpoken[2].spoken, false);
    assert.equal(parsed!.rubricResults[0].met, false);
    assert.equal(parsed!.rubricResults[1].met, false);
    assert.equal(parsed!.reactionsObserved[0].shape, null);
    assert.equal(parsed!.suggestedMark, "partial");
    assert.equal(parsed!.talkRatio, 0.62);
  });
});