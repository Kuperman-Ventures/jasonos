import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discernEventIcon } from "./icons.ts";

describe("discernEventIcon", () => {
  it("maps obvious titles", () => {
    assert.equal(discernEventIcon("Train to Grand Central"), "train");
    assert.equal(discernEventIcon("Lucien’s Birthday"), "cake");
    assert.equal(discernEventIcon("Dad Vacuums 1st & 2nd Floor"), "vacuum");
    assert.equal(discernEventIcon("Composting pick-up"), "recycle");
    assert.equal(discernEventIcon("Kuperman Family Playlist (1 Song!)"), "music");
    assert.equal(discernEventIcon("Change cats water"), "cat");
    assert.equal(discernEventIcon("Soccer practice"), "sport");
    assert.equal(discernEventIcon("Flight to Chicago"), "plane");
  });

  it("falls back when nothing matches", () => {
    assert.equal(discernEventIcon("Mystery hang"), "star");
  });
});
