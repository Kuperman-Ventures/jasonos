import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markRoutineEvents, normalizeRoutineTitle } from "./routine.ts";
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

describe("normalizeRoutineTitle", () => {
  it("collapses punctuation and case", () => {
    assert.equal(
      normalizeRoutineTitle("Change cats' water"),
      normalizeRoutineTitle("change cats water")
    );
  });
});

describe("markRoutineEvents", () => {
  it("marks same UID on two days as routine", () => {
    const a = ev({
      uid: "water",
      title: "Change cats water",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 23, 8, 0).toISOString(),
    });
    const b = ev({
      uid: "water",
      title: "Change cats water",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 30, 8, 0).toISOString(),
    });
    const oneOff = ev({
      uid: "once",
      title: "Eye appt",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 25, 10, 0).toISOString(),
    });
    const out = markRoutineEvents([a, b, oneOff]);
    assert.equal(out.find((e) => e.uid === "water" && e.startsAt === a.startsAt)?.routine, true);
    assert.equal(out.find((e) => e.uid === "water" && e.startsAt === b.startsAt)?.routine, true);
    assert.equal(out.find((e) => e.uid === "once")?.routine, false);
  });

  it("marks matching titles on two days even with different UIDs", () => {
    const a = ev({
      uid: "a1",
      title: "Change cats' water",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 24, 7, 0).toISOString(),
    });
    const b = ev({
      uid: "b2",
      title: "Change cats water",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 31, 7, 0).toISOString(),
    });
    const out = markRoutineEvents([a, b]);
    assert.equal(out.every((e) => e.routine === true), true);
  });

  it("does not mark a one-off with a unique title", () => {
    const out = markRoutineEvents([
      ev({
        uid: "solo",
        title: "Soccer tryouts",
        startsAt: zonedLocalDate("America/New_York", 2026, 10, 26, 16, 0).toISOString(),
      }),
    ]);
    assert.equal(out[0]!.routine, false);
  });
});
