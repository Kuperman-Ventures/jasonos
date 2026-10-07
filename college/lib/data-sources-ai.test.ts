import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_WORKFLOW_BOUNDARIES,
  AI_WORKFLOW_USES,
  FEATURES,
} from "./data-sources-view";
import { SOURCE_REGISTRY } from "./data-sources";

test("AI_WORKFLOW_USES covers ingest, school lookup, and activity icons", () => {
  assert.deepEqual(
    AI_WORKFLOW_USES.map((row) => row.id),
    ["ingest-extract", "school-lookup", "activity-icon"],
  );
  for (const row of AI_WORKFLOW_USES) {
    assert.ok(row.title.trim());
    assert.ok(row.where.trim());
    assert.ok(row.how.trim());
    assert.ok(row.review.trim());
    assert.ok(row.sourceIds.includes("ai-gateway"));
    if (row.feature) {
      assert.ok(FEATURES.some((f) => f.id === row.feature), row.feature);
    }
  }
});

test("AI workflow source ids exist in the registry", () => {
  const ids = new Set(SOURCE_REGISTRY.map((s) => s.id));
  for (const row of AI_WORKFLOW_USES) {
    for (const sourceId of row.sourceIds) {
      assert.ok(ids.has(sourceId), `missing source ${sourceId}`);
    }
  }
});

test("AI boundaries stay short and concrete", () => {
  assert.equal(AI_WORKFLOW_BOUNDARIES.length, 4);
  for (const line of AI_WORKFLOW_BOUNDARIES) {
    assert.ok(line.length > 20);
    assert.doesNotMatch(line, /leverage|seamless|empower/i);
  }
});

test("ai-gateway notes name the three jobs", () => {
  const gateway = SOURCE_REGISTRY.find((s) => s.id === "ai-gateway");
  assert.ok(gateway);
  assert.match(gateway.subtitle ?? "", /ingest/i);
  assert.match(gateway.subtitle ?? "", /school lookup/i);
  assert.match(gateway.subtitle ?? "", /activity icons/i);
  assert.match(gateway.notes ?? "", /Ingest/i);
  assert.match(gateway.notes ?? "", /Add-school/i);
  assert.match(gateway.notes ?? "", /activity icon/i);
});
