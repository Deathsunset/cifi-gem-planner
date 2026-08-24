import test from "node:test";
import assert from "node:assert/strict";
import {
  canRecommendUpgrade,
  clampWeightPriority,
  isMandatoryTemporalLevel4,
  priorityFromWeight,
  TEMPORAL_LEVEL_4_COST,
  weightFromPriority,
} from "../app/planner-preferences.ts";

test("all resource weights use one bounded relative priority scale", () => {
  assert.equal(priorityFromWeight(1, 1), 100);
  assert.equal(priorityFromWeight(10000, 10000), 100);
  assert.equal(weightFromPriority(200, 1), 2);
  assert.equal(weightFromPriority(200, 10000), 20000);
  assert.equal(clampWeightPriority(-5), 0);
  assert.equal(clampWeightPriority(500), 200);
  assert.equal(clampWeightPriority(Number.POSITIVE_INFINITY), 100);
});

test("maxed or unavailable upgrades cannot be recommended", () => {
  assert.equal(canRecommendUpgrade(4, 5, true, true), true);
  assert.equal(canRecommendUpgrade(5, 5, true, true), false);
  assert.equal(canRecommendUpgrade(6, 5, true, true), false);
  assert.equal(canRecommendUpgrade(4, 5, false, true), false);
  assert.equal(canRecommendUpgrade(4, 5, true, false), false);
});

test("Temporal level 4 becomes mandatory only when its requirements are met", () => {
  assert.equal(TEMPORAL_LEVEL_4_COST, 5e20);
  assert.equal(isMandatoryTemporalLevel4("temporal-quality", 3, 5, 5e20), true);
  assert.equal(isMandatoryTemporalLevel4("temporal-quality", 3, 4, 5e20), false);
  assert.equal(isMandatoryTemporalLevel4("temporal-quality", 3, 5, 4.99e20), false);
  assert.equal(isMandatoryTemporalLevel4("temporal-quality", 4, 5, 5e20), false);
});
