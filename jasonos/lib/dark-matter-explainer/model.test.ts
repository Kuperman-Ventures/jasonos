import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildExplainerView, parseToken, seasonData } from "./model.ts";

describe("parseToken", () => {
  it("names versions, variants, and World X", () => {
    assert.equal(parseToken("J1").name, "Jason 1");
    assert.equal(parseToken("D*").name, "Daniela (variant)");
    assert.equal(parseToken("AX").name, "Amanda (World X)");
    assert.equal(parseToken("J13").name, "Jason 13");
    assert.equal(parseToken("J1").ring, "#19c3f0");
  });
});

describe("buildExplainerView", () => {
  it("starts season 1 on the last story step with every world visible", () => {
    const view = buildExplainerView({ season: 1, step: 99, trace: "all", selectedWorld: null });
    assert.equal(view.maxStep, 6);
    assert.equal(view.step, 6);
    assert.equal(view.worlds.length, 8);
    assert.ok(view.worlds.every((world) => world.visible));
    assert.equal(view.selected.title, "AMANDA STAYS");
  });

  it("hides later season 1 worlds until their step", () => {
    const view = buildExplainerView({ season: 1, step: 0, trace: "all", selectedWorld: null });
    assert.deepEqual(
      view.worlds.filter((world) => world.visible).map((world) => world.title),
      ["HOME REALITY", "VELOCITY REALITY"],
    );
    assert.equal(view.selected.title, "VELOCITY REALITY");
    assert.equal(view.caption.includes("Jason 2 abducts Jason 1"), true);
  });

  it("joins a dashed Jason 1 segment into pandemic world", () => {
    const view = buildExplainerView({ season: 1, step: 6, trace: "all", selectedWorld: null });
    const pandemic = view.worlds[4];
    const jason1 = pandemic?.cells[0];
    assert.equal(jason1?.hasStop, true);
    assert.equal(jason1?.note, "Blair 2 in insect world; stops grouped");
    assert.equal(jason1?.left.includes("repeating-linear-gradient"), true);
  });

  it("draws Amanda 2 dashed lead-in on the season 2 reunion", () => {
    const view = buildExplainerView({ season: 2, step: 5, trace: "all", selectedWorld: null });
    const reunion = view.worlds[5];
    const amanda = reunion?.cells.find((cell) => cell.note === "A2 + R1 return");
    assert.equal(amanda?.hasStop, true);
    assert.equal(amanda?.left.includes("repeating-linear-gradient"), true);
  });

  it("dims untraced lanes", () => {
    const view = buildExplainerView({ season: 1, step: 6, trace: "j1", selectedWorld: null });
    const jason = view.lanes.find((lane) => lane.colorKey === "j1");
    const amanda = view.lanes.find((lane) => lane.colorKey === "a");
    assert.equal(jason?.active, true);
    assert.equal(amanda?.active, false);
    assert.equal(view.worlds[0]?.cells[0]?.opacity, 1);
    assert.equal(view.worlds[0]?.cells[2]?.opacity, 0.14);
  });

  it("keeps season 2 family as two white lanes", () => {
    const lanes = seasonData(2).lanes.filter((lane) => lane.colorKey === "f");
    assert.equal(lanes.length, 2);
    assert.equal(lanes[0]?.label, "Daniela 1");
    assert.equal(lanes[1]?.label, "Charlie 1");
  });
});
