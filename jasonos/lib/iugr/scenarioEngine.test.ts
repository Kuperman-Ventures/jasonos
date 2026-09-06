import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allScenarioCombinations,
  evaluateScenario,
  type ScenarioAssumptions,
  type ScenarioReadingId,
} from "./scenarioEngine.ts";

function expectedReading(a: ScenarioAssumptions): ScenarioReadingId {
  if (a.consciousness === "no") return "count-breaks";
  if (a.consciousness === "unknown") {
    if (a.civilizations === "rarely" || a.history === "almost-never") {
      return "copies-stay-rare";
    }
    return "will-not-settle";
  }
  if (a.civilizations === "often" && a.history === "constantly") {
    return "copies-win";
  }
  if (a.civilizations === "rarely" || a.history === "almost-never") {
    return "copies-stay-rare";
  }
  return "will-not-settle";
}

describe("IUGR three-dial scenario engine", () => {
  it("resolves all 27 combinations to the approved table", () => {
    const combos = allScenarioCombinations();
    assert.equal(combos.length, 27);

    for (const assumptions of combos) {
      const result = evaluateScenario(assumptions);
      const expected = expectedReading(assumptions);
      assert.equal(
        result.readingId,
        expected,
        `Failed for ${JSON.stringify(assumptions)}`,
      );
      assert.equal(result.category, expected);
      assert.ok(result.label.length > 0);
      assert.ok(result.explanation.length > 0);
      assert.ok(result.whatDidTheWork.length > 0);
    }
  });

  it("never returns a percentage, probability, or simulation verdict about the reader", () => {
    for (const assumptions of allScenarioCombinations()) {
      const result = evaluateScenario(assumptions);
      const blob = [
        result.label,
        result.explanation,
        ...result.whatDidTheWork,
      ].join(" ");

      assert.doesNotMatch(
        blob,
        /\d\s*%/,
        `Percent found for ${JSON.stringify(assumptions)}: ${blob}`,
      );
      assert.doesNotMatch(
        blob,
        /\b(probability|odds|percent|confidence score)\b/i,
      );
      assert.doesNotMatch(
        blob,
        /\byou are (likely|probably|not )?simulated\b/i,
      );
      assert.doesNotMatch(blob, /\bwe are (likely|probably) simulated\b/i);
    }
  });

  it("maps mind=No to count-breaks regardless of other dials", () => {
    const result = evaluateScenario({
      civilizations: "often",
      history: "constantly",
      consciousness: "no",
    });
    assert.equal(result.readingId, "count-breaks");
  });

  it("maps mind=Yes + Often + Constantly to copies-win", () => {
    const result = evaluateScenario({
      civilizations: "often",
      history: "constantly",
      consciousness: "yes",
    });
    assert.equal(result.readingId, "copies-win");
  });
});
