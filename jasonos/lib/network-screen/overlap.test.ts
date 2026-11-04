import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOverlapOnlyImport } from "./overlap.ts";

describe("isOverlapOnlyImport", () => {
  it("marks null total_count_label as overlap only", () => {
    assert.equal(
      isOverlapOnlyImport({ totalCountLabel: null, degrees: ["2nd", "3rd"] }),
      true
    );
  });

  it("marks an all-1st-degree list as overlap only", () => {
    assert.equal(
      isOverlapOnlyImport({ totalCountLabel: "500+", degrees: ["1st", "1st"] }),
      true
    );
  });

  it("keeps mixed-degree captures with a total label as normal", () => {
    assert.equal(
      isOverlapOnlyImport({ totalCountLabel: "500+", degrees: ["1st", "2nd"] }),
      false
    );
  });
});
