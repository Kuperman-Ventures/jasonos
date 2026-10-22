import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeAcrossLanes,
  dedupeOccurrences,
  filterEventsToWindow,
  occurrenceKey,
} from "./dedupe.ts";
import type { FamilyMeetingEvent } from "./types.ts";
import { zonedLocalDate } from "./weekend.ts";

function ev(
  partial: Partial<FamilyMeetingEvent> & Pick<FamilyMeetingEvent, "uid" | "startsAt" | "title">
): FamilyMeetingEvent {
  return {
    id: partial.id ?? `${partial.uid}-${partial.startsAt}`,
    uid: partial.uid,
    title: partial.title,
    startsAt: partial.startsAt,
    endsAt: partial.endsAt ?? partial.startsAt,
    allDay: partial.allDay ?? false,
    calendarName: partial.calendarName ?? "Test",
    calendarHref: partial.calendarHref ?? "/test/",
    groupId: partial.groupId ?? "family",
  };
}

describe("filterEventsToWindow", () => {
  it("drops events that start before or after the two-week window", () => {
    const start = zonedLocalDate("America/New_York", 2026, 10, 22, 0, 0);
    const end = zonedLocalDate("America/New_York", 2026, 11, 5, 0, 0);
    const kept = filterEventsToWindow(
      [
        ev({ uid: "old", title: "Old", startsAt: "2023-10-22T00:00:00.000Z", allDay: true }),
        ev({
          uid: "in",
          title: "In range",
          startsAt: zonedLocalDate("America/New_York", 2026, 10, 25, 9, 0).toISOString(),
        }),
        ev({
          uid: "late",
          title: "Day 15",
          startsAt: zonedLocalDate("America/New_York", 2026, 11, 5, 0, 0).toISOString(),
          allDay: true,
        }),
      ],
      start,
      end
    );
    assert.equal(kept.length, 1);
    assert.equal(kept[0]!.uid, "in");
  });
});

describe("dedupeOccurrences", () => {
  it("keeps one row per uid+start", () => {
    const a = ev({ uid: "same", title: "A", startsAt: "2026-10-24T14:00:00.000Z" });
    const b = ev({ uid: "same", title: "A copy", startsAt: "2026-10-24T14:00:00.000Z" });
    const c = ev({ uid: "same", title: "Next week", startsAt: "2026-10-31T14:00:00.000Z" });
    const out = dedupeOccurrences([a, b, c]);
    assert.equal(out.length, 2);
    assert.equal(occurrenceKey("same", a.startsAt), occurrenceKey("same", b.startsAt));
  });
});

describe("dedupeAcrossLanes", () => {
  it("keeps a shared occurrence on the more specific lane", () => {
    const start = "2026-10-24T15:00:00.000Z";
    const family = ev({
      uid: "shared",
      title: "Eye appt",
      startsAt: start,
      groupId: "family",
    });
    const kyle = ev({
      uid: "shared",
      title: "Eye appt",
      startsAt: start,
      groupId: "kyle_kat_jason",
    });
    const byLane = dedupeAcrossLanes([
      { groupId: "family", events: [family] },
      { groupId: "kyle_kat_jason", events: [kyle] },
    ]);
    assert.equal(byLane.get("family")!.length, 0);
    assert.equal(byLane.get("kyle_kat_jason")!.length, 1);
  });
});
