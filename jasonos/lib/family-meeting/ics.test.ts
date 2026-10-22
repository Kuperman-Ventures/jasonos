import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseIcsEvents, unfoldIcs } from "./ics.ts";

describe("parseIcsEvents", () => {
  it("unfolds folded lines", () => {
    assert.equal(unfoldIcs("SUMMARY:Hel\r\n lo"), "SUMMARY:Hello");
  });

  it("parses a timed VEVENT", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:abc-1
SUMMARY:Soccer
DTSTART:20261024T090000Z
DTEND:20261024T103000Z
LOCATION:Field 3
END:VEVENT
END:VCALENDAR`;
    const events = parseIcsEvents(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.summary, "Soccer");
    assert.equal(events[0]!.location, "Field 3");
    assert.equal(events[0]!.allDay, false);
    assert.equal(events[0]!.startsAt, "2026-10-24T09:00:00.000Z");
  });

  it("parses an all-day event", () => {
    const ics = `BEGIN:VEVENT
UID:day-1
SUMMARY:Camping
DTSTART;VALUE=DATE:20261025
DTEND;VALUE=DATE:20261026
END:VEVENT`;
    const events = parseIcsEvents(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.allDay, true);
    assert.equal(events[0]!.summary, "Camping");
  });
});
