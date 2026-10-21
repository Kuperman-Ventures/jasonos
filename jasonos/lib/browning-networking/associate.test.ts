import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handoffLane } from "./lanes";

const BEFORE = new Date("2026-10-01T12:00:00.000Z");
const AFTER = new Date("2026-10-20T12:00:00.000Z");

describe("associate waiting meeting", () => {
  it("moves a waiting handoff to Meeting set once a call is linked", () => {
    assert.equal(handoffLane({ status: "acted_on", callStartsAt: null }), "waiting");
    assert.equal(
      handoffLane(
        {
          status: "booked",
          callStartsAt: "2026-10-06T18:00:00.000Z",
        },
        BEFORE
      ),
      "scheduled"
    );
  });

  it("keeps follow-ups in waiting until a call is linked", () => {
    assert.equal(handoffLane({ status: "follow_up", callStartsAt: null }), "waiting");
    assert.equal(
      handoffLane(
        {
          status: "follow_up",
          callStartsAt: "2026-10-06T18:00:00.000Z",
        },
        BEFORE
      ),
      "scheduled"
    );
  });

  it("treats a past linked call as Meeting held", () => {
    assert.equal(
      handoffLane(
        {
          status: "booked",
          callStartsAt: "2026-09-28T18:00:00.000Z",
        },
        AFTER
      ),
      "held"
    );
  });
});
