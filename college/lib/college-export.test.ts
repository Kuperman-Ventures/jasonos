import assert from "node:assert/strict";
import test from "node:test";
import { schoolsSpreadsheetRows, schoolsToCsv } from "./college-export";
import { fromSeed, type SchoolSeed } from "./types";

const seed: SchoolSeed = {
  id: "mit",
  name: "MIT",
  location: "Cambridge, MA",
  campusSize: "Urban / Small",
  mechanicalEngineering: "Yes",
  materials: "Yes",
  materialsOffering: "Standalone",
  admissionsContext: "Extremely selective",
  satContext: "1530-1580",
  selectivity: "",
  notes: 'Elite, "aspirational"',
  listOrder: 1,
};

test("schoolsToCsv escapes quotes and commas", () => {
  const school = {
    ...fromSeed(seed),
    visitStatus: "want" as const,
    undergradEnrollment: 4535,
  };
  const csv = schoolsToCsv([school]);
  assert.match(csv, /^School,/);
  assert.match(csv, /Want to Visit/);
  assert.match(csv, /"Elite, ""aspirational"""/);
  assert.match(csv, /4535/);
});

test("spreadsheet includes header then one data row", () => {
  const rows = schoolsSpreadsheetRows([fromSeed(seed)]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], "School");
  assert.equal(rows[1][0], "MIT");
});
