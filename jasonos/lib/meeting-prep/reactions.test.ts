import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REACTION_SHAPES, parseReactions, type Reaction } from "./reactions.ts";

function six(overrides?: Partial<Record<Reaction["shape"], Partial<Reaction>>>): Reaction[] {
  return REACTION_SHAPES.map((shape) => ({
    shape,
    soundsLike: `  They ${shape}.  `,
    pivot: `  Back to the point on ${shape}.  `,
    ...overrides?.[shape],
  }));
}

describe("parseReactions", () => {
  it("trims fields and returns one row per shape", () => {
    const parsed = parseReactions(JSON.stringify(six()));
    assert.ok(parsed);
    assert.equal(parsed!.length, 6);
    assert.deepEqual(
      parsed!.map((item) => item.shape),
      [...REACTION_SHAPES]
    );
    assert.equal(parsed![0].soundsLike, "They agree.");
    assert.equal(parsed![0].pivot, "Back to the point on agree.");
  });

  it("rejects fewer than six", () => {
    assert.equal(parseReactions(JSON.stringify(six().slice(0, 5))), null);
  });

  it("rejects an unknown shape", () => {
    const rows = six();
    rows[2] = { ...rows[2], shape: "maybe" as Reaction["shape"] };
    assert.equal(parseReactions(JSON.stringify(rows)), null);
  });
});
