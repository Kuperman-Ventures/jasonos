import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_APPS_SECTION,
  DEFAULT_ACTIVITIES_VIEW,
  isAppsSectionId,
  resolveAppsSection,
  resolveActivitiesView,
} from "./apps-materials";
import { normalizeTabId } from "./types";

test("Activities is the default Apps & Materials section", () => {
  assert.equal(DEFAULT_APPS_SECTION, "activities");
  assert.equal(isAppsSectionId("activities"), true);
  assert.equal(isAppsSectionId("questions"), false);
  assert.equal(isAppsSectionId("materials"), true);
  assert.equal(isAppsSectionId("consultants"), false);
  assert.equal(resolveAppsSection(null), "activities");
  assert.equal(resolveAppsSection("questions"), "activities");
  assert.equal(resolveAppsSection("activities"), "activities");
  assert.equal(resolveAppsSection("legacy"), "activities");
});

test("legacy tab=questions opens the Common App Guide", () => {
  assert.equal(normalizeTabId("questions"), "guide");
  assert.equal(normalizeTabId("guide"), "guide");
});

test("Activities views resolve to My Record by default", () => {
  assert.equal(DEFAULT_ACTIVITIES_VIEW, "my");
  assert.equal(resolveActivitiesView(null), "my");
  assert.equal(resolveActivitiesView("awards"), "my");
  assert.equal(resolveActivitiesView("prep"), "prep");
  assert.equal(resolveActivitiesView("nope"), "my");
  assert.equal(resolveActivitiesView("my"), "my");
});
