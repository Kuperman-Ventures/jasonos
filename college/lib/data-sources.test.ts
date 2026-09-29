import assert from "node:assert/strict";
import test from "node:test";
import { seedSchools } from "./content";
import {
  FEATURES,
  SOURCE_REGISTRY,
  buildDataSources,
  computeStatus,
  diagramPositions,
  needAttentionCount,
  sortForList,
  type DataSource,
  type DataSourceCheckState,
  type Status,
} from "./data-sources";

const NOW = new Date("2026-09-29T15:00:00Z");

function check(partial: Partial<DataSourceCheckState> = {}): DataSourceCheckState {
  return {
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    lastMs: null,
    brokenLinks: [],
    blockedLinks: [],
    ...partial,
  };
}

type StatusInput = Parameters<typeof computeStatus>[0];

function source(partial: Partial<StatusInput> & Pick<StatusInput, "type">): StatusInput {
  return {
    id: "x",
    name: "X",
    feeds: ["schools"],
    apiKey: "not_needed",
    envKeys: [],
    testable: true,
    ...partial,
  };
}

function fakeSource(id: string, status: Status, name = id): DataSource {
  return {
    ...source({ type: "live", id, name }),
    status,
    statusLabel: status,
  };
}

test("registry has 34 unique sources with the expected type counts", () => {
  assert.equal(SOURCE_REGISTRY.length, 34);
  assert.equal(new Set(SOURCE_REGISTRY.map((s) => s.id)).size, 34);
  const counts: Record<string, number> = {};
  for (const s of SOURCE_REGISTRY) counts[s.type] = (counts[s.type] ?? 0) + 1;
  assert.deepEqual(counts, { platform: 4, live: 13, snapshot: 12, linkout: 4, outbound: 1 });
});

test("every source feeds at least one known feature", () => {
  const known = new Set(FEATURES.map((f) => f.id));
  for (const s of SOURCE_REGISTRY) {
    assert.ok(s.feeds.length > 0, `${s.id} feeds nothing`);
    for (const f of s.feeds) assert.ok(known.has(f), `${s.id} feeds unknown ${f}`);
  }
});

test("snapshots carry update instructions and a stale rule", () => {
  for (const s of SOURCE_REGISTRY.filter((row) => row.type === "snapshot")) {
    assert.ok(s.howToUpdate, `${s.id} has no howToUpdate`);
    assert.ok(s.staleAfter, `${s.id} has no staleAfter`);
  }
});

test("computeStatus: snapshot without importedAt is no_date", () => {
  const r = computeStatus(source({ type: "snapshot", importedAt: null }), null, NOW);
  assert.equal(r.status, "no_date");
});

test("computeStatus: snapshot past staleAfterDate is stale", () => {
  const r = computeStatus(
    source({ type: "snapshot", importedAt: "2025-01-01", staleAfterDate: "2026-01-01" }),
    null,
    NOW,
  );
  assert.equal(r.status, "stale");
});

test("computeStatus: current snapshot is ok", () => {
  const r = computeStatus(
    source({ type: "snapshot", importedAt: "2026-09-01", staleAfterDate: "2027-01-01" }),
    null,
    NOW,
  );
  assert.equal(r.status, "ok");
});

test("computeStatus: incomplete drive matrix is stale with a count", () => {
  const r = computeStatus(
    source({ type: "snapshot", id: "drive-matrix", importedAt: "2026-09-27", coverage: { have: 40, total: 43 } }),
    null,
    NOW,
  );
  assert.equal(r.status, "stale");
  assert.equal(r.statusLabel, "Missing 3 schools");
});

test("computeStatus: live source with a missing key is failing", () => {
  const r = computeStatus(source({ type: "live", apiKey: "missing" }), null, NOW);
  assert.deepEqual(r, { status: "failing", statusLabel: "Key missing" });
});

test("computeStatus: live source never checked is untested", () => {
  assert.equal(computeStatus(source({ type: "live" }), null, NOW).status, "untested");
  assert.equal(computeStatus(source({ type: "platform" }), check(), NOW).status, "untested");
});

test("computeStatus: live source whose last error is newer than last success is failing", () => {
  const r = computeStatus(
    source({ type: "live" }),
    check({
      lastCheckedAt: "2026-09-29T10:00:00Z",
      lastSuccessAt: "2026-09-28T10:00:00Z",
      lastErrorAt: "2026-09-29T10:00:00Z",
    }),
    NOW,
  );
  assert.equal(r.status, "failing");
});

