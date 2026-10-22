import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { upcomingWeekendWindow, zonedLocalDate } from "./weekend.ts";

describe("upcomingWeekendWindow", () => {
  it("from Wednesday points at the coming Friday–Sunday", () => {
    // 2026-10-21 is Wednesday in America/New_York
    const now = zonedLocalDate("America/New_York", 2026, 10, 21, 12, 0);
    const win = upcomingWeekendWindow(now);
    assert.equal(win.fridayKey, "2026-10-23");
    assert.match(win.label, /Oct/);
    assert.ok(win.start < win.end);
  });

  it("from Friday night uses the current weekend", () => {
    const now = zonedLocalDate("America/New_York", 2026, 10, 23, 20, 0);
    const win = upcomingWeekendWindow(now);
    assert.equal(win.fridayKey, "2026-10-23");
  });

  it("from Sunday still uses that weekend", () => {
    const now = zonedLocalDate("America/New_York", 2026, 10, 25, 10, 0);
    const win = upcomingWeekendWindow(now);
    assert.equal(win.fridayKey, "2026-10-23");
  });
});
