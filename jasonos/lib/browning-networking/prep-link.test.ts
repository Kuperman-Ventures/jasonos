import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BROWNING_FIRST_CALL,
  BROWNING_SECOND_CALL,
  chooseBrowningStrategyName,
  shouldSkipPlanBuild,
} from "./prep-choice.ts";

describe("chooseBrowningStrategyName", () => {
  it("picks first call when no prior held meeting", () => {
    assert.equal(chooseBrowningStrategyName(false), BROWNING_FIRST_CALL);
  });

  it("picks second call when a prior held meeting exists", () => {
    assert.equal(chooseBrowningStrategyName(true), BROWNING_SECOND_CALL);
  });
});

describe("shouldSkipPlanBuild", () => {
  it("skips when plan_built_at is set", () => {
    assert.equal(shouldSkipPlanBuild({ planBuiltAt: "2026-10-20T12:00:00Z" }), true);
  });

  it("builds when plan_built_at is unset", () => {
    assert.equal(shouldSkipPlanBuild({ planBuiltAt: null }), false);
  });

  it("rebuilds when force is true even if plan_built_at is set", () => {
    assert.equal(
      shouldSkipPlanBuild({
        planBuiltAt: "2026-10-20T12:00:00Z",
        force: true,
      }),
      false
    );
  });
});
