import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchOfferedSlot } from "./chosen-time";
import type { HandoffSlot } from "./types";

const slots: HandoffSlot[] = [
  { id: "thu", start: "2026-10-01T21:00:00.000Z", end: "2026-10-01T21:30:00.000Z" },
  { id: "fri", start: "2026-10-02T21:00:00.000Z", end: "2026-10-02T21:30:00.000Z" },
  { id: "mon", start: "2026-10-05T14:00:00.000Z", end: "2026-10-05T14:30:00.000Z" },
];

describe("chosen time", () => {
  it("picks the one weekday they named", () => {
    const hit = matchOfferedSlot(slots, "Thursday works for me.");
    assert.equal(hit?.id, "thu");
  });

  it("does not pick when they name two days", () => {
    assert.equal(matchOfferedSlot(slots, "Thursday or Friday after 5."), null);
  });

  it("ignores the quoted list of every time", () => {
    const hit = matchOfferedSlot(
      slots,
      `Thursday works.\nOn Mon, Sep 28, 2026 at 2:00 PM Jason wrote:\nThu. Oct 1 @ 5:00pm ET\nFri. Oct 2 @ 5:00pm ET\nMon. Oct 5 @ 10:00am ET`
    );
    assert.equal(hit?.id, "thu");
  });

  it("picks a single clock time", () => {
    const hit = matchOfferedSlot(slots, "10:00am is good.");
    assert.equal(hit?.id, "mon");
  });

  it("uses first, second, or last when they say so", () => {
    assert.equal(matchOfferedSlot(slots, "The second one.")?.id, "fri");
    assert.equal(matchOfferedSlot(slots, "Let's do the last time.")?.id, "mon");
  });
});
