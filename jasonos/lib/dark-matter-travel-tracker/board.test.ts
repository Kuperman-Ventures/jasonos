import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatTripDates,
  groupItemsByDay,
  isUpcomingTrip,
  splitTrips,
} from "./board.ts";
import { slugifyTitle, uniqueSlug } from "./slug.ts";
import type { Trip } from "./types.ts";

function trip(partial: Partial<Trip> & Pick<Trip, "id" | "slug" | "title">): Trip {
  return {
    destination: "",
    startDate: null,
    endDate: null,
    status: "planning",
    notes: "",
    travelers: [],
    items: [],
    ...partial,
  };
}

describe("splitTrips", () => {
  it("keeps undated and current trips on the upcoming board", () => {
    const trips = [
      trip({ id: "1", slug: "idea", title: "Maybe Maine", status: "idea" }),
      trip({
        id: "2",
        slug: "past",
        title: "Old trip",
        startDate: "2026-01-01",
        endDate: "2026-01-04",
        status: "done",
      }),
      trip({
        id: "3",
        slug: "now",
        title: "Happening",
        startDate: "2026-10-20",
        endDate: "2026-10-30",
        status: "happening",
      }),
    ];
    const { upcoming, past } = splitTrips(trips, "2026-10-25");
    assert.deepEqual(
      upcoming.map((row) => row.slug),
      ["now", "idea"]
    );
    assert.deepEqual(
      past.map((row) => row.slug),
      ["past"]
    );
  });

  it("moves a finished date range to past even if status is still booked", () => {
    const ended = trip({
      id: "4",
      slug: "ended",
      title: "Ended",
      startDate: "2026-09-01",
      endDate: "2026-09-08",
      status: "booked",
    });
    assert.equal(isUpcomingTrip(ended, "2026-10-25"), false);
  });
});

describe("groupItemsByDay", () => {
  it("groups by day and parks undated items last", () => {
    const groups = groupItemsByDay([
      {
        id: "b",
        occursOn: "2026-12-19",
        startTime: "09:00",
        kind: "activity",
        title: "Ski",
        location: "",
        confirmation: "",
        notes: "",
        sortOrder: 0,
      },
      {
        id: "a",
        occursOn: null,
        startTime: null,
        kind: "note",
        title: "Pack layers",
        location: "",
        confirmation: "",
        notes: "",
        sortOrder: 0,
      },
      {
        id: "c",
        occursOn: "2026-12-18",
        startTime: "16:00",
        kind: "transit",
        title: "Drive",
        location: "",
        confirmation: "",
        notes: "",
        sortOrder: 0,
      },
    ]);
    assert.equal(groups[0]?.key, "2026-12-18");
    assert.equal(groups[1]?.key, "2026-12-19");
    assert.equal(groups.at(-1)?.key, "unscheduled");
  });
});

describe("formatTripDates", () => {
  it("labels missing dates and ranges", () => {
    assert.equal(formatTripDates(null, null), "Dates TBD");
    assert.match(formatTripDates("2026-12-18", "2026-12-21"), /Dec/);
  });
});

describe("slugifyTitle", () => {
  it("builds a URL slug and uniquifies collisions", () => {
    assert.equal(slugifyTitle("Vermont Weekend"), "vermont-weekend");
    assert.equal(uniqueSlug("vermont-weekend", ["vermont-weekend"]), "vermont-weekend-2");
  });
});
