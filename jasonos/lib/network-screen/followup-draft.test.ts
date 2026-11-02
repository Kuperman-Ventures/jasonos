import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INTRO_FOLLOWUP_RULES } from "./strategy.ts";

describe("INTRO_FOLLOWUP_RULES", () => {
  it("keeps the follow-up aimed at the introduced person", () => {
    assert.match(INTRO_FOLLOWUP_RULES, /FROM Jason TO the person/);
    assert.match(INTRO_FOLLOWUP_RULES, /connector already made the introduction/i);
    assert.match(INTRO_FOLLOWUP_RULES, /Ask for a short call/);
    assert.doesNotMatch(INTRO_FOLLOWUP_RULES, /Ask for an introduction to each/);
  });
});
