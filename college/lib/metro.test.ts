import assert from "node:assert/strict";
import test from "node:test";
import metroPopulations from "@/data/metro-populations.json";
import { metroFromCbsa } from "./metro";

test("metro-populations.json has LA and Houghton checks", () => {
  const table = metroPopulations as Record<
    string,
    { name: string; type: string; population: number }
  >;
  assert.equal(table["31080"].population, 12_844_441);
  assert.equal(table["31080"].type, "Metropolitan");
  assert.match(table["31080"].name, /Los Angeles/);
  assert.equal(table["26340"].population, 40_028);
  assert.equal(table["26340"].type, "Micropolitan");
  assert.match(table["26340"].name, /Houghton/);
});

test("metroFromCbsa looks up committed table", () => {
  const la = metroFromCbsa("31080");
  assert.equal(la.metroPopulation, 12_844_441);
  assert.match(la.metroArea ?? "", /Los Angeles/);
  assert.deepEqual(metroFromCbsa("99999"), {
    metroArea: null,
    metroPopulation: null,
  });
});
