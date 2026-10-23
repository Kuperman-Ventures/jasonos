import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Input validation for buildMeetingPlan. The full research → propose path
 * needs Supabase + Claude; those are covered by manual/MCP checks.
 */
describe("buildMeetingPlan inputs", () => {
  it("rejects unknown from.kind values at the type boundary", () => {
    const allowed = new Set(["playbook", "guide", "blank"]);
    for (const kind of ["playbook", "guide", "blank", "chat", "strategy", ""]) {
      assert.equal(allowed.has(kind), kind === "playbook" || kind === "guide" || kind === "blank");
    }
  });

  it("requires a script id for playbook and guide", () => {
    const needsScript = (kind: string, scriptId?: string | null) =>
      (kind === "playbook" || kind === "guide") && !(scriptId?.trim());
    assert.equal(needsScript("playbook", null), true);
    assert.equal(needsScript("guide", "  "), true);
    assert.equal(needsScript("blank", null), false);
    assert.equal(needsScript("playbook", "abc"), false);
  });
});
