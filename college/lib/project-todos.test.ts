import assert from "node:assert/strict";
import test from "node:test";
import {
  assignedByBadge,
  canMarkTodoDone,
  dueTone,
  formatTodoWhen,
  groupTodosByOwner,
  listProjectTodos,
  memberOwnerId,
  openListStats,
  sanitizeChecklistForViewer,
  sanitizeSubtasksForViewer,
  shortDueLabel,
  todoOwnerIndex,
} from "./project-todos";

test("memberOwnerId maps household ids onto owners", () => {
  assert.equal(memberOwnerId("jason"), "jason");
  assert.equal(memberOwnerId("kat"), "kat");
  assert.equal(memberOwnerId("kyle"), "kyle");
  assert.equal(memberOwnerId("local"), "jason");
});

test("only the list owner can mark a to-do done", () => {
  assert.equal(canMarkTodoDone("kat", "kat"), true);
  assert.equal(canMarkTodoDone("jason", "kat"), false);
  assert.equal(canMarkTodoDone("kyle", "kyle"), true);
});

test("assignedByBadge only shows when someone else assigned it", () => {
  assert.equal(assignedByBadge({ owner: "kat", assignedBy: "jason" }), "From Jason");
  assert.equal(assignedByBadge({ owner: "kat", assignedBy: "kat" }), null);
  assert.equal(assignedByBadge({ owner: "kat", assignedBy: null }), null);
});

test("sanitizeChecklistForViewer blocks flipping someone else's to-do", () => {
  const owners = todoOwnerIndex([
    {
      id: "ing-kat",
      label: "Campus tour",
      owner: "kat",
      assignedBy: "jason",
      parentId: "inbox",
      dueDate: null,
      startDate: null,
      endDate: null,
      sourceId: null,
      createdAt: "2026-09-20T12:00:00.000Z",
    },
  ]);
  const { checklist, blocked } = sanitizeChecklistForViewer(
    {},
    { "ing-kat": true, "shared-runway-item": true },
    "jason",
    owners,
  );
  assert.deepEqual(blocked, ["ing-kat"]);
  assert.equal(checklist["ing-kat"], undefined);
  assert.equal(checklist["shared-runway-item"], true);
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

test("listProjectTodos merges dynamic ingest steps with assigner", () => {
  const todos = listProjectTodos(
    {},
    undefined,
    [
      {
        id: "ing-test-1",
        label: "Book October campus tour",
        owner: "kat",
        assignedBy: "jason",
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
  assert.equal(ingested?.assignedBy, "jason");
  assert.equal(assignedByBadge(ingested!), "From Jason");
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

test("short due labels and soon-window tone", () => {
  assert.equal(shortDueLabel(null), "—");
  assert.equal(shortDueLabel("2026-09-25"), "Sep 25");
  assert.equal(dueTone("2026-09-25", new Date(2026, 8, 20)), "soon");
  assert.equal(dueTone("2026-12-15", new Date(2026, 8, 20)), "dated");
  assert.equal(dueTone(null), "undated");
});

test("openListStats counts open and dated", () => {
  const stats = openListStats([
    {
      id: "a",
      label: "Dated",
      owner: "jason",
      assignedBy: null,
      dueDate: "2026-10-01",
      startDate: null,
      endDate: null,
      done: false,
      parentId: "inbox",
      parentText: "x",
      phase: "Junior Fall",
      phaseWindow: "now",
    },
    {
      id: "b",
      label: "Undated",
      owner: "jason",
      assignedBy: null,
      dueDate: null,
      startDate: null,
      endDate: null,
      done: false,
      parentId: "inbox",
      parentText: "x",
      phase: "Junior Fall",
      phaseWindow: "now",
    },
    {
      id: "c",
      label: "Done",
      owner: "jason",
      assignedBy: null,
      dueDate: "2026-10-02",
      startDate: null,
      endDate: null,
      done: true,
      parentId: "inbox",
      parentText: "x",
      phase: "Junior Fall",
      phaseWindow: "now",
    },
  ]);
  assert.equal(stats.label, "2 open · 1 dated");
});

test("sanitizeSubtasksForViewer lets others add but not check off", () => {
  const owners = todoOwnerIndex([]);
  owners.set("kat-task", "kat");
  const current = {
    "kat-task": [{ id: "s1", label: "Existing", dueDate: null, done: false }],
  };
  const next = {
    "kat-task": [
      { id: "s1", label: "Existing", dueDate: null, done: true },
      { id: "s2", label: "Added by Jason", dueDate: null, done: true },
    ],
  };
  const saved = sanitizeSubtasksForViewer(current, next, "jason", owners);
  assert.equal(saved["kat-task"]?.[0]?.done, false);
  assert.equal(saved["kat-task"]?.[1]?.done, false);
  assert.equal(saved["kat-task"]?.[1]?.label, "Added by Jason");
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
