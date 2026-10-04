import assert from "node:assert/strict";
import test from "node:test";
import {
  agendaForMeetingDate,
  familyMeetingCadenceLabel,
  familyMeetingCalendarEvents,
  familyMeetingDates,
  familyMeetingFullyDone,
  familyMeetingIntervalDays,
  familyMeetingOccurrence,
  isFamilyMeetingDate,
  nextFamilyMeetingDate,
  normalizeDoneBy,
  sundayOnOrAfter,
  toggleFamilyMeetingAck,
} from "./family-meeting";

test("exploration meetings are Sundays every two weeks from 6 Sep 2026", () => {
  assert.equal(sundayOnOrAfter("2026-09-01"), "2026-09-06");
  assert.deepEqual(familyMeetingDates("2026-09-01", "2026-10-04"), [
    "2026-09-06",
    "2026-09-20",
    "2026-10-04",
  ]);
  assert.equal(familyMeetingIntervalDays("exploration"), 14);
  assert.equal(familyMeetingCadenceLabel("exploration"), "every two weeks");
  assert.equal(isFamilyMeetingDate("2026-10-04"), true);
  assert.equal(isFamilyMeetingDate("2026-10-05"), false);
  assert.equal(isFamilyMeetingDate("2026-12-27"), true);
  assert.equal(isFamilyMeetingDate("2027-01-03"), false);
  assert.equal(isFamilyMeetingDate("2027-04-18"), true);
  assert.equal(isFamilyMeetingDate("2027-05-02"), true);
});

test("consideration and applications meetings are weekly Sundays", () => {
  assert.equal(familyMeetingIntervalDays("consideration"), 7);
  assert.equal(familyMeetingIntervalDays("applications"), 7);
  assert.equal(familyMeetingCadenceLabel("consideration"), "weekly");
  const spring = familyMeetingDates("2027-04-01", "2027-05-31");
  assert.deepEqual(spring, [
    "2027-04-04",
    "2027-04-18",
    "2027-05-02",
    "2027-05-09",
    "2027-05-16",
    "2027-05-23",
    "2027-05-30",
  ]);
  assert.equal(familyMeetingOccurrence("2027-05-02").cadence, "weekly");
  assert.equal(familyMeetingOccurrence("2026-10-04").cadence, "biweekly");
});

test("nextFamilyMeetingDate includes today when today is a meeting Sunday", () => {
  assert.equal(nextFamilyMeetingDate(new Date(2026, 9, 4)), "2026-10-04");
  assert.equal(nextFamilyMeetingDate(new Date(2026, 9, 5)), "2026-10-18");
  assert.equal(nextFamilyMeetingDate(new Date(2026, 11, 28)), "2027-01-10");
});

test("doneBy helpers keep household order and require every owner", () => {
  assert.deepEqual(normalizeDoneBy(["kat", "jason", "kat", "nope"]), ["jason", "kat"]);
  assert.equal(familyMeetingFullyDone(["kyle", "jason", "kat"]), true);
  assert.equal(familyMeetingFullyDone(["kyle", "jason"]), false);
  assert.deepEqual(toggleFamilyMeetingAck(["kyle"], "jason", true), ["kyle", "jason"]);
  assert.deepEqual(toggleFamilyMeetingAck(["kyle", "jason"], "kyle", false), ["jason"]);
});

test("open agenda items sit on the next meeting only", () => {
  const items = [
    { id: "open", label: "Visit window", doneBy: ["kyle"] as const, done: false },
    { id: "done", label: "Already discussed", doneBy: ["kyle", "jason", "kat"] as const, done: true },
  ];
  const now = new Date(2026, 9, 5);
  assert.deepEqual(
    agendaForMeetingDate("2026-10-18", [...items], now).map((row) => row.id),
    ["open"],
  );
  assert.deepEqual(agendaForMeetingDate("2026-10-04", [...items], now).map((row) => row.id), []);
});

test("family meeting calendar events cover the ICS window", () => {
  const events = familyMeetingCalendarEvents(new Date(2026, 9, 4), 4);
  assert.ok(events.some((event) => event.id === "family-meeting-2026-10-04"));
  assert.ok(events.every((event) => event.title === "Family meeting"));
});
