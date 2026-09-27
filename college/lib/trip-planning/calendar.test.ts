import assert from "node:assert/strict";
import test from "node:test";
import schoolsFile from "@/content/schools.json";
import {
  CAMPUS_CALENDARS,
  buildCampusCalendar,
  campusWeekState,
  getCampusDayStatus,
  listCampusCalendarCoverage,
  springBreakRangeLabel,
} from "./calendar";

const schoolNames = schoolsFile.schools.map((s) => s.name);

test("all 43 college-list schools have a campus calendar record", () => {
  const coverage = listCampusCalendarCoverage(schoolNames);
  assert.equal(CAMPUS_CALENDARS.length, 43);
  assert.equal(coverage.matched.length, 43);
  assert.deepEqual(coverage.schoolsMissingCalendar, []);
  assert.deepEqual(coverage.calendarsMissingSchool, []);
});

test("MIT spring break week is break; following week is session", () => {
  const mit = "Massachusetts Institute of Technology (MIT)";
  const cal = buildCampusCalendar(mit);
  // Week of Mar 22, 2027 = index 3; Mar 29 = index 4
  assert.equal(campusWeekState(cal, 3), "break");
  assert.equal(campusWeekState(cal, 4), "session");
  assert.match(cal[3]!.tooltip, /Spring break/);
});

test("getCampusDayStatus prefers break over classes on spring break", () => {
  const day = getCampusDayStatus(
    "Massachusetts Institute of Technology (MIT)",
    "2027-03-23",
  );
  assert.equal(day.status, "break");
  assert.equal(day.label, "Spring break");
});

test("weekend inside classes period is labeled Weekend", () => {
  const day = getCampusDayStatus(
    "Massachusetts Institute of Technology (MIT)",
    "2027-03-06", // Saturday during spring classes
  );
  assert.equal(day.status, "classes");
  assert.equal(day.label, "Weekend");
});

test("dates after last period and before Aug 1 are summer between_terms", () => {
  const day = getCampusDayStatus(
    "Massachusetts Institute of Technology (MIT)",
    "2027-06-01",
  );
  assert.equal(day.status, "between_terms");
  assert.equal(day.label, "Summer (no regular classes)");
});

test("dates on or after Aug 1 2027 are not yet loaded", () => {
  const day = getCampusDayStatus(
    "Massachusetts Institute of Technology (MIT)",
    "2027-08-01",
  );
  assert.equal(day.status, null);
  assert.equal(day.label, "Calendar not yet loaded");
});

test("springBreakRangeLabel finds MIT spring break", () => {
  const label = springBreakRangeLabel(
    CAMPUS_CALENDARS.find(
      (row) => row.school === "Massachusetts Institute of Technology (MIT)",
    )!,
  );
  assert.equal(label, "Mar 22 - Mar 26");
});

test("stubCampusCalendar is gone", async () => {
  const mod = await import("./calendar");
  assert.equal("stubCampusCalendar" in mod, false);
});
