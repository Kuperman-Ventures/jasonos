import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysYmd,
  etEndOfWorkWeekYmd,
  formatMonSunWeekLabel,
  gmailAfterSlashDate,
  mondayStartOfWeekYmd,
  weekRangeMonSun,
} from "./dates.ts";

describe("gmailAfterSlashDate", () => {
  it("emits YYYY/MM/DD so Gmail after: actually filters Sent", () => {
    const now = new Date("2026-09-15T18:00:00Z");
    assert.equal(gmailAfterSlashDate(7, now), "2026/09/08");
  });
});

describe("etEndOfWorkWeekYmd", () => {
  it("includes Thursday when today is Tuesday", () => {
    assert.equal(etEndOfWorkWeekYmd("2026-09-15"), "2026-09-18");
  });
});

describe("mondayStartOfWeekYmd / weekRangeMonSun", () => {
  it("anchors every weekday to the same Monday–Sunday week", () => {
    // 2026-04-01 is Wednesday; week is Mon Mar 30 – Sun Apr 5
    assert.equal(mondayStartOfWeekYmd("2026-04-01"), "2026-03-30");
    assert.equal(mondayStartOfWeekYmd("2026-03-30"), "2026-03-30");
    assert.equal(mondayStartOfWeekYmd("2026-04-05"), "2026-03-30");
    assert.deepEqual(weekRangeMonSun("2026-04-02"), {
      start: "2026-03-30",
      end: "2026-04-05",
    });
  });

  it("treats Sunday as the last day of the week that started Monday", () => {
    assert.equal(mondayStartOfWeekYmd("2026-04-05"), "2026-03-30");
    assert.equal(addDaysYmd("2026-03-30", 6), "2026-04-05");
  });

  it("formats a Mon–Sun label", () => {
    assert.equal(
      formatMonSunWeekLabel("2026-03-30", "2026-04-05"),
      "Monday 30 March \u2013 Sunday 5 April 2026"
    );
  });
});
