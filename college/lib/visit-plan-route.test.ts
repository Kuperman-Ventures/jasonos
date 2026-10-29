import assert from "node:assert/strict";
import test from "node:test";
import {
  VISIT_PLAN_END_ID,
  VISIT_PLAN_START_ID,
  buildVisitPlanFromOrder,
  optimizeVisitPlanOrder,
  schoolIdsFromRoute,
} from "./visit-plan-route";

const home = { lat: 40.7312, lng: -74.2735 };

test("optimizeVisitPlanOrder orders nearby NJ schools from home", () => {
  const coords = new Map([
    ["njit", { lat: 40.742, lng: -74.178 }],
    ["stevens-institute-of-technology", { lat: 40.745, lng: -74.024 }],
    ["rutgers-university-new-brunswick", { lat: 40.501, lng: -74.448 }],
  ]);
  const nameById = new Map([
    ["njit", "NJIT"],
    ["stevens-institute-of-technology", "Stevens"],
    ["rutgers-university-new-brunswick", "Rutgers"],
  ]);
  const start = { id: VISIT_PLAN_START_ID, name: "Home", point: home };
  const end = { id: VISIT_PLAN_END_ID, name: "Home", point: home };
  const route = optimizeVisitPlanOrder({
    schoolIds: [
      "rutgers-university-new-brunswick",
      "njit",
      "stevens-institute-of-technology",
    ],
    start,
    end,
    coords,
    nameById,
  });
  const order = schoolIdsFromRoute(route);
  assert.equal(order.length, 3);
  assert.ok(route.legs.length >= 3);
  assert.equal(route.order[0], VISIT_PLAN_START_ID);
  assert.equal(route.order[route.order.length - 1], VISIT_PLAN_END_ID);
});

test("buildVisitPlanFromOrder keeps manual school sequence", () => {
  const coords = new Map([
    ["njit", { lat: 40.742, lng: -74.178 }],
    ["stevens-institute-of-technology", { lat: 40.745, lng: -74.024 }],
  ]);
  const nameById = new Map([
    ["njit", "NJIT"],
    ["stevens-institute-of-technology", "Stevens"],
  ]);
  const route = buildVisitPlanFromOrder({
    schoolIds: ["stevens-institute-of-technology", "njit"],
    start: { id: VISIT_PLAN_START_ID, name: "Home", point: home },
    end: { id: VISIT_PLAN_END_ID, name: "Home", point: home },
    coords,
    nameById,
  });
  assert.deepEqual(schoolIdsFromRoute(route), [
    "stevens-institute-of-technology",
    "njit",
  ]);
});
