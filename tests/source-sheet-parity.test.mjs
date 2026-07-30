import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateUpgradeMetric,
  metricScore,
} from "../app/planner-calculations.ts";

// Inputs copied from the source spreadsheet:
// MainSheet D6:D7, C8:C9, B10:B12, C30:D38, C16:F22 and Q68;
// Relic efficiency E27.
const sourceContext = {
  weights: {
    cells: 1,
    mp: 20,
    shards: 15,
    rp: 10,
    ap: 14.9,
    mats: 100,
    borge: 10000,
    ozzy: 10000,
    knox: 10000,
  },
  profile: {
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
  },
  gemLevels: {
    Exodus: 4,
    Temporal: 3,
    Innovation: 2,
    Power: 2,
    Attraction: 3,
    Creation: 4,
    Evolution: 0,
  },
  gemNodes: {
    Exodus: 0,
    Temporal: 3,
    Innovation: 3,
    Power: 3,
    Attraction: 3,
    Creation: 3,
    Evolution: 0,
  },
  upgradeLevels: {
    "evolution-stability": 0,
    "evolution-resonance": 0,
  },
};

function withOverrides(overrides = {}) {
  return {
    ...sourceContext,
    ...overrides,
    weights: { ...sourceContext.weights, ...overrides.weights },
    profile: {
      ...sourceContext.profile,
      ...overrides.profile,
      ships: { ...sourceContext.profile.ships, ...overrides.profile?.ships },
    },
    gemLevels: { ...sourceContext.gemLevels, ...overrides.gemLevels },
    gemNodes: { ...sourceContext.gemNodes, ...overrides.gemNodes },
    upgradeLevels: { ...sourceContext.upgradeLevels, ...overrides.upgradeLevels },
  };
}

function closeTo(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

test("all seven Power values match the cached source-sheet results", () => {
  const cases = [
    ["power-cradle", 10, 122.5251354], // MainSheet R59
    ["power-aux", 8, 113.8885393], // MainSheet R60
    ["power-zag", 7, 150.2655366], // MainSheet R61
    ["power-hephaestus", 6, 461.9913868], // MainSheet M62
    ["power-demeter", 4, 154.7295976], // MainSheet R63
    ["power-koios", 3, 165.8443818], // MainSheet R64
    ["power-zeus", 3, 260.0587], // MainSheet R65
  ];
  for (const [id, level, expected] of cases) {
    closeTo(calculateUpgradeMetric(id, level, sourceContext).value, expected, 1e-6);
  }
});

test("Temporal values match the source sheet with the same progression and ship inputs", () => {
  closeTo(calculateUpgradeMetric("temporal-ticks", 17, sourceContext).value, 0.4964716745, 1e-9); // MainSheet P20
  closeTo(calculateUpgradeMetric("temporal-zag-ranks", 5, sourceContext).value, 149.84352, 1e-7); // MainSheet P21
  closeTo(calculateUpgradeMetric("temporal-lm-max", 8, sourceContext).value, 133.8244486, 1e-7); // MainSheet S22
  closeTo(calculateUpgradeMetric("temporal-zag-crew", 12, sourceContext).value, 38.00529357, 1e-7); // MainSheet J23
  closeTo(calculateUpgradeMetric("temporal-lrs", 2, sourceContext).value, 283.0962376, 1e-7); // MainSheet J24
});

test("source-sheet costs produce the same displayed efficiencies", () => {
  const cradle = calculateUpgradeMetric("power-cradle", 10, sourceContext);
  closeTo(metricScore(cradle, 88_573_500_000), 1383.315967, 1e-4); // MainSheet S59
  const lrs = calculateUpgradeMetric("temporal-lrs", 2, sourceContext);
  closeTo(metricScore(lrs, 490_000_000_000), 577.7474303, 1e-4); // MainSheet K24
});

test("advanced inputs remain dynamic and enforce their limits", () => {
  const coresAtSheetDefaults = calculateUpgradeMetric(
    "innovation-cores",
    0,
    withOverrides({ gemLevels: { Innovation: 3 } }),
  );
  closeTo(coresAtSheetDefaults.value, 742.4952, 1e-6); // MainSheet M35

  const cheaperBadge = calculateUpgradeMetric(
    "innovation-cores",
    0,
    withOverrides({ profile: { ultimaBadgeCost: 25 }, gemLevels: { Innovation: 3 } }),
  );
  closeTo(cheaperBadge.value, coresAtSheetDefaults.value * 2, 1e-6);

  const unvaluedCores = calculateUpgradeMetric(
    "innovation-cores",
    0,
    withOverrides({ profile: { ultimaBadgeCost: 0 }, gemLevels: { Innovation: 3 } }),
  );
  closeTo(unvaluedCores.value, 0);

  const lockedRelic = calculateUpgradeMetric(
    "temporal-lm-max",
    8,
    withOverrides({ profile: { relic26Level: 40 }, gemLevels: { Power: 2 }, gemNodes: { Exodus: 3 } }),
  );
  const zeroRelic = calculateUpgradeMetric(
    "temporal-lm-max",
    8,
    withOverrides({ profile: { relic26Level: 0 }, gemLevels: { Power: 2 }, gemNodes: { Exodus: 3 } }),
  );
  closeTo(lockedRelic.value, zeroRelic.value);

  const activeRelic = calculateUpgradeMetric(
    "temporal-lm-max",
    8,
    withOverrides({ profile: { relic26Level: 40 }, gemLevels: { Power: 3 }, gemNodes: { Exodus: 3 } }),
  );
  assert.ok(activeRelic.value > lockedRelic.value);

  const cappedRelic = calculateUpgradeMetric(
    "temporal-lm-max",
    8,
    withOverrides({ profile: { relic26Level: 999 }, gemLevels: { Power: 3 }, gemNodes: { Exodus: 3 } }),
  );
  closeTo(cappedRelic.value, activeRelic.value);
});
