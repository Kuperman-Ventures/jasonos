import assert from "node:assert/strict";
import test from "node:test";
import {
  cycleRequirementStatus,
  findRequirementTodoId,
  getRequirementProgress,
  normalizeRequirementProgress,
  progressKey,
  requirementHasTodo,
  setRequirementStatus,
  setRequirementTodoId,
} from "@/lib/requirement-progress";
import type { PersistedProjectStep } from "@/lib/ingest";

test("normalizeRequirementProgress accepts array and map shapes", () => {
  const fromArray = normalizeRequirementProgress([
    { userId: "kyle", schoolId: "mit", key: "essay", status: 1, todoId: "t1" },
    { userId: "nope", schoolId: "mit", key: "essay", status: 2 },
  ]);
  assert.equal(fromArray[progressKey("kyle", "mit", "essay")]?.status, 1);
  assert.equal(fromArray[progressKey("kyle", "mit", "essay")]?.todoId, "t1");
  assert.equal(Object.keys(fromArray).length, 1);

  const fromMap = normalizeRequirementProgress({
    "kyle::mit::tests": { status: 2, todoId: null },
  });
  assert.equal(fromMap[progressKey("kyle", "mit", "tests")]?.status, 2);
});

test("setRequirementStatus and cycle", () => {
  assert.equal(cycleRequirementStatus(0), 1);
  assert.equal(cycleRequirementStatus(2), 0);
  let map = setRequirementStatus({}, "kyle", "mit", "essay", 1);
  assert.equal(getRequirementProgress(map, "kyle", "mit", "essay").status, 1);
  map = setRequirementTodoId(map, "kyle", "mit", "essay", "todo-1");
  assert.equal(getRequirementProgress(map, "kyle", "mit", "essay").todoId, "todo-1");
});

test("requirementHasTodo respects soft-deleted edits", () => {
  const steps: PersistedProjectStep[] = [
    {
      id: "todo-1",
      label: "Personal essay",
      owner: "kyle",
      assignedBy: "kyle",
      parentId: "inbox",
      dueDate: null,
      startDate: null,
      endDate: null,
      sourceId: null,
      createdAt: "2026-09-26T00:00:00.000Z",
      schoolId: "mit",
      sourceRequirement: "essay",
    },
  ];
  assert.equal(requirementHasTodo("essay", "mit", steps), true);
  assert.equal(findRequirementTodoId("essay", "mit", steps), "todo-1");
  assert.equal(requirementHasTodo("essay", "mit", steps, { "todo-1": { deleted: true } }), false);
  assert.equal(requirementHasTodo("tests", "mit", steps), false);
});