test("computeStatus: live source last checked over 7 days ago is untested", () => {
  const r = computeStatus(
    source({ type: "live" }),
    check({ lastCheckedAt: "2026-09-10T10:00:00Z", lastSuccessAt: "2026-09-10T10:00:00Z" }),
    NOW,
  );
  assert.equal(r.status, "untested");
});

test("computeStatus: live source that recovered after an error is ok", () => {
  const r = computeStatus(
    source({ type: "live" }),
    check({
      lastCheckedAt: "2026-09-29T11:00:00Z",
      lastSuccessAt: "2026-09-29T11:00:00Z",
      lastErrorAt: "2026-09-29T10:00:00Z",
    }),
    NOW,
  );
  assert.equal(r.status, "ok");
});

test("computeStatus: link-out with broken links is stale, blocked links alone are ok", () => {
  const broken = computeStatus(
    source({ type: "linkout" }),
    check({ lastCheckedAt: "2026-09-29T06:00:00Z", brokenLinks: [{ url: "https://x.edu/npc", status: 404 }] }),
    NOW,
  );
  assert.deepEqual(broken, { status: "stale", statusLabel: "Broken link" });

  const blocked = computeStatus(
    source({ type: "linkout" }),
    check({ lastCheckedAt: "2026-09-29T06:00:00Z", blockedLinks: [{ url: "https://y.edu/npc", status: 403 }] }),
    NOW,
  );
  assert.equal(blocked.status, "ok");
  assert.equal(computeStatus(source({ type: "linkout" }), null, NOW).status, "untested");
});

test("computeStatus: outbound without a token is failing", () => {
  const r = computeStatus(source({ type: "outbound", tokenStatus: "missing" }), null, NOW);
  assert.deepEqual(r, { status: "failing", statusLabel: "No token" });
  assert.equal(computeStatus(source({ type: "outbound", tokenStatus: "set" }), null, NOW).status, "untested");
});

test("sortForList puts failing first, then stale/untested, then no_date, then ok", () => {
  const sorted = sortForList([
    fakeSource("a-ok", "ok"),
    fakeSource("b-nodate", "no_date"),
    fakeSource("c-untested", "untested"),
    fakeSource("d-failing", "failing"),
    fakeSource("e-stale", "stale"),
  ]);
  assert.deepEqual(
    sorted.map((s) => s.id),
    ["d-failing", "c-untested", "e-stale", "b-nodate", "a-ok"],
  );
});

test("needAttentionCount counts failing, stale and untested but not no_date", () => {
  const n = needAttentionCount([
    fakeSource("a", "ok"),
    fakeSource("b", "no_date"),
    fakeSource("c", "untested"),
    fakeSource("d", "failing"),
    fakeSource("e", "stale"),
  ]);
  assert.equal(n, 3);
});

test("buildDataSources returns every registry entry with a status", () => {
  const sources = buildDataSources({
    schools: seedSchools(),
    checks: {},
    now: NOW,
    calendarTokenSet: true,
  });
  assert.equal(sources.length, 34);
  for (const s of sources) assert.ok(s.status && s.statusLabel, s.id);
  const perplexity = sources.find((s) => s.id === "perplexity")!;
  assert.equal(perplexity.apiKey, "not_needed");
  assert.equal(perplexity.testable, false);
  assert.deepEqual(perplexity.envKeys, []);
  const scorecard = sources.find((s) => s.id === "college-scorecard")!;
  assert.deepEqual(scorecard.envKeys, ["COLLEGE_SCORECARD_API_KEY", "SCORECARD_API_KEY"]);
  assert.match(scorecard.setupHint ?? "", /api\.data\.gov\/signup/);
  assert.match(scorecard.setupHint ?? "", /DEMO_KEY/);
  const feed = sources.find((s) => s.id === "calendar-feed")!;
  assert.equal(feed.tokenStatus, "set");
});

test("diagramPositions places every non-platform source", () => {
  const sources = buildDataSources({ schools: seedSchools(), checks: {}, now: NOW });
  const pos = diagramPositions(sources);
  assert.equal(Object.keys(pos).length, 30);
});
