import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { compareSchools, nextDate, nextOpenStep } from "./list";
import { fromSeed, type School, type SchoolSeed } from "./types";

const file = JSON.parse(
  fs.readFileSync(new URL("../content/schools.json", import.meta.url), "utf8"),
) as { schools: SchoolSeed[]; selectivityGuide: { term: string; meaning: string }[] };

test("spreadsheet seed has every school and the selectivity guide", () => {
  assert.equal(file.schools.length, 43);
  assert.equal(file.selectivityGuide.length, 5);
  for (const school of file.schools) {
    assert.ok(school.name);
    assert.ok(school.location);
    assert.ok(school.admissionsContext);
    assert.ok(school.notes);
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

test("choice sort puts top choice ahead of the sheet order", () => {
  const [first, second] = file.schools.slice(0, 2).map(fromSeed);
  const ranked = { ...second, choice: "top" as const };
  const sorted = [first, ranked].sort((a, b) => compareSchools(a, b, "choice"));
  assert.equal(sorted[0].id, second.id);
});
