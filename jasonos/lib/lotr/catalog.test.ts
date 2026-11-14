import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGIONS } from "./regions.ts";
import { LOCATIONS } from "./locations.ts";
import {
  TALE_AGE,
  TALE_ORDER,
  wordCount,
  type Tale,
} from "./types.ts";

const VIEW_W = 1000;
const VIEW_H = 760;
const TALE_SET = new Set<Tale>(TALE_ORDER);

describe("lotr catalog", () => {
  it("keeps location ids unique", () => {
    const ids = LOCATIONS.map((location) => location.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("places every location in a known region inside the viewBox", () => {
    const regionIds = new Set(REGIONS.map((region) => region.id));
    for (const location of LOCATIONS) {
      assert.ok(regionIds.has(location.regionId), `${location.id} region`);
      assert.ok(location.x >= 0 && location.x <= VIEW_W, `${location.id} x`);
      assert.ok(location.y >= 0 && location.y <= VIEW_H, `${location.id} y`);
    }
  });

  it("gives every region at least one location", () => {
    for (const region of REGIONS) {
      const count = LOCATIONS.filter((location) => location.regionId === region.id).length;
      assert.ok(count > 0, `${region.id} empty`);
    }
  });

  it("requires scene title, text, source and a short text length", () => {
    for (const location of LOCATIONS) {
      assert.ok(location.scenes.length > 0, `${location.id} has no scenes`);
      for (const scene of location.scenes) {
        assert.ok(scene.title.trim(), `${location.id} empty title`);
        assert.ok(scene.text.trim(), `${location.id} empty text`);
        assert.ok(scene.source.trim(), `${location.id} empty source`);
        assert.ok(wordCount(scene.text) <= 40, `${location.id} ${scene.title} too long`);
      }
    }
  });

  it("keeps every scene tale in the Tale type", () => {
    for (const location of LOCATIONS) {
      for (const scene of location.scenes) {
        assert.ok(TALE_SET.has(scene.tale), `${location.id} bad tale ${scene.tale}`);
      }
    }
  });

  it("matches each scene's tale to an age the location names", () => {
    for (const location of LOCATIONS) {
      for (const scene of location.scenes) {
        const age = TALE_AGE[scene.tale];
        assert.ok(
          location.names[age],
          `${location.id} scene ${scene.title} needs ${age} name`
        );
      }
    }
  });
});
