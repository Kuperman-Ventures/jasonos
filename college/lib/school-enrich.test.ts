import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findEngineeringCatalog,
  findSeedProgramFacts,
  findSubmissionsCatalog,
  researchGroupsFilledByFields,
} from "./school-enrich";
import { fromSeed, type School } from "./types";

function stub(partial: Partial<School>): School {
  return {
    ...fromSeed({
      id: "x",
      name: "X University",
      location: "",
      campusSetting: "",
      metroArea: null,
      metroPopulation: null,
      mechanicalEngineering: "",
      materials: "",
      materialsOffering: "",
      admissionsContext: "",
      satContext: "",
      selectivity: "",
      notes: "",
      listOrder: 1,
    }),
    ...partial,
  };
}

test("findEngineeringCatalog matches Pitt by unitId canonical id", () => {
  const hit = findEngineeringCatalog(
    stub({
      id: "university-of-pittsburgh-pittsburgh-campus",
      name: "University of Pittsburgh-Pittsburgh Campus",
      unitId: 215293,
    }),
  );
  assert.ok(hit);
  assert.equal(hit!.schoolId, "university-of-pittsburgh");
  assert.ok(hit!.programs.length >= 8);
});

test("findSubmissionsCatalog matches Pitt by unitId", () => {
  const hit = findSubmissionsCatalog(
    stub({
      id: "university-of-pittsburgh-pittsburgh-campus",
      name: "University of Pittsburgh-Pittsburgh Campus",
      unitId: 215293,
    }),
  );
  assert.ok(hit);
  assert.equal(hit!.catalogId, "university-of-pittsburgh");
  assert.equal(hit!.submissions.selfReport.state, "req");
});

test("findSeedProgramFacts matches Pitt ME/materials Yes", () => {
  const hit = findSeedProgramFacts(
    stub({
      id: "university-of-pittsburgh-pittsburgh-campus",
      name: "University of Pittsburgh-Pittsburgh Campus",
      unitId: 215293,
    }),
  );
  assert.ok(hit);
  assert.equal(hit!.mechanicalEngineering, "Yes");
  assert.equal(hit!.materials, "Yes");
});

test("researchGroupsFilledByFields marks Setting and Submissions when present", () => {
  const groups = researchGroupsFilledByFields(
    stub({
      campusSetting: "Urban",
      mechanicalEngineering: "Yes",
      materials: "Yes",
      aerospaceEngineering: "No",
      residencyDataStatus: "Estimated",
      testPolicy: "Optional",
      applicationPlatform: "Common App",
      requiredEssays: "None required",
      meritAidNotes: "Chancellor scholarships",
      submissions: {
        cycle: "2026-27",
        selfReport: { state: "req", note: "STARS" },
        required: [],
        optional: [],
        notAccepted: [],
        notes: "",
      },
      submissionsCheckedDate: "2026-10-03",
    }),
  );
  assert.deepEqual(groups, [
    "Setting",
    "Programs",
    "Admissions by residency",
    "Application requirements",
    "Aid",
    "Submissions",
  ]);
});
