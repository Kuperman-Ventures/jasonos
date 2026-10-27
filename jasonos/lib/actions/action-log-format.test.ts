import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_TZ } from "../dates.ts";
import {
  ACTION_LOG_TZ,
  actionLogDayKey,
  cadenceWords,
  followUpDetail,
  formatCalendarDay,
  snoozeDetail,
  untilDetail,
} from "./action-log-format.ts";

describe("action log dates", () => {
  it("uses the same timezone as the rest of JasonOS", () => {
    assert.equal(ACTION_LOG_TZ, APP_TZ);
  });

  it("formats a calendar day without shifting it", () => {
    assert.equal(formatCalendarDay("2026-10-30"), "Fri, Oct 30");
  });

  it("keeps a late UTC timestamp on the Eastern day", () => {
    assert.equal(actionLogDayKey("2026-10-28T02:30:00.000Z"), "2026-10-27");
  });

  it("describes a snooze and a follow-up due date", () => {
    assert.equal(snoozeDetail(1, "2026-10-28"), "1 day · back Wed, Oct 28");
    assert.equal(snoozeDetail(3, "2026-10-30"), "3 days · back Fri, Oct 30");
    assert.equal(followUpDetail(5, "2026-11-01"), "5 days · due Sun, Nov 1");
  });

  it("reads a snooze-until value as a day", () => {
    assert.equal(untilDetail("2026-10-30"), "until Fri, Oct 30");
  });

  it("names cadence intervals the way the picker does", () => {
    assert.equal(cadenceWords("biweekly"), "Every 2 weeks");
    assert.equal(cadenceWords("none"), "No cadence");
  });
});
