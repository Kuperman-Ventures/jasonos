import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupEventsByDay } from "./days.ts";
import type { FamilyMeetingEvent } from "./types.ts";
import { zonedLocalDate } from "./weekend.ts";

function ev(
  partial: Partial<FamilyMeetingEvent> &
    Pick<FamilyMeetingEvent, "uid" | "startsAt" | "title">
): FamilyMeetingEvent {
  return {
    id: partial.id ?? `${partial.uid}-${partial.startsAt}`,
    uid: partial.uid,
    title: partial.title,
    startsAt: partial.startsAt,
    endsAt: partial.endsAt ?? partial.startsAt,
    allDay: partial.allDay ?? false,
    calendarName: "Test",
    calendarHref: "/test/",
    groupId: "family",
  };
}

describe("groupEventsByDay", () => {
  it("buckets events by local day and keeps order", () => {
    const a = ev({
      uid: "a",
      title: "Morning",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 22, 9, 0).toISOString(),
    });
    const b = ev({
      uid: "b",
      title: "Afternoon",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 22, 15, 0).toISOString(),
    });
    const c = ev({
      uid: "c",
      title: "Next day",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 23, 10, 0).toISOString(),
    });
    const groups = groupEventsByDay([c, b, a]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]!.key, "2026-10-22");
    assert.equal(groups[0]!.weekday, "Thu");
    assert.equal(groups[0]!.date, "Oct 22");
    assert.deepEqual(
      groups[0]!.events.map((e) => e.uid),
      ["a", "b"]
    );
    assert.equal(groups[1]!.key, "2026-10-23");
    assert.equal(groups[1]!.events[0]!.uid, "c");
  });
});
