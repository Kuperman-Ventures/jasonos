import assert from "node:assert/strict";
import test from "node:test";
import { canViewFinances } from "./permissions";

test("Exploration finances: parent and admin only", () => {
  assert.equal(canViewFinances({ id: "p1", role: "parent" }, "exploration"), true);
  assert.equal(canViewFinances({ id: "a1", role: "super_admin" }, "exploration"), true);
  assert.equal(canViewFinances({ id: "s1", role: "student" }, "exploration"), false);
  assert.equal(canViewFinances({ id: "g1", role: "guest" }, "exploration"), false);
  assert.equal(canViewFinances({ id: "local", role: "student" }, "exploration"), true);
});

test("After Exploration, student can view finances", () => {
  assert.equal(canViewFinances({ id: "s1", role: "student" }, "consideration"), true);
  assert.equal(canViewFinances({ id: "s1", role: "student" }, "applications"), true);
  assert.equal(canViewFinances({ id: "g1", role: "sibling" }, "consideration"), false);
});
