import assert from "node:assert/strict";
import test from "node:test";
import {
  SAMPLE_FAMILY_DRAFT,
  buildFamilyProfile,
  calcCore,
  normalizeFamilyProfile,
  programCapForSchool,
  rangeAround,
} from "./familyFinances";
import { financeRecordForSchoolName, normalizeHouseholdFinances } from "./finances";

test("sample married NJ family SAI range is about $26k–$32k", () => {
  const core = calcCore(SAMPLE_FAMILY_DRAFT);
  assert.ok(core.sai != null);
  assert.ok(core.sai! > 20000 && core.sai! < 40000);
  const range = rangeAround(core.sai!, 0.1);
  assert.ok(range.low >= 20000 && range.low <= 30000);
  assert.ok(range.high >= 28000 && range.high <= 36000);
});

test("low-income families get automatic −$1,500 SAI", () => {
  const core = calcCore({
    ...SAMPLE_FAMILY_DRAFT,
    agi: 40000,
    p1: 25000,
    p2: 15000,
    tax: 2000,
    cash: 1000,
    inv: 0,
    home: 0,
  });
  assert.equal(core.sai, -1500);
  assert.equal(core.autoLow, true);
});

test("MIT caps at cost − tuition under $200k", () => {
  const mit = financeRecordForSchoolName("Massachusetts Institute of Technology (MIT)");
  assert.ok(mit);
  const cap = programCapForSchool(mit!, 150000, true);
  assert.ok(cap);
  assert.equal(cap!.tag.includes("MIT") || cap!.why.includes("MIT"), true);
  const tuition = mit!.tuitionFees ?? 0;
  const cost = mit!.totalCost ?? 0;
  assert.equal(cap!.cap, Math.max(0, cost - tuition));
});

test("MIT full-cost under $100k beats tuition-free", () => {
  const mit = financeRecordForSchoolName("Massachusetts Institute of Technology (MIT)");
  assert.ok(mit);
  const cap = programCapForSchool(mit!, 90000, true);
  assert.ok(cap);
  assert.equal(cap!.cap, 0);
});

test("Rutgers Scarlet Guarantee only for NJ at ≤ $100k", () => {
  const rutgers = financeRecordForSchoolName("Rutgers University–New Brunswick");
  assert.ok(rutgers);
  const nj = programCapForSchool(rutgers!, 90000, true);
  assert.ok(nj);
  assert.match(nj!.tag, /Scarlet/i);
  const other = programCapForSchool(rutgers!, 90000, false);
  assert.equal(other, null);
});

test("buildFamilyProfile stores school estimates keyed by id", () => {
  const mit = financeRecordForSchoolName("Massachusetts Institute of Technology (MIT)");
  const profile = buildFamilyProfile(SAMPLE_FAMILY_DRAFT, [
    { id: "mit", name: mit!.school, finance: mit },
  ]);
  assert.ok(profile);
  assert.ok(profile!.schools.mit);
  assert.equal(profile!.residency, "NJ");
  assert.equal(profile!.incomeBand, "Over $110,000");
});

test("malformed familyProfile normalizes to null", () => {
  assert.equal(normalizeFamilyProfile(null), null);
  assert.equal(normalizeFamilyProfile({ enteredAt: "2026-01-01" }), null);
  const household = normalizeHouseholdFinances({
    annualBudget: 60000,
    costIncreasePct: 4,
    schools: {},
    familyProfile: { broken: true },
  });
  assert.equal(household.familyProfile, null);
  assert.equal(household.annualBudget, 60000);
});
