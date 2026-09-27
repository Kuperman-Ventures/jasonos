import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPUS_MAP_RADIUS_MILES,
  buildSatelliteStaticMapUrl,
  circlePathPoints,
  googleSatelliteMapsHref,
  parseCampusMapQuery,
  zoomForRadiusMiles,
} from "./campus-map";

test("zoomForRadiusMiles targets about 25 mi radius at mid latitudes", () => {
  const zoom = zoomForRadiusMiles(42.36, CAMPUS_MAP_RADIUS_MILES);
  assert.ok(zoom >= 9 && zoom <= 11, `zoom=${zoom}`);
});

test("circlePathPoints closes the ring", () => {
  const pts = circlePathPoints(40.73, -74.17, 25, 36);
  assert.equal(pts.length, 37);
  assert.ok(Math.abs(pts[0]!.lat - pts[pts.length - 1]!.lat) < 1e-9);
  assert.ok(Math.abs(pts[0]!.lng - pts[pts.length - 1]!.lng) < 1e-9);
});

test("buildSatelliteStaticMapUrl is satellite with marker and path", () => {
  const url = buildSatelliteStaticMapUrl({
    lat: 42.36,
    lng: -71.09,
    apiKey: "test-key",
  });
  assert.match(url, /maps\.googleapis\.com\/maps\/api\/staticmap/);
  assert.match(url, /maptype=satellite/);
  assert.match(url, /markers=/);
  assert.match(url, /path=/);
  assert.match(url, /key=test-key/);
});

test("googleSatelliteMapsHref opens satellite basemap", () => {
  const href = googleSatelliteMapsHref(42.36, -71.09, 10);
  assert.match(href, /google\.com\/maps/);
  assert.match(href, /1e3/);
});

test("parseCampusMapQuery validates coordinates", () => {
  assert.deepEqual(
    parseCampusMapQuery(new URLSearchParams("lat=42.3&lng=-71.1")),
    { lat: 42.3, lng: -71.1 },
  );
  assert.equal(parseCampusMapQuery(new URLSearchParams("lat=99&lng=0")), null);
  assert.equal(parseCampusMapQuery(new URLSearchParams("lat=x&lng=0")), null);
});
