import assert from "node:assert/strict";
import test from "node:test";
import { campusCoordsForSchool } from "./campus-coords";

test("campusCoordsForSchool separates UPenn and Drexel from City Hall", () => {
  const upenn = campusCoordsForSchool("upenn");
  const drexel = campusCoordsForSchool("drexel-university");
  assert.ok(upenn);
  assert.ok(drexel);
  // City Hall ~ -75.163; University City is west of the Schuylkill (~ -75.19).
  assert.ok(upenn!.lng < -75.18);
  assert.ok(drexel!.lng < -75.18);
  assert.notEqual(upenn!.lng, drexel!.lng);
});

test("campusCoordsForSchool returns null for unknown ids", () => {
  assert.equal(campusCoordsForSchool("not-a-school"), null);
});
