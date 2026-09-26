import assert from "node:assert/strict";
import test from "node:test";
import { VIEWPORT_MOBILE_MAX_PX, viewportModeFromMatches } from "./use-viewport-mode";

test("viewportModeFromMatches maps matchMedia to mobile or desktop", () => {
  assert.equal(viewportModeFromMatches(true), "mobile");
  assert.equal(viewportModeFromMatches(false), "desktop");
});

test("VIEWPORT_MOBILE_MAX_PX matches the shell rail breakpoint", () => {
  assert.equal(VIEWPORT_MOBILE_MAX_PX, 900);
});
