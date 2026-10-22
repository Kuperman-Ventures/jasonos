import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchCalendarGroup } from "./groups.ts";

describe("matchCalendarGroup", () => {
  it("matches Family", () => {
    assert.equal(matchCalendarGroup("Family")?.id, "family");
    assert.equal(matchCalendarGroup("Kuperman Family")?.id, "family");
  });

  it("matches Kat & Jason before Family", () => {
    assert.equal(matchCalendarGroup("Kat & Jason")?.id, "kat_jason");
    assert.equal(matchCalendarGroup("Jason and Kat")?.id, "kat_jason");
  });

  it("matches Kyle and Wyatt specifically", () => {
    assert.equal(matchCalendarGroup("Kyle, Kat & Jason")?.id, "kyle_kat_jason");
    assert.equal(matchCalendarGroup("Wyatt, Kat & Jason")?.id, "wyatt_kat_jason");
    assert.equal(matchCalendarGroup("Kyle")?.id, "kyle_kat_jason");
  });

  it("returns null for unrelated calendars", () => {
    assert.equal(matchCalendarGroup("Work"), null);
    assert.equal(matchCalendarGroup("Holidays in United States"), null);
  });
});
