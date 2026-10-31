import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyScoreRules, classifyCandidates } from "./score.ts";

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
    assert.equal(scored.why, "They hire CMOs");
    assert.equal(scored.ask, null);
  });

  it("keeps why on Tier 1 and Tier 2, ask only on Tier 1", () => {
    const tier1 = applyScoreRules({
      linkedinDegree: "2nd",
      bucket: "recruiter",
      tier: "tier1",
      title: "Partner",
      company: "Search Co",
      why: "Runs marketing searches",
      ask: "Ask if they are staffing a CMO seat",
      nextAction: null,
    });
    assert.equal(tier1.tier, "tier1");
    assert.equal(tier1.why, "Runs marketing searches");
    assert.equal(tier1.ask, "Ask if they are staffing a CMO seat");

    const tier2 = applyScoreRules({
      linkedinDegree: "2nd",
      bucket: "industry_peer",
      tier: "tier2",
      title: "CMO",
      company: "Big Co",
      why: "Marketing leader worth knowing",
      ask: "Should drop",
      nextAction: null,
    });
    assert.equal(tier2.tier, "tier2");
    assert.equal(tier2.why, "Marketing leader worth knowing");
    assert.equal(tier2.ask, null);
  });
});

describe("classifyCandidates", () => {
  const people = [
    { id: "a", linkedinDegree: "2nd" },
    { id: "b", linkedinDegree: "1st" },
    { id: "c", linkedinDegree: "2nd" },
    { id: "d", linkedinDegree: "3rd" },
    { id: "e", linkedinDegree: "2nd" },
    { id: "f", linkedinDegree: "2nd" },
  ];

  it("caps tier1 at three and demotes the rest to tier2", () => {
    const classified = classifyCandidates(people, [
      { id: "a", lane: "job_search", tier: "tier1", bucket: "hiring_path", title: "CEO", company: "Acme", why: "Hires the marketing seat", ask: "Ask for an intro" },
      { id: "c", lane: "job_search", tier: "tier1", bucket: "recruiter", title: "Partner", company: "Search", why: "Recruits CMOs", ask: "Ask if a search is open" },
      { id: "d", lane: "advisors", tier: "tier1", bucket: "prospect", title: "Founder", company: "Startup", why: "Series A SaaS founder", ask: "Ask for a diagnostic intro" },
      { id: "e", lane: "job_search", tier: "tier1", bucket: "hiring_path", title: "CRO", company: "Gamma", why: "Fourth name", ask: "Should become bench" },
      { id: "f", lane: "industry", tier: "tier2", bucket: "industry_peer", title: "CMO", company: "Big", why: "Worth knowing", ask: null },
    ]);
    const byId = Object.fromEntries(classified.map((person) => [person.id, person]));
    assert.equal(byId.a?.tier, "tier1");
    assert.equal(byId.c?.tier, "tier1");
    assert.equal(byId.d?.tier, "tier1");
    assert.equal(byId.e?.tier, "tier2");
    assert.equal(byId.e?.ask, null);
    assert.equal(byId.e?.why, "Fourth name");
    assert.equal(byId.f?.lane, "industry");
    assert.equal(classified.filter((person) => person.tier === "tier1").length, 3);
  });

  it("forces lane none to tier none", () => {
    const classified = classifyCandidates(people, [
      { id: "a", lane: "none", tier: "tier1", bucket: "hiring_path", title: "CEO", company: "Acme", why: "Nope", ask: "Nope" },
    ]);
    const row = classified.find((person) => person.id === "a");
    assert.equal(row?.lane, "none");
    assert.equal(row?.tier, "none");
    assert.equal(row?.bucket, "not_relevant");
    assert.equal(row?.why, null);
    assert.equal(row?.ask, null);
  });

  it("forces 1st degree to tier2 with reactivate", () => {
    const classified = classifyCandidates(people, [
      { id: "b", lane: "job_search", tier: "tier1", bucket: "hiring_path", title: "CEO", company: "Known", why: "Already connected", ask: "Skip" },
    ]);
    const row = classified.find((person) => person.id === "b");
    assert.equal(row?.tier, "tier2");
    assert.equal(row?.nextAction, "Reactivate directly");
    assert.equal(row?.why, "Already connected");
    assert.equal(row?.ask, null);
  });

  it("marks skipped people as lane none", () => {
    const classified = classifyCandidates(people, [
      { id: "a", lane: "job_search", tier: "tier1", bucket: "hiring_path", title: "CEO", company: "Acme", why: "Hires the marketing seat", ask: "Ask for an intro" },
    ]);
    assert.equal(classified.length, people.length);
    const skipped = classified.find((person) => person.id === "c");
    assert.equal(skipped?.lane, "none");
    assert.equal(skipped?.tier, "none");
    assert.equal(skipped?.bucket, "not_relevant");
  });

  it("demotes a tier1 pick that has no reason", () => {
    const classified = classifyCandidates(people, [
      { id: "a", lane: "job_search", tier: "tier1", bucket: "hiring_path", title: "CEO", company: "Acme", why: "  ", ask: "Ask" },
      { id: "c", lane: "job_search", tier: "tier1", bucket: "recruiter", title: "Partner", company: "Search", why: "Recruits CMOs", ask: "Ask if a search is open" },
    ]);
    const byId = Object.fromEntries(classified.map((person) => [person.id, person]));
    assert.equal(byId.a?.tier, "tier2");
    assert.equal(byId.a?.ask, null);
    assert.equal(byId.c?.tier, "tier1");
  });
});
