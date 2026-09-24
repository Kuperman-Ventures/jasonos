import assert from "node:assert/strict";
import test from "node:test";
import schoolsFile from "@/content/schools.json";
import {
  mapCommonAppRow,
  pickCommonAppMatch,
  queryCommonAppGrid,
  schoolNeedsCommonAppFill,
  type CommonAppGridRow,
} from "./common-app-grid";

test("Common App match prefers UPenn over Stroudsburg", () => {
  assert.equal(pickCommonAppMatch("University of Pennsylvania (UPenn)")?.name, "University of Pennsylvania");
});

test("Common App match prefers Texas A&M main campus over East Texas A&M", () => {
  assert.equal(pickCommonAppMatch("Texas A&M University")?.name, "Texas A&M University");
});

test("Common App match prefers UVA over College at Wise", () => {
  assert.equal(pickCommonAppMatch("University of Virginia (UVA)")?.name, "University of Virginia");
});

test("Common App match resolves nicknames and parentheticals", () => {
  assert.equal(pickCommonAppMatch("Georgia Institute of Technology (Georgia Tech)")?.name, "Georgia Institute of Technology");
  assert.equal(pickCommonAppMatch("Pennsylvania State University (Penn State)")?.name, "Penn State");
  assert.equal(pickCommonAppMatch("Virginia Polytechnic Institute and State University (Virginia Tech)")?.name, "Virginia Tech");
  assert.equal(pickCommonAppMatch("Carnegie Mellon University (CMU)")?.name, "Carnegie Mellon University");
  assert.equal(pickCommonAppMatch("University of Wisconsin–Madison")?.name, "University of Wisconsin- Madison");
});

test("MIT and UC campuses intentionally miss (not on Common App)", () => {
  assert.equal(pickCommonAppMatch("Massachusetts Institute of Technology (MIT)"), null);
  assert.equal(pickCommonAppMatch("University of California, Berkeley (UC Berkeley)"), null);
  assert.equal(pickCommonAppMatch("University of California, Los Angeles (UCLA)"), null);
  assert.equal(pickCommonAppMatch("University of California, Davis (UC Davis)"), null);
  assert.equal(pickCommonAppMatch("University of California, Irvine (UC Irvine)"), null);
});

test("Kyle list schools match when present on the Common App grid", () => {
  const expectedMisses = new Set([
    "Massachusetts Institute of Technology (MIT)",
    "University of California, Berkeley (UC Berkeley)",
    "University of California, Los Angeles (UCLA)",
    "University of California, Davis (UC Davis)",
    "University of California, Irvine (UC Irvine)",
  ]);
  for (const school of schoolsFile.schools) {
    const result = queryCommonAppGrid(school.name);
    if (expectedMisses.has(school.name)) {
      assert.equal(result.status, "miss", school.name);
    } else {
      assert.equal(result.status, "hit", school.name);
      assert.ok(result.facts?.applicationPlatform);
      assert.ok(result.facts?.teacherRecs);
    }
  }
});

test("mapCommonAppRow fills platform, essays, recs, test policy, and deadlines", () => {
  const row: CommonAppGridRow = {
    name: "Stanford University",
    platform: "Common App",
    schoolType: "Coed",
    deadlines: {
      ED: null,
      EDII: null,
      EA: null,
      EAII: null,
      REA: "2026-11-01",
      RD: "2027-01-05",
    },
    feeUS: 100,
    feeIntl: 100,
    feeWaiver: "Accepted",
    requiresPersonalEssay: true,
    requiresCoursesAndGrades: true,
    portfolio: null,
    testPolicyCode: "A",
    testPolicy: "Required",
    testsUsed: "SAT without essay or ACT without science or writing",
    teacherRecs: 2,
    otherRecs: 0,
    midYearReport: true,
    counselorRec: true,
    source: "Common App 2026-27 Requirements Grid",
  };
  const facts = mapCommonAppRow(row);
  assert.equal(facts.applicationPlatform, "Common App");
  assert.match(facts.requiredEssays, /personal essay required/i);
  assert.match(facts.teacherRecs, /2 teacher recommendations/);
  assert.match(facts.teacherRecs, /counselor recommendation required/);
  assert.match(facts.testPolicy, /Required/);
  assert.match(facts.meritAidNotes, /\$100/);
  assert.equal(facts.deadlines.length, 2);
  assert.equal(facts.deadlines[0]?.title, "Restrictive Early Action");
  assert.equal(facts.deadlines[0]?.dueDate, "2026-11-01");
  assert.equal(facts.deadlines[1]?.title, "Regular Decision");
  assert.equal(facts.deadlines[1]?.dueDate, "2027-01-05");
});

test("schoolNeedsCommonAppFill detects blank application fields", () => {
  assert.equal(
    schoolNeedsCommonAppFill({
      applicationPlatform: "",
      requiredEssays: "",
      teacherRecs: "",
      testPolicy: "Test optional",
      meritAidNotes: "",
      deadlines: [],
    }),
    true,
  );
  assert.equal(
    schoolNeedsCommonAppFill({
      applicationPlatform: "Common App",
      requiredEssays: "Common App personal essay required",
      teacherRecs: "2 teacher recommendations",
      testPolicy: "Required",
      meritAidNotes: "US application fee $100",
      deadlines: [{ title: "Regular Decision" }],
    }),
    false,
  );
});
