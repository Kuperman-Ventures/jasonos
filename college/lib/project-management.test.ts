import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PROJECT_SECTION,
  isProjectSectionId,
  resolveProjectSection,
} from "./project-management";

test("project sections resolve with a timeline default", () => {
  assert.equal(DEFAULT_PROJECT_SECTION, "timeline");
  assert.equal(isProjectSectionId("timeline"), true);
  assert.equal(isProjectSectionId("todos"), true);
  assert.equal(isProjectSectionId("ingest"), true);
  assert.equal(isProjectSectionId("board"), true);
  assert.equal(isProjectSectionId("nope"), false);
  assert.equal(resolveProjectSection(null), "timeline");
  assert.equal(resolveProjectSection("todos"), "todos");
  assert.equal(resolveProjectSection("ingest"), "ingest");
  assert.equal(resolveProjectSection("calendar"), "calendar");
  assert.equal(resolveProjectSection("legacy"), "timeline");
});
