import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTrackedPrograms,
  normalizeTrackedPrograms,
  programOfferStatus,
  programOfferedFromRecord,
  programsOfferedHeadline,
} from "./types";

test("defaultTrackedPrograms prefers filled offered fields", () => {
  assert.deepEqual(defaultTrackedPrograms("Yes", ""), ["Mechanical engineering"]);
  assert.deepEqual(defaultTrackedPrograms("", "No"), ["Material sciences"]);
  assert.deepEqual(defaultTrackedPrograms("Yes", "Yes", "Partial"), [
    "Mechanical engineering",
    "Material sciences",
    "Aerospace engineering",
  ]);
  assert.deepEqual(defaultTrackedPrograms("", ""), [
    "Mechanical engineering",
    "Material sciences",
    "Aerospace engineering",
  ]);
});

test("normalizeTrackedPrograms keeps known labels only", () => {
  assert.deepEqual(normalizeTrackedPrograms(["Material sciences", "Bogus"], "Yes", "Yes"), [
    "Material sciences",
  ]);
  assert.deepEqual(normalizeTrackedPrograms([], "Yes", "", "Yes"), [
    "Mechanical engineering",
    "Aerospace engineering",
  ]);
  assert.deepEqual(
    normalizeTrackedPrograms(["Aerospace engineering"], "Yes", "Yes", "Yes"),
    ["Aerospace engineering"],
  );
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
  assert.equal(
    programsOfferedHeadline(["Aerospace engineering"], { "Aerospace engineering": "partial" }),
    "Partial",
  );
  assert.equal(
    programsOfferedHeadline(
      ["Mechanical engineering", "Aerospace engineering", "Material sciences"],
      {
        "Mechanical engineering": "yes",
        "Aerospace engineering": "yes",
        "Material sciences": "yes",
      },
    ),
    "All 3 offered",
  );
});

test("programOfferStatus reads Yes / Partial / No", () => {
  assert.equal(programOfferStatus("Yes"), "yes");
  assert.equal(programOfferStatus("Partial"), "partial");
  assert.equal(programOfferStatus("no"), "no");
  assert.equal(programOfferStatus(""), null);
});

test("programOfferedFromRecord treats Partial as offered", () => {
  assert.equal(programOfferedFromRecord("Yes"), true);
  assert.equal(programOfferedFromRecord("Partial"), true);
  assert.equal(programOfferedFromRecord("no"), false);
  assert.equal(programOfferedFromRecord(""), null);
});
