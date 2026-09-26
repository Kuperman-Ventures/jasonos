import assert from "node:assert/strict";
import test from "node:test";
import {
  INTEREST_PICKER_LEVELS,
  placeInterestPopover,
} from "../components/InterestPicker";
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

test("interest popover centers on the click, clamped to the viewport", () => {
  const trigger = {
    top: 100,
    bottom: 140,
    left: 400,
    right: 540,
    width: 140,
    height: 40,
    x: 400,
    y: 100,
    toJSON() {
      return this;
    },
  } as DOMRect;

  const centered = placeInterestPopover({
    trigger,
    popoverWidth: 320,
    popoverHeight: 56,
    anchorX: 470,
    viewportWidth: 1200,
    viewportHeight: 800,
  });
  assert.equal(centered.left, 470 - 160);
  assert.equal(centered.top, 146);
  assert.equal(centered.openUp, false);

  const nearLeft = placeInterestPopover({
    trigger,
    popoverWidth: 320,
    popoverHeight: 56,
    anchorX: 40,
    viewportWidth: 1200,
    viewportHeight: 800,
  });
  assert.equal(nearLeft.left, 8);

  const withoutClick = placeInterestPopover({
    trigger,
    popoverWidth: 320,
    popoverHeight: 56,
    viewportWidth: 1200,
    viewportHeight: 800,
  });
  assert.equal(withoutClick.left, 400 + 70 - 160);
});
