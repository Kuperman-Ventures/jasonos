import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { etYmd } from "@/lib/dates";
import {
  addBusinessDays,
  firstEligibleYmd,
  proposeSlots,
  wallToUtc,
} from "./slots";

const MONDAY = new Date("2026-09-28T15:00:00.000Z");

describe("slot proposal", () => {
  it("waits three business days", () => {
    assert.equal(etYmd(MONDAY), "2026-09-28");
    assert.equal(addBusinessDays("2026-09-28", 3), "2026-10-01");
    assert.equal(addBusinessDays("2026-10-02", 3), "2026-10-07");
    assert.equal(firstEligibleYmd(MONDAY), "2026-10-01");
  });

  it("offers three daytime slots on different days, none before the buffer", () => {
    const slots = proposeSlots({ now: MONDAY, busy: [] });
    assert.equal(slots.length, 3);
    const days = slots.map((slot) => etYmd(slot.start));
    assert.deepEqual(days, ["2026-10-01", "2026-10-02", "2026-10-05"]);
    for (const slot of slots) {
      const start = new Date(slot.start);
      const hour = Number(
        start.toLocaleString("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          hourCycle: "h23",
        })
      );
      assert.equal(hour, 10);
      assert.equal(Date.parse(slot.end) - Date.parse(slot.start), 30 * 60_000);
    }
  });

  it("keeps after-5pm availability in the evening", () => {
    const slots = proposeSlots({
      now: MONDAY,
      busy: [],
      availabilityNote: "I only take calls after 5pm.",
    });
    assert.equal(slots.length, 3);
    for (const slot of slots) {
      const hour = Number(
        new Date(slot.start).toLocaleString("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          hourCycle: "h23",
        })
      );
      assert.ok(hour >= 17);
    }
  });

  it("skips a busy block and an all-day hold", () => {
    const busyStart = wallToUtc("2026-10-01", 10 * 60).toISOString();
    const busyEnd = wallToUtc("2026-10-01", 12 * 60).toISOString();
    const slots = proposeSlots({
      now: MONDAY,
      busy: [
        { start: busyStart, end: busyEnd },
        {
          start: "2026-10-02T04:00:00.000Z",
          end: "2026-10-03T04:00:00.000Z",
          allDay: true,
        },
      ],
    });
    const days = slots.map((slot) => etYmd(slot.start));
    assert.equal(days.includes("2026-10-02"), false);
    const thursday = slots.find((slot) => etYmd(slot.start) === "2026-10-01");
    assert.ok(thursday);
    const hour = Number(
      new Date(thursday.start).toLocaleString("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        hourCycle: "h23",
      })
    );
    assert.equal(hour, 14);
  });

  it("skips times already offered on other Browning handoffs", () => {
    const first = proposeSlots({ now: MONDAY, busy: [] });
    assert.equal(first.length, 3);
    const second = proposeSlots({
      now: MONDAY,
      busy: first.map((slot) => ({ start: slot.start, end: slot.end })),
    });
    assert.equal(second.length, 3);
    const firstStarts = new Set(first.map((slot) => slot.start));
    for (const slot of second) {
      assert.equal(firstStarts.has(slot.start), false);
    }
  });
});
