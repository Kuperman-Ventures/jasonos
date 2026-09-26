import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTripPlanState,
  normalizeStateCode,
  parseTripPlanState,
  regionForLocation,
  regionForState,
  toggleClusterInTrip,
  tripPlanStorageKey,
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
  assert.equal(base.weekIndex, 5);
  const added = toggleClusterInTrip(base, "plus1");
  assert.deepEqual(added.clusterIds, ["same", "plus1"]);
  const removed = toggleClusterInTrip(added, "same");
  assert.deepEqual(removed.clusterIds, ["plus1"]);
});
