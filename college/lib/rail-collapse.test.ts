import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultRailDensity,
  isRailDensity,
  resolveRailDensity,
  shortProcessPhaseName,
} from "./rail-collapse";

test("rail density helpers", () => {
  assert.equal(isRailDensity("slim"), true);
  assert.equal(isRailDensity("wide"), false);
  assert.equal(defaultRailDensity(1000), "slim");
  assert.equal(defaultRailDensity(1200), "expanded");
  assert.equal(resolveRailDensity("expanded", 900), "expanded");
  assert.equal(resolveRailDensity(null, 900), "slim");
});

test("short process phase names", () => {
  assert.equal(shortProcessPhaseName("Junior Fall"), "Jr Fall");
  assert.equal(shortProcessPhaseName("Senior Winter"), "Sr Win");
});
