import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EVIDENCE_CLAIM_IDS,
  EVIDENCE_CLAIMS,
  allClaimsClassified,
  isCorrectClassification,
} from "./evidenceClaims.ts";

describe("evidenceClaims classification helpers", () => {
  it("starts incomplete with no classifications", () => {
    assert.equal(allClaimsClassified({}), false);
  });

  it("knows the correct class for Matrix claim", () => {
    assert.equal(
      isCorrectClassification("matrix", "interesting-not-proof"),
      true,
    );
    assert.equal(isCorrectClassification("matrix", "evidence"), false);
  });

  it("ships the five party claims from the script", () => {
    assert.equal(EVIDENCE_CLAIM_IDS.length, 5);
    assert.equal(EVIDENCE_CLAIMS.length, 5);
    assert.ok(EVIDENCE_CLAIMS.some((c) => c.id === "matrix"));
    assert.ok(EVIDENCE_CLAIMS.some((c) => c.id === "nothing-matters"));
  });

  it("completes only when every claim is classified", () => {
    const classified: Partial<
      Record<(typeof EVIDENCE_CLAIM_IDS)[number], "assumption">
    > = {};
    for (const id of EVIDENCE_CLAIM_IDS) {
      classified[id] = "assumption";
    }
    assert.equal(allClaimsClassified(classified), true);
  });
});
