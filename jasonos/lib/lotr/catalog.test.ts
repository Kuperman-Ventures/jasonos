import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGIONS } from "./regions.ts";
import { LOCATIONS } from "./locations.ts";
import {
  COASTLINE,
  FORESTS,
  GEOGRAPHY,
  MOUNTAINS,
  NUMENOR,
  RIVERS,
  LAKES,
} from "./geography.ts";
import {
  TALE_AGE,
  TALE_ORDER,
  wordCount,
  type Tale,
} from "./types.ts";

const VIEW_W = 1000;
const VIEW_H = 760;
const TALE_SET = new Set<Tale>(TALE_ORDER);

function pathPointCount(path: string): number {
  const nums = path.match(/-?\d+(\.\d+)?/g) ?? [];
  return Math.floor(nums.length / 2);
}

function parseViewBox(viewBox: string): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  return { x, y, w, h };
}

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

  it("places every location inside its region's viewBox", () => {
    for (const location of LOCATIONS) {
      const region = REGIONS.find((item) => item.id === location.regionId);
      assert.ok(region, location.regionId);
      const box = parseViewBox(region!.viewBox);
      assert.ok(
        location.x >= box.x && location.x <= box.x + box.w,
        `${location.id} x outside region viewBox`
      );
      assert.ok(
        location.y >= box.y && location.y <= box.y + box.h,
        `${location.id} y outside region viewBox`
      );
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

describe("lotr geography", () => {
  it("exports non-empty SVG paths that start with M", () => {
    const paths = [
      COASTLINE,
      NUMENOR,
      ...Object.values(MOUNTAINS),
      ...Object.values(RIVERS),
      ...Object.values(FORESTS),
      ...Object.values(LAKES),
    ];
    for (const path of paths) {
      assert.equal(typeof path, "string");
      assert.ok(path.trim().length > 0);
      assert.equal(path.trim()[0], "M");
    }
    assert.ok(GEOGRAPHY.coastline.startsWith("M"));
  });

  it("draws a coastline with at least 60 points", () => {
    assert.ok(pathPointCount(COASTLINE) >= 60, String(pathPointCount(COASTLINE)));
  });

  it("names all seven mountain ranges, seven rivers and four forests", () => {
    assert.deepEqual(Object.keys(MOUNTAINS).sort(), [
      "blueMountains",
      "ephelDuath",
      "eredLithui",
      "greyMountains",
      "ironHills",
      "mistyMountains",
      "whiteMountains",
    ]);
    assert.deepEqual(Object.keys(RIVERS).sort(), [
      "anduin",
      "brandywine",
      "celduin",
      "entwash",
      "greyflood",
      "isen",
      "lhun",
    ]);
    assert.deepEqual(Object.keys(FORESTS).sort(), [
      "fangorn",
      "lothlorien",
      "mirkwood",
      "oldForest",
    ]);
  });
});
