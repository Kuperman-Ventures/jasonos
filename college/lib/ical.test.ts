import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIcsCalendar, webcalUrlFromHttps } from "./ical";
import type { CalendarEvent } from "./calendar-events";

test("buildIcsCalendar emits all-day VEVENT for dated rows", () => {
  const events: CalendarEvent[] = [
    {
      id: "evt-1",
      title: "College + Career Fair Key",
      date: "2026-09-30",
      startTime: null,
      endTime: null,
      notes: "Bring questions",
      createdAt: "2026-09-22T12:00:00.000Z",
      createdBy: "jason",
      sourceId: null,
      assetUrl: null,
      assetPath: null,
    },
    {
      id: "evt-undated",
      title: "Skip me",
      date: null,
      startTime: null,
      endTime: null,
      notes: "",
      createdAt: "2026-09-22T12:00:00.000Z",
      createdBy: "jason",
      sourceId: null,
      assetUrl: null,
      assetPath: null,
    },
  ];
  const ics = buildIcsCalendar(events);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /SUMMARY:College \+ Career Fair Key/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260930/);
  assert.match(ics, /DTEND;VALUE=DATE:20261001/);
  assert.doesNotMatch(ics, /Skip me/);
});

test("webcalUrlFromHttps swaps scheme", () => {
  assert.equal(
    webcalUrlFromHttps("https://kyle-college.vercel.app/api/calendar/ics?token=abc"),
    "webcal://kyle-college.vercel.app/api/calendar/ics?token=abc",
  );
});
