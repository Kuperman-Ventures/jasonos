import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VISIT_END_ADDRESS,
  DEFAULT_VISIT_START_ADDRESS,
  defaultVisitPlanUiState,
  parseVisitPlanUiState,
} from "./visit-plan-state";

test("defaultVisitPlanUiState starts and ends at home", () => {
  const state = defaultVisitPlanUiState();
  assert.equal(state.startAddress, DEFAULT_VISIT_START_ADDRESS);
  assert.equal(state.endAddress, DEFAULT_VISIT_END_ADDRESS);
  assert.equal(state.manualOrder, null);
});

test("parseVisitPlanUiState reads manual order", () => {
  assert.equal(parseVisitPlanUiState(null), null);
  const parsed = parseVisitPlanUiState({
    startAddress: "Princeton, NJ",
    endAddress: "Newark, NJ",
    manualOrder: ["njit", "upenn"],
  });
  assert.deepEqual(parsed, {
    startAddress: "Princeton, NJ",
    endAddress: "Newark, NJ",
    manualOrder: ["njit", "upenn"],
  });
});
