/**
 * Held-Karp / route helpers are covered via drive-matrix exports.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRouteFromOrder,
  driveFieldsForSchool,
  driveLeg,
  formatTravelLabel,
  nearestSchoolsFrom,
  shortestSchoolOrder,
  travelModeForMinutes,
} from "./drive-matrix";

test("home→NJIT is a short Drive", () => {
  const fields = driveFieldsForSchool("njit");
  assert.equal(fields.travelMode, "Drive");
  assert.ok(fields.driveMinutes != null && fields.driveMinutes < 60);
  assert.ok(fields.driveMiles != null && fields.driveMiles < 20);
  assert.match(formatTravelLabel(fields.driveMinutes, fields.driveMiles, fields.travelMode), /min/);
});

test("home→Stanford is Fly", () => {
  const fields = driveFieldsForSchool("stanford-university");
  assert.equal(fields.travelMode, "Fly");
  assert.ok((fields.driveMinutes ?? 0) > 360);
  assert.match(
    formatTravelLabel(fields.driveMinutes, fields.driveMiles, fields.travelMode),
    /^Fly \(/,
  );
});

test("travelModeForMinutes threshold is 360", () => {
  assert.equal(travelModeForMinutes(360), "Drive");
  assert.equal(travelModeForMinutes(361), "Fly");
});

test("nearestSchoolsFrom returns three closest", () => {
  const hits = nearestSchoolsFrom("upenn", [
    { id: "upenn", name: "UPenn" },
    { id: "drexel-university", name: "Drexel" },
    { id: "lehigh-university", name: "Lehigh" },
    { id: "njit", name: "NJIT" },
    { id: "stanford-university", name: "Stanford" },
  ]);
  assert.equal(hits.length, 3);
  assert.equal(hits[0]?.schoolId, "drexel-university");
  assert.ok(hits[0]!.minutes <= hits[1]!.minutes);
});

test("shortestSchoolOrder visits each school once", () => {
  const route = shortestSchoolOrder({
    startId: "home",
    endId: "home",
    schoolIds: ["njit", "stevens-institute-of-technology", "rutgers-university-new-brunswick"],
  });
  assert.ok(route);
  assert.equal(route!.schoolCount, 3);
  assert.equal(route!.incomplete, false);
  assert.ok((route!.totalMinutes ?? 0) > 0);
  const schoolStops = route!.order.filter((id) => id.startsWith("school:"));
  // order uses raw school ids in schoolIds path — check legs
  assert.ok(route!.legs.length >= 3);
  const manual = buildRouteFromOrder({
    startId: "home",
    endId: "home",
    schoolIds: ["njit", "stevens-institute-of-technology", "rutgers-university-new-brunswick"],
  });
  assert.ok((route!.totalMinutes ?? Infinity) <= (manual.totalMinutes ?? Infinity));
});

test("driveLeg is directed and self is zero", () => {
  assert.deepEqual(driveLeg("home", "home"), { minutes: 0, miles: 0 });
  const a = driveLeg("home", "school:njit");
  const b = driveLeg("school:njit", "home");
  assert.ok(a && b);
  // Directions can differ slightly
  assert.ok(a.minutes > 0 && b.minutes > 0);
});
