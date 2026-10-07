import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_MODEL_SOURCE_IDS,
  AI_WORKFLOW_BOUNDARIES,
  AI_WORKFLOW_USES,
  DS_FILTERS,
  FEATURES,
  aiDiagramCaption,
  featureUsesAi,
  isAiSource,
  matchesFilter,
} from "./data-sources-view";
import { SOURCE_REGISTRY, type DataSource } from "./data-sources";

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

test("AI model sources and feature tags for the diagram", () => {
  assert.deepEqual([...AI_MODEL_SOURCE_IDS].sort(), ["ai-gateway", "perplexity"]);
  assert.equal(isAiSource("ai-gateway"), true);
  assert.equal(isAiSource("college-scorecard"), false);
  assert.equal(featureUsesAi("ingest"), true);
  assert.equal(featureUsesAi("schools"), true);
  assert.equal(featureUsesAi("finances"), false);
});

test("AI filter keeps only Gateway and Perplexity", () => {
  assert.ok(DS_FILTERS.includes("AI"));
  const gateway = { id: "ai-gateway", type: "platform" } as DataSource;
  const scorecard = { id: "college-scorecard", type: "live" } as DataSource;
  assert.equal(matchesFilter(gateway, "AI"), true);
  assert.equal(matchesFilter(scorecard, "AI"), false);
});

test("aiDiagramCaption names the active AI job", () => {
  assert.match(aiDiagramCaption({ sourceId: "ai-gateway" }) ?? "", /AI ·/);
  assert.match(aiDiagramCaption({ feature: "ingest" }) ?? "", /Ingest extraction/);
  assert.equal(aiDiagramCaption({ sourceId: "supabase" }), null);
  assert.equal(aiDiagramCaption({ feature: "finances" }), null);
});
