import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canEditOfferedTimes, handoffLane, isFollowUp } from "./lanes";

describe("handoff lanes", () => {
  it("keeps an unsent reply in the reply list", () => {
    assert.equal(handoffLane({ status: "times_ready", callStartsAt: null }), "reply");
    assert.equal(handoffLane({ status: "draft_ready", callStartsAt: null }), "reply");
  });

  it("puts a resume packet in the reach-out list until they act", () => {
    assert.equal(
      handoffLane({ status: "times_ready", callStartsAt: null, sourceKind: "packet" }),
      "outreach"
    );
    assert.equal(
      canEditOfferedTimes({ status: "times_ready", callStartsAt: null, sourceKind: "packet" }),
      true
    );
  });

  it("puts an acted-on handoff in the waiting list until a call exists", () => {
    assert.equal(handoffLane({ status: "acted_on", callStartsAt: null }), "waiting");
  });

  it("keeps a follow-up in the waiting list until a call exists", () => {
    assert.equal(handoffLane({ status: "follow_up", callStartsAt: null }), "waiting");
    assert.equal(isFollowUp({ status: "follow_up", callStartsAt: null }), true);
    assert.equal(isFollowUp({ status: "acted_on", callStartsAt: null }), false);
    assert.equal(
      handoffLane({ status: "follow_up", callStartsAt: "2026-10-06T18:00:00.000Z" }),
      "scheduled"
    );
  });

  it("locks the time picker once the meeting is set", () => {
    assert.equal(canEditOfferedTimes({ status: "draft_ready", callStartsAt: null }), true);
    assert.equal(canEditOfferedTimes({ status: "acted_on", callStartsAt: null }), false);
    assert.equal(
      canEditOfferedTimes({ status: "booked", callStartsAt: "2026-10-01T21:00:00.000Z" }),
      false
    );
    assert.equal(
      canEditOfferedTimes({ status: "acted_on", callStartsAt: "2026-10-01T21:00:00.000Z" }),
      false
    );
  });

  it("moves a booked call out of the waiting list", () => {
    assert.equal(
      handoffLane({ status: "acted_on", callStartsAt: "2026-10-06T18:00:00.000Z" }),
      "scheduled"
    );
    assert.equal(handoffLane({ status: "booked", callStartsAt: null }), "scheduled");
    assert.equal(handoffLane({ status: "brief_ready", callStartsAt: null }), "scheduled");
  });
});
