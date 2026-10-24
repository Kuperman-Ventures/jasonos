import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withEventKeys } from "./edits.ts";
import { buildPrintPackPayload, sourceLanesForSheet } from "./print-pack.ts";
import type { FamilyMeetingAgenda, FamilyMeetingEvent } from "./types.ts";
import { FAMILY_CALENDAR_GROUPS } from "./groups.ts";
import { zonedLocalDate } from "./weekend.ts";

function ev(
  partial: Partial<FamilyMeetingEvent> &
    Pick<FamilyMeetingEvent, "uid" | "startsAt" | "title" | "groupId">
): FamilyMeetingEvent {
  return withEventKeys({
    id: `${partial.uid}-${partial.startsAt}`,
    uid: partial.uid,
    title: partial.title,
    startsAt: partial.startsAt,
    endsAt: partial.startsAt,
    allDay: partial.allDay ?? false,
    calendarName: "Test",
    calendarHref: "/t/",
    groupId: partial.groupId,
    routine: partial.routine,
    presentation: partial.presentation,
  });
}

describe("sourceLanesForSheet", () => {
  it("puts family + kids on Kat & Jason", () => {
    assert.deepEqual(sourceLanesForSheet("kat_jason"), [
      "family",
      "kat_jason",
      "kyle_kat_jason",
      "wyatt_kat_jason",
    ]);
  });

  it("puts family + wyatt on Wyatt", () => {
    assert.deepEqual(sourceLanesForSheet("wyatt_kat_jason"), [
      "family",
      "wyatt_kat_jason",
    ]);
  });
});

describe("buildPrintPackPayload", () => {
  it("includes family events on every sheet and heads ups globally", () => {
    const familyEv = ev({
      uid: "fam1",
      title: "Uncle birthday",
      groupId: "family",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 26, 0, 0).toISOString(),
      allDay: true,
    });
    const wyattEv = ev({
      uid: "w1",
      title: "Soccer",
      groupId: "wyatt_kat_jason",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 27, 16, 0).toISOString(),
    });
    const heads = ev({
      uid: "h1",
      title: "Book summer camp",
      groupId: "kat_jason",
      startsAt: zonedLocalDate("America/New_York", 2026, 10, 28, 9, 0).toISOString(),
      presentation: "heads_up",
    });

    const agenda: FamilyMeetingAgenda = {
      generatedAt: new Date().toISOString(),
      weekendLabel: "test",
      rangeStart: "",
      rangeEnd: "",
      timezone: "America/New_York",
      connected: true,
      appleIdMasked: null,
      error: null,
      warnings: [],
      totalEvents: 3,
      openDayKeys: [],
      loggedDayCount: 0,
      printFreezeLabel: "",
      groups: FAMILY_CALENDAR_GROUPS.map((group) => ({
        group,
        calendarName: group.label,
        missingCalendar: false,
        events:
          group.id === "family"
            ? [familyEv]
            : group.id === "wyatt_kat_jason"
              ? [wyattEv]
              : group.id === "kat_jason"
                ? [heads]
                : [],
      })),
    };

    const pack = buildPrintPackPayload(agenda, "2026-10-23");
    const familySheet = pack.sheets.find((s) => s.id === "family")!;
    const katSheet = pack.sheets.find((s) => s.id === "kat_jason")!;
    const wyattSheet = pack.sheets.find((s) => s.id === "wyatt_kat_jason")!;

    assert.ok(
      familySheet.days.some((d) =>
        d.events.some((e) => e.title === "Uncle birthday")
      )
    );
    assert.ok(
      katSheet.days.some((d) =>
        d.events.some((e) => e.title === "Uncle birthday")
      )
    );
    assert.ok(
      katSheet.days.some((d) => d.events.some((e) => e.title === "Soccer"))
    );
    assert.ok(
      wyattSheet.days.some((d) => d.events.some((e) => e.title === "Soccer"))
    );
    assert.ok(katSheet.headsUps.some((h) => h.title === "Book summer camp"));
    assert.ok(wyattSheet.headsUps.some((h) => h.title === "Book summer camp"));
  });
});
