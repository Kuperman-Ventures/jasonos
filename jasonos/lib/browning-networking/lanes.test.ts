import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canEditOfferedTimes, handoffLane, isFollowUp } from "./lanes";

const BEFORE = new Date("2026-10-01T12:00:00.000Z");
const AFTER = new Date("2026-10-20T12:00:00.000Z");
const FUTURE_START = "2026-10-06T18:00:00.000Z";
const PAST_START = "2026-09-28T18:00:00.000Z";

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
      handoffLane({ status: "follow_up", callStartsAt: FUTURE_START }, BEFORE),
      "scheduled"
    );
  });

  it("locks the time picker once the meeting is set", () => {
    assert.equal(canEditOfferedTimes({ status: "draft_ready", callStartsAt: null }), true);
    assert.equal(canEditOfferedTimes({ status: "acted_on", callStartsAt: null }), false);
    assert.equal(
      canEditOfferedTimes({ status: "booked", callStartsAt: FUTURE_START }),
      false
    );
    assert.equal(
      canEditOfferedTimes({ status: "acted_on", callStartsAt: FUTURE_START }),
      false
    );
  });

  it("moves a booked call out of the waiting list into Meeting set", () => {
    assert.equal(
      handoffLane({ status: "acted_on", callStartsAt: FUTURE_START }, BEFORE),
      "scheduled"
    );
    assert.equal(handoffLane({ status: "booked", callStartsAt: null }, BEFORE), "scheduled");
    assert.equal(handoffLane({ status: "brief_ready", callStartsAt: null }, BEFORE), "scheduled");
  });

  it("moves an ended call into Meeting held", () => {
    assert.equal(
      handoffLane({ status: "booked", callStartsAt: PAST_START }, AFTER),
      "held"
    );
    assert.equal(
      handoffLane(
        {
          status: "brief_ready",
          callStartsAt: PAST_START,
          callEndsAt: "2026-09-28T18:30:00.000Z",
        },
        AFTER
      ),
      "held"
    );
    assert.equal(
      handoffLane({ status: "thank_you_ready", callStartsAt: PAST_START }, AFTER),
      "held"
    );
    assert.equal(
      handoffLane({ status: "thank_you_ready", callStartsAt: null }, AFTER),
      "held"
    );
  });

  it("keeps a future booked call in Meeting set even after thank-you status is cleared", () => {
    assert.equal(
      handoffLane({ status: "booked", callStartsAt: FUTURE_START }, BEFORE),
      "scheduled"
    );
  });
});
