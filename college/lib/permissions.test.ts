import assert from "node:assert/strict";
import test from "node:test";
import {
  canAdvanceListPhase,
  canEditActivitiesJournal,
  isAdminRole,
  isParentRole,
  isStudentRole,
  roleLabel,
} from "./permissions";

test("role labels match household settings names", () => {
  assert.equal(roleLabel("super_admin"), "Admin");
  assert.equal(roleLabel("parent"), "Parent");
  assert.equal(roleLabel("student"), "Student");
});

test("role helpers distinguish Admin, Parent, and Student", () => {
  assert.equal(isAdminRole("super_admin"), true);
  assert.equal(isParentRole("parent"), true);
  assert.equal(isStudentRole("student"), true);
  assert.equal(isStudentRole("parent"), false);
});

test("only the Student role advances list phases", () => {
  assert.equal(canAdvanceListPhase({ id: "kyle", role: "student" }), true);
  assert.equal(canAdvanceListPhase({ id: "local", role: "super_admin" }), true);
  assert.equal(canAdvanceListPhase({ id: "jason", role: "super_admin" }), false);
  assert.equal(canAdvanceListPhase({ id: "kat", role: "parent" }), false);
});

test("Student and Admin edit the activities journal; Parent views only", () => {
  assert.equal(canEditActivitiesJournal({ id: "kyle", role: "student" }), true);
  assert.equal(canEditActivitiesJournal({ id: "jason", role: "super_admin" }), true);
  assert.equal(canEditActivitiesJournal({ id: "kat", role: "parent" }), false);
  assert.equal(canEditActivitiesJournal({ id: "local", role: "super_admin" }), true);
});
