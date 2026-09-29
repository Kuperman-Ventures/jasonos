import assert from "node:assert/strict";
import test from "node:test";
import {
  entityTypeLabel,
  formatActivityWhen,
  groupActivityByPerson,
  sortActivityEntries,
  type ActivityEntry,
} from "./activity-log";

function entry(
  partial: Partial<ActivityEntry> & Pick<ActivityEntry, "id" | "actorId" | "actorName" | "createdAt">,
): ActivityEntry {
  return {
    action: "update",
    entityType: "todo",
    entityId: null,
    summary: "Did something",
    detail: {},
    ...partial,
  };
}

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

test("sortActivityEntries by recency is newest first", () => {
  const rows = [
    entry({ id: "1", actorId: "a", actorName: "Jason", createdAt: "2026-09-20T12:00:00.000Z" }),
    entry({ id: "2", actorId: "b", actorName: "Kyle", createdAt: "2026-09-22T12:00:00.000Z" }),
    entry({ id: "3", actorId: "a", actorName: "Jason", createdAt: "2026-09-21T12:00:00.000Z" }),
  ];
  assert.deepEqual(
    sortActivityEntries(rows, "recency").map((r) => r.id),
    ["2", "3", "1"],
  );
});

test("sortActivityEntries by person groups name then newest", () => {
  const rows = [
    entry({ id: "1", actorId: "k", actorName: "Kyle", createdAt: "2026-09-20T12:00:00.000Z" }),
    entry({ id: "2", actorId: "j", actorName: "Jason", createdAt: "2026-09-22T12:00:00.000Z" }),
    entry({ id: "3", actorId: "j", actorName: "Jason", createdAt: "2026-09-21T12:00:00.000Z" }),
    entry({ id: "4", actorId: "k", actorName: "Kyle", createdAt: "2026-09-23T12:00:00.000Z" }),
  ];
  const sorted = sortActivityEntries(rows, "person");
  assert.deepEqual(
    sorted.map((r) => r.id),
    ["2", "3", "4", "1"],
  );
  const groups = groupActivityByPerson(sorted);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.actorName, "Jason");
  assert.deepEqual(
    groups[0]!.entries.map((e) => e.id),
    ["2", "3"],
  );
  assert.equal(groups[1]!.actorName, "Kyle");
  assert.deepEqual(
    groups[1]!.entries.map((e) => e.id),
    ["4", "1"],
  );
});
