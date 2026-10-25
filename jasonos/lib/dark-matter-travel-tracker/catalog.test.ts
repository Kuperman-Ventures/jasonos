import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadTripCatalog, parseTripCatalog } from "./catalog.ts";

describe("loadTripCatalog", () => {
  it("loads the empty checked-in catalog", () => {
    const catalog = loadTripCatalog();
    assert.equal(catalog.catalogSource, "json");
    assert.deepEqual(catalog.trips, []);
  });
});

describe("parseTripCatalog", () => {
  it("accepts a trip with travelers and itinerary", () => {
    const catalog = parseTripCatalog({
      version: 1,
      updatedAt: "2026-10-25",
      trips: [
        {
          id: "trip-1",
          slug: "vermont-weekend",
          title: "Vermont weekend",
          destination: "Stowe",
          startDate: "2026-12-18",
          endDate: "2026-12-21",
          status: "planning",
          notes: "Drive up Friday.",
          travelers: [{ id: "t1", name: "Jason" }],
          items: [
            {
              id: "i1",
              occursOn: "2026-12-18",
              startTime: "16:00",
              kind: "transit",
              title: "Drive to Stowe",
              location: "",
              confirmation: "",
              notes: "",
              sortOrder: 0,
            },
          ],
        },
      ],
    });
    assert.equal(catalog.trips.length, 1);
    assert.equal(catalog.trips[0]?.title, "Vermont weekend");
    assert.equal(catalog.trips[0]?.travelers[0]?.name, "Jason");
    assert.equal(catalog.trips[0]?.items[0]?.kind, "transit");
  });

  it("rejects a bad status", () => {
    assert.throws(
      () =>
        parseTripCatalog({
          version: 1,
          trips: [
            {
              id: "x",
              slug: "x",
              title: "X",
              status: "maybe",
            },
          ],
        }),
      /status must be one of/
    );
  });
});
