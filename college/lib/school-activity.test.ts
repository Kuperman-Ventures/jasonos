import assert from "node:assert/strict";
import test from "node:test";
import { fromSeed } from "./types";
import { schoolPatchActivityLines } from "./school-activity";

const school = fromSeed({
  id: "ucla",
  name: "UCLA",
  location: "Los Angeles, CA",
  campusSize: "",
  mechanicalEngineering: "",
  materials: "",
  materialsOffering: "",
  admissionsContext: "",
  satContext: "",
  selectivity: "",
  notes: "",
  listOrder: 1,
});

test("schoolPatchActivityLines logs archive and restore", () => {
  const archived = schoolPatchActivityLines(school, { archived: true });
  assert.equal(archived.length, 1);
  assert.equal(archived[0]?.action, "archive");
  assert.match(archived[0]!.summary, /Archived college “UCLA”/);

  const restored = schoolPatchActivityLines({ ...school, archived: true }, { archived: false });
  assert.equal(restored[0]?.action, "restore");
  assert.match(restored[0]!.summary, /Restored/);
});

test("schoolPatchActivityLines logs interest and visit", () => {
  const interest = schoolPatchActivityLines(school, { interestLevel: "high" });
  assert.match(interest[0]!.summary, /to High/);

  const visit = schoolPatchActivityLines(school, { visitStatus: "planned" });
  assert.match(visit[0]!.summary, /Visit Planned/);
});

test("schoolPatchActivityLines skips unchanged and quiet patches", () => {
  assert.deepEqual(schoolPatchActivityLines(school, { interestLevel: "" }), []);
  assert.deepEqual(schoolPatchActivityLines(school, { notes: "long research dump" }), []);
});
