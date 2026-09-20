import assert from "node:assert/strict";
import test from "node:test";
import {
  ROADMAP_TRACKS,
  barPlacement,
  currentSeasonId,
  herePlacement,
  milestonePlacement,
  trackProgress,
} from "./roadmap";

test("barPlacement spans seasons on a 0–100 axis", () => {
  const list = barPlacement("fall-2026", "summer-2027");
  assert.equal(list.left, 0);
  assert.equal(list.width, 60);
  const short = barPlacement("fall-2027", "fall-2027");
  assert.equal(short.left, 80);
  assert.ok(short.width >= 8);
});

test("milestone and here sit on season markers", () => {
  assert.equal(milestonePlacement("summer-2027"), 60);
  assert.equal(herePlacement(new Date("2026-09-20T12:00:00Z")), 0);
  assert.equal(currentSeasonId(new Date("2027-04-01T12:00:00Z")), "spring-2027");
});

test("trackProgress reads linked checklist ids", () => {
  const track = ROADMAP_TRACKS.find((item) => item.id === "college-list");
  assert.ok(track);
  const empty = trackProgress(track, {});
  assert.equal(empty.done, 0);
  assert.equal(empty.percent, 0);
  const partial = trackProgress(track, { "p1-5": true, "p2-4": true });
  assert.equal(partial.done, 2);
  assert.equal(partial.total, 5);
  assert.equal(partial.percent, 40);
});

test("roadmap covers the reference workstreams plus checklist spans", () => {
  const ids = ROADMAP_TRACKS.map((track) => track.id);
  assert.ok(ids.includes("college-list"));
  assert.ok(ids.includes("visits"));
  assert.ok(ids.includes("recs"));
  assert.ok(ids.includes("passion"));
  assert.ok(ids.includes("essays"));
  assert.ok(ids.includes("testing"));
  assert.ok(ids.includes("money"));
  assert.ok(ids.includes("applications"));
});
