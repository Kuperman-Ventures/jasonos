import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idleMotionForIndex, MOTION } from "./motion.ts";

describe("idleMotionForIndex", () => {
  it("is deterministic for the same index", () => {
    const a = idleMotionForIndex(3);
    const b = idleMotionForIndex(3);
    assert.deepEqual(a, b);
  });

  it("keeps duration inside the idle band and varies by index", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      const motion = idleMotionForIndex(i);
      assert.ok(motion.durationMs >= MOTION.idle.durationMs.min);
      assert.ok(motion.durationMs <= MOTION.idle.durationMs.max);
      assert.ok(motion.delayMs >= 0);
      seen.add(`${motion.durationMs}:${motion.delayMs}`);
    }
    assert.equal(seen.size, 10);
  });
});
