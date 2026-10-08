import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { compareSchools, nextAction, nextDate, nextOpenStep } from "./list";
import {
  fromSeed,
  selectivityTierFromContext,
  selectivityTierFromRate,
  type School,
  type SchoolSeed,
} from "./types";
import { mapSchool } from "./db";

const file = JSON.parse(
  fs.readFileSync(new URL("../content/schools.json", import.meta.url), "utf8"),
) as { schools: SchoolSeed[]; selectivityGuide: { term: string; meaning: string }[] };

test("spreadsheet seed has every school and the selectivity guide", () => {
  assert.equal(file.schools.length, 45);
  assert.equal(file.selectivityGuide.length, 5);
  for (const school of file.schools) {
    assert.ok(school.name);
    assert.ok(school.location);
    assert.ok(school.admissionsContext);
    assert.ok(school.notes);
    assert.ok(school.campusSetting);
  }
  assert.equal(file.schools[0].id, "mit");
  assert.equal(file.schools[0].admissionsContext, "Extremely selective");
  assert.equal(file.schools.find((school) => school.id === "rutgers-university-new-brunswick")?.notes.includes("R-HEX"), true);
});

test("next date prefers the deadline over the visit", () => {
  const school: School = {
    ...fromSeed(file.schools[0]),
    deadline: "2027-11-01",
    deadlineLabel: "Early Action",
    visitDate: "2026-10-03",
  };
  assert.deepEqual(nextDate(school), { date: "2027-11-01", label: "Early Action" });
});

test("next open step skips finished steps", () => {
  const school: School = {
    ...fromSeed(file.schools[0]),
    steps: [
      { id: "a", label: "Campus visit", owner: "kyle", done: true, sortOrder: 0 },
      { id: "b", label: "Interview", owner: "kyle", done: false, sortOrder: 1 },
    ],
  };
  assert.equal(nextOpenStep(school), "Interview");
});

test("interest sort puts top choice ahead of the sheet order", () => {
  const [first, second] = file.schools.slice(0, 2).map(fromSeed);
  const ranked = { ...second, interestLevel: "top" as const };
  const sorted = [first, ranked].sort((a, b) => compareSchools(a, b, "interest"));
  assert.equal(sorted[0].id, second.id);
});

test("location sort orders by state then city", () => {
  const [a, b, c] = file.schools.slice(0, 3).map(fromSeed);
  const texas = { ...a, location: "Austin, TX", listOrder: 3 };
  const mass = { ...b, location: "Medford, MA", listOrder: 1 };
  const massB = { ...c, location: "Cambridge, MA", listOrder: 2 };
  const sorted = [texas, mass, massB].sort((left, right) =>
    compareSchools(left, right, "location"),
  );
  assert.deepEqual(
    sorted.map((school) => school.location),
    ["Cambridge, MA", "Medford, MA", "Austin, TX"],
  );
});

test("selectivity tier only uses the admissions lines that fit", () => {
  const tiers = file.schools.map((school) => selectivityTierFromContext(school.admissionsContext));
  assert.equal(tiers.filter((tier) => tier === "extremely_selective").length, 9);
  assert.equal(tiers.filter((tier) => tier === "very_selective").length, 3);
  assert.equal(tiers.filter((tier) => tier === "competitive").length, 12);
  assert.equal(tiers.filter((tier) => tier === "less_competitive").length, 0);
  assert.equal(tiers.filter((tier) => tier === "").length, 21);
  assert.equal(fromSeed(file.schools[0]).selectivityTier, "extremely_selective");
  assert.equal(selectivityTierFromContext("Broad access"), "");
  assert.equal(selectivityTierFromContext("Selective"), "");
});

test("selectivityTierFromRate buckets admit rates", () => {
  assert.equal(selectivityTierFromRate(null), "");
  assert.equal(selectivityTierFromRate(11.9), "extremely_selective");
  assert.equal(selectivityTierFromRate(12), "very_selective");
  assert.equal(selectivityTierFromRate(30), "very_selective");
  assert.equal(selectivityTierFromRate(30.1), "competitive");
  assert.equal(selectivityTierFromRate(60), "competitive");
  assert.equal(selectivityTierFromRate(60.1), "less_competitive");
  assert.equal(selectivityTierFromRate(90), "less_competitive");
});

test("mapSchool keeps a stored selectivity tier over a derived one", () => {
  const base = {
    id: "test-school",
    name: "Test School",
    location: "Test, NJ",
    mechanical_engineering: "Yes",
    materials: "Yes",
    materials_offering: "",
    admissions_context: "",
    sat_context: "",
    selectivity: "",
    notes: "",
    list_order: 1,
    choice: "unsure",
    plan: "",
    visited: false,
    visit_date: null,
    visit_notes: "",
    deadline: null,
    deadline_label: "",
    selectivity_tier: "competitive",
    interest_level: "",
    application_status: "",
    admission_track: "",
    test_policy: "",
    middle_50: "",
    application_platform: "",
    required_essays: "",
    teacher_recs: "",
    cost_of_attendance: "",
    net_price_estimate: "",
    merit_aid_notes: "",
    rate_that_applies_to_kyle: 5,
    overall_admit_rate: 5,
  };
  assert.equal(mapSchool(base).selectivityTier, "competitive");
  assert.equal(mapSchool({ ...base, selectivity_tier: "" }).selectivityTier, "extremely_selective");
});

test("pathwayFromContext strips tier prefixes for the snapshot card", async () => {
  const { pathwayFromContext } = await import("./types");
  assert.equal(
    pathwayFromContext("Competitive direct-to-engineering pathway"),
    "Direct-to-engineering",
  );
  assert.equal(pathwayFromContext("Extremely selective"), "");
  assert.equal(pathwayFromContext(""), "");
  assert.equal(pathwayFromContext("Engineering entry pathway"), "Engineering entry");
});

test("next action is the earliest unfinished deadline", () => {
  const school: School = {
    ...fromSeed(file.schools[0]),
    deadlines: [
      { id: "late", title: "Regular", dueDate: "2028-01-01", completed: false, sortOrder: 1 },
      { id: "early", title: "Early Action", dueDate: "2027-11-01", completed: false, sortOrder: 0 },
      { id: "done", title: "Visit", dueDate: "2026-10-01", completed: true, sortOrder: 2 },
    ],
    steps: [{ id: "s", label: "Essay", owner: "kyle", done: false, sortOrder: 0 }],
  };
  assert.deepEqual(nextAction(school), { title: "Early Action", dueDate: "2027-11-01" });
});

test("adjacentInList walks previous and next in display order", async () => {
  const { adjacentInList } = await import("./list");
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(adjacentInList(items, "a"), {
    index: 0,
    previous: null,
    next: { id: "b" },
    total: 3,
  });
  assert.deepEqual(adjacentInList(items, "b"), {
    index: 1,
    previous: { id: "a" },
    next: { id: "c" },
    total: 3,
  });
  assert.deepEqual(adjacentInList(items, "c"), {
    index: 2,
    previous: { id: "b" },
    next: null,
    total: 3,
  });
  assert.deepEqual(adjacentInList(items, "missing"), {
    index: -1,
    previous: null,
    next: null,
    total: 3,
  });
});
