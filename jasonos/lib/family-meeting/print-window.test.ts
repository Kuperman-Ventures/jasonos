import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  freezeFridayKeyFor,
  printWeekFromFreezeFriday,
} from "./print-window.ts";
import { zonedLocalDate } from "./weekend.ts";

describe("printWeekFromFreezeFriday", () => {
  it("covers Sat through the following Sunday", () => {
    const week = printWeekFromFreezeFriday("2026-10-23"); // Friday
    assert.equal(week.rangeStartKey, "2026-10-24"); // Sat
    assert.equal(week.rangeEndKey, "2026-11-01"); // next Sun
    assert.equal(week.rangeEndExclusiveKey, "2026-11-02");
  });
});

describe("freezeFridayKeyFor", () => {
  it("returns this Friday on Friday", () => {
    const fri = zonedLocalDate("America/New_York", 2026, 10, 23, 20, 0);
    assert.equal(freezeFridayKeyFor(fri), "2026-10-23");
  });

  it("returns last Friday on Saturday morning", () => {
    const sat = zonedLocalDate("America/New_York", 2026, 10, 24, 1, 0);
    assert.equal(freezeFridayKeyFor(sat), "2026-10-23");
  });
});
