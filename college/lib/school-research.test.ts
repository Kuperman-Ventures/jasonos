import assert from "node:assert/strict";
import test from "node:test";
import {
  lookupSummary,
  mapScorecard,
  mergeFacts,
  parseSearchJson,
  pickScorecardMatch,
  type ScorecardRow,
} from "./school-research";
import { knownWebsite } from "./school-websites";
import { schoolFaviconUrl } from "./types";

const mit: ScorecardRow = {
  id: 166683,
  "school.name": "Massachusetts Institute of Technology",
  "school.city": "Cambridge",
  "school.state": "MA",
  "school.locale": 12,
  "school.school_url": "web.mit.edu/",
  "latest.student.size": 4535,
  "latest.admissions.admission_rate.overall": 0.0455,
  "latest.admissions.test_requirements": 1,
  "latest.admissions.sat_scores.25th_percentile.critical_reading": 740,
  "latest.admissions.sat_scores.75th_percentile.critical_reading": 780,
  "latest.admissions.sat_scores.25th_percentile.math": 780,
  "latest.admissions.sat_scores.75th_percentile.math": 800,
  "latest.cost.attendance.academic_year": 82730,
};

test("scorecard match prefers Georgia Tech over technical colleges", () => {
  const rows: ScorecardRow[] = [
    { id: 1, "school.name": "Southern Regional Technical College" },
    { id: 2, "school.name": "Georgia Institute of Technology-Main Campus" },
    { id: 3, "school.name": "West Georgia Technical College" },
  ];
  assert.equal(pickScorecardMatch("Georgia Tech", rows)?.id, 2);
});

test("scorecard facts use published numbers and do not set a selectivity tier", () => {
  const facts = mapScorecard(mit);
  assert.equal(facts.location, "Cambridge, MA");
  assert.equal(facts.campusSize, "Urban / Small");
  assert.equal(facts.admissionsContext, "Admit rate 4.6% in the latest College Scorecard");
  assert.equal(facts.satContext, "SAT reading 740-780, math 780-800");
  assert.equal(facts.middle50, facts.satContext);
  assert.equal(facts.testPolicy, "Test required");
  assert.match(facts.costOfAttendance, /\$82,730/);
  assert.equal(facts.website, "https://web.mit.edu/");
  assert.equal(facts.sources[0]?.url, "https://web.mit.edu/");
  assert.match(facts.sources[1]?.url ?? "", /166683/);
});

test("scorecard match prefers Purdue's main campus over Fort Wayne", () => {
  const rows: ScorecardRow[] = [
    { id: 1, "school.name": "Purdue University Fort Wayne" },
    { id: 2, "school.name": "Purdue University-Main Campus" },
  ];
  assert.equal(pickScorecardMatch("Purdue University", rows)?.id, 2);
  assert.equal(
    pickScorecardMatch("Purdue University", [{ id: 9, "school.name": "Purdue University Fort Wayne" }]),
    null,
  );
});

test("public schools outside New Jersey show the out-of-state sticker", () => {
  const facts = mapScorecard({
    id: 139755,
    "school.name": "Georgia Institute of Technology-Main Campus",
    "school.city": "Atlanta",
    "school.state": "GA",
    "school.ownership": 1,
    "latest.cost.attendance.academic_year": 28167,
    "latest.cost.tuition.out_of_state": 34484,
    "latest.cost.roomboard.oncampus": 13608,
    "latest.cost.booksupply": 800,
    "latest.cost.otherexpense.oncampus": 3200,
  });
  assert.match(facts.costOfAttendance, /\$52,092 out-of-state/);
  assert.match(facts.costOfAttendance, /\$28,167/);
});

test("search JSON drops past dates and ignores invented SAT fields", () => {
  const parsed = parseSearchJson(
    `Here you go\n{"officialName":"Purdue University","testPolicy":"Test optional","applicationPlatform":"Common App","mechanicalEngineering":"Yes","deadlines":[{"title":"Early Action","dueDate":"2026-11-01"},{"title":"Old Regular","dueDate":"2024-01-01"},{"title":"Regular","dueDate":"November 1"}],"sat":"1500"}`,
    "2026-09-19",
  );
  assert.ok(parsed);
  assert.equal(parsed?.applicationPlatform, "Common App");
  assert.equal(parsed?.mechanicalEngineering, "Yes");
  assert.equal(parsed?.deadlines.length, 2);
  assert.equal(parsed?.deadlines[0]?.dueDate, "2026-11-01");
  assert.equal(parsed?.deadlines[1]?.dueDate, null);
});

test("web facts are ignored unless a search returned a source, and they do not replace Scorecard numbers", () => {
  const scorecard = mapScorecard(mit);
  const search = parseSearchJson(
    `{"location":"Somewhere","testPolicy":"Test optional","applicationPlatform":"Coalition","cost":"$1","deadlines":[{"title":"Early Action","dueDate":"2026-11-01"}]}`,
    "2026-09-19",
  );
  const blocked = mergeFacts(scorecard, search, []);
  assert.equal(blocked.applicationPlatform, "");
  assert.equal(blocked.testPolicy, "Test required");
  const merged = mergeFacts(scorecard, search, [{ title: "Admissions", url: "https://example.edu/apply" }]);
  assert.equal(merged.location, "Cambridge, MA");
  assert.equal(merged.testPolicy, "Test required");
  assert.equal(merged.applicationPlatform, "Coalition");
  assert.equal(merged.costOfAttendance.includes("82,730"), true);
  assert.equal(merged.deadlines.length, 1);
});

test("summary says what was filled and what stays blank", () => {
  const summary = lookupSummary({
    name: "Purdue University",
    facts: mapScorecard(mit),
    scorecard: "hit",
    search: "skipped",
  });
  assert.match(summary, /College Scorecard filled/);
  assert.match(summary, /Web search did not run/);
  assert.match(summary, /Interest, selectivity tier, and net price stay blank/);
});

test("school icons use the official site, not a branch campus", () => {
  assert.equal(knownWebsite("purdue-university"), "https://www.purdue.edu/");
  assert.equal(knownWebsite("mit"), "https://web.mit.edu/");
  assert.match(schoolFaviconUrl("https://web.mit.edu/"), /domain=web\.mit\.edu/);
  assert.match(schoolFaviconUrl("https://twin-cities.umn.edu/"), /domain=twin-cities\.umn\.edu/);
  assert.equal(schoolFaviconUrl(""), "");
});
