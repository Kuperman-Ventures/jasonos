import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceSchoolPatch,
  archiveSchoolPatch,
  currentListPhaseId,
  mergeListPrefs,
  normalizeColumns,
  phaseCountGauge,
  previousListPhaseId,
  retreatSchoolPatch,
  schoolOnListPhase,
  canAdvanceListPhase,
  isForwardListPhaseMove,
  selectivityGauges,
  selectivityPieSlices,
} from "./list-phases";

test("currentListPhaseId follows the funnel calendar", () => {
  assert.equal(currentListPhaseId(new Date("2026-09-20T12:00:00Z")), "exploration");
  assert.equal(currentListPhaseId(new Date("2026-12-31T12:00:00Z")), "exploration");
  assert.equal(currentListPhaseId(new Date("2027-01-01T12:00:00Z")), "consideration");
  assert.equal(currentListPhaseId(new Date("2027-07-26T12:00:00Z")), "consideration");
  assert.equal(currentListPhaseId(new Date("2027-07-27T12:00:00Z")), "applications");
});

test("phaseCountGauge can read over 100%", () => {
  const gauge = phaseCountGauge(43, {
    id: "exploration",
    label: "Exploration",
    window: "",
    target: 30,
    rangeLabel: "27–33",
    startsOn: "2026-09-01",
    endsOn: "2026-12-31",
    defaultColumns: ["school"],
  });
  assert.equal(gauge.percent, 143.3);
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

test("selectivityPieSlices sizes wedges by ideal mix and fills by actual share", () => {
  // 10 schools: 2 extremely (20%), 1 very (10%), 4 competitive (40%), 3 less (30%)
  // Ideal: 10 / 20 / 45 / 25
  const schools = [
    ...Array.from({ length: 2 }, () => ({ selectivityTier: "extremely_selective" })),
    { selectivityTier: "very_selective" },
    ...Array.from({ length: 4 }, () => ({ selectivityTier: "competitive" })),
    ...Array.from({ length: 3 }, () => ({ selectivityTier: "less_competitive" })),
    { selectivityTier: "" },
  ];
  const { slices, setCount, unsetCount } = selectivityPieSlices(schools);
  assert.equal(setCount, 10);
  assert.equal(unsetCount, 1);
  assert.equal(slices.length, 4);

  assert.equal(slices[0].idealPercent, 10);
  assert.equal(slices[0].idealSweep, 36);
  assert.equal(slices[0].actualPercent, 20);
  assert.equal(slices[0].overIdeal, true);
  assert.equal(slices[0].fillSweep, 36); // capped at ideal

  assert.equal(slices[1].idealPercent, 20);
  assert.equal(slices[1].actualPercent, 10);
  assert.equal(slices[1].fillSweep, 36); // half of the 72° ideal wedge
  assert.equal(slices[1].overIdeal, false);

  assert.equal(slices[2].idealPercent, 45);
  assert.equal(slices[2].actualPercent, 40);
  assert.ok(Math.abs(slices[2].fillSweep - (40 / 45) * 162) < 0.01);

  assert.equal(slices[3].idealPercent, 25);
  assert.equal(slices[3].actualPercent, 30);
  assert.equal(slices[3].overIdeal, true);

  // Wedges start at top (-90) and run clockwise through ideal shares
  assert.equal(slices[0].startAngle, -90);
  assert.equal(slices[1].startAngle, -54);
  assert.equal(slices[2].startAngle, 18);
  assert.equal(slices[3].startAngle, 180);
});

test("selectivityPieSlices stays empty when no tiers are set", () => {
  const { slices, setCount, unsetCount } = selectivityPieSlices([
    { selectivityTier: "" },
    { selectivityTier: "" },
  ]);
  assert.equal(setCount, 0);
  assert.equal(unsetCount, 2);
  assert.ok(slices.every((slice) => slice.count === 0 && slice.fillSweep === 0));
});

test("normalizeColumns keeps school and falls back to phase defaults", () => {
  assert.deepEqual(normalizeColumns(["interest", "action"], {
    id: "exploration",
    label: "Exploration",
    window: "",
    target: 30,
    rangeLabel: "27–33",
    startsOn: "2026-09-01",
    endsOn: "2026-12-31",
    defaultColumns: ["school", "selectivity", "interest", "action"],
  }), ["school", "interest", "action"]);
  assert.deepEqual(
    normalizeColumns([], {
      id: "exploration",
      label: "Exploration",
      window: "",
      target: 30,
      rangeLabel: "27–33",
      startsOn: "2026-09-01",
      endsOn: "2026-12-31",
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

test("only Kyle (or local seed) can advance list phases", () => {
  assert.equal(canAdvanceListPhase("kyle"), true);
  assert.equal(canAdvanceListPhase("local"), true);
  assert.equal(canAdvanceListPhase("jason"), false);
  assert.equal(canAdvanceListPhase("kat"), false);

  assert.equal(isForwardListPhaseMove("exploration", "consideration"), true);
  assert.equal(isForwardListPhaseMove("consideration", "applications"), true);
  assert.equal(isForwardListPhaseMove("exploration", "applications"), true);
  assert.equal(isForwardListPhaseMove("consideration", "exploration"), false);
  assert.equal(isForwardListPhaseMove("applications", "consideration"), false);
  assert.equal(isForwardListPhaseMove("exploration", "exploration"), false);
});
