import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handoffLane } from "./lanes";

describe("associate waiting meeting", () => {
  it("moves a waiting handoff to Meeting set once a call is linked", () => {
    assert.equal(handoffLane({ status: "acted_on", callStartsAt: null }), "waiting");
    assert.equal(
      handoffLane({
        status: "booked",
        callStartsAt: "2026-10-06T18:00:00.000Z",
      }),
      "scheduled"
    );
  });

  it("keeps follow-ups in waiting until a call is linked", () => {
    assert.equal(handoffLane({ status: "follow_up", callStartsAt: null }), "waiting");
    assert.equal(
      handoffLane({
        status: "follow_up",
        callStartsAt: "2026-10-06T18:00:00.000Z",
      }),
      "scheduled"
    );
  });

  it("treats a past linked call as Meeting set too", () => {
    assert.equal(
      handoffLane({
        status: "booked",
        callStartsAt: "2026-09-28T18:00:00.000Z",
      }),
      "scheduled"
    );
  });
});
