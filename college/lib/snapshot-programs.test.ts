import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTrackedPrograms,
  normalizeTrackedPrograms,
  programOfferedFromRecord,
  programsOfferedHeadline,
} from "./types";

test("defaultTrackedPrograms prefers filled offered fields", () => {
  assert.deepEqual(defaultTrackedPrograms("Yes", ""), ["Mechanical engineering"]);
  assert.deepEqual(defaultTrackedPrograms("", "No"), ["Material sciences"]);
  assert.deepEqual(defaultTrackedPrograms("", ""), [
    "Mechanical engineering",
    "Material sciences",
  ]);
});

test("normalizeTrackedPrograms keeps known labels only", () => {
  assert.deepEqual(normalizeTrackedPrograms(["Material sciences", "Bogus"], "Yes", "Yes"), [
    "Material sciences",
  ]);
  assert.deepEqual(normalizeTrackedPrograms([], "Yes", ""), ["Mechanical engineering"]);
});

test("programsOfferedHeadline matches snapshot copy", () => {
  assert.equal(programsOfferedHeadline([], {}), "None tracked");
  assert.equal(
    programsOfferedHeadline(["Mechanical engineering"], { "Mechanical engineering": true }),
    "Offered",
  );
  assert.equal(
    programsOfferedHeadline(
      ["Mechanical engineering", "Material sciences"],
      { "Mechanical engineering": true, "Material sciences": true },
    ),
    "Both offered",
  );
  assert.equal(
    programsOfferedHeadline(
      ["Mechanical engineering", "Material sciences"],
      { "Mechanical engineering": true, "Material sciences": false },
    ),
    "1 of 2 offered",
  );
});

test("programOfferedFromRecord reads Yes/No", () => {
  assert.equal(programOfferedFromRecord("Yes"), true);
  assert.equal(programOfferedFromRecord("no"), false);
  assert.equal(programOfferedFromRecord(""), null);
});
