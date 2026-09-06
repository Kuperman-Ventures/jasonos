import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SCENARIO_ASSUMPTIONS,
  evaluateScenario,
  type ScenarioAssumptions,
} from "./scenarioEngine.ts";

function base(overrides: Partial<ScenarioAssumptions> = {}): ScenarioAssumptions {
  return { ...DEFAULT_SCENARIO_ASSUMPTIONS, ...overrides };
}

describe("IUGR Assumption Arcade scenario engine", () => {
  it("defaults to too-uncertain-to-count when consciousness is unknown", () => {
    const result = evaluateScenario(DEFAULT_SCENARIO_ASSUMPTIONS);
    assert.equal(result.category, "too-uncertain-to-count");
    assert.match(result.explanation, /unknown/i);
    assert.doesNotMatch(
      `${result.label} ${result.explanation}`,
      /\d+\s*%|probability|odds|you are (likely|probably)|you are simulated/i,
    );
  });

  it("returns observer-count-breaks when consciousness is No, regardless of scale", () => {
    const result = evaluateScenario(
      base({
        consciousness: "no",
        civilizations: "often",
        compute: "absurdly-huge",
        history: "constantly",
        detail: "full-worlds",
      }),
    );
    assert.equal(result.category, "observer-count-breaks");
    assert.match(result.explanation, /inner experience/i);
  });

  it("keeps copies rare for clearly low-scale configurations", () => {
    assert.equal(
      evaluateScenario(base({ consciousness: "yes", civilizations: "rarely" }))
        .category,
      "copies-stay-rare",
    );
    assert.equal(
      evaluateScenario(
        base({ consciousness: "yes", compute: "tiny", civilizations: "often" }),
      ).category,
      "copies-stay-rare",
    );
    assert.equal(
      evaluateScenario(
        base({
          consciousness: "yes",
          history: "almost-never",
          civilizations: "often",
        }),
      ).category,
      "copies-stay-rare",
    );
  });

  it("allows copies-could-outnumber only for the strongest high-scale configuration", () => {
    const strong = evaluateScenario({
      civilizations: "often",
      consciousness: "yes",
      compute: "absurdly-huge",
      history: "constantly",
      detail: "full-worlds",
    });
    assert.equal(strong.category, "copies-could-outnumber");
    assert.match(strong.explanation, /could outnumber/);
    assert.doesNotMatch(
      strong.explanation,
      /are more likely|you are likely|we are probably/i,
    );

    const almost = evaluateScenario({
      civilizations: "often",
      consciousness: "yes",
      compute: "huge",
      history: "sometimes",
      detail: "full-worlds",
    });
    assert.notEqual(almost.category, "copies-could-outnumber");
  });

  it("treats consciousness Unknown + low scale as copies-stay-rare", () => {
    const result = evaluateScenario(
      base({ consciousness: "unknown", civilizations: "rarely" }),
    );
    assert.equal(result.category, "copies-stay-rare");
  });
});
