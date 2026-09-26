import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminHygiene,
  isSeniorCycleDeadline,
  loginUrlForSite,
  mapAdminMember,
} from "./admin";
import { fromSeed, type SchoolSeed } from "./types";

const seed: SchoolSeed = {
  id: "test-u",
  name: "Test University",
  location: "Test, NJ",
  campusSize: "",
  mechanicalEngineering: "Yes",
  materials: "Yes",
  materialsOffering: "Standalone",
  aerospaceEngineering: "Yes",
  admissionsContext: "Extremely selective",
  satContext: "",
  selectivity: "",
  notes: "",
  listOrder: 1,
};

test("isSeniorCycleDeadline flags 2026-27 grid dates only", () => {
  assert.equal(isSeniorCycleDeadline("2026-11-01"), true);
  assert.equal(isSeniorCycleDeadline("2027-01-15"), true);
  assert.equal(isSeniorCycleDeadline("2027-11-01"), false);
  assert.equal(isSeniorCycleDeadline("2028-01-05"), false);
  assert.equal(isSeniorCycleDeadline(null), false);
});

test("buildAdminHygiene counts blank interest and senior deadlines", () => {
  const blank = fromSeed(seed);
  const filled = {
    ...fromSeed({ ...seed, id: "filled", name: "Filled U" }),
    interestLevel: "top" as const,
    selectivityTier: "extremely_selective" as const,
    website: "https://example.edu",
  };
  const withSenior = {
    ...filled,
    id: "senior",
    name: "Senior U",
    deadlines: [
      {
        id: "d1",
        title: "Early Action",
        dueDate: "2026-11-01",
        completed: false,
        sortOrder: 0,
      },
    ],
  };
  const hygiene = buildAdminHygiene([blank, filled, withSenior]);
  assert.equal(hygiene.blankInterest.length, 1);
  assert.equal(hygiene.blankInterest[0]?.id, "test-u");
  assert.equal(hygiene.seniorCycleDeadlines.length, 1);
  assert.equal(hygiene.seniorCycleDeadlines[0]?.dueDate, "2026-11-01");
  assert.ok(hygiene.phaseCounts.some((row) => row.id === "exploration" && row.count >= 1));
});

test("mapAdminMember and loginUrlForSite", () => {
  const row = mapAdminMember({
    id: "kyle",
    displayName: "Kyle",
    email: "kykupe@gmail.com",
    role: "student",
    uiVisible: true,
    authUserId: null,
    avatarUrl: null,
  });
  assert.equal(row.roleLabel, "Student");
  assert.equal(row.hasAuth, false);
  assert.equal(loginUrlForSite("https://kyle-college.vercel.app/"), "https://kyle-college.vercel.app/login");
});
