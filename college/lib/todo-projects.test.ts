import assert from "node:assert/strict";
import test from "node:test";
import {
  TODO_PROJECT_COLORS,
  createTodoProject,
  nextProjectColorIndex,
  normalizeProjectName,
  normalizeTodoProjects,
  openDatedStats,
  projectColor,
} from "./todo-projects";
import { clearProjectIdFromEdits } from "./project-todos";

test("normalizeProjectName trims and caps length", () => {
  assert.equal(normalizeProjectName("  AP exams  "), "AP exams");
  assert.equal(normalizeProjectName("   "), null);
  assert.equal(normalizeProjectName("x".repeat(80))?.length, 60);
});

test("normalizeTodoProjects sorts by createdAt and drops bad rows", () => {
  const projects = normalizeTodoProjects([
    { id: "b", name: "Budget", colorIndex: 2, createdAt: "2026-09-02T00:00:00.000Z" },
    { id: "a", name: "AP exams", colorIndex: 0, createdAt: "2026-09-01T00:00:00.000Z" },
    { id: "", name: "bad" },
    null,
  ]);
  assert.deepEqual(
    projects.map((p) => p.id),
    ["a", "b"],
  );
  assert.equal(projectColor(0), TODO_PROJECT_COLORS[0]);
});

test("createTodoProject assigns next color and never blanks name", () => {
  const first = createTodoProject("Testing", []);
  assert.ok(first);
  assert.equal(first!.colorIndex, 0);
  const second = createTodoProject("Budget", [first!]);
  assert.equal(second!.colorIndex, 1);
  assert.equal(createTodoProject("  ", []), null);
  assert.equal(nextProjectColorIndex([first!, second!]), 2);
});

test("clearProjectIdFromEdits nulls projectId without deleting edits", () => {
  const next = clearProjectIdFromEdits("p1", {
    t1: { projectId: "p1", label: "Stay" },
    t2: { projectId: "p2" },
  });
  assert.equal(next.t1?.projectId, null);
  assert.equal(next.t1?.label, "Stay");
  assert.equal(next.t2?.projectId, "p2");
});

test("openDatedStats matches reference label", () => {
  const stats = openDatedStats([
    { done: false, dueDate: "2026-10-01" },
    { done: false, dueDate: null },
    { done: true, dueDate: "2026-09-01" },
  ]);
  assert.equal(stats.label, "2 OPEN · 1 DATED");
});
