import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FAMILY_MEETING_LOOKAHEAD_DAYS,
  upcomingAgendaWindow,
  zonedLocalDate,
} from "./weekend.ts";

describe("upcomingAgendaWindow", () => {
  it("spans 14 calendar days from local midnight today", () => {
    const now = zonedLocalDate("America/New_York", 2026, 10, 22, 18, 30);
    const win = upcomingAgendaWindow(now);
    assert.equal(win.startKey, "2026-10-22");
    assert.equal(win.label, "Oct 22 – Nov 4");
    // Exclusive end is midnight 14 local days later (DST-safe check via keys).
    const endLocal = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(win.end);
    assert.equal(endLocal, "2026-11-05");
    assert.equal(FAMILY_MEETING_LOOKAHEAD_DAYS, 14);
  });

  it("includes weekdays and weekends in the label range", () => {
    const now = zonedLocalDate("America/New_York", 2026, 10, 23, 9, 0);
    const win = upcomingAgendaWindow(now);
    assert.equal(win.startKey, "2026-10-23");
    assert.match(win.label, /Oct 23/);
    assert.ok(win.start < win.end);
  });
});
