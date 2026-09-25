import assert from "node:assert/strict";
import test from "node:test";
import {
  assignmentPatch,
  assignedByBadge,
  canMarkTodoDone,
  dueTone,
  formatTodoWhen,
  groupTodosByOwner,
  isTodoOverdue,
  listProjectTodos,
  memberOwnerId,
  normalizeTodoEdits,
  openListStats,
  personMeterMax,
  personMeterRows,
  removeProjectTodoState,
  sanitizeChecklistForViewer,
  sanitizeSubtasksForViewer,
  shortDueLabel,
  todoOwnerIndex,
  todoPrimaryDate,
  type ProjectTodo,
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
  assert.equal(canMarkTodoDone("jason", null), false);
});

test("assignedByBadge only shows when someone else assigned it", () => {
  assert.equal(assignedByBadge({ owner: "kat", assignedBy: "jason" }), "From Jason");
  assert.equal(assignedByBadge({ owner: "kat", assignedBy: "kat" }), null);
  assert.equal(assignedByBadge({ owner: "kat", assignedBy: null }), null);
  assert.equal(assignedByBadge({ owner: null, assignedBy: "jason" }), null);
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

test("listProjectTodos applies wording, description, and date edits", () => {
  const todos = listProjectTodos(
    {},
    undefined,
    [],
    {
      "p1-1-s3": {
        label: "Register for the October PSAT",
        description: "Do this before the fee waiver window closes.",
        dueDate: "2026-10-01",
        startDate: null,
        endDate: null,
      },
    },
  );
  const psat = todos.find((todo) => todo.id === "p1-1-s3");
  assert.equal(psat?.label, "Register for the October PSAT");
  assert.equal(psat?.description, "Do this before the fee waiver window closes.");
  assert.equal(psat?.dueDate, "2026-10-01");

  const cleared = normalizeTodoEdits({
    "p1-1-s3": { dueDate: "", description: "  keep me  ", label: "   " },
    junk: "nope",
  });
  assert.equal(cleared["p1-1-s3"]?.dueDate, null);
  assert.equal(cleared["p1-1-s3"]?.description, "keep me");
  assert.equal(cleared["p1-1-s3"]?.label, undefined);
  assert.equal(cleared.junk, undefined);
});

test("groupTodosByOwner focuses the signed-in person", () => {
  const todos = listProjectTodos({});
  const grouped = groupTodosByOwner(todos, "kyle");
  assert.equal(grouped.mine.owner, "kyle");
  assert.ok(grouped.mine.open.length > 0);
  assert.ok(grouped.others.every((bucket) => bucket.owner !== "kyle"));
  assert.ok(grouped.others.some((bucket) => bucket.owner === "jason" && bucket.open.length > 0));
  assert.equal(grouped.unclaimed.open.length, 0);
});

test("assignmentPatch and unclaimed edits move to-dos between lists", () => {
  assert.deepEqual(assignmentPatch("jason", "kyle"), { owner: "kyle", assignedBy: "jason" });
  assert.deepEqual(assignmentPatch("jason", "jason"), { owner: "jason", assignedBy: null });
  assert.deepEqual(assignmentPatch("jason", null), { owner: null, assignedBy: null });

  const todos = listProjectTodos(
    {},
    undefined,
    [],
    {
      "p1-1-s3": { owner: null, assignedBy: null },
      "p1-1-s1": { owner: "kat", assignedBy: "jason" },
    },
  );
  const grouped = groupTodosByOwner(todos, "jason");
  assert.ok(grouped.unclaimed.open.some((todo) => todo.id === "p1-1-s3"));
  assert.ok(grouped.others.find((bucket) => bucket.owner === "kat")?.open.some((todo) => todo.id === "p1-1-s1"));
  assert.equal(todoOwnerIndex([], { "p1-1-s3": { owner: null } }).has("p1-1-s3"), false);
  assert.equal(todoOwnerIndex([], { "p1-1-s1": { owner: "kat" } }).get("p1-1-s1"), "kat");
});

test("short due labels and soon-window tone", () => {
  assert.equal(shortDueLabel(null), "—");
  assert.equal(shortDueLabel("2026-09-25"), "Sep 25");
  assert.equal(dueTone("2026-09-25", new Date(2026, 8, 20)), "soon");
  assert.equal(dueTone("2026-12-15", new Date(2026, 8, 20)), "dated");
  assert.equal(dueTone("2026-09-18", new Date(2026, 8, 25)), "over");
  assert.equal(dueTone("2026-09-25", new Date(2026, 8, 25)), "soon");
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

test("todoPrimaryDate prefers end as due and never uses start", () => {
  assert.equal(
    todoPrimaryDate({ dueDate: "2026-09-20", startDate: "2026-09-01", endDate: "2026-09-25" }),
    "2026-09-25",
  );
  assert.equal(
    todoPrimaryDate({ dueDate: "2026-09-20", startDate: "2026-09-01", endDate: null }),
    "2026-09-20",
  );
  assert.equal(
    todoPrimaryDate({ dueDate: null, startDate: "2026-09-14", endDate: null }),
    null,
  );
  assert.equal(
    todoPrimaryDate({ dueDate: null, startDate: null, endDate: "2026-10-10" }),
    "2026-10-10",
  );
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
  assert.equal(
    formatTodoWhen({ dueDate: null, startDate: "2026-09-14", endDate: null }),
    "No date",
  );
});

test("removeProjectTodoState soft-deletes seed todos and drops dynamic steps", () => {
  const dynamic = {
    id: "ing-1",
    label: "Campus tour",
    owner: "kat" as const,
    assignedBy: "jason" as const,
    parentId: "inbox",
    dueDate: null,
    startDate: null,
    endDate: null,
    sourceId: null,
    createdAt: "2026-09-20T12:00:00.000Z",
  };
  const removed = removeProjectTodoState(
    "ing-1",
    [dynamic],
    {},
    { "ing-1": [{ id: "sub-1", label: "Book", dueDate: null, done: false }] },
    { "ing-1": true },
  );
  assert.equal(removed.projectSteps.length, 0);
  assert.equal(removed.todoEdits["ing-1"]?.deleted, true);
  assert.equal(removed.todoSubtasks["ing-1"], undefined);
  assert.equal(removed.checklist["ing-1"], undefined);

  const soft = removeProjectTodoState("p1-1-s3", [], {}, {}, { "p1-1-s3": true });
  assert.equal(soft.todoEdits["p1-1-s3"]?.deleted, true);
  const listed = listProjectTodos(soft.checklist, undefined, soft.projectSteps, soft.todoEdits);
  assert.equal(listed.find((todo) => todo.id === "p1-1-s3"), undefined);
});

function meterTodo(
  partial: Partial<ProjectTodo> & Pick<ProjectTodo, "id" | "owner" | "done">,
): ProjectTodo {
  return {
    label: partial.label ?? partial.id,
    assignedBy: null,
    dueDate: null,
    startDate: null,
    endDate: null,
    parentId: "inbox",
    parentText: "x",
    phase: "Junior Fall",
    phaseWindow: "now",
    projectId: null,
    description: "",
    ...partial,
  };
}

test("isTodoOverdue is before today only; today and undated are not", () => {
  const now = new Date(2026, 8, 25);
  assert.equal(
    isTodoOverdue(meterTodo({ id: "a", owner: "kyle", done: false, dueDate: "2026-09-18" }), now),
    true,
  );
  assert.equal(
    isTodoOverdue(meterTodo({ id: "b", owner: "kyle", done: false, dueDate: "2026-09-25" }), now),
    false,
  );
  assert.equal(
    isTodoOverdue(meterTodo({ id: "c", owner: "kyle", done: false, dueDate: null }), now),
    false,
  );
  assert.equal(
    isTodoOverdue(meterTodo({ id: "d", owner: "kyle", done: true, dueDate: "2026-09-12" }), now),
    false,
  );
});

test("personMeterRows is me-first, open-only, and keeps zero members", () => {
  const now = new Date(2026, 8, 25);
  const todos = [
    meterTodo({ id: "1", owner: "kyle", done: false, dueDate: "2026-09-12" }),
    meterTodo({ id: "2", owner: "kyle", done: false, dueDate: null }),
    meterTodo({ id: "3", owner: "kyle", done: true, dueDate: "2026-09-01" }),
    meterTodo({ id: "4", owner: "kat", done: false, dueDate: "2026-09-22" }),
    meterTodo({ id: "5", owner: "kat", done: false, endDate: "2026-10-01" }),
    meterTodo({ id: "6", owner: null, done: false, dueDate: "2026-09-01" }),
  ];
  const rows = personMeterRows(todos, "jason", now);
  assert.deepEqual(
    rows.map((row) => ({ owner: row.owner, total: row.total, overdue: row.overdue })),
    [
      { owner: "jason", total: 0, overdue: 0 },
      { owner: "kyle", total: 2, overdue: 1 },
      { owner: "kat", total: 2, overdue: 1 },
    ],
  );
  assert.equal(personMeterMax(rows), 2);
  assert.equal(personMeterMax([{ owner: "jason", label: "Jason", total: 0, overdue: 0 }]), 1);
});
