import assert from "node:assert/strict";
import test from "node:test";
import {
  HOME_CLIMATE,
  climateCompareSummaryBody,
  climateForCityState,
  climateSchoolSummaryBody,
  hasCityClimate,
  monthlyFromAnchors,
} from "./climate";

test("Ithaca / Cornell is colder in January than Maplewood", () => {
  const cornell = climateForCityState("cornell", "Cornell", "Ithaca", "NY");
  assert.ok(hasCityClimate("Ithaca", "NY"));
  assert.ok(cornell.hi[0]! < HOME_CLIMATE.hi[0]!);
  assert.ok(cornell.lo[0]! < HOME_CLIMATE.lo[0]!);
  // NOAA anchor: Jan high 31°
  assert.equal(cornell.hi[0], 31);
  assert.ok(cornell.snow.reduce((a, b) => a + b, 0) > 40);
});

test("College Park is not SoCal mild coastal", () => {
  const md = climateForCityState("umd", "Maryland", "College Park", "MD");
  assert.ok(md.hi[0]! < 50);
  assert.ok(md.snow.reduce((a, b) => a + b, 0) > 5);
});

test("summary body does not repeat the school name", () => {
  const cornell = climateForCityState("cornell", "Cornell", "Ithaca", "NY");
  const body = climateSchoolSummaryBody(cornell);
  assert.ok(!/^Cornell/i.test(body));
  assert.match(body, /Highs run from/);
  assert.match(body, /snow/i);
});

test("compare summary uses snow more/less wording", () => {
  const cornell = climateForCityState("cornell", "Cornell", "Ithaca", "NY");
  const home = climateForCityState("home", "Home", "Maplewood", "NJ");
  const body = climateCompareSummaryBody(home, cornell, "Cornell");
  assert.match(body, /Highs from/);
  assert.match(body, /in\. of snow a year,/);
  assert.match(body, /in\. (more|less) than Cornell/);
});

test("monthlyFromAnchors hits Jan and Jul anchors", () => {
  const m = monthlyFromAnchors({
    janHi: 31,
    janLo: 15,
    julHi: 80,
    julLo: 58,
    precipIn: 38.3,
    snowIn: 62.9,
  });
  assert.equal(m.hi[0], 31);
  assert.equal(m.lo[0], 15);
  assert.equal(m.hi[6], 80);
  assert.equal(m.lo[6], 58);
});
