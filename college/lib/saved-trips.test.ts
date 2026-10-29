import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTripSchoolSummary,
  normalizeTripName,
  parseSavedTrip,
  tripMapRouteParts,
} from "./saved-trips";
import { fromSeed } from "./types";

test("normalizeTripName trims and caps length", () => {
  assert.equal(normalizeTripName("  Philly loop  "), "Philly loop");
  assert.equal(normalizeTripName("x".repeat(120)).length, 80);
  assert.equal(normalizeTripName("   "), "");
});

test("parseSavedTrip requires id, name, and schools", () => {
  assert.equal(parseSavedTrip(null), null);
  assert.equal(parseSavedTrip({ id: "1", name: "Trip" }), null);
  const trip = parseSavedTrip({
    id: "t1",
    name: " Mid-Atlantic ",
    school_ids: ["upenn", "drexel", "upenn"],
    school_names: ["UPenn", "Drexel"],
    start_address: "Maplewood, NJ 07040",
    end_address: "Maplewood, NJ 07040",
    created_at: "2026-10-28T12:00:00.000Z",
    updated_at: "2026-10-28T12:00:00.000Z",
    created_by_id: "jason",
    created_by_name: "Jason",
  });
  assert.ok(trip);
  assert.equal(trip!.name, "Mid-Atlantic");
  assert.deepEqual(trip!.schoolIds, ["upenn", "drexel"]);
  assert.equal(trip!.schoolNames[0], "UPenn");
});

test("tripMapRouteParts builds a Google Maps driving link", () => {
  const upenn = fromSeed({
    id: "upenn",
    name: "University of Pennsylvania (UPenn)",
    location: "Philadelphia, PA",
    campusSetting: "",
    metroArea: null,
    metroPopulation: null,
    mechanicalEngineering: "",
    materials: "",
    materialsOffering: "",
    admissionsContext: "",
    satContext: "",
    selectivity: "",
    notes: "",
    listOrder: 1,
  });
  upenn.visitAddress = "249 South 36th Street, Philadelphia, PA 19104";
  const parts = tripMapRouteParts(
    {
      schoolIds: ["upenn"],
      startAddress: "Maplewood, NJ 07040",
      endAddress: "Maplewood, NJ 07040",
    },
    new Map([["upenn", upenn]]),
  );
  assert.equal(parts.length, 1);
  assert.match(parts[0]!.googleUrl, /google\.com\/maps\/dir/);
  assert.match(parts[0]!.googleUrl, /travelmode=driving/);
  assert.match(parts[0]!.googleUrl, /Maplewood/);
});

test("formatTripSchoolSummary truncates long lists", () => {
  assert.equal(
    formatTripSchoolSummary({
      id: "1",
      name: "T",
      schoolIds: ["a", "b", "c", "d"],
      schoolNames: ["A", "B", "C", "D"],
      startAddress: "",
      endAddress: "",
      createdAt: "",
      updatedAt: "",
      createdById: "",
      createdByName: "",
    }),
    "A · B · C · +1",
  );
});
