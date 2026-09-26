import assert from "node:assert/strict";
import test from "node:test";
import { entityTypeLabel, formatActivityWhen } from "./activity-log";

test("formatActivityWhen renders a readable local timestamp", () => {
  const label = formatActivityWhen("2026-09-22T15:30:00.000Z");
  assert.match(label, /Sep/);
  assert.match(label, /2026/);
});

test("entityTypeLabel covers known entity types", () => {
  assert.equal(entityTypeLabel("todo"), "To-do");
  assert.equal(entityTypeLabel("note"), "Note");
  assert.equal(entityTypeLabel("calendar"), "Calendar");
  assert.equal(entityTypeLabel("ingest"), "Ingest");
  assert.equal(entityTypeLabel("school"), "College");
  assert.equal(entityTypeLabel("checklist"), "Checklist");
  assert.equal(entityTypeLabel("system"), "System");
});
