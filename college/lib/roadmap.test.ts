import assert from "node:assert/strict";
import test from "node:test";
import {
  ROADMAP_MONTHS,
  ROADMAP_TRACKS,
  accessibleTrackName,
  currentMonthIndex,
  dayProgressInMonth,
  formatNowDay,
  formatSpan,
  formatTodayLong,
  gridColumnStart,
  monthCells,
  monthIndex,
  spanLength,
  trackState,
  yearBands,
} from "./roadmap";

test("monthIndex is zero at Sep 2026", () => {
  assert.equal(monthIndex(2026, 8), 0);
  assert.equal(monthIndex(2027, 0), 4);
  assert.equal(monthIndex(2027, 6), 10);
  assert.equal(monthIndex(2027, 9), 13);
  assert.equal(monthIndex(2028, 0), 16);
});

test("spanLength is inclusive", () => {
  assert.equal(spanLength({ year: 2026, month: 8 }, { year: 2027, month: 2 }), 7);
  assert.equal(spanLength({ year: 2027, month: 6 }, { year: 2027, month: 6 }), 1);
  assert.equal(spanLength({ year: 2027, month: 9 }, { year: 2028, month: 0 }), 4);
});

test("grid columns match the dense ledger math", () => {
  assert.equal(gridColumnStart(0), 2);
  assert.equal(gridColumnStart(2), 4); // Nov 2026 → NOW column
  assert.equal(gridColumnStart(10), 12); // Jul 2027 essays pin
});

test("month window is 17 cells with year bands", () => {
  const cells = monthCells();
  assert.equal(cells.length, ROADMAP_MONTHS);
  assert.equal(cells[0].label, "Sep");
  assert.equal(cells[cells.length - 1].label, "Jan");
  assert.deepEqual(
    yearBands(cells).map((band) => ({ year: band.year, start: band.start, span: band.span })),
    [
      { year: 2026, start: 0, span: 4 },
      { year: 2027, start: 4, span: 12 },
      { year: 2028, start: 16, span: 1 },
    ],
  );
});

test("reference tracks land on the example spans", () => {
  const list = ROADMAP_TRACKS.find((track) => track.id === "college-list");
  const essays = ROADMAP_TRACKS.find((track) => track.id === "essays");
  const apps = ROADMAP_TRACKS.find((track) => track.id === "applications");
  assert.ok(list && essays && apps);
  assert.equal(formatSpan(list), "Sep – Mar");
  assert.equal(formatSpan(essays), "Jul 2027");
  assert.equal(formatSpan(apps), "Oct – Jan 28");
  assert.equal(spanLength(list.start, list.end), 7);
  assert.equal(monthIndex(essays.start.year, essays.start.month), 10);
});

test("trackState marks future work past the current month", () => {
  const apps = ROADMAP_TRACKS.find((track) => track.id === "applications");
  assert.ok(apps);
  assert.equal(trackState(apps, {}, new Date("2026-11-15T12:00:00Z")), "future");
  assert.equal(trackState(apps, {}, new Date("2027-11-15T12:00:00Z")), "active");
  assert.equal(
    trackState(apps, { "p4-4": true, "p5-2": true, "p5-4": true }, new Date("2027-11-15T12:00:00Z")),
    "done",
  );
  assert.match(
    accessibleTrackName(apps, "future"),
    /not started/,
  );
});

test("currentMonthIndex clamps into the window", () => {
  assert.equal(currentMonthIndex(new Date("2026-11-20T12:00:00Z")), 2);
  assert.equal(currentMonthIndex(new Date("2025-01-01T12:00:00Z")), 0);
  assert.equal(currentMonthIndex(new Date("2030-01-01T12:00:00Z")), ROADMAP_MONTHS - 1);
});

test("dayProgressInMonth walks across the month", () => {
  assert.equal(dayProgressInMonth(new Date("2026-09-01T12:00:00")), 0);
  assert.ok(Math.abs(dayProgressInMonth(new Date("2026-09-16T12:00:00")) - 0.5) < 0.01);
  assert.ok(dayProgressInMonth(new Date("2026-09-30T12:00:00")) > 0.9);
  assert.equal(formatNowDay(new Date("2026-09-20T12:00:00")), "Sep 20");
  assert.match(formatTodayLong(new Date("2026-09-20T12:00:00")), /Sep 20, 2026/);
});
