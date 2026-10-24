import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyFamilyMeetingEdits, withEventKeys } from "./edits.ts";
import type { FamilyMeetingEvent } from "./types.ts";

function ev(
  partial: Partial<FamilyMeetingEvent> &
    Pick<FamilyMeetingEvent, "uid" | "startsAt" | "title">
): FamilyMeetingEvent {
  return withEventKeys({
    id: partial.id ?? `${partial.uid}-${partial.startsAt}`,
    uid: partial.uid,
    title: partial.title,
    startsAt: partial.startsAt,
    endsAt: partial.endsAt ?? partial.startsAt,
    allDay: partial.allDay ?? false,
    calendarName: "Test",
    calendarHref: "/test/",
    groupId: partial.groupId ?? "family",
    routine: partial.routine,
  });
}

describe("applyFamilyMeetingEdits", () => {
  it("hides one occurrence but keeps a later one", () => {
    const a = ev({
      uid: "vac",
      title: "Dad Vacuums",
      startsAt: "2026-10-24T21:00:00.000Z",
    });
    const b = ev({
      uid: "vac",
      title: "Dad Vacuums",
      startsAt: "2026-10-31T21:00:00.000Z",
    });
    const out = applyFamilyMeetingEdits([a, b], {
      occurrences: [
        {
          occurrence_key: a.occurrenceKey!,
          series_key: a.seriesKey!,
          group_id: "family",
          day_key: a.dayKey!,
          title: a.title,
          starts_at: a.startsAt,
          hidden: true,
          presentation: "auto",
        },
      ],
      series: [],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0]!.startsAt, b.startsAt);
  });

  it("archives every occurrence of a series", () => {
    const a = ev({
      uid: "song",
      title: "Playlist",
      startsAt: "2026-10-28T00:00:00.000Z",
      allDay: true,
    });
    const b = ev({
      uid: "song",
      title: "Playlist",
      startsAt: "2026-11-04T00:00:00.000Z",
      allDay: true,
    });
    const out = applyFamilyMeetingEdits([a, b], {
      occurrences: [],
      series: [{ series_key: a.seriesKey!, title: "Playlist", archived: true }],
    });
    assert.equal(out.length, 0);
  });

  it("promotes a routine series to spotlight", () => {
    const a = ev({
      uid: "compost",
      title: "Composting",
      startsAt: "2026-10-28T11:00:00.000Z",
      routine: true,
    });
    const out = applyFamilyMeetingEdits([a], {
      occurrences: [
        {
          occurrence_key: a.occurrenceKey!,
          series_key: a.seriesKey!,
          group_id: "family",
          day_key: a.dayKey!,
          title: a.title,
          starts_at: a.startsAt,
          hidden: false,
          presentation: "spotlight",
        },
      ],
      series: [],
    });
    assert.equal(out[0]!.routine, false);
    assert.equal(out[0]!.presentation, "spotlight");
  });
});
