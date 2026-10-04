import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_APPS_SECTION,
  DEFAULT_ACTIVITIES_VIEW,
  isAppsSectionId,
  resolveAppsSection,
  resolveActivitiesView,
  viewForOpenedActivity,
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

test("Activities views default to Gather and map the old My Record URL", () => {
  assert.equal(DEFAULT_ACTIVITIES_VIEW, "gather");
  assert.equal(resolveActivitiesView(null), "gather");
  assert.equal(resolveActivitiesView("awards"), "gather");
  assert.equal(resolveActivitiesView("prep"), "prep");
  assert.equal(resolveActivitiesView("plan"), "plan");
  assert.equal(resolveActivitiesView("gather"), "gather");
  assert.equal(resolveActivitiesView("shape"), "shape");
  assert.equal(resolveActivitiesView("nope"), "gather");
  assert.equal(resolveActivitiesView("my"), "shape");
  assert.equal(resolveActivitiesView("write"), "prep");
});

test("opening an activity goes to Application Prep; clearing it keeps the current stage", () => {
  assert.equal(viewForOpenedActivity("plan", "a1"), "prep");
  assert.equal(viewForOpenedActivity("shape", "a1"), "prep");
  assert.equal(viewForOpenedActivity("plan", null), "plan");
  assert.equal(viewForOpenedActivity("gather", null), "gather");
});
