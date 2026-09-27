import assert from "node:assert/strict";
import test from "node:test";
import {
  formatScorecardCost,
  formatScorecardNetPrice,
  formatScorecardSat,
  mapScorecardByIdRow,
  ScorecardUnsupportedError,
  type ScorecardByIdRow,
} from "./scorecard";

function baseRow(overrides: Partial<ScorecardByIdRow> = {}): ScorecardByIdRow {
  return {
    id: 168148,
    "school.name": "Tufts University",
    "school.city": "Medford",
    "school.state": "MA",
    "school.school_url": "www.tufts.edu",
    "school.ownership": 2,
    "latest.student.size": 6847,
    "latest.admissions.sat_scores.25th_percentile.critical_reading": 720,
    "latest.admissions.sat_scores.75th_percentile.critical_reading": 770,
    "latest.admissions.sat_scores.25th_percentile.math": 740,
    "latest.admissions.sat_scores.75th_percentile.math": 790,
    "latest.cost.attendance.academic_year": 88200,
    "latest.cost.tuition.in_state": 68000,
    "latest.cost.tuition.out_of_state": 68000,
    "latest.cost.avg_net_price.private": 35200,
    "latest.cost.avg_net_price.public": null,
    "location.lat": 42.4075,
    "location.lon": -71.119,
    ...overrides,
  };
}

test("formatScorecardSat sums percentiles with en dash", () => {
  assert.equal(formatScorecardSat(baseRow()), "~1460–1560");
  assert.equal(
    formatScorecardSat(
      baseRow({ "latest.admissions.sat_scores.25th_percentile.math": null }),
    ),
    "",
  );
});

test("formatScorecardCost private and NJ public use sticker line", () => {
  assert.equal(
    formatScorecardCost(baseRow()),
    "$88,200 sticker price, latest College Scorecard",
  );
  assert.equal(
    formatScorecardCost(
      baseRow({
        "school.ownership": 1,
        "school.state": "NJ",
        "latest.cost.attendance.academic_year": 36000,
      }),
    ),
    "$36,000 sticker price, latest College Scorecard",
  );
});

test("formatScorecardCost public outside NJ uses out-of-state formula", () => {
  const line = formatScorecardCost(
    baseRow({
      "school.ownership": 1,
      "school.state": "MI",
      "school.name": "University of Michigan",
      "latest.cost.attendance.academic_year": 30000,
      "latest.cost.tuition.in_state": 16000,
      "latest.cost.tuition.out_of_state": 55000,
    }),
  );
  // Y = 30000 - 16000 + 55000 = 69000
  assert.equal(
    line,
    "$69,000 out-of-state sticker price (College Scorecard cost of attendance with out-of-state tuition). In-state figure $30,000",
  );
});

test("formatScorecardNetPrice distinguishes public and private copy", () => {
  assert.equal(
    formatScorecardNetPrice(baseRow()),
    "$35,200 average net price for students receiving federal aid (College Scorecard)",
  );
  assert.equal(
    formatScorecardNetPrice(
      baseRow({
        "school.ownership": 1,
        "latest.cost.avg_net_price.public": 18000,
        "latest.cost.avg_net_price.private": null,
      }),
    ),
    "$18,000 average net price for in-state students receiving federal aid (College Scorecard)",
  );
});

test("mapScorecardByIdRow maps fields and rejects for-profit", () => {
  const mapped = mapScorecardByIdRow(baseRow(), "2026-09-27");
  assert.equal(mapped.unitId, 168148);
  assert.equal(mapped.location, "Medford, MA");
  assert.equal(mapped.website, "https://www.tufts.edu");
  assert.equal(mapped.control, "Private");
  assert.equal(mapped.undergradEnrollment, 6847);
  assert.equal(mapped.sat, "~1460–1560");
  assert.equal(mapped.scorecardFetchedDate, "2026-09-27");
  assert.equal(mapped.lat, 42.4075);
  assert.throws(
    () => mapScorecardByIdRow(baseRow({ "school.ownership": 3 })),
    (error: unknown) =>
      error instanceof ScorecardUnsupportedError &&
      error.message === "For-profit schools are not supported",
  );
});
