import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { weightedTotal } from "./scores";
import type { Criterion, Scores } from "./types";

const criteria = JSON.parse(
  fs.readFileSync(new URL("../content/consultant-criteria.json", import.meta.url), "utf8"),
) as Criterion[];
const seed = JSON.parse(
  fs.readFileSync(new URL("../content/consultant-scores-seed.json", import.meta.url), "utf8"),
) as Scores;

test("weighted totals match the artifact seed", () => {
  assert.equal(weightedTotal(seed.ctk, criteria).toFixed(2), "3.15");
  assert.equal(weightedTotal(seed.hfc, criteria).toFixed(2), "3.30");
});

test("requested criterion weights match the eval mix", () => {
  const byId = Object.fromEntries(criteria.map((c) => [c.id, c.weight]));
  assert.equal(byId.price, 0.05);
  assert.equal(byId.scope, 0.05);
  assert.equal(byId.track, 0.2);
});
