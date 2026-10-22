import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitAgendaLists } from "./collapse.ts";
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
    routine: partial.routine,
  };
}

describe("splitAgendaLists", () => {
  it("keeps one-offs in spotlight and collapses routines", () => {
    const birthday = ev({
      uid: "bday",
      title: "Lucien’s Birthday",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 30, 0, 0).toISOString(),
      allDay: true,
      routine: false,
    });
    const vac1 = ev({
      uid: "vac",
      title: "Dad Vacuums 1st & 2nd Floor",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 23, 17, 0).toISOString(),
      routine: true,
    });
    const vac2 = ev({
      uid: "vac",
      title: "Dad Vacuums 1st & 2nd Floor",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 30, 17, 0).toISOString(),
      routine: true,
    });
    const { spotlight, routines } = splitAgendaLists([vac1, birthday, vac2]);
    assert.equal(spotlight.length, 1);
    assert.equal(spotlight[0]!.title, "Lucien’s Birthday");
    assert.equal(routines.length, 1);
    assert.equal(routines[0]!.title, "Dad Vacuums 1st & 2nd Floor");
    assert.equal(routines[0]!.dateLabels.length, 2);
    assert.equal(routines[0]!.weekdayLabel, "Fri");
    assert.equal(routines[0]!.timeLabel, "5:00 PM");
  });
});
