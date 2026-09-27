import assert from "node:assert/strict";
import test from "node:test";
import { fromSeed, type SchoolSeed } from "./types";
import {
  anyFilterLevelOn,
  buildMapRouteParts,
  buildTripFromSelection,
  buildVisitClusters,
  defaultVisitInterestFilter,
  filterVisitClusters,
  nearbySchoolStats,
  parseSchoolLocation,
  schoolMapById,
  schoolMapLocation,
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
});

test("buildTripFromSelection uses matrix Held-Karp order and home endpoints", () => {
  const gt = school({
    id: "georgia-tech",
    name: "Georgia Institute of Technology (Georgia Tech)",
    location: "Atlanta, GA",
  });
  gt.interestLevel = "top";
  const clemson = school({
    id: "clemson-university",
    name: "Clemson University",
    location: "Clemson, SC",
  });
  clemson.interestLevel = "high";
  const florida = school({
    id: "university-of-florida",
    name: "University of Florida",
    location: "Gainesville, FL",
  });
  florida.interestLevel = "moderate";
  const list = [gt, clemson, florida];
  const clusters = buildVisitClusters(gt, list);
  const byId = schoolMapById(list);

  const justBase = buildTripFromSelection(gt, clusters, ["georgia-tech"], byId, {
    startId: "airport:ATL",
    endId: "airport:ATL",
  });
  assert.deepEqual(justBase.orderedIds, ["georgia-tech"]);
  assert.equal(justBase.stops.length, 1);
  assert.ok((justBase.totalDriveMinutes ?? 0) > 0); // ATL ↔ GT round trip
  assert.equal(justBase.tooMany, false);
  assert.ok(justBase.route);

  const withPeer = buildTripFromSelection(
    gt,
    clusters,
    ["georgia-tech", "clemson-university"],
    byId,
    { startId: "airport:ATL", endId: "airport:ATL" },
  );
  assert.equal(withPeer.orderedIds.includes("clemson-university"), true);
  assert.ok(withPeer.totalDriveMinutes > justBase.totalDriveMinutes);
  assert.ok(withPeer.stops.some((s) => s.driveFromPrev && /min|hr/.test(s.driveFromPrev)));

  const withThird = buildTripFromSelection(
    gt,
    clusters,
    ["georgia-tech", "clemson-university", "university-of-florida"],
    byId,
    { startId: "airport:ATL", endId: "airport:ATL" },
  );
  assert.equal(withThird.orderedIds.length, 3);
  assert.ok(withThird.totalDriveMinutes > withPeer.totalDriveMinutes);
});

test("buildTripFromSelection flags more than 12 schools", () => {
  const base = school({
    id: "georgia-tech",
    name: "Georgia Institute of Technology (Georgia Tech)",
    location: "Atlanta, GA",
  });
  const extras = Array.from({ length: 13 }, (_, i) =>
    school({
      id: `extra-${i}`,
      name: `Extra ${i}`,
      location: "Atlanta, GA",
    }),
  );
  const list = [base, ...extras];
  const byId = schoolMapById(list);
  const plan = buildTripFromSelection(
    base,
    [],
    list.map((s) => s.id),
    byId,
    { startId: "home", endId: "home" },
  );
  assert.equal(plan.tooMany, true);
  assert.equal(plan.route, null);
});

test("filterVisitClusters hides peers by interest but keeps current school", () => {
  const gt = school({
    id: "georgia-tech",
    name: "Georgia Institute of Technology (Georgia Tech)",
    location: "Atlanta, GA",
  });
  gt.interestLevel = "top";
  const emory = school({ id: "emory", name: "Emory University", location: "Atlanta, GA" });
  emory.interestLevel = "high";
  const list = [gt, emory];
  const clusters = buildVisitClusters(gt, list);
  const byId = schoolMapById(list);
  const filter = { ...defaultVisitInterestFilter(), high: false };
  const filtered = filterVisitClusters(clusters, gt, byId, filter);
  const same = filtered[0]!;
  assert.ok(same.stops.some((s) => s.schoolId === "georgia-tech"));
  assert.equal(
    same.stops.some((s) => s.schoolId === "emory"),
    false,
  );
  const stats = nearbySchoolStats(clusters, filtered, gt.id);
  assert.equal(stats.total, 1);
  assert.equal(stats.showing, 0);
});

test("buildMapRouteParts splits long routes and encodes Google/Apple URLs", () => {
  const stops = ["A", "B", "C", "D", "E", "F", "G"];
  const parts = buildMapRouteParts(stops, "Home", "Home");
  assert.ok(parts.length >= 2);
  assert.match(parts[0]!.googleUrl, /google\.com\/maps\/dir/);
  assert.match(parts[0]!.appleUrl, /maps\.apple\.com\/directions/);
  assert.match(parts[0]!.googleUrl, /origin=Home/);
  assert.match(parts[0]!.appleUrl, /source=Home/);
});

test("schoolMapLocation prefers visitAddress then name+city+state", () => {
  const row = school({
    id: "purdue-university",
    name: "Purdue University",
    location: "West Lafayette, IN",
  });
  assert.equal(schoolMapLocation(row), "Purdue University, West Lafayette, IN");
  row.visitAddress = "475 Stadium Mall Dr, West Lafayette, IN";
  assert.equal(schoolMapLocation(row), "475 Stadium Mall Dr, West Lafayette, IN");
});

test("visitInterestKey and anyFilterLevelOn", () => {
  assert.equal(visitInterestKey(""), "none");
  assert.equal(visitInterestKey("top"), "top");
  assert.equal(anyFilterLevelOn(defaultVisitInterestFilter()), true);
  assert.equal(
    anyFilterLevelOn({
      top: false,
      high: false,
      moderate: false,
      safety: false,
      none: false,
    }),
    false,
  );
});
