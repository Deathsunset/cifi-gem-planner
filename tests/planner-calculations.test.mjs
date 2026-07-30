import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateNodeMetric,
  calculateUpgradeMetric,
  metricScore,
  NODE_EFFECTS,
} from "../app/planner-calculations.ts";

const weights = {
  cells: 1,
  mp: 20,
  shards: 15,
  rp: 10,
  ap: 14.9,
  mats: 100,
  borge: 10000,
  ozzy: 10000,
  knox: 10000,
};

const profile = {
  lrs: 5500,
  tech: 18000,
  research: 400,
  meltdown: 0.733,
  quantum: 75,
  manualMk9: 0,
  mk9Output: 0,
  relic26Level: 2,
  ultimaBadgeCost: 50,
  ships: {
    cradle: { rank: 266, crew: 2098 },
    aux: { rank: 154, crew: 1723 },
    zag: { rank: 120, crew: 1261 },
    hephaestus: { rank: 544, crew: 1116 },
    demeter: { rank: 51, crew: 1059 },
    koios: { rank: 81, crew: 1012 },
    zeus: { rank: 37, crew: 865 },
  },
};

const gemLevels = {
  Exodus: 4,
  Temporal: 3,
  Innovation: 2,
  Power: 2,
  Attraction: 3,
  Creation: 4,
  Evolution: 0,
};

const gemNodes = {
  Exodus: 0,
  Temporal: 3,
  Innovation: 3,
  Power: 3,
  Attraction: 3,
  Creation: 3,
  Evolution: 0,
};

function context(overrides = {}) {
  return {
    weights: { ...weights, ...overrides.weights },
    profile: {
      ...profile,
      ...overrides.profile,
      ships: { ...profile.ships, ...overrides.profile?.ships },
    },
    gemLevels: { ...gemLevels, ...overrides.gemLevels },
    gemNodes: { ...gemNodes, ...overrides.gemNodes },
    upgradeLevels: {
      "evolution-stability": 0,
      "evolution-resonance": 0,
      ...overrides.upgradeLevels,
    },
  };
}

function closeTo(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

test("matches representative values calculated by the source sheet", () => {
  closeTo(calculateUpgradeMetric("power-cradle", 10, context()).value, 122.5251353617, 1e-8);
  closeTo(calculateUpgradeMetric("temporal-lrs", 2, context()).value, 283.0962375898, 1e-8);
  closeTo(calculateUpgradeMetric("creation-cells", 9, context()).value, 48.508401775, 1e-8);
  closeTo(calculateUpgradeMetric("creation-mech-cap", 12, context()).value, 445.7856, 1e-6);
  closeTo(calculateUpgradeMetric("innovation-cores", 0, context({ gemLevels: { Innovation: 3 } })).value, 742.4952, 1e-6);
});

test("ship Rank and Crew change Power recommendations", () => {
  const baseline = calculateUpgradeMetric("power-cradle", 10, context()).value;
  const strongerShip = calculateUpgradeMetric("power-cradle", 10, context({
    profile: { ships: { cradle: { rank: 350, crew: 2600 } } },
  })).value;
  assert.ok(strongerShip > baseline);
});

test("global progression inputs drive their matching Gem formulas", () => {
  const temporal = calculateUpgradeMetric("temporal-lrs", 2, context()).value;
  const moreResets = calculateUpgradeMetric("temporal-lrs", 2, context({ profile: { lrs: 7000 } })).value;
  const creation = calculateUpgradeMetric("creation-cells", 9, context()).value;
  const moreTech = calculateUpgradeMetric("creation-cells", 9, context({ profile: { tech: 25000 } })).value;
  const innovation = calculateUpgradeMetric("innovation-cells", 8, context()).value;
  const moreResearch = calculateUpgradeMetric("innovation-cells", 8, context({ profile: { research: 500 } })).value;
  assert.ok(moreResets > temporal);
  assert.ok(moreTech > creation);
  assert.ok(moreResearch > innovation);
});

test("Power upgrades combine all resources affected by the source formula", () => {
  const metric = calculateUpgradeMetric("power-zeus", 3, context());
  for (const resource of ["cells", "mp", "shards", "rp", "ap", "mats"]) {
    assert.ok(metric.components[resource] > 0, `${resource} should contribute to Zeus Power`);
  }
});

test("loot weights affect loot upgrades independently", () => {
  const baseline = calculateUpgradeMetric("attraction-borge", 23, context()).value;
  const higherBorgeWeight = calculateUpgradeMetric("attraction-borge", 23, context({ weights: { borge: 20000 } })).value;
  const higherOzzyWeight = calculateUpgradeMetric("attraction-borge", 23, context({ weights: { ozzy: 20000 } })).value;
  closeTo(higherBorgeWeight, baseline * 2);
  closeTo(higherOzzyWeight, baseline);
});

test("nodes expose real effects and receive a weighted efficiency", () => {
  const node = calculateNodeMetric("node-temporal-2", context());
  assert.match(NODE_EFFECTS["node-temporal-2"], /Loop Reset/);
  assert.ok(node.components.shards > 0);
  assert.ok(node.components.rp > 0);
  assert.ok(node.components.ap > 0);
  assert.ok(metricScore(node, 9000) > 0);
});
