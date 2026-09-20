import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTodoWhen,
  groupTodosByOwner,
  listProjectTodos,
  memberOwnerId,
} from "./project-todos";

test("memberOwnerId maps household ids onto owners", () => {
  assert.equal(memberOwnerId("jason"), "jason");
  assert.equal(memberOwnerId("kat"), "kat");
  assert.equal(memberOwnerId("kyle"), "kyle");
  assert.equal(memberOwnerId("local"), "jason");
});

test("listProjectTodos nests under runway parents and sorts open first", () => {
  const todos = listProjectTodos({});
  assert.ok(todos.length >= 10);
  const psat = todos.find((todo) => todo.id === "p1-1-s3");
  assert.ok(psat);
  assert.equal(psat?.owner, "kyle");
  assert.match(psat?.parentText ?? "", /PSAT/);
  assert.equal(psat?.phase, "Junior Fall");

  const withDone = listProjectTodos({ "p1-1-s3": true });
  assert.equal(withDone.find((todo) => todo.id === "p1-1-s3")?.done, true);
  assert.equal(withDone[withDone.length - 1]?.id, "p1-1-s3");
});

test("listProjectTodos merges dynamic ingest steps", () => {
  const todos = listProjectTodos(
    {},
    undefined,
    [
      {
        id: "ing-test-1",
        label: "Book October campus tour",
        owner: "kat",
        parentId: "inbox",
        dueDate: "2026-10-05",
        startDate: null,
        endDate: null,
        sourceId: "src-1",
        createdAt: "2026-09-20T12:00:00.000Z",
      },
    ],
  );
  const ingested = todos.find((todo) => todo.id === "ing-test-1");
  assert.ok(ingested);
  assert.equal(ingested?.owner, "kat");
  assert.equal(ingested?.phase, "Inbox");
  assert.match(ingested?.parentText ?? "", /Ingested/);
});

test("groupTodosByOwner focuses the signed-in person", () => {
  const todos = listProjectTodos({});
  const grouped = groupTodosByOwner(todos, "kyle");
  assert.equal(grouped.mine.owner, "kyle");
  assert.ok(grouped.mine.open.length > 0);
  assert.ok(grouped.others.every((bucket) => bucket.owner !== "kyle"));
  assert.ok(grouped.others.some((bucket) => bucket.owner === "jason" && bucket.open.length > 0));
});

test("formatTodoWhen covers due dates and windows", () => {
  assert.equal(
    formatTodoWhen({ dueDate: "2026-09-20", startDate: null, endDate: null }),
    "Sep 20, 2026",
  );
  assert.match(
    formatTodoWhen({
      dueDate: null,
      startDate: "2026-10-01",
      endDate: "2026-10-10",
    }),
    /Oct 1, 2026/,
  );
});
