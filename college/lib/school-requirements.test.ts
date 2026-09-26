import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSchoolRequirements,
  classifyTestPolicy,
  parseSatRange,
  recommendationCount,
  toSubmitItems,
} from "@/lib/school-requirements";
import type { School } from "@/lib/types";

function baseSchool(overrides: Partial<School> = {}): School {
  return {
    id: "georgia-tech",
    name: "Georgia Institute of Technology (Georgia Tech)",
    location: "Atlanta, GA",
    campusSize: "",
    undergradEnrollment: null,
    control: "",
    residencyDataStatus: "",
    kyleResidency: "",
    inStateAdmitRate: null,
    outOfStateAdmitRate: null,
    overallAdmitRate: null,
    rateThatAppliesToKyle: null,
    admitDataYear: null,
    enrolledOutOfStatePct: null,
    outOfStateDefinition: "",
    outOfStatePolicy: "",
    engineeringResidencyNote: "",
    residencySourceUrl: "",
    residencyNotes: "",
    mechanicalEngineering: "",
    materials: "",
    materialsOffering: "",
    materialsProgram: "",
    materialsSourceUrl: "",
    aerospaceEngineering: "",
    aerospaceProgram: "",
    aerospaceNotes: "",
    aerospaceSourceUrl: "",
    admissionsContext: "Very selective, especially out-of-state",
    satContext: "~1370–1530",
    selectivity: "",
    notes: "",
    listOrder: 1,
    choice: "",
    plan: "",
    visited: false,
    visitStatus: "",
    visitDate: null,
    visitNotes: "",
    deadline: null,
    deadlineLabel: "",
    selectivityTier: "",
    interestLevel: "",
    applicationStatus: "",
    admissionTrack: "",
    testPolicy: "Test required",
    familyTestPolicy: "",
    trackedPrograms: [],
    middle50: "SAT reading 680-750, math 690-790",
    applicationPlatform: "Common App",
    requiredEssays: "Common App personal essay required",
    teacherRecs:
      "0 teacher recommendations; counselor recommendation not required; mid-year report required",
    costOfAttendance: "",
    netPriceEstimate: "",
    meritAidNotes: "",
    researchSources: "",
    website: "https://www.gatech.edu",
    listPhase: "exploration",
    phasesParticipated: ["exploration"],
    archived: false,
    archivedAt: null,
    steps: [],
    deadlines: [],
    contacts: [],
    projectNotes: [],
    ...overrides,
  } as School;
}

test("classifyTestPolicy maps required / optional / blind", () => {
  assert.equal(classifyTestPolicy("Test required").state, "req");
  assert.equal(classifyTestPolicy("Tests considered but not required").state, "mod");
  assert.equal(classifyTestPolicy("Test-free").state, "no");
  assert.equal(classifyTestPolicy("").state, "unk");
});

test("parseSatRange reads composite and reading+math bands", () => {
  assert.deepEqual(parseSatRange("~1370–1530"), [1370, 1530]);
  assert.deepEqual(parseSatRange("SAT reading 680-750, math 690-790"), [1370, 1540]);
  assert.equal(parseSatRange("High"), null);
});

test("buildSchoolRequirements derives Georgia Tech profile", () => {
  const view = buildSchoolRequirements(baseSchool());
  assert.equal(view.platform, "Common App");
  assert.equal(view.testPolicy, "Test required");
  assert.deepEqual(view.satRange, [1370, 1540]);

  const byKey = Object.fromEntries(view.profile.map((item) => [item.key, item]));
  assert.equal(byKey.application.state, "req");
  assert.equal(byKey.essay.state, "req");
  assert.equal(byKey.tests.state, "req");
  assert.equal(byKey.teacherRecs.state, "no");
  assert.equal(byKey.counselorRec.state, "no");
  assert.equal(byKey.interview.state, "unk");

  assert.equal(toSubmitItems(view.profile).length, 3);
  assert.equal(recommendationCount(view.profile), 0);
  assert.equal(view.kit.application.title, "Common App application");
});

test("Stanford-style recs and modified tests", () => {
  const view = buildSchoolRequirements(
    baseSchool({
      testPolicy: "Tests considered but not required",
      requiredEssays:
        "Common App personal essay required; courses and grades required; portfolio: College's own system",
      teacherRecs:
        "2 teacher recommendations; counselor recommendation required; mid-year report required",
    }),
  );
  const byKey = Object.fromEntries(view.profile.map((item) => [item.key, item]));
  assert.equal(byKey.tests.state, "mod");
  assert.equal(byKey.teacherRecs.state, "req");
  assert.equal(byKey.teacherRecs.note, "2 needed");
  assert.equal(byKey.counselorRec.state, "req");
  assert.equal(byKey.supplements.state, "mod");
  assert.equal(recommendationCount(view.profile), 2);
});

test("empty fields stay Not listed", () => {
  const view = buildSchoolRequirements(
    baseSchool({
      testPolicy: "",
      familyTestPolicy: "",
      satContext: "",
      middle50: "",
      applicationPlatform: "",
      requiredEssays: "",
      teacherRecs: "",
    }),
  );
  assert.ok(view.profile.every((item) => item.key === "application" || item.state === "unk" || item.key === "interview"));
  assert.equal(view.profile.find((item) => item.key === "application")?.state, "unk");
  assert.equal(view.satRange, null);
});
