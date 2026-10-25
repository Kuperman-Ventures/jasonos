import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyScoreRules } from "./score.ts";

describe("applyScoreRules", () => {
  it("keeps a 1st-degree connection off Tier 1", () => {
    const scored = applyScoreRules({
      linkedinDegree: "1st",
      bucket: "hiring_path",
      tier: "tier1",
      title: "CEO",
      company: "Acme",
      why: "They hire CMOs",
      ask: "Intro to the CEO",
      nextAction: "Ask for the intro",
    });
    assert.equal(scored.tier, "tier2");
    assert.equal(scored.nextAction, "Reactivate directly");
    assert.equal(scored.why, null);
    assert.equal(scored.ask, null);
  });

  it("keeps why and ask only on Tier 1", () => {
    const scored = applyScoreRules({
      linkedinDegree: "2nd",
      bucket: "recruiter",
      tier: "tier1",
      title: "Partner",
      company: "Search Co",
      why: "Runs marketing searches",
      ask: "Ask if they are staffing a CMO seat",
      nextAction: null,
    });
    assert.equal(scored.tier, "tier1");
    assert.equal(scored.why, "Runs marketing searches");
    assert.equal(scored.ask, "Ask if they are staffing a CMO seat");
  });
});
