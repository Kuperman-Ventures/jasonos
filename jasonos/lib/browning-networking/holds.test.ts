import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBookedCall } from "./booking";
import {
  busyForHandoff,
  holdsLookCurrent,
  holdTitle,
  placementBlockReason,
  reconcileHolds,
  slotEligibleForHold,
  type StoredHold,
} from "./holds";
import type { BusyBlock, HandoffSlot } from "./types";

/** Far enough before the Oct 6–9 fixture slots that they stay hold-eligible. */
const NOW = new Date("2026-10-01T12:00:00.000Z");

const slot = (id: string, start: string): HandoffSlot => ({
  id,
  start,
  end: new Date(Date.parse(start) + 30 * 60_000).toISOString(),
});

describe("tentative holds", () => {
  it("names the hold after the person", () => {
    assert.equal(holdTitle("Jane Smith"), "Hold · Jane Smith");
    assert.equal(holdTitle("  "), "Hold · Browning reply");
  });

  it("creates holds for offered times and deletes them once the meeting is set", () => {
    const slots = [slot("a", "2026-10-06T14:00:00.000Z")];
    const created = reconcileHolds({
      slots,
      listed: [],
      stored: [],
      keep: true,
      now: NOW,
    });
    assert.equal(created.create.length, 1);
    assert.equal(created.deleteIds.length, 0);

    const stored: StoredHold[] = [
      {
        slotId: "a",
        eventId: "evt-a",
        start: slots[0]!.start,
        end: slots[0]!.end,
      },
    ];
    const cleared = reconcileHolds({
      slots,
      listed: [
        {
          eventId: "evt-a",
          slotId: "a",
          start: slots[0]!.start,
          end: slots[0]!.end,
        },
      ],
      stored,
      keep: false,
      now: NOW,
    });
    assert.deepEqual(cleared.deleteIds, ["evt-a"]);
    assert.equal(cleared.create.length, 0);
  });

  it("keeps a matching hold, moves a changed one, and drops a removed time", () => {
    const kept = slot("keep", "2026-10-06T14:00:00.000Z");
    const moved = slot("move", "2026-10-07T15:00:00.000Z");
    const plan = reconcileHolds({
      slots: [kept, moved],
      listed: [
        { eventId: "evt-keep", slotId: "keep", start: kept.start, end: kept.end },
        {
          eventId: "evt-move",
          slotId: "move",
          start: "2026-10-07T14:00:00.000Z",
          end: "2026-10-07T14:30:00.000Z",
        },
        {
          eventId: "evt-old",
          slotId: "old",
          start: "2026-10-08T14:00:00.000Z",
          end: "2026-10-08T14:30:00.000Z",
        },
        {
          eventId: "evt-dup",
          slotId: "keep",
          start: kept.start,
          end: kept.end,
        },
      ],
      stored: [],
      keep: true,
      now: NOW,
    });
    assert.equal(plan.keep.length, 1);
    assert.equal(plan.keep[0]?.eventId, "evt-keep");
    assert.equal(plan.update.length, 1);
    assert.equal(plan.update[0]?.eventId, "evt-move");
    assert.equal(plan.create.length, 0);
    assert.deepEqual(plan.deleteIds.sort(), ["evt-dup", "evt-old"]);
  });

  it("releases an unbooked hold once the start is within 24 hours", () => {
    const far = slot("far", "2026-10-10T18:00:00.000Z");
    const near = slot("near", "2026-10-06T15:00:00.000Z"); // ~27h before Oct 5 12:00 would be far; use later now
    const now = new Date("2026-10-05T16:00:00.000Z"); // near is ~23h out
    assert.equal(slotEligibleForHold(far.start, now), true);
    assert.equal(slotEligibleForHold(near.start, now), false);

    const plan = reconcileHolds({
      slots: [far, near],
      listed: [
        { eventId: "evt-far", slotId: "far", start: far.start, end: far.end },
        { eventId: "evt-near", slotId: "near", start: near.start, end: near.end },
      ],
      stored: [
        { slotId: "far", eventId: "evt-far", start: far.start, end: far.end },
        { slotId: "near", eventId: "evt-near", start: near.start, end: near.end },
      ],
      keep: true,
      now,
    });
    assert.deepEqual(
      plan.keep.map((row) => row.eventId),
      ["evt-far"]
    );
    assert.deepEqual(plan.deleteIds, ["evt-near"]);
    assert.equal(plan.create.length, 0);

    assert.equal(
      holdsLookCurrent({
        slots: [far, near],
        stored: [{ slotId: "far", eventId: "evt-far", start: far.start, end: far.end }],
        keep: true,
        now,
      }),
      true
    );
    assert.equal(
      holdsLookCurrent({
        slots: [far, near],
        stored: [
          { slotId: "far", eventId: "evt-far", start: far.start, end: far.end },
          { slotId: "near", eventId: "evt-near", start: near.start, end: near.end },
        ],
        keep: true,
        now,
      }),
      false
    );
  });

  it("does not create a new hold for a slot inside the 24-hour window", () => {
    const near = slot("near", "2026-10-06T12:00:00.000Z");
    const now = new Date("2026-10-05T13:00:00.000Z");
    const plan = reconcileHolds({
      slots: [near],
      listed: [],
      stored: [],
      keep: true,
      now,
    });
    assert.equal(plan.create.length, 0);
    assert.equal(plan.keep.length, 0);
  });

  it("treats stored holds as current only when every offered time still matches", () => {
    const slots = [slot("a", "2026-10-06T14:00:00.000Z")];
    const stored: StoredHold[] = [
      { slotId: "a", eventId: "evt-a", start: slots[0]!.start, end: slots[0]!.end },
    ];
    assert.equal(holdsLookCurrent({ slots, stored, keep: true, now: NOW }), true);
    assert.equal(
      holdsLookCurrent({
        slots: [slot("a", "2026-10-06T15:00:00.000Z")],
        stored,
        keep: true,
        now: NOW,
      }),
      false
    );
    assert.equal(holdsLookCurrent({ slots, stored, keep: false, now: NOW }), false);
    assert.equal(holdsLookCurrent({ slots: [], stored: [], keep: false, now: NOW }), false);
    assert.equal(
      holdsLookCurrent({
        slots: [],
        stored: [],
        keep: false,
        clearedAt: "2026-10-08T12:00:00.000Z",
        now: NOW,
      }),
      true
    );
  });

  it("shows other replies' times as grey holds and hides this reply's own hold", () => {
    const mine = slot("mine", "2026-10-06T14:00:00.000Z");
    const theirs = slot("theirs", "2026-10-07T15:00:00.000Z");
    const calendar: BusyBlock[] = [
      {
        title: "Hold · Pat Lee",
        start: mine.start,
        end: mine.end,
        eventId: "own-hold",
        tentativeHold: true,
        holdHandoffId: "me",
      },
      {
        title: "Board call",
        start: "2026-10-08T18:00:00.000Z",
        end: "2026-10-08T19:00:00.000Z",
        eventId: "board",
      },
    ];
    const busy = busyForHandoff(
      calendar,
      [
        {
          id: "me",
          contactName: "Pat Lee",
          status: "acted_on",
          callStartsAt: null,
          slots: [mine],
        },
        {
          id: "other",
          contactName: "Jane Smith",
          status: "times_ready",
          callStartsAt: null,
          slots: [theirs],
        },
        {
          id: "booked",
          contactName: "Booked Person",
          status: "booked",
          callStartsAt: "2026-10-09T14:00:00.000Z",
          slots: [slot("gone", "2026-10-09T14:00:00.000Z")],
        },
      ],
      "me",
      NOW
    );
    assert.equal(
      busy.some((block) => block.holdHandoffId === "me"),
      false
    );
    assert.equal(busy.some((block) => block.title === "Board call"), true);
    const hold = busy.find((block) => block.holdHandoffId === "other");
    assert.equal(hold?.title, "Hold · Jane Smith");
    assert.equal(hold?.tentativeHold, true);
    assert.equal(busy.some((block) => block.title.includes("Booked Person")), false);
  });

  it("hides this reply's own hold when the calendar event has no handoff id", () => {
    const mine = slot("mine", "2026-10-06T14:00:00.000Z");
    const busy = busyForHandoff(
      [
        {
          title: "Hold · Pat Lee",
          start: mine.start,
          end: mine.end,
          eventId: "own-hold",
          tentativeHold: true,
        },
      ],
      [
        {
          id: "me",
          contactName: "Pat Lee",
          status: "times_ready",
          callStartsAt: null,
          slots: [mine],
        },
      ],
      "me",
      NOW
    );
    assert.equal(busy.length, 0);
  });

  it("does not stack a second hold on a time the calendar already shows", () => {
    const theirs = slot("theirs", "2026-10-07T15:00:00.000Z");
    const busy = busyForHandoff(
      [
        {
          title: "Hold · Jane Smith",
          start: theirs.start,
          end: theirs.end,
          tentativeHold: true,
          holdHandoffId: "other",
        },
      ],
      [
        {
          id: "me",
          contactName: "Pat Lee",
          status: "times_ready",
          callStartsAt: null,
          slots: [],
        },
        {
          id: "other",
          contactName: "Jane Smith",
          status: "acted_on",
          callStartsAt: null,
          slots: [theirs],
        },
      ],
      "me",
      NOW
    );
    assert.equal(busy.length, 1);
  });

  it("does not paint a near-term offered time as a grey hold for other replies", () => {
    const near = slot("near", "2026-10-06T12:00:00.000Z");
    const now = new Date("2026-10-05T13:00:00.000Z");
    const busy = busyForHandoff(
      [
        {
          title: "Hold · Jane Smith",
          start: near.start,
          end: near.end,
          tentativeHold: true,
          holdHandoffId: "other",
        },
      ],
      [
        {
          id: "me",
          contactName: "Pat Lee",
          status: "times_ready",
          callStartsAt: null,
          slots: [],
        },
        {
          id: "other",
          contactName: "Jane Smith",
          status: "acted_on",
          callStartsAt: null,
          slots: [near],
        },
      ],
      "me",
      now
    );
    assert.equal(busy.length, 0);
  });

  it("refuses a time that is already a hold or a meeting", () => {
    const hold: BusyBlock = {
      title: "Hold · Jane Smith",
      start: "2026-10-07T15:00:00.000Z",
      end: "2026-10-07T15:30:00.000Z",
      tentativeHold: true,
      holdHandoffId: "other",
    };
    assert.match(
      placementBlockReason(hold.start, hold.end, [hold]) ?? "",
      /tentative hold/
    );
    assert.match(
      placementBlockReason("2026-10-08T18:00:00.000Z", "2026-10-08T18:30:00.000Z", [
        {
          title: "Board call",
          start: "2026-10-08T18:00:00.000Z",
          end: "2026-10-08T19:00:00.000Z",
        },
      ]) ?? "",
      /already on your calendar/
    );
    assert.equal(
      placementBlockReason("2026-10-08T19:00:00.000Z", "2026-10-08T19:30:00.000Z", [hold]),
      null
    );
  });

  it("does not let an all-day event block a timed offer", () => {
    assert.equal(
      placementBlockReason("2026-10-08T18:00:00.000Z", "2026-10-08T18:30:00.000Z", [
        {
          title: "Out of office",
          start: "2026-10-08",
          end: "2026-10-09",
          allDay: true,
        },
      ]),
      null
    );
  });

  it("does not treat a tentative hold as the meeting being booked", () => {
    const now = new Date("2026-10-01T15:00:00.000Z");
    const onlyHold = findBookedCall(
      [
        {
          id: "hold",
          summary: "Hold · Jane Smith",
          start: "2026-10-06T14:00:00.000Z",
          end: "2026-10-06T14:30:00.000Z",
          browningHold: true,
        },
      ],
      { name: "Jane Smith", email: "jane@example.com" },
      now
    );
    assert.equal(onlyHold, null);

    const real = findBookedCall(
      [
        {
          id: "hold",
          summary: "Hold · Jane Smith",
          start: "2026-10-06T14:00:00.000Z",
          end: "2026-10-06T14:30:00.000Z",
        },
        {
          id: "real",
          summary: "Jane Smith / Jason",
          start: "2026-10-08T14:00:00.000Z",
          end: "2026-10-08T14:30:00.000Z",
          attendees: [{ email: "jane@example.com" }],
        },
      ],
      { name: "Jane Smith", email: "jane@example.com" },
      now
    );
    assert.equal(real?.id, "real");
  });
});
