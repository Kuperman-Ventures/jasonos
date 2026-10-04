import assert from "node:assert/strict";
import test from "node:test";
import { processCalendarEntries } from "./calendar-sources";
import type { ProjectTodo } from "./project-todos";
import type { TimelineStage } from "./timeline-stages";

function todo(partial: Partial<ProjectTodo> & Pick<ProjectTodo, "id" | "label">): ProjectTodo {
  return {
    description: "",
    owner: "kyle",
    assignedBy: null,
    dueDate: null,
    startDate: null,
    endDate: null,
    done: false,
    parentId: "inbox",
    parentText: "x",
    phase: "Inbox",
    phaseWindow: "",
    projectId: null,
    schoolId: null,
    kind: "normal",
    doneBy: [],
    completedAt: null,
    ...partial,
  };
}

function stage(partial: Partial<TimelineStage> & Pick<TimelineStage, "id" | "name">): TimelineStage {
  return {
    projectId: "testing",
    start: "2026-10-14",
    end: "2026-10-14",
    phase: null,
    isMilestone: false,
    completedAt: null,
    ...partial,
  };
}

test("a school with no admission track contributes no deadlines", () => {
  const entries = processCalendarEntries({
    schools: [
      {
        id: "mit",
        name: "MIT",
        admissionTrack: "",
        deadlines: [
          { id: "d1", title: "Early Action", dueDate: "2027-11-01" },
          { id: "d2", title: "Regular Decision", dueDate: "2028-01-01" },
        ],
      },
    ],
  });
  assert.equal(
    entries.filter((row) => row.source === "deadline").length,
    0,
  );
});

test("a school with ea contributes Early Action and Early Action II only", () => {
  const entries = processCalendarEntries({
    schools: [
      {
        id: "gatech",
        name: "Georgia Tech",
        admissionTrack: "ea",
        deadlines: [
          { id: "ea1", title: "Early Action", dueDate: "2027-11-01" },
          { id: "ea2", title: "Early Action II", dueDate: "2027-12-01" },
          { id: "rd", title: "Regular Decision", dueDate: "2028-01-15" },
          { id: "ed", title: "Early Decision", dueDate: "2027-11-01" },
        ],
      },
    ],
  });
  const deadlines = entries.filter((row) => row.source === "deadline");
  assert.deepEqual(
    deadlines.map((row) => row.title),
    ["Georgia Tech - Early Action", "Georgia Tech - Early Action II"],
  );
  assert.equal(deadlines[0]?.id, "deadline-ea1");
  assert.equal(deadlines[1]?.id, "deadline-ea2");
});

test("done and deleted to-dos are excluded", () => {
  const entries = processCalendarEntries({
    todos: [
      todo({ id: "open", label: "Pick a cause", endDate: "2026-09-20", owner: "kyle" }),
      todo({ id: "done", label: "Done item", endDate: "2026-09-21", done: true }),
      todo({
        id: "fam",
        label: "Family meeting item",
        endDate: "2026-10-04",
        kind: "family_meeting",
      }),
    ],
  });
  const todos = entries.filter((row) => row.source === "todo");
  assert.equal(todos.length, 1);
  assert.equal(todos[0]?.id, "todo-open");
  assert.equal(todos[0]?.title, "Pick a cause (Kyle)");
});

test("milestone stages appear; non-milestones do not", () => {
  const entries = processCalendarEntries({
    stages: [
      stage({ id: "testing-s2", name: "PSAT/NMSQT", isMilestone: true, start: "2026-10-14" }),
      stage({ id: "testing-s1", name: "PSAT prep", isMilestone: false, start: "2026-09-01" }),
    ],
    todos: [
      todo({
        id: "testing-s2",
        label: "PSAT/NMSQT",
        endDate: "2026-10-14",
        projectId: "testing",
      }),
    ],
  });
  assert.deepEqual(
    entries.filter((row) => row.source === "stage").map((row) => row.id),
    ["stage-testing-s2"],
  );
  assert.equal(
    entries.filter((row) => row.source === "todo").length,
    0,
  );
});

test("visits only come from live schools with a visit date", () => {
  const entries = processCalendarEntries({
    schools: [
      { id: "cmu", name: "CMU", visitDate: "2026-10-20", archived: false },
      { id: "old", name: "Archived", visitDate: "2026-10-21", archived: true },
      { id: "none", name: "No visit", visitDate: null },
    ],
  });
  const visits = entries.filter((row) => row.source === "visit");
  assert.equal(visits.length, 1);
  assert.equal(visits[0]?.id, "visit-cmu");
  assert.equal(visits[0]?.title, "Visit: CMU");
});
