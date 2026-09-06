import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeTownScenario,
  formatSharePercent,
  formatWholeNumber,
  narrationForCopies,
  PEOPLE_PER_TOWN,
  simplifiedCopiedShare,
} from "./scenarioMath.ts";

describe("IUGR scenario math", () => {
  it("keeps every resident in Original Town at 0 copies", () => {
    const census = computeTownScenario(0);
    assert.equal(census.copiedTowns, 0);
    assert.equal(census.originalResidents, PEOPLE_PER_TOWN);
    assert.equal(census.copiedResidents, 0);
    assert.equal(census.totalResidents, 100);
    assert.equal(census.copiedShare, 0);
    assert.equal(simplifiedCopiedShare(0), 0);
    assert.match(narrationForCopies(0).headline, /Original Town/);
  });

  it("splits residents evenly at 1 copy", () => {
    const census = computeTownScenario(1);
    assert.equal(census.totalTowns, 2);
    assert.equal(census.copiedResidents, 100);
    assert.equal(census.totalResidents, 200);
    assert.equal(census.copiedShare, 0.5);
    assert.equal(simplifiedCopiedShare(1), 0.5);
    assert.match(narrationForCopies(1).detail, /1 out of 2/);
  });

  it("shows nine-of-ten intuition at 9 copies", () => {
    const census = computeTownScenario(9);
    assert.equal(census.totalTowns, 10);
    assert.equal(census.copiedResidents, 900);
    assert.equal(census.totalResidents, 1000);
    assert.equal(census.copiedShare, 0.9);
    assert.equal(simplifiedCopiedShare(9), 0.9);
    assert.match(narrationForCopies(9).detail, /9 out of 10/);
  });

  it("shows ninety-nine-of-one-hundred intuition at 99 copies", () => {
    const census = computeTownScenario(99);
    assert.equal(census.totalTowns, 100);
    assert.equal(census.copiedResidents, 9900);
    assert.equal(census.totalResidents, 10000);
    assert.equal(census.copiedShare, 0.99);
    assert.match(narrationForCopies(99).detail, /99 out of 100/);
  });

  it("shows 999-of-1000 intuition at 999 copies", () => {
    const census = computeTownScenario(999);
    assert.equal(census.totalTowns, 1000);
    assert.equal(census.copiedResidents, 99900);
    assert.equal(census.totalResidents, 100000);
    assert.equal(census.copiedShare, 0.999);
    assert.equal(simplifiedCopiedShare(999), 999 / 1000);
    assert.match(narrationForCopies(999).detail, /999 out of 1,000/);
  });

  it("guards invalid inputs and formats numbers for humans", () => {
    assert.equal(computeTownScenario(-4).copiedTowns, 0);
    assert.equal(computeTownScenario(Number.NaN).copiedTowns, 0);
    assert.equal(computeTownScenario(5000).copiedTowns, 999);
    assert.equal(formatWholeNumber(1000), "1,000");
    assert.equal(formatSharePercent(0.9), "90%");
    assert.equal(formatSharePercent(0.999), "99.9%");
  });
});
