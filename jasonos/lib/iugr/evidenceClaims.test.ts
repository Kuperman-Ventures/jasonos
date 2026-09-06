import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EVIDENCE_CLAIM_IDS,
  allClaimsClassified,
  isCorrectClassification,
} from "./evidenceClaims.ts";
import { CATCH_CAVEAT_IDS } from "./theCatch.ts";

describe("evidenceClaims classification helpers", () => {
  it("starts incomplete with no classifications", () => {
    assert.equal(allClaimsClassified({}), false);
  });

  it("knows the correct class for speed-of-light claim", () => {
    assert.equal(
      isCorrectClassification("light-speed", "interesting-not-proof"),
      true,
    );
    assert.equal(isCorrectClassification("light-speed", "evidence"), false);
  });

  it("completes only when every claim is classified", () => {
    const classified: Partial<
      Record<(typeof EVIDENCE_CLAIM_IDS)[number], "assumption">
    > = {};
    for (const id of EVIDENCE_CLAIM_IDS) {
      classified[id] = "assumption";
    }
    assert.equal(allClaimsClassified(classified), true);
    assert.equal(EVIDENCE_CLAIM_IDS.length, 7);
  });
});

describe("theCatch caveats", () => {
  it("includes the core caveat set plus the next question", () => {
    assert.ok(CATCH_CAVEAT_IDS.includes("consciousness"));
    assert.ok(CATCH_CAVEAT_IDS.includes("next-question"));
    assert.equal(CATCH_CAVEAT_IDS.length, 7);
  });
});
