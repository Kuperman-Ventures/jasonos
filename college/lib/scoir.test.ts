import assert from "node:assert/strict";
import test from "node:test";
import {
  SCOIR_ABSENT_NAMES,
  formatScoirSatMid50,
  scoirNewJerseyPct,
  scoirRecordForSchool,
  scoirSchoolCount,
  scoirSummaryCounts,
  unmatchedScoirNames,
} from "./scoir";

test("scoir import covers 40 schools", () => {
  assert.equal(scoirSchoolCount(), 40);
  const summary = scoirSummaryCounts();
  assert.equal(summary.schoolCount, 40);
  assert.equal(summary.applying, 4);
  assert.equal(summary.following, 36);
  assert.equal(summary.usesCommonApp, 35);
  assert.equal(summary.noCommonApp, 5);
  assert.equal(summary.essayRequired, 31);
  assert.equal(summary.essaySome, 2);
  assert.equal(summary.essayOptional, 4);
  assert.equal(summary.essayNotRequired, 1);
  assert.equal(summary.essayEmpty, 2);
  assert.equal(summary.demonstratedInterest, 12);
  assert.equal(summary.bindingEarlyDecision, 12);
  assert.equal(summary.satMissing, 5);
});

test("match by unitId then name", () => {
  const byId = scoirRecordForSchool({
    name: "Wrong Name",
    unitId: 166683,
  });
  assert.ok(byId);
  assert.match(byId!.school, /MIT/);

  const byName = scoirRecordForSchool({
    name: "Carnegie Mellon University (CMU)",
    unitId: null,
  });
  assert.ok(byName);
  assert.equal(byName!.scoirListStatus, "Applying");
});

test("absent tracker schools have no Scoir row", () => {
  for (const name of SCOIR_ABSENT_NAMES) {
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

test("SAT mid-50 formats with tilde and en dash", () => {
  assert.equal(formatScoirSatMid50("1500-1570"), "~1500–1570");
  assert.equal(formatScoirSatMid50(null), "");
});

test("Tennessee geography is incomplete", () => {
  const row = scoirRecordForSchool({
    name: "University of Tennessee, Knoxville",
    unitId: 221759,
  });
  assert.ok(row);
  assert.equal(row!.undergradGeography?.complete, false);
});

test("unmatchedScoirNames reports the five absent schools", () => {
  const all = [
    ...SCOIR_ABSENT_NAMES.map((name) => ({ name, unitId: null as number | null })),
    { name: "Massachusetts Institute of Technology (MIT)", unitId: 166683 },
  ];
  const result = unmatchedScoirNames(all);
  assert.deepEqual(result.missingScoir.sort(), [...SCOIR_ABSENT_NAMES].sort());
});
