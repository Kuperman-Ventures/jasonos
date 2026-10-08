import assert from "node:assert/strict";
import test from "node:test";
import {
  appendRegionRouteStop,
  buildRegionRouteLegs,
  formatRegionRouteLeg,
  formatRegionRouteTotal,
} from "./region-route";
import { driveLeg, schoolTravelPointId } from "@/lib/drive-matrix";

test("appendRegionRouteStop grows and truncates on reselect", () => {
  assert.deepEqual(appendRegionRouteStop([], "a"), ["a"]);
  assert.deepEqual(appendRegionRouteStop(["a"], "b"), ["a", "b"]);
  assert.deepEqual(appendRegionRouteStop(["a", "b", "c"], "b"), ["a", "b"]);
  assert.deepEqual(appendRegionRouteStop(["a", "b"], "a"), ["a"]);
});

test("buildRegionRouteLegs uses drive matrix when available", () => {
  // Prefer real matrix pairs when present; otherwise still shape-check empty.
  const names = new Map<string, string>([
    ["mit", "MIT"],
    ["harvard-university", "Harvard"],
  ]);
  const empty = buildRegionRouteLegs(["mit"], names);
  assert.equal(empty.legs.length, 0);
  assert.equal(formatRegionRouteTotal(empty), "Click schools to build a drive path");

  const two = buildRegionRouteLegs(["mit", "harvard-university"], names);
  assert.equal(two.legs.length, 1);
  const cell = driveLeg(schoolTravelPointId("mit"), schoolTravelPointId("harvard-university"));
  if (cell) {
    assert.equal(two.legs[0]?.minutes, cell.minutes);
    assert.equal(two.totalMinutes, cell.minutes);
    assert.match(formatRegionRouteLeg(two.legs[0]!), /\d/);
    assert.match(formatRegionRouteTotal(two), /Total/);
  } else {
    assert.equal(two.legs[0]?.minutes, null);
    assert.equal(two.missingLegs, 1);
    assert.match(formatRegionRouteTotal(two), /unknown/);
  }
});
