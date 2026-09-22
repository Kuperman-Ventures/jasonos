import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_APPS_SECTION,
  isAppsSectionId,
  resolveAppsSection,
} from "./apps-materials";

test("apps sections resolve with App Questions as the default", () => {
  assert.equal(DEFAULT_APPS_SECTION, "questions");
  assert.equal(isAppsSectionId("questions"), true);
  assert.equal(isAppsSectionId("materials"), true);
  assert.equal(isAppsSectionId("consultants"), false);
  assert.equal(resolveAppsSection(null), "questions");
  assert.equal(resolveAppsSection("questions"), "questions");
  assert.equal(resolveAppsSection("materials"), "materials");
  assert.equal(resolveAppsSection("legacy"), "questions");
});
