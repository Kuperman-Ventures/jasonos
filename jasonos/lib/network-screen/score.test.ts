import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyScoreRules, selectIntroRecommendations } from "./score.ts";

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

describe("selectIntroRecommendations", () => {
  const people = [
    { id: "a", linkedinDegree: "2nd" },
    { id: "b", linkedinDegree: "1st" },
    { id: "c", linkedinDegree: "2nd" },
    { id: "d", linkedinDegree: "3rd" },
    { id: "e", linkedinDegree: "2nd" },
  ];

  it("keeps three intro targets and skips someone Jason already knows", () => {
    const chosen = selectIntroRecommendations(people, [
      { id: "b", bucket: "hiring_path", title: "CEO", company: "Known", why: "Already connected", ask: "Skip" },
      { id: "a", bucket: "hiring_path", title: "CEO", company: "Acme", why: "Hires the marketing seat", ask: "Ask for an intro" },
      { id: "c", bucket: "recruiter", title: "Partner", company: "Search", why: "Recruits CMOs", ask: "Ask if a search is open" },
      { id: "d", bucket: "peer_referral", title: "CMO", company: "Beta", why: "Sits in the seat Jason wants", ask: "Ask for a point of view" },
      { id: "e", bucket: "hiring_path", title: "Founder", company: "Gamma", why: "Fourth name", ask: "Should not be kept" },
    ]);
    assert.deepEqual(chosen.map((person) => person.id), ["a", "c", "d"]);
    assert.equal(chosen[0]?.why, "Hires the marketing seat");
  });

  it("drops a pick that has no reason", () => {
    const chosen = selectIntroRecommendations(people, [
      { id: "a", bucket: "hiring_path", title: "CEO", company: "Acme", why: "  ", ask: "Ask" },
      { id: "c", bucket: "recruiter", title: "Partner", company: "Search", why: "Recruits CMOs", ask: "Ask if a search is open" },
    ]);
    assert.deepEqual(chosen.map((person) => person.id), ["c"]);
  });
});
