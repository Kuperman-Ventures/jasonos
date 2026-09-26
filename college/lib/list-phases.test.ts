import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceSchoolPatch,
  archiveSchoolPatch,
  currentListPhaseId,
  idealTierCount,
  listPhaseBarProgress,
  listPhaseDaySpan,
  listPhaseEyebrow,
  LIST_PHASES,
  listSizeBar,
  mergeListPrefs,
  normalizeColumns,
  phaseCountGauge,
  previousListPhaseId,
  retreatSchoolPatch,
  schoolOnListPhase,
  isForwardListPhaseMove,
  selectivityGauges,
  selectivityPieSlices,
} from "./list-phases";
import { canAdvanceListPhase } from "./permissions";

const explorationPhase = {
  id: "exploration" as const,
  label: "Exploration",
  window: "",
  season: "Junior fall",
  target: 30,
  rangeLo: 27,
  rangeHi: 33,
  rangeLabel: "27–33",
  startsOn: "2026-09-01",
  endsOn: "2026-12-31",
  defaultColumns: ["school", "selectivity", "interest", "action"] as const,
};

test("currentListPhaseId follows the funnel calendar", () => {
  assert.equal(currentListPhaseId(new Date("2026-09-20T12:00:00Z")), "exploration");
  assert.equal(currentListPhaseId(new Date("2026-12-31T12:00:00Z")), "exploration");
  assert.equal(currentListPhaseId(new Date("2027-01-01T12:00:00Z")), "consideration");
  assert.equal(currentListPhaseId(new Date("2027-07-26T12:00:00Z")), "consideration");
  assert.equal(currentListPhaseId(new Date("2027-07-27T12:00:00Z")), "applications");
});

test("list phase calendar bar spans, progress, and eyebrow", () => {
  assert.ok(listPhaseDaySpan(LIST_PHASES[0]) > 100);
  assert.ok(listPhaseDaySpan(LIST_PHASES[1]) > listPhaseDaySpan(LIST_PHASES[0]));
  const midExploration = listPhaseBarProgress(LIST_PHASES[0], new Date(2026, 9, 15));
  assert.ok(midExploration > 0 && midExploration < 1);
  assert.equal(listPhaseBarProgress(LIST_PHASES[1], new Date(2026, 9, 15)), 0);
  assert.equal(listPhaseBarProgress(LIST_PHASES[0], new Date(2027, 2, 1)), 1);
  assert.equal(listPhaseEyebrow("consideration"), "Phase 2 of 3 · Junior spring");
});

test("phaseCountGauge can read over 100%", () => {
  const gauge = phaseCountGauge(43, { ...explorationPhase, defaultColumns: ["school"] });
  assert.equal(gauge.percent, 143.3);
});

test("idealTierCount rounds share × target with a floor of 1", () => {
  assert.equal(idealTierCount(10, 30), 3);
  assert.equal(idealTierCount(20, 30), 6);
  assert.equal(idealTierCount(45, 30), 14);
  assert.equal(idealTierCount(25, 30), 8);
  assert.equal(idealTierCount(10, 1), 1);
});

test("listSizeBar reports over, under, and in-range notes", () => {
  const over = listSizeBar(43, explorationPhase);
  assert.equal(over.note, "+10 over range");
  assert.match(over.prose, /Trim 10/);
  assert.equal(over.overRange, true);

  const under = listSizeBar(20, explorationPhase);
  assert.equal(under.note, "7 under range");
  assert.equal(under.underRange, true);

  const ok = listSizeBar(30, explorationPhase);
  assert.equal(ok.note, "In range");
  assert.equal(ok.overRange, false);
  assert.equal(ok.underRange, false);
});

test("selectivityGauges uses live mix percentages", () => {
  const slices = selectivityGauges(
    [
      { selectivityTier: "extremely_selective" },
      { selectivityTier: "extremely_selective" },
      { selectivityTier: "competitive" },
    ],
    [
      { id: "extremely_selective", label: "Extremely selective" },
      { id: "competitive", label: "Competitive" },
    ],
  );
  assert.equal(slices[0].percent, 66.7);
  assert.equal(slices[1].count, 1);
});

test("selectivityPieSlices sizes wedges by ideal mix and fills by have/ideal count", () => {
  // Target 30 → ideals 3 / 6 / 14 / 8
  // Have: 9 extremely (over), 3 very (under), 14 competitive (met), 0 less (under)
  const schools = [
    ...Array.from({ length: 9 }, () => ({ selectivityTier: "extremely_selective" })),
    ...Array.from({ length: 3 }, () => ({ selectivityTier: "very_selective" })),
    ...Array.from({ length: 14 }, () => ({ selectivityTier: "competitive" })),
    { selectivityTier: "" },
  ];
  const { slices, setCount, unsetCount } = selectivityPieSlices(schools, 30);
  assert.equal(setCount, 26);
  assert.equal(unsetCount, 1);
  assert.equal(slices.length, 4);

  assert.equal(slices[0].idealCount, 3);
  assert.equal(slices[0].count, 9);
  assert.equal(slices[0].status, "over");
  assert.equal(slices[0].statusLabel, "+6 over");
  assert.equal(slices[0].fillRatio, 3);

  assert.equal(slices[1].idealCount, 6);
  assert.equal(slices[1].count, 3);
  assert.equal(slices[1].status, "under");
  assert.equal(slices[1].statusLabel, "3 to go");
  assert.equal(slices[1].fillRatio, 0.5);

  assert.equal(slices[2].idealCount, 14);
  assert.equal(slices[2].count, 14);
  assert.equal(slices[2].status, "met");
  assert.equal(slices[2].statusLabel, "On ideal");
  assert.equal(slices[2].fillRatio, 1);

  assert.equal(slices[3].idealCount, 8);
  assert.equal(slices[3].count, 0);
  assert.equal(slices[3].status, "under");
  assert.equal(slices[3].fillRatio, 0);

  // Wedges start at top (-90) with 2.4° gaps; first start is -90 + 1.2
  assert.ok(Math.abs(slices[0].startAngle - (-90 + 1.2)) < 0.01);
  assert.ok(Math.abs(slices[0].endAngle - (-90 + 36 - 1.2)) < 0.01);
  assert.ok(Math.abs(slices[1].startAngle - (-54 + 1.2)) < 0.01);
});

