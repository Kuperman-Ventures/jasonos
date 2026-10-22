import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchCalendarGroup,
  normalizeCalendarName,
  pickBestCalendarForGroup,
  familyCalendarGroup,
} from "./groups.ts";

describe("matchCalendarGroup", () => {
  it("matches live iCloud display names", () => {
    assert.equal(matchCalendarGroup("Family ⚠️")?.id, "family");
    assert.equal(matchCalendarGroup("Kuperman Family")?.id, "family");
    assert.equal(matchCalendarGroup("KAT and JASON")?.id, "kat_jason");
    assert.equal(matchCalendarGroup("KYLE")?.id, "kyle_kat_jason");
    assert.equal(matchCalendarGroup("WYATT")?.id, "wyatt_kat_jason");
  });

  it("prefers exact Family over Kuperman Family", () => {
    const group = familyCalendarGroup("family");
    const picked = pickBestCalendarForGroup(group, [
      { name: "Kuperman Family", href: "/a/" },
      { name: "Family ⚠️", href: "/b/" },
    ]);
    assert.equal(picked?.href, "/b/");
  });

  it("returns null for unrelated calendars", () => {
    assert.equal(matchCalendarGroup("Work"), null);
    assert.equal(matchCalendarGroup("Dad & The Boys"), null);
    assert.equal(matchCalendarGroup("Eventbrite"), null);
  });

  it("strips emoji for matching", () => {
    assert.equal(normalizeCalendarName("Family ⚠️"), "Family");
  });
});
