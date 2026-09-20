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
