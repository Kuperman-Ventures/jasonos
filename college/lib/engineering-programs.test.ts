import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type ResearchProgram = {
  id: string;
  name: string;
  category: string;
  sourceUrl: string;
  notes?: string;
};

type ResearchSchool = {
  schoolId: string;
  school: string;
  programs: ResearchProgram[];
};

const dataPath = path.join(process.cwd(), "data", "engineering-programs.json");
const schools = JSON.parse(readFileSync(dataPath, "utf8")) as ResearchSchool[];

test("engineering-programs research covers 45 schools and 426 programs", () => {
  assert.equal(schools.length, 45);
  assert.equal(
    schools.reduce((sum, school) => sum + school.programs.length, 0),
    426,
  );
});

test("engineering-programs ids are unique and sourceUrls are http(s)", () => {
  const ids = new Set<string>();
  for (const school of schools) {
    for (const program of school.programs) {
      assert.ok(program.id, `missing id for ${school.schoolId}`);
      assert.equal(ids.has(program.id), false, `duplicate id ${program.id}`);
      ids.add(program.id);
      assert.match(program.sourceUrl, /^https?:\/\//);
    }
  }
});

test("vassar-college has an empty engineering major list", () => {
  const vassar = schools.find((school) => school.schoolId === "vassar-college");
  assert.ok(vassar);
  assert.equal(vassar!.programs.length, 0);
});
