import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeCalendarEvents,
  removeCalendarEvent,
  shortEventDate,
  updateCalendarEvent,
  type CalendarEvent,
} from "./calendar-events";

function sample(partial: Partial<CalendarEvent> & Pick<CalendarEvent, "id" | "title">): CalendarEvent {
  return {
    date: null,
    startTime: null,
    endTime: null,
    notes: "",
    createdAt: "2026-09-22T12:00:00.000Z",
    createdBy: "jason",
    sourceId: null,
    assetUrl: null,
    assetPath: null,
    ...partial,
  };
}

test("shortEventDate labels undated and known days", () => {
  assert.equal(shortEventDate(null), "Undated");
  assert.equal(shortEventDate("2026-09-30"), "Sep 30, 2026");
});

test("updateCalendarEvent and removeCalendarEvent", () => {
  const events = [sample({ id: "e1", title: "Fair", date: "2026-09-01" })];
  const updated = updateCalendarEvent(events, "e1", {
    title: "College Fair",
    date: "2026-09-30",
    notes: "Bring questions",
  });
  assert.equal(updated[0]!.title, "College Fair");
  assert.equal(updated[0]!.date, "2026-09-30");
  assert.equal(updated[0]!.notes, "Bring questions");
  assert.equal(removeCalendarEvent(updated, "e1").length, 0);
});

test("normalizeCalendarEvents drops bad rows", () => {
  assert.equal(normalizeCalendarEvents(null).length, 0);
  assert.equal(
    normalizeCalendarEvents([{ id: "ok", title: "Ok" }, { title: "missing id" }]).length,
    1,
  );
});
