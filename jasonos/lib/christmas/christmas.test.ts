import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHRISTMAS_MOUNTAINS } from "../../config/christmas.ts";
import { RESORTS } from "../../config/resorts.ts";
import { blackoutDatesInBreak, christmasBreakDates, countPassDays, passLabel } from "./dates.ts";
import { median, planHeadline, seasonFromDaily, summarizeHistory } from "./summarize.ts";

describe("christmas break and Epic Local", () => {
  it("covers Dec 24 through Jan 2 and blocks only Dec 26-31 inside that break", () => {
    const days = christmasBreakDates();
    assert.deepEqual(days[0], "2026-12-24");
    assert.deepEqual(days[days.length - 1], "2027-01-02");
    assert.equal(days.length, 10);
    assert.deepEqual(blackoutDatesInBreak(), [
      "2026-12-26",
      "2026-12-27",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
    ]);
  });

  it("leaves Hunter open and blocks Stowe for 6 of the 10 days", () => {
    const hunter = CHRISTMAS_MOUNTAINS.find((mountain) => mountain.id === "hunter");
    const stowe = CHRISTMAS_MOUNTAINS.find((mountain) => mountain.id === "stowe");
    const creek = CHRISTMAS_MOUNTAINS.find((mountain) => mountain.id === "mountain-creek");
    const vail = CHRISTMAS_MOUNTAINS.find((mountain) => mountain.id === "vail");
    assert.equal(hunter?.standing, "open");
    assert.equal(stowe?.standing, "blackout");
    assert.equal(creek?.standing, "off-pass");
    assert.match(vail?.limitNote ?? "", /10 days/);
    assert.deepEqual(countPassDays("open"), { open: 10, total: 10 });
    assert.deepEqual(countPassDays("blackout"), { open: 4, total: 10 });
    assert.equal(passLabel("blackout"), "4 of 10 days, blocked Dec 26-31");
    assert.equal(passLabel("off-pass"), "Not on the pass");
    const rankHunter = RESORTS.find((resort) => resort.id === "hunter");
    assert.deepEqual(rankHunter?.blackoutDates, []);
  });

  it("summarizes historical windows and names a higher blacked-out mountain", () => {
    assert.equal(median([1, 10, 3]), 3);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    const summary = summarizeHistory([
      { year: 2020, snowIn: 4, meanHighF: 30 },
      { year: 2021, snowIn: 8, meanHighF: 28 },
      { year: 2022, snowIn: 6, meanHighF: 32 },
    ]);
    assert.equal(summary.medianSnowIn, 6);
    assert.equal(summary.seasonsAtLeast6In, 2);
    assert.equal(summary.seasons, 3);
    const missing = seasonFromDaily(2024, ["2024-12-24"], new Map());
    assert.equal(missing, null);
    const headline = planHeadline([
      { name: "Okemo", standing: "open", medianSnowIn: 12 },
      { name: "Hunter", standing: "open", medianSnowIn: 9 },
      { name: "Stowe", standing: "blackout", medianSnowIn: 18 },
    ]);
    assert.match(headline ?? "", /Okemo has the highest median snowfall, 12 in/);
    assert.match(headline ?? "", /Stowe is higher at 18 in/);
  });
});
