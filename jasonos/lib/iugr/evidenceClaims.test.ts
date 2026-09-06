import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EVIDENCE_CLAIM_IDS,
  allClaimsScanned,
  markClaimScanned,
} from "./evidenceClaims";

describe("evidenceClaims helpers", () => {
  it("starts incomplete with no scans", () => {
    assert.equal(allClaimsScanned([]), false);
  });

  it("marks a claim scanned without duplicates", () => {
    const once = markClaimScanned([], "glitches");
    assert.deepEqual(once, ["glitches"]);
    assert.deepEqual(markClaimScanned(once, "glitches"), ["glitches"]);
  });

  it("completes only when every claim is scanned", () => {
    let scanned = markClaimScanned([], "glitches");
    assert.equal(allClaimsScanned(scanned), false);

    for (const id of EVIDENCE_CLAIM_IDS) {
      scanned = markClaimScanned(scanned, id);
    }

    assert.equal(scanned.length, EVIDENCE_CLAIM_IDS.length);
    assert.equal(allClaimsScanned(scanned), true);
  });
});
