import assert from "node:assert/strict";
import test from "node:test";
import {
  schoolsByState,
  selectivityBreakdown,
  stateFillStrength,
  stateFromLocation,
} from "./dashboard";
import { US_STATE_PATHS } from "./us-state-paths";
import { fromSeed, type SchoolSeed } from "./types";

const sample: SchoolSeed[] = [
  {
    id: "mit",
    name: "MIT",
    location: "Cambridge, MA",
    campusSize: "",
    mechanicalEngineering: "",
    materials: "",
    materialsOffering: "",
    admissionsContext: "Extremely selective",
    satContext: "",
    selectivity: "",
    notes: "n",
    listOrder: 0,
  },
  {
    id: "gatech",
    name: "Georgia Tech",
    location: "Atlanta, GA",
    campusSize: "",
    mechanicalEngineering: "",
    materials: "",
    materialsOffering: "",
    admissionsContext: "Very selective, especially out-of-state",
    satContext: "",
    selectivity: "",
    notes: "n",
    listOrder: 1,
  },
  {
    id: "ncsu",
    name: "NC State",
    location: "Raleigh, NC",
    campusSize: "",
    mechanicalEngineering: "",
    materials: "",
    materialsOffering: "",
    admissionsContext: "Competitive",
    satContext: "",
    selectivity: "",
    notes: "n",
    listOrder: 2,
  },
];

test("stateFromLocation reads the state code", () => {
  assert.equal(stateFromLocation("Cambridge, MA"), "MA");
  assert.equal(stateFromLocation("Champaign-Urbana, IL"), "IL");
  assert.equal(stateFromLocation("nowhere"), null);
});

test("selectivityBreakdown uses locked tiers and percents", () => {
  const schools = sample.map(fromSeed);
  const slices = selectivityBreakdown(schools);
  const extreme = slices.find((slice) => slice.id === "extremely_selective");
  const very = slices.find((slice) => slice.id === "very_selective");
  const competitive = slices.find((slice) => slice.id === "competitive");
  assert.equal(extreme?.count, 1);
  assert.equal(very?.count, 1);
  assert.equal(competitive?.count, 1);
  assert.equal(extreme?.percent, 33.3);
});

test("schoolsByState aggregates list locations", () => {
  const schools = sample.map(fromSeed);
  assert.deepEqual(schoolsByState(schools), [
    { state: "GA", count: 1 },
    { state: "MA", count: 1 },
    { state: "NC", count: 1 },
  ]);
});

test("stateFillStrength scales with max and stays visible at one", () => {
  assert.equal(stateFillStrength(0, 5), 0);
  assert.equal(stateFillStrength(5, 5), 1);
  assert.ok(stateFillStrength(1, 5) >= 0.22);
});

test("US_STATE_PATHS covers the lower 48 plus AK HI DC", () => {
  assert.ok(US_STATE_PATHS.CA?.startsWith("M"));
  assert.ok(US_STATE_PATHS.NJ?.startsWith("M"));
  assert.equal(Object.keys(US_STATE_PATHS).length, 51);
});
