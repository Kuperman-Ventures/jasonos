import assert from "node:assert/strict";
import test from "node:test";
import { airportMapOrigin, nearestAirport } from "./visit-airports";

test("nearestAirport picks ATL for Atlanta", () => {
  const hit = nearestAirport({ lat: 33.7756, lng: -84.3963 }); // Georgia Tech area
  assert.ok(hit);
  assert.equal(hit!.iata, "ATL");
  assert.ok(hit!.miles < 20);
  assert.match(hit!.mapOrigin, /ATL/);
  assert.match(hit!.buttonLabel, /ATL/);
});

test("nearestAirport picks BOS for Cambridge", () => {
  const hit = nearestAirport({ lat: 42.3601, lng: -71.0942 }); // MIT area
  assert.ok(hit);
  assert.equal(hit!.iata, "BOS");
});

test("nearestAirport picks IND for West Lafayette (not a tiny GA strip)", () => {
  const hit = nearestAirport({ lat: 40.4237, lng: -86.9212 }); // Purdue area
  assert.ok(hit);
  assert.equal(hit!.iata, "IND");
  assert.ok(hit!.miles > 40);
});

test("airportMapOrigin is maps-friendly", () => {
  const origin = airportMapOrigin({
    iata: "ATL",
    name: "Hartsfield-Jackson Atlanta International",
    city: "Atlanta",
    state: "GA",
    lat: 33.64,
    lng: -84.42,
  });
  assert.match(origin, /Hartsfield-Jackson/);
  assert.match(origin, /\(ATL\)/);
  assert.match(origin, /Atlanta, GA/);
});
