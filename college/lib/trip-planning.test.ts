import assert from "node:assert/strict";
import test from "node:test";
import {
  CHS_SCHEDULE,
  CHS_SCHEDULE_YEAR,
  DEFAULT_TRIP_WEEK_INDEX,
  FALL_TRIP_GRID,
  KYLE_STUDENT,
  TRIP_WEEK_LABELS,
  TRIP_WEEK0,
  chsTripWindows,
  chsVisitBreaks,
  defaultTripPlanState,
  isoDate,
  kyleBreakCellLabel,
  normalizeStateCode,
  parseTripPlanState,
  preferredTripSeason,
  regionForLocation,
  regionForState,
  toggleClusterInTrip,
  tripPlanStorageKey,
  weekDate,
} from "./trip-planning/index";

test("regionForState maps sample states", () => {
  assert.equal(regionForState("NJ"), "Northeast");
  assert.equal(regionForState("NY"), "Northeast");
  assert.equal(regionForState("PA"), "Mid-Atlantic");
  assert.equal(regionForState("VA"), "Mid-Atlantic");
  assert.equal(regionForState("NC"), "South");
  assert.equal(regionForState("IL"), "Midwest");
  assert.equal(regionForState("CO"), "Mountain");
  assert.equal(regionForState("TX"), "Texas");
  assert.equal(regionForState("CA"), "West Coast");
  assert.equal(regionForState("WA"), "West Coast");
});

test("normalizeStateCode accepts full names", () => {
  assert.equal(normalizeStateCode("New Jersey"), "NJ");
  assert.equal(normalizeStateCode("n.j."), "NJ");
  assert.equal(normalizeStateCode("California"), "CA");
});

test("regionForLocation parses City, ST", () => {
  assert.equal(regionForLocation("Maplewood, NJ"), "Northeast");
  assert.equal(regionForLocation("Los Angeles, CA"), "West Coast");
  assert.equal(regionForLocation("Austin, TX"), "Texas");
  assert.equal(regionForLocation("Unknownia"), null);
});

test("tripPlanStorageKey is per user and school", () => {
  assert.equal(
    tripPlanStorageKey("kyle", "ucla"),
    "track-trip-plan:kyle:ucla",
  );
});

test("parseTripPlanState validates shape", () => {
  assert.equal(parseTripPlanState(null), null);
  assert.equal(parseTripPlanState({ weekIndex: 2 }), null);
  assert.deepEqual(parseTripPlanState({ clusterIds: ["same", "plus1"], weekIndex: 5 }), {
    clusterIds: ["same", "plus1"],
    weekIndex: 5,
  });
  assert.deepEqual(parseTripPlanState({ clusterIds: ["same"], weekIndex: 99 }), {
    clusterIds: ["same"],
    weekIndex: 8,
  });
});

test("defaultTripPlanState and toggleClusterInTrip", () => {
  const base = defaultTripPlanState(["same"]);
  assert.deepEqual(base.clusterIds, ["same"]);
  assert.equal(base.weekIndex, DEFAULT_TRIP_WEEK_INDEX);
  const added = toggleClusterInTrip(base, "plus1");
  assert.deepEqual(added.clusterIds, ["same", "plus1"]);
  const removed = toggleClusterInTrip(added, "same");
  assert.deepEqual(removed.clusterIds, ["plus1"]);
});

test("CHS schedule keeps full year data with red visit breaks", () => {
  assert.equal(CHS_SCHEDULE_YEAR, "2026-2027");
  assert.ok(CHS_SCHEDULE.length >= 20);
  const visits = chsVisitBreaks();
  assert.ok(visits.some((e) => e.label === "Winter Break"));
  assert.ok(visits.some((e) => e.label === "Spring Break"));
  assert.ok(visits.some((e) => e.label === "Thanksgiving Break"));
  assert.ok(visits.every((e) => e.forVisits));
  const windows = chsTripWindows();
  assert.deepEqual(
    windows.map((w) => w.label),
    ["NJEA Teachers Convention", "Thanksgiving Break", "Winter Break", "Spring Break"],
  );
  const labor = CHS_SCHEDULE.find((e) => e.label === "Labor Day");
  assert.equal(labor?.start, "2026-09-07");
  const yom = CHS_SCHEDULE.find((e) => e.label === "Yom Kippur");
  assert.equal(yom?.start, "2026-09-21");
  const spring = CHS_SCHEDULE.find((e) => e.label === "Spring Break");
  assert.deepEqual([spring?.start, spring?.end], ["2027-04-12", "2027-04-16"]);
  const memorial = CHS_SCHEDULE.find((e) => e.label === "Memorial Day");
  assert.equal(memorial?.start, "2027-05-31");
});

test("CHS dates fall in the 2026-27 academic window (through Aug 2027)", () => {
  for (const entry of CHS_SCHEDULE) {
    assert.ok(entry.start >= "2026-08-01", `${entry.label} start ${entry.start}`);
    assert.ok(entry.end <= "2027-08-31", `${entry.label} end ${entry.end}`);
  }
  assert.equal(KYLE_STUDENT.scheduleYear, "2026-2027");
});

test("Kyle spring grid marks Spring Break week in red visit set", () => {
  assert.equal(TRIP_WEEK_LABELS[0], "Mar 1");
  assert.equal(TRIP_WEEK_LABELS[6], "Apr 12");
  assert.equal(TRIP_WEEK_LABELS[8], "Apr 26");
  assert.equal(isoDate(TRIP_WEEK0), "2027-03-01");
  assert.equal(isoDate(weekDate(6)), "2027-04-12");
  assert.equal(isoDate(weekDate(8)), "2027-04-26");
  assert.deepEqual(KYLE_STUDENT.breaks, [6]);
  assert.equal(DEFAULT_TRIP_WEEK_INDEX, 6);
  assert.equal(kyleBreakCellLabel(6), "Spring Break");
  assert.equal(kyleBreakCellLabel(0), "School");
});

test("fall When-to-go grid covers NJEA and Thanksgiving 2026", () => {
  assert.equal(FALL_TRIP_GRID.weekLabels[0], "Oct 26");
  assert.equal(FALL_TRIP_GRID.weekLabels[1], "Nov 2");
  assert.equal(FALL_TRIP_GRID.weekLabels[4], "Nov 23");
  assert.equal(isoDate(FALL_TRIP_GRID.week0), "2026-10-26");
  assert.ok(FALL_TRIP_GRID.kyleBreaks.includes(1), "NJEA week is a Kyle break");
  assert.ok(FALL_TRIP_GRID.kyleBreaks.includes(4), "Thanksgiving week is a Kyle break");
  assert.equal(FALL_TRIP_GRID.defaultWeekIndex, 1);
  assert.match(kyleBreakCellLabel(1, FALL_TRIP_GRID), /NJEA|Teachers/);
  assert.equal(kyleBreakCellLabel(4, FALL_TRIP_GRID), "Thanksgiving Break");
});

test("preferredTripSeason picks fall for all-Drive trips", () => {
  assert.equal(preferredTripSeason(["Drive", "Drive"]), "fall");
  assert.equal(preferredTripSeason(["Drive", "Fly"]), "spring");
  assert.equal(preferredTripSeason(["Fly"]), "spring");
  assert.equal(preferredTripSeason([]), "fall");
});

test("defaultTripPlanState can seed fall season", () => {
  const fall = defaultTripPlanState(["same"], "fall");
  assert.equal(fall.season, "fall");
  assert.equal(fall.weekIndex, FALL_TRIP_GRID.defaultWeekIndex);
});
