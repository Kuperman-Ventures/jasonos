import assert from "node:assert/strict";
import test from "node:test";
import { INTEREST_PICKER_LEVELS } from "../components/InterestPicker";
import { INTEREST_LEVELS, interestLabel } from "./types";

test("interest picker levels run low to high with reference labels", () => {
  assert.deepEqual(
    INTEREST_PICKER_LEVELS.map((level) => level.key),
    ["safety", "moderate", "high", "top"],
  );
  assert.equal(INTEREST_PICKER_LEVELS[0]?.name, "Safety / backup");
  assert.equal(INTEREST_PICKER_LEVELS[3]?.short, "Top choice");
});

test("stored interest ids still match INTEREST_LEVELS", () => {
  for (const level of INTEREST_PICKER_LEVELS) {
    assert.ok(INTEREST_LEVELS.some((item) => item.id === level.key));
    assert.ok(interestLabel(level.key));
  }
  assert.equal(interestLabel(""), "Not set");
});
