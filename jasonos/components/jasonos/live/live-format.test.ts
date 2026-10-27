import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterUpcomingWeekMeetings, formatAttendeeLine } from "./live-format.ts";

describe("filterUpcomingWeekMeetings", () => {
  const now = Date.parse("2026-10-27T16:00:00.000Z");

  it("keeps meetings from now through 7 days and sorts them", () => {
    const rows = [
      { id: "late", startsAt: "2026-11-10T16:00:00.000Z" },
      { id: "soon", startsAt: "2026-10-28T16:00:00.000Z" },
      { id: "past", startsAt: "2026-10-26T16:00:00.000Z" },
      { id: "week", startsAt: "2026-11-02T15:00:00.000Z" },
      { id: "edge", startsAt: "2026-11-03T16:00:00.000Z" },
    ];
    const filtered = filterUpcomingWeekMeetings(rows, 7, now);
    assert.deepEqual(
      filtered.map((row) => row.id),
      ["soon", "week", "edge"]
    );
  });

  it("returns empty when nothing is in range", () => {
    assert.deepEqual(
      filterUpcomingWeekMeetings([{ id: "x", startsAt: "2026-10-01T00:00:00.000Z" }], 7, now),
      []
    );
  });
});

describe("formatAttendeeLine", () => {
  it("truncates long attendee lists", () => {
    assert.equal(formatAttendeeLine([]), "No attendees listed");
    assert.equal(formatAttendeeLine(["Ada", "Bob"]), "Ada, Bob");
    assert.equal(
      formatAttendeeLine(["Ada", "Bob", "Cara", "Dan"]),
      "Ada, Bob +2"
    );
  });
});