test("selectivityPieSlices stays empty when no tiers are set", () => {
  const { slices, setCount, unsetCount } = selectivityPieSlices(
    [{ selectivityTier: "" }, { selectivityTier: "" }],
    30,
  );
  assert.equal(setCount, 0);
  assert.equal(unsetCount, 2);
  assert.ok(slices.every((slice) => slice.count === 0 && slice.fillRatio === 0));
});

test("normalizeColumns keeps school and falls back to phase defaults", () => {
  assert.deepEqual(
    normalizeColumns(["interest", "action"], {
      ...explorationPhase,
      defaultColumns: ["school", "selectivity", "interest", "action"],
    }),
    ["school", "interest", "action"],
  );
  assert.deepEqual(
    normalizeColumns([], {
      ...explorationPhase,
      defaultColumns: ["school", "selectivity"],
    }),
    ["school", "selectivity"],
  );
});

test("mergeListPrefs fills missing phases", () => {
  const prefs = mergeListPrefs({
    columnsByPhase: { exploration: ["school", "action"] },
    showArchived: true,
  });
  assert.equal(prefs.showArchived, true);
  assert.deepEqual(prefs.columnsByPhase.exploration, ["school", "action"]);
  assert.ok((prefs.columnsByPhase.consideration ?? []).includes("school"));
});

test("advance and archive keep phase participation", () => {
  const advanced = advanceSchoolPatch({
    listPhase: "exploration",
    phasesParticipated: ["exploration"],
  });
  assert.deepEqual(advanced, {
    listPhase: "consideration",
    phasesParticipated: ["exploration", "consideration"],
    archived: false,
  });
  const archived = archiveSchoolPatch({
    listPhase: "consideration",
    phasesParticipated: ["exploration", "consideration"],
  });
  assert.equal(archived.archived, true);
  assert.deepEqual(archived.phasesParticipated, ["exploration", "consideration"]);
  assert.equal(
    advanceSchoolPatch({
      listPhase: "applications",
      phasesParticipated: ["exploration", "consideration", "applications"],
    }),
    null,
  );
});

test("retreat moves a school back without wiping participation history", () => {
  assert.equal(previousListPhaseId("exploration"), null);
  assert.equal(previousListPhaseId("consideration"), "exploration");
  assert.equal(previousListPhaseId("applications"), "consideration");

  const retreated = retreatSchoolPatch({
    listPhase: "consideration",
    phasesParticipated: ["exploration", "consideration"],
  });
  assert.deepEqual(retreated, {
    listPhase: "exploration",
    phasesParticipated: ["exploration", "consideration"],
    archived: false,
  });

  assert.equal(
    retreatSchoolPatch({
      listPhase: "exploration",
      phasesParticipated: ["exploration"],
    }),
    null,
  );

  const fromApps = retreatSchoolPatch({
    listPhase: "applications",
    phasesParticipated: ["exploration", "consideration", "applications"],
  });
  assert.equal(fromApps?.listPhase, "consideration");
  assert.deepEqual(fromApps?.phasesParticipated, [
    "exploration",
    "consideration",
    "applications",
  ]);
});

test("exploration keeps consideration schools; applications clears consideration", () => {
  const exploring = { listPhase: "exploration" as const };
  const considering = { listPhase: "consideration" as const };
  const applying = { listPhase: "applications" as const };

  assert.equal(schoolOnListPhase(exploring, "exploration"), true);
  assert.equal(schoolOnListPhase(exploring, "consideration"), false);
  assert.equal(schoolOnListPhase(exploring, "applications"), false);

  // Moved E → C: still on Exploration, now also on Consideration
  assert.equal(schoolOnListPhase(considering, "exploration"), true);
  assert.equal(schoolOnListPhase(considering, "consideration"), true);
  assert.equal(schoolOnListPhase(considering, "applications"), false);

  // Moved C → A: off Consideration (and Exploration), only Applications
  assert.equal(schoolOnListPhase(applying, "exploration"), false);
  assert.equal(schoolOnListPhase(applying, "consideration"), false);
  assert.equal(schoolOnListPhase(applying, "applications"), true);
});

test("only the Student role can advance list phases", () => {
  assert.equal(canAdvanceListPhase({ id: "kyle", role: "student" }), true);
  assert.equal(canAdvanceListPhase({ id: "local", role: "super_admin" }), true);
  assert.equal(canAdvanceListPhase({ id: "jason", role: "super_admin" }), false);
  assert.equal(canAdvanceListPhase({ id: "kat", role: "parent" }), false);

  assert.equal(isForwardListPhaseMove("exploration", "consideration"), true);
  assert.equal(isForwardListPhaseMove("consideration", "applications"), true);
  assert.equal(isForwardListPhaseMove("exploration", "applications"), true);
  assert.equal(isForwardListPhaseMove("consideration", "exploration"), false);
  assert.equal(isForwardListPhaseMove("applications", "consideration"), false);
  assert.equal(isForwardListPhaseMove("exploration", "exploration"), false);
});
