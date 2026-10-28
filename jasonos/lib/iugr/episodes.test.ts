import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIVE_ENTRIES, otherLiveEntries } from "./episodes.ts";

describe("IUGR live entries", () => {
  it("lists Dark Matter Travel Tracker as the second live experience", () => {
    assert.equal(LIVE_ENTRIES[0]?.href, "/iugr");
    assert.equal(LIVE_ENTRIES[1]?.id, "dark-matter-travel-tracker");
    assert.equal(LIVE_ENTRIES[1]?.entryNumber, 2);
    assert.equal(LIVE_ENTRIES[1]?.href, "/iugr/dark-matter");
    assert.equal(LIVE_ENTRIES[1]?.statusLabel, "Live");
  });

  it("omits the current entry from the other-live list", () => {
    const others = otherLiveEntries("dark-matter-travel-tracker");
    assert.equal(others.length, 1);
    assert.equal(others[0]?.id, "are-you-an-original");
  });
});
