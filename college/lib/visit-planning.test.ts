import assert from "node:assert/strict";
import test from "node:test";
import { fromSeed, type SchoolSeed } from "./types";
import {
  buildVisitClusters,
  parseSchoolLocation,
  visitInterestKey,
} from "./visit-planning";

function school(partial: Partial<SchoolSeed> & Pick<SchoolSeed, "id" | "name" | "location">) {
  return fromSeed({
    campusSize: "Medium",
    mechanicalEngineering: "Yes",
    materials: "Yes",
    materialsOffering: "",
    admissionsContext: "",
    satContext: "",
    selectivity: "",
    notes: "",
    listOrder: 1,
    ...partial,
  });
}

test("parseSchoolLocation splits City, ST", () => {
  assert.deepEqual(parseSchoolLocation("Atlanta, GA"), {
    city: "Atlanta",
    state: "GA",
    label: "Atlanta, GA",
  });
});

test("buildVisitClusters groups same city and same state", () => {
  const gt = school({
    id: "georgia-tech",
    name: "Georgia Institute of Technology (Georgia Tech)",
    location: "Atlanta, GA",
  });
  gt.interestLevel = "top";
  const emory = school({
    id: "emory",
    name: "Emory University",
    location: "Atlanta, GA",
  });
  emory.interestLevel = "high";
  const uga = school({
    id: "uga",
    name: "University of Georgia",
    location: "Athens, GA",
  });
  uga.interestLevel = "moderate";
  const purdue = school({
    id: "purdue-university",
    name: "Purdue University",
    location: "West Lafayette, IN",
  });
  purdue.interestLevel = "high";

  const clusters = buildVisitClusters(gt, [gt, emory, uga, purdue]);
  assert.equal(clusters[0]?.id, "same");
  assert.ok(clusters[0]?.stops.some((s) => s.schoolId === "emory"));
  assert.equal(clusters[1]?.id, "plus1");
  assert.ok(clusters[1]?.stops.some((s) => s.schoolId === "uga"));
  assert.equal(clusters[2]?.id, "long");
  assert.ok(clusters[2]?.stops.some((s) => s.schoolId === "purdue-university"));
  // No invented minute strings
  for (const cluster of clusters) {
    for (const stop of cluster.stops) {
      if (stop.driveFromPrev) {
        assert.equal(/min|hr|hour/i.test(stop.driveFromPrev), false);
      }
    }
  }
});

test("visitInterestKey maps blank to none", () => {
  assert.equal(visitInterestKey(""), "none");
  assert.equal(visitInterestKey("top"), "top");
});
