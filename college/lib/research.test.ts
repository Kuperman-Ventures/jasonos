import assert from "node:assert/strict";
import test from "node:test";
import {
  formatResearchRequest,
  prepareSchoolResearchUpdates,
  RESEARCH_GROUPS,
  researchGroupsNeeded,
  validateSchoolResearchUpdate,
} from "./research";
import type { School } from "./types";

function schoolStub(overrides: Partial<School> = {}): Pick<
  School,
  | "name"
  | "unitId"
  | "location"
  | "website"
  | "control"
  | "researchCompleted"
> {
  return {
    name: "Tufts University",
    unitId: 168148,
    location: "Medford, MA",
    website: "https://www.tufts.edu",
    control: "Private",
    researchCompleted: ["Admissions by residency"],
    ...overrides,
  };
}

test("RESEARCH_GROUPS cover the six add-school groups", () => {
  assert.deepEqual(
    RESEARCH_GROUPS.map((g) => g.name),
    [
      "Setting",
      "Programs",
      "Admissions by residency",
      "Application requirements",
      "Aid",
      "Submissions",
    ],
  );
  assert.ok(RESEARCH_GROUPS[0].fields.some((f) => f.field === "campusSetting"));
  assert.ok(RESEARCH_GROUPS[1].fields.some((f) => f.field === "materials"));
  assert.ok(RESEARCH_GROUPS[3].fields.some((f) => f.field === "applicationPlatform"));
  assert.ok(RESEARCH_GROUPS[4].fields.some((f) => f.field === "meritAidNotes"));
  assert.ok(RESEARCH_GROUPS[5].fields.some((f) => f.field === "submissions"));
});

test("researchGroupsNeeded skips completed groups", () => {
  assert.deepEqual(researchGroupsNeeded(schoolStub()), [
    "Setting",
    "Programs",
    "Application requirements",
    "Aid",
    "Submissions",
  ]);
  assert.deepEqual(
    researchGroupsNeeded(
      schoolStub({
        researchCompleted: [
          "Setting",
          "Programs",
          "Admissions by residency",
          "Application requirements",
          "Aid",
          "Submissions",
        ],
      }),
    ),
    [],
  );
});

test("formatResearchRequest lists needed groups and fields", () => {
  const text = formatResearchRequest(schoolStub());
  assert.match(text, /School: Tufts University/);
  assert.match(text, /unitId: 168148/);
  assert.match(text, /Groups needed: Setting, Programs, Application requirements, Aid, Submissions/);
  assert.match(text, /campusSetting/);
  assert.match(text, /normalizeSubmissions/);
  assert.doesNotMatch(text, /residencyDataStatus/);
});

test("validateSchoolResearchUpdate accepts a clean payload", () => {
  const result = validateSchoolResearchUpdate({
    updateType: "school-research",
    unitId: 168148,
    school: "Tufts University",
    preparedDate: "2026-09-27",
    completedGroups: ["Setting", "Programs"],
    fields: {
      campusSetting: "Suburban",
      aerospaceEngineering: "No",
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.update.fields.campusSetting, "Suburban");
    assert.deepEqual(result.update.completedGroups, ["Setting", "Programs"]);
  }
});

test("validateSchoolResearchUpdate accepts submissions JSON", () => {
  const result = validateSchoolResearchUpdate({
    updateType: "school-research",
    unitId: 168148,
    completedGroups: ["Submissions"],
    fields: {
      submissions: {
        cycle: "2026-27",
        selfReport: { state: "no", note: "None found" },
        required: [],
        optional: [],
        notAccepted: [],
        notes: "",
      },
      submissionsCheckedDate: "2026-10-03",
    },
  });
  assert.equal(result.ok, true);
});

test("validateSchoolResearchUpdate rejects a bad submissions object", () => {
  const result = validateSchoolResearchUpdate({
    updateType: "school-research",
    unitId: 168148,
    completedGroups: ["Submissions"],
    fields: {
      submissions: "not-an-object",
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.problems.some((p) => p.includes("submissions")));
  }
});

test("validateSchoolResearchUpdate rejects bad enums and unknown fields", () => {
  const result = validateSchoolResearchUpdate({
    updateType: "school-research",
    unitId: 168148,
    completedGroups: ["Setting"],
    fields: {
      campusSetting: "Mega city",
      notAField: "x",
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.problems.some((p) => p.includes("campusSetting")));
    assert.ok(result.problems.some((p) => p.includes("notAField")));
  }
});

test("validateSchoolResearchUpdate returns field diffs against a school", () => {
  const school = {
    ...schoolStub(),
    id: "tufts",
    campusSetting: "Urban",
    aerospaceEngineering: "",
  } as School;
  const result = validateSchoolResearchUpdate(
    {
      updateType: "school-research",
      unitId: 168148,
      completedGroups: ["Setting"],
      fields: {
        campusSetting: "Suburban",
        aerospaceEngineering: "No",
      },
    },
    school,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.diffs.length, 2);
    assert.ok(result.diffs.some((d) => d.field === "campusSetting" && d.next === "Suburban"));
  }
});

test("prepareSchoolResearchUpdates builds preview rows", () => {
  const school = {
    id: "tufts",
    name: "Tufts University",
    unitId: 168148,
    location: "Medford, MA",
    website: "https://www.tufts.edu",
    control: "Private",
    researchCompleted: ["Admissions by residency"],
    campusSetting: "",
    mechanicalEngineering: "",
    materials: "",
    materialsOffering: "",
    materialsProgram: "",
    materialsSourceUrl: "",
    aerospaceEngineering: "",
    aerospaceProgram: "",
    aerospaceNotes: "",
    aerospaceSourceUrl: "",
  } as School;

  const result = prepareSchoolResearchUpdates(
    {
      updateType: "school-research",
      unitId: 168148,
      completedGroups: ["Setting", "Programs"],
      fields: {
        campusSetting: "Suburban",
        mechanicalEngineering: "Yes",
      },
    },
    [school],
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.patches.length, 1);
    assert.ok(result.patches[0]!.rows.some((row) => row.field === "campusSetting"));
    assert.deepEqual(result.patches[0]!.patch.researchCompleted, [
      "Admissions by residency",
      "Setting",
      "Programs",
    ]);
  }
});

test("prepareSchoolResearchUpdates rejects unknown unitId", () => {
  const result = prepareSchoolResearchUpdates(
    {
      updateType: "school-research",
      unitId: 1,
      completedGroups: [],
      fields: { campusSetting: "Urban" },
    },
    [],
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.problems.some((p) => p.includes("unitId")));
  }
});
