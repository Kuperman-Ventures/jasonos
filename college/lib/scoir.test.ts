import assert from "node:assert/strict";
import test from "node:test";
import {
  formatApplicationFee,
  honorsCollegeLine,
  scoirNewJerseyPct,
  scoirRecordForSchool,
  scoirRequirementState,
  scoirSchoolCount,
  scoirSummaryCounts,
} from "./scoir";

test("scoir import covers 40 schools with revised summary counts", () => {
  assert.equal(scoirSchoolCount(), 40);
  const summary = scoirSummaryCounts();
  assert.equal(summary.schoolCount, 40);
  assert.equal(summary.demonstratedInterest, 12);
  assert.equal(summary.netPriceTable, 13);
  assert.equal(summary.netPriceNoteOnly, 27);
  assert.equal(summary.honorsSeparate, 8);
  assert.equal(summary.honorsInvite, 10);
  assert.equal(summary.honorsNone, 22);
});

test("match by unitId then name", () => {
  const byId = scoirRecordForSchool({
    name: "Wrong Name",
    unitId: 166683,
  });
  assert.ok(byId);
  assert.match(byId!.school, /MIT/);
  assert.equal(byId!.essayOrStatement, "Required");

  const byName = scoirRecordForSchool({
    name: "Carnegie Mellon University (CMU)",
    unitId: null,
  });
  assert.ok(byName);
  assert.equal(byName!.considersDemonstratedInterest, false);
});

test("WPI and archived names have no Scoir row", () => {
  for (const name of [
    "Worcester Polytechnic Institute (WPI)",
    "Boston University",
    "Northeastern University",
    "Stevens Institute of Technology",
    "University of Connecticut",
  ]) {
    assert.equal(scoirRecordForSchool({ name, unitId: null }), null);
  }
});

test("New Jersey share highlights", () => {
  assert.equal(
    scoirNewJerseyPct({ name: "New Jersey Institute of Technology (NJIT)", unitId: 185828 }),
    87.8,
  );
  assert.equal(
    scoirNewJerseyPct({ name: "Rutgers University–New Brunswick", unitId: 186380 }),
    75.9,
  );
  assert.equal(
    scoirNewJerseyPct({ name: "University of Delaware", unitId: 130943 }),
    20.0,
  );
});

test("Tennessee geography is incomplete", () => {
  const row = scoirRecordForSchool({
    name: "University of Tennessee, Knoxville",
    unitId: 221759,
  });
  assert.ok(row);
  assert.equal(row!.undergradGeography?.complete, false);
});

test("application fee and honors helpers", () => {
  assert.equal(formatApplicationFee(0), "No fee");
  assert.equal(formatApplicationFee(75), "$75");
  assert.equal(honorsCollegeLine("Separate application"), "Honors college: separate application");
  assert.equal(honorsCollegeLine("By invitation"), "Honors college: by invitation");
  assert.equal(honorsCollegeLine(null), null);
  assert.deepEqual(scoirRequirementState("Required"), { state: "req", note: "Required" });
  assert.equal(scoirRequirementState(""), null);
  assert.equal(scoirRequirementState(null), null);
});
