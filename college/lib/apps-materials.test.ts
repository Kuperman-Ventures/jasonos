import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_APPS_SECTION,
  DEFAULT_ACTIVITIES_VIEW,
  isAppsSectionId,
  resolveAppsSection,
  resolveActivitiesView,
} from "./apps-materials";

test("Activities is the default Apps & Materials section", () => {
  assert.equal(DEFAULT_APPS_SECTION, "activities");
  assert.equal(isAppsSectionId("activities"), true);
  assert.equal(isAppsSectionId("questions"), true);
  assert.equal(isAppsSectionId("materials"), true);
  assert.equal(isAppsSectionId("consultants"), false);
  assert.equal(resolveAppsSection(null), "activities");
  assert.equal(resolveAppsSection("questions"), "questions");
  assert.equal(resolveAppsSection("activities"), "activities");
  assert.equal(resolveAppsSection("legacy"), "activities");
});

test("Activities views resolve to My Activities by default", () => {
  assert.equal(DEFAULT_ACTIVITIES_VIEW, "my");
  assert.equal(resolveActivitiesView(null), "my");
  assert.equal(resolveActivitiesView("awards"), "awards");
  assert.equal(resolveActivitiesView("prep"), "prep");
  assert.equal(resolveActivitiesView("nope"), "my");
});
