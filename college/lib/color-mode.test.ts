import assert from "node:assert/strict";
import test from "node:test";
import { isColorModePreference, resolveColorMode } from "@/lib/color-mode";

test("isColorModePreference accepts system light dark", () => {
  assert.equal(isColorModePreference("system"), true);
  assert.equal(isColorModePreference("light"), true);
  assert.equal(isColorModePreference("dark"), true);
  assert.equal(isColorModePreference("auto"), false);
});

test("resolveColorMode follows system preference", () => {
  assert.equal(resolveColorMode("system", true), "dark");
  assert.equal(resolveColorMode("system", false), "light");
  assert.equal(resolveColorMode("dark", false), "dark");
  assert.equal(resolveColorMode("light", true), "light");
});
