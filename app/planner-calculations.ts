export const PLANNER_RESOURCES = ["cells", "mp", "shards", "rp", "ap", "mats", "borge", "ozzy", "knox"] as const;
export type PlannerResource = (typeof PLANNER_RESOURCES)[number];

export const SHIP_IDS = ["cradle", "aux", "zag", "hephaestus", "demeter", "koios", "zeus"] as const;
export type ShipId = (typeof SHIP_IDS)[number];
export type ShipStats = Record<ShipId, { rank: number; crew: number }>;

export type PlannerGemName = "Exodus" | "Temporal" | "Innovation" | "Power" | "Attraction" | "Creation" | "Evolution";

export type CalculationProfile = {
  lrs: number;
  tech: number;
  research: number;
  meltdown: number;
  quantum: number;
  manualMk9: number;
  mk9Output: number;
  relic26Level: number;
  ultimaBadgeCost: number;
  ships: ShipStats;
};

export type CalculationContext = {
  profile: CalculationProfile;
  weights: Record<PlannerResource, number>;
  gemLevels: Record<PlannerGemName, number>;
  gemNodes: Record<PlannerGemName, number>;
  upgradeLevels: Record<string, number>;
};

export type WeightedMetric = {
  value: number;
  bonus: string;
  components: Partial<Record<PlannerResource, number>>;
};

const LOG10_2 = Math.log10(2);
const SCORE_SCALE = 1e12;
const TRINKET_GAINS = {
  cells: 1.24133539244238e17,
  mp: 5.91733677489497,
  shards: 11.5435155058739,
  rp: 10.382082425971,
  ap: 1.264533689,
  mats: 1.124843186,
} as const;
const SHIP_EVOLUTION_GAINS = {
  normal: { cells: 280854124.5, mp: 1.243354542, shards: 1.25159675331765, rp: 2.32129474353755, ap: 1.04759885708282 },
  exodusNode2: { cells: 63581690093, mp: 2.326133457, shards: 1.96458977142785, rp: 5.3593742505191, ap: 3.867429085 },
} as const;

const POWER_SHIP_FORMULAS: Record<string, { ship: ShipId; crewFactor: number; rankFactor: number }> = {
  "power-cradle": { ship: "cradle", crewFactor: 0.0012, rankFactor: 0.02 },
  "power-aux": { ship: "aux", crewFactor: 0.0014, rankFactor: 0.02 },
  "power-zag": { ship: "zag", crewFactor: 0.002, rankFactor: 0.03 },
  "power-hephaestus": { ship: "hephaestus", crewFactor: 0.0012, rankFactor: 0.02 },
  "power-demeter": { ship: "demeter", crewFactor: 0.0034, rankFactor: 0.02 },
  "power-koios": { ship: "koios", crewFactor: 0.0014, rankFactor: 0.02 },
  "power-zeus": { ship: "zeus", crewFactor: 0.0012, rankFactor: 0.02 },
};

const POWER_WEIGHT_FACTORS: Record<string, Partial<Record<PlannerResource, number>>> = {
  "power-cradle": { cells: 2, shards: 1, rp: 1 },
  "power-aux": { cells: 2, shards: 1, rp: 1 },
  "power-zag": { cells: 2, mp: 1, shards: 1, rp: 1 },
  "power-hephaestus": { cells: 2, mp: 2, shards: 1, rp: 1 },
  "power-demeter": { cells: 2, mp: 1, shards: 2, rp: 1 },
  "power-koios": { cells: 2, mp: 2, shards: 3, rp: 2 },
  "power-zeus": { cells: 4, mp: 1, shards: 2, rp: 2, ap: 2, mats: 2 },
};

const POWER_MELTDOWN_CELL_FACTORS: Record<string, number> = {
  "power-cradle": 14,
  "power-aux": 28,
  "power-zag": 15,
  "power-hephaestus": 29,
  "power-demeter": 14,
  "power-koios": 16,
  "power-zeus": 16,
};

export const NODE_EFFECTS: Record<string, string> = {
  "node-exodus-1": "Borge loot scales with purchased Evolution and Temporal upgrades; also improves Meltdown progression.",
  "node-exodus-2": "Materials scale with purchased Temporal and Innovation upgrades; improves fragments and Ship Evolutions.",
  "node-exodus-3": "Ozzy loot scales with purchased Innovation and Power upgrades; improves relics and retains Ship Evolutions.",
  "node-exodus-4": "Reduces m0 cost with Power and Attraction upgrades and retains Ship Crewmates through Loop Resets.",
  "node-exodus-5": "Knox loot scales with purchased Attraction and Creation upgrades and retains Ship Ranks through Loop Resets.",
  "node-exodus-6": "Raises Catch-Up Timer cap, reduces manual MK9 costs and retains Ship Installs through Loop Resets.",
  "node-temporal-1": "Starts every TR with e100 MP, 100 free Loops Filled and 100 free Loop Resets.",
  "node-temporal-2": "Each Loop Reset multiplies Shards by 1.03, RP by 1.02 and AP by 1.01.",
  "node-temporal-3": "Each Loop Reset multiplies All Generator output by 1.05 and Materials by 1.005.",
  "node-temporal-4": "Approximately 23% more Borge loot, 300 free Loops Filled and 400 free Loop Resets.",
  "node-temporal-5": "MP scales strongly with Zagreus Rank, adds free Zagreus Ranks and increases Ouroboros Orbs.",
  "node-temporal-6": "Adds 3% Borge, Ozzy and Knox loot plus tick-based MP and AP.",
  "node-innovation-1": "Speeds Koios ranks, starts with early research completed and unlocks research bulk buy.",
  "node-innovation-2": "Multiplies RP by e25 and gives Ozzy 25% more HP regeneration.",
  "node-innovation-3": "Adds combat power and effect chance to Borge and Ozzy.",
  "node-innovation-4": "Multiplies Cells, All Gens, MP, Shards, RP, AP and Materials by 1.02 per Koios Rank.",
  "node-innovation-5": "Scales Materials with Research progress and multiplies Borge, Ozzy and Knox loot by 1.3.",
  "node-innovation-6": "Scales Cells, MP and AP with completed Studies.",
  "node-attraction-1": "Multiplies Campaign fragments by 1.5 and Shards by 1.1 per Demeter Crew.",
  "node-attraction-2": "Reduces Esoteric Exchange costs and improves Borge experience and Lucky Looter.",
  "node-attraction-3": "Operations Retained scale Cells, All Gens, RP and Shards; Borge and Ozzy loot gain 25%.",
  "node-attraction-4": "Multiplies Campaign and Farm fragments by 1.25 and improves the Shard milestone.",
  "node-attraction-5": "Multiplies Shards by 1.75 per Demeter Rank and accelerates Demeter ranks.",
  "node-attraction-6": "Raises Attraction Node 3's Operation Retention cap from e333 to e555.",
  "node-creation-1": "Reduces Mech mission timers by 30 minutes and increases Borge Max HP by 20%.",
  "node-creation-2": "Raises Cradle Mech caps by e1000, improves Borge stats and retains claimed reward lanes.",
  "node-creation-3": "Each Mech multiplies AP and Materials by 1.01 and improves Borge as he levels.",
  "node-creation-4": "Cells scale by 1.01 per Tech Upgrade and Materials by 1.015 per Mech.",
  "node-creation-5": "Adds e50 Mech cap, fragment scaling per Mech and Hunter HP scaling.",
  "node-creation-6": "Improves daily Tokens, Ozzy level scaling and daily MP rewards.",
  "node-power-1": "Starts with 50 Innovation Cores and 500 Mining Pods; improves Mining Pods and relic caps.",
  "node-power-2": "Starts with 160 Blueprints and 300 Fireteam Carriers; doubles Campaign fragments.",
  "node-power-3": "Greatly improves Construction speed, cost, Storage Facility and Farm fragments.",
  "node-power-4": "Starts with 50 Innovation Cores and 150 Titan Haulers; doubles Farm fragments.",
  "node-power-5": "Starts with 180 Blueprints and 100 Combat Corvettes; adds Innovation Cores from Campaigns.",
  "node-power-6": "Improves construction resources, Tokenium and Knox level scaling.",
  "node-evolution-1": "Raises Ouroboros Orb Catch-Up cap to x4 and increases Catch-Up speed by x1.66.",
  "node-evolution-2": "Player Levels award LP, LP can buy RP and Hunter loot increases by 10%.",
  "node-evolution-3": "Adds e10 Cells per manual MK9 purchase and +0.025 Meltdown power.",
  "node-evolution-4": "Raises Ouroboros Orb Catch-Up to x8 and increases Catch-Up speed by x1.33.",
  "node-evolution-5": "Adds LP per Cradle Rank and improves LP doublers for Cells, MP, Shards and RP.",
  "node-evolution-6": "Adds e2000 Cells, +0.040 Meltdown power and Hunter effect chances.",
};

function amplification(gemLevel: number) {
  return 0.9 + 0.1 * gemLevel;
}

function logRatio(baseFactor: number, level: number) {
  return Math.log10(1 + baseFactor * (level + 1)) - Math.log10(1 + baseFactor * level);
}

function weightedComponents(logs: Partial<Record<PlannerResource, number>>, weights: Record<PlannerResource, number>) {
  const components: Partial<Record<PlannerResource, number>> = {};
  let value = 0;
  for (const resource of PLANNER_RESOURCES) {
    const contribution = (logs[resource] ?? 0) * weights[resource];
    if (contribution) components[resource] = contribution;
    value += contribution;
  }
  return { value, components };
}

function mergeMetrics(...metrics: WeightedMetric[]): WeightedMetric {
  const components: Partial<Record<PlannerResource, number>> = {};
  let value = 0;
  for (const metric of metrics) {
    value += metric.value;
    for (const resource of PLANNER_RESOURCES) {
      const contribution = metric.components[resource] ?? 0;
      if (contribution) components[resource] = (components[resource] ?? 0) + contribution;
    }
  }
  return { value, components, bonus: metrics.map((metric) => metric.bonus).filter(Boolean).join(" · ") };
}

function fromLogs(logs: Partial<Record<PlannerResource, number>>, context: CalculationContext, bonus: string): WeightedMetric {
  return { ...weightedComponents(logs, context.weights), bonus };
}

function formatMultiplierFromLog(logGain: number) {
  if (!Number.isFinite(logGain) || logGain <= 0) return "No measurable gain";
  if (logGain < 6) {
    const multiplier = 10 ** logGain;
    return `x${multiplier >= 100 ? multiplier.toFixed(0) : multiplier >= 10 ? multiplier.toFixed(2) : multiplier.toFixed(3)}`;
  }
  const exponent = Math.floor(logGain);
  const mantissa = 10 ** (logGain - exponent);
  return `x${mantissa.toFixed(2)}e${exponent}`;
}

function exodusNodeSupport(gem: PlannerGemName, context: CalculationContext): WeightedMetric {
  const exodusNodes = context.gemNodes.Exodus;
  if ((gem === "Temporal" || gem === "Evolution") && exodusNodes >= 1) {
    return fromLogs({ borge: Math.log10(1.002) }, context, "includes Exodus Node 1 loot");
  }
  if ((gem === "Innovation" || gem === "Power") && exodusNodes >= 3) {
    return fromLogs({ ozzy: Math.log10(1.002) }, context, "includes Exodus Node 3 loot");
  }
  if ((gem === "Attraction" || gem === "Creation") && exodusNodes >= 5) {
    return fromLogs({ knox: Math.log10(1.002) }, context, "includes Exodus Node 5 loot");
  }
  return { value: 0, bonus: "", components: {} };
}

function mk9Stability(level: number, evolutionLevel: number) {
  return 0.1 + (1 + level * 0.025) ** amplification(evolutionLevel) - 1;
}

function coreValue(cores: number, context: CalculationContext) {
  const stabilityLevel = context.upgradeLevels["evolution-stability"] ?? 0;
  const stability = mk9Stability(stabilityLevel, context.gemLevels.Evolution);
  const ratio = context.profile.ultimaBadgeCost > 0 ? cores / context.profile.ultimaBadgeCost : 0;
  return fromLogs({
    cells: 10 * context.profile.meltdown * (8 + stability) * ratio,
    mp: 8 * ratio,
    shards: 6 * ratio,
  }, context, `+${cores} Innovation Cores`);
}

function effectiveRelic26Level(context: CalculationContext) {
  if (context.gemLevels.Power < 3) return 0;
  return Math.min(40, Math.max(0, Math.trunc(context.profile.relic26Level)));
}

function powerMetric(id: string, level: number, context: CalculationContext): WeightedMetric {
  const formula = POWER_SHIP_FORMULAS[id];
  const ship = context.profile.ships[formula.ship];
  const amp = amplification(context.gemLevels.Power);
  const logGain = amp * (
    ship.crew * logRatio(formula.crewFactor, level)
    + ship.rank * logRatio(formula.rankFactor, level)
  );
  const logs = { ...POWER_WEIGHT_FACTORS[id] };
  logs.cells = (logs.cells ?? 0) + POWER_MELTDOWN_CELL_FACTORS[id] * context.profile.meltdown;
  for (const resource of PLANNER_RESOURCES) logs[resource] = (logs[resource] ?? 0) * logGain;
  return mergeMetrics(fromLogs(logs, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Power", context));
}

export function calculateUpgradeMetric(id: string, level: number, context: CalculationContext): WeightedMetric | null {
  const { profile, gemLevels } = context;

  if (POWER_SHIP_FORMULAS[id]) return powerMetric(id, level, context);

  if (id === "exodus-cells") return fromLogs({ cells: Math.log10(4) * amplification(gemLevels.Exodus) }, context, formatMultiplierFromLog(Math.log10(4) * amplification(gemLevels.Exodus)));
  if (id === "exodus-shards") return fromLogs({ shards: Math.log10(5) * amplification(gemLevels.Exodus) }, context, formatMultiplierFromLog(Math.log10(5) * amplification(gemLevels.Exodus)));
  if (id === "exodus-rp") return fromLogs({ rp: Math.log10(8) * amplification(gemLevels.Exodus) }, context, formatMultiplierFromLog(Math.log10(8) * amplification(gemLevels.Exodus)));
  if (id === "exodus-mp") return fromLogs({ mp: Math.log10(4) * amplification(gemLevels.Exodus) }, context, formatMultiplierFromLog(Math.log10(4) * amplification(gemLevels.Exodus)));
  if (id === "exodus-ap") return fromLogs({ ap: Math.log10(1.6) * amplification(gemLevels.Exodus) }, context, formatMultiplierFromLog(Math.log10(1.6) * amplification(gemLevels.Exodus)));
  if (id === "exodus-mats") return fromLogs({ mats: Math.log10(1.4) * amplification(gemLevels.Exodus) }, context, formatMultiplierFromLog(Math.log10(1.4) * amplification(gemLevels.Exodus)));
  if (id === "exodus-orbs") return null;

  if (id === "temporal-lms") {
    const logGain = level > 0 ? Math.log10((level + 1) / level) : Math.log10(2);
    return mergeMetrics(fromLogs({ mp: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Temporal", context));
  }
  if (id === "temporal-ticks") {
    const logGain = level > 0 ? Math.log10((level + 1) / level) : Math.log10(2);
    return mergeMetrics(fromLogs({ mp: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Temporal", context));
  }
  if (id === "temporal-zag-ranks") {
    const logGain = context.profile.ships.zag.rank * logRatio(0.35, level) * amplification(Math.min(gemLevels.Temporal, 3));
    return mergeMetrics(fromLogs({ mp: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Temporal", context));
  }
  if (id === "temporal-lm-max") {
    const exodusNode3 = context.gemNodes.Exodus >= 3;
    const relic26Level = effectiveRelic26Level(context);
    const logs = exodusNode3
      ? { cells: 50, mp: 15 * 1.25 * (1 + 0.02 * relic26Level) * LOG10_2, shards: 15 * 1.25 * (1 + 0.02 * relic26Level) * LOG10_2 }
      : { cells: 39, mp: 9 * LOG10_2, shards: 9 * LOG10_2 };
    return mergeMetrics(fromLogs(logs, context, exodusNode3 ? "+50 LM levels with relic scaling" : "+39 Cells and +9 MP/Shards LM levels"), exodusNodeSupport("Temporal", context));
  }
  if (id === "temporal-zag-crew") {
    const logGain = context.profile.ships.zag.crew * logRatio(0.003, level) * amplification(Math.min(gemLevels.Temporal, 3));
    return mergeMetrics(fromLogs({ mp: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Temporal", context));
  }
  if (id === "temporal-lrs") {
    const logGain = profile.lrs * logRatio(0.005, level) * amplification(Math.min(gemLevels.Temporal, 3));
    return mergeMetrics(fromLogs({ mp: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Temporal", context));
  }

  if (id === "innovation-studies" || id === "innovation-blueprints") return null;
  const innovationFactors: Record<string, { resource: PlannerResource; factor: number }> = {
    "innovation-cells": { resource: "cells", factor: 0.06 },
    "innovation-mp": { resource: "mp", factor: 0.04 },
    "innovation-shards": { resource: "shards", factor: 0.04 },
    "innovation-rp": { resource: "rp", factor: 0.04 },
    "innovation-ap": { resource: "ap", factor: 0.04 },
    "innovation-mats": { resource: "mats", factor: 0.01 },
  };
  if (innovationFactors[id]) {
    const formula = innovationFactors[id];
    const logGain = profile.research * logRatio(formula.factor, level) * amplification(gemLevels.Innovation);
    return mergeMetrics(fromLogs({ [formula.resource]: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Innovation", context));
  }
  if (id === "innovation-cores") {
    const cores = Math.floor((1 + 0.2 * gemLevels.Innovation) * profile.quantum);
    return mergeMetrics(coreValue(cores, context), exodusNodeSupport("Innovation", context));
  }

  if (id === "attraction-borge") {
    const logGain = Math.log10(1.07) * amplification(gemLevels.Attraction);
    return mergeMetrics(fromLogs({ borge: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Attraction", context));
  }
  if (id === "attraction-ozzy") {
    const logGain = Math.log10(1.04) * amplification(gemLevels.Attraction);
    return mergeMetrics(fromLogs({ ozzy: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Attraction", context));
  }
  if (id === "attraction-catch-up") return null;
  if (id === "attraction-gu1") {
    const logGain = Math.log10(1.03) * amplification(gemLevels.Attraction);
    return mergeMetrics(fromLogs({ knox: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Attraction", context));
  }
  if (id === "attraction-gu2") {
    const remaining = Math.max(0.001, 1.02 - 0.001 * level);
    const next = Math.max(0.001, 1.02 - 0.001 * (level + 1));
    const logGain = Math.log10(remaining / next);
    return mergeMetrics(fromLogs({ knox: logGain }, context, `${((1 - next / remaining) * 100).toFixed(2)}% faster catch-up`), exodusNodeSupport("Attraction", context));
  }
  if (id === "attraction-gu3") {
    const gains = context.gemNodes.Exodus >= 2 ? SHIP_EVOLUTION_GAINS.exodusNode2 : SHIP_EVOLUTION_GAINS.normal;
    const logs = Object.fromEntries(Object.entries(gains).map(([resource, multiplier]) => [resource, Math.log10(multiplier)])) as Partial<Record<PlannerResource, number>>;
    return mergeMetrics(fromLogs(logs, context, `Cells ${formatMultiplierFromLog(logs.cells ?? 0)} plus MP/Shards/RP/AP`), exodusNodeSupport("Attraction", context));
  }

  if (id === "creation-mech-cap") {
    const logGain = 8 * amplification(gemLevels.Creation);
    const logs = {
      mp: logGain,
      cells: logGain * (2 + 8 * profile.meltdown),
      shards: logGain,
    };
    return mergeMetrics(fromLogs(logs, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Creation", context));
  }
  if (id === "creation-hardware") {
    const logGain = amplification(gemLevels.Creation);
    return mergeMetrics(fromLogs({ cells: logGain * 8 * profile.meltdown }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Creation", context));
  }
  if (id === "creation-software") {
    const logGain = Math.log10(50) * amplification(gemLevels.Creation);
    return mergeMetrics(fromLogs({ cells: logGain * 8 * profile.meltdown }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Creation", context));
  }
  if (id === "creation-cells") {
    const cellExponent = profile.tech * logRatio(0.005, level) * amplification(gemLevels.Creation);
    return mergeMetrics(fromLogs({ cells: cellExponent }, context, `e${cellExponent.toFixed(2)} Cells`), exodusNodeSupport("Creation", context));
  }
  const creationFactors: Record<string, { resource: PlannerResource; factor: number }> = {
    "creation-mp": { resource: "mp", factor: 0.001 },
    "creation-shards": { resource: "shards", factor: 0.001 },
    "creation-rp": { resource: "rp", factor: 0.0007 },
  };
  if (creationFactors[id]) {
    const formula = creationFactors[id];
    const logGain = profile.tech * logRatio(formula.factor, level) * amplification(gemLevels.Creation);
    return mergeMetrics(fromLogs({ [formula.resource]: logGain }, context, formatMultiplierFromLog(logGain)), exodusNodeSupport("Creation", context));
  }
  if (id === "creation-trinkets") {
    const logs = Object.fromEntries(Object.entries(TRINKET_GAINS).map(([resource, multiplier]) => [resource, Math.log10(multiplier)])) as Partial<Record<PlannerResource, number>>;
    return mergeMetrics(fromLogs(logs, context, "+F Trinket tier weighted across six resources"), exodusNodeSupport("Creation", context));
  }
  const creationLoot: Record<string, { resource: PlannerResource; multiplier: number }> = {
    "creation-borge": { resource: "borge", multiplier: 1.025 },
    "creation-ozzy": { resource: "ozzy", multiplier: 1.01 },
    "creation-knox": { resource: "knox", multiplier: 1.025 },
  };
  if (creationLoot[id]) {
    const formula = creationLoot[id];
    return mergeMetrics(fromLogs({ [formula.resource]: Math.log10(formula.multiplier) }, context, `x${formula.multiplier.toFixed(3)}`), exodusNodeSupport("Creation", context));
  }

  if (id === "power-blueprints") return null;
  if (id === "power-cores") return mergeMetrics(coreValue(4 * gemLevels.Power, context), exodusNodeSupport("Power", context));

  if (id === "evolution-gens") {
    return mergeMetrics(fromLogs({ cells: 8 * profile.meltdown }, context, "x1e8 All Generator output"), exodusNodeSupport("Evolution", context));
  }
  if (id === "evolution-lp") {
    const relic26Level = effectiveRelic26Level(context);
    const lpLog = context.gemNodes.Exodus >= 3 ? 50 * 1.25 * (1 + 0.02 * relic26Level) / 10 * LOG10_2 : 5 * LOG10_2;
    return mergeMetrics(fromLogs({ cells: lpLog, mp: lpLog, shards: lpLog }, context, "+50 LP with current relic assumption"), exodusNodeSupport("Evolution", context));
  }
  if (id === "evolution-stability") {
    const currentStability = mk9Stability(level, gemLevels.Evolution);
    const nextStability = mk9Stability(level + 1, gemLevels.Evolution);
    const cellExponent = currentStability > 0 ? profile.mk9Output * (nextStability / currentStability - 1) * profile.meltdown : 0;
    const resonanceLevel = context.upgradeLevels["evolution-resonance"] ?? 0;
    const shardLog = resonanceLevel * LOG10_2;
    return mergeMetrics(fromLogs({ cells: cellExponent, shards: shardLog }, context, `e${cellExponent.toFixed(2)} Cells · x${(2 ** Math.min(resonanceLevel, 20)).toFixed(0)} Shards`), exodusNodeSupport("Evolution", context));
  }
  if (id === "evolution-resonance") {
    const stabilityLevel = context.upgradeLevels["evolution-stability"] ?? 0;
    const stability = mk9Stability(stabilityLevel, gemLevels.Evolution);
    const shardLog = profile.manualMk9 > 0 ? Math.log10(profile.manualMk9) * (1 + stability) * 4.5 : 0;
    return mergeMetrics(fromLogs({ shards: shardLog }, context, formatMultiplierFromLog(shardLog)), exodusNodeSupport("Evolution", context));
  }

  return null;
}

function totalUpgradeLevels(context: CalculationContext, gems: PlannerGemName[]) {
  return Object.entries(context.upgradeLevels)
    .filter(([id]) => gems.some((gem) => id.startsWith(`${gem.toLowerCase()}-`)) && !id.endsWith("-quality"))
    .reduce((sum, [, level]) => sum + level, 0);
}

function strategicMetric(context: CalculationContext, resources: PlannerResource[], factor: number, bonus: string) {
  const logs = Object.fromEntries(resources.map((resource) => [resource, factor])) as Partial<Record<PlannerResource, number>>;
  return fromLogs(logs, context, bonus);
}

export function calculateNodeMetric(nodeId: string, context: CalculationContext): WeightedMetric {
  const bonus = NODE_EFFECTS[nodeId] ?? "Unlocks this Gem node's permanent effects.";
  const id = Number(nodeId.split("-").at(-1) ?? 0);

  if (nodeId.startsWith("node-exodus-")) {
    if (id === 1) return fromLogs({ borge: totalUpgradeLevels(context, ["Evolution", "Temporal"]) * Math.log10(1.002), cells: Math.floor(context.profile.manualMk9 / 20) * context.profile.meltdown }, context, bonus);
    if (id === 2) return fromLogs({ mats: totalUpgradeLevels(context, ["Temporal", "Innovation"]) * Math.log10(1.035) }, context, bonus);
    if (id === 3) return fromLogs({ ozzy: totalUpgradeLevels(context, ["Innovation", "Power"]) * Math.log10(1.003) }, context, bonus);
    if (id === 4) return strategicMetric(context, ["borge", "ozzy", "knox"], 0.025, bonus);
    if (id === 5) return fromLogs({ knox: totalUpgradeLevels(context, ["Attraction", "Creation"]) * Math.log10(1.003) }, context, bonus);
    return strategicMetric(context, ["mats", "cells"], 0.04, bonus);
  }
  if (nodeId === "node-temporal-1") return fromLogs({ mp: 100 }, context, bonus);
  if (nodeId === "node-temporal-2") return fromLogs({ shards: context.profile.lrs * Math.log10(1.03), rp: context.profile.lrs * Math.log10(1.02), ap: context.profile.lrs * Math.log10(1.01) }, context, bonus);
  if (nodeId === "node-temporal-3") return fromLogs({ cells: context.profile.lrs * Math.log10(1.05) * 8 * context.profile.meltdown, mats: context.profile.lrs * Math.log10(1.005) }, context, bonus);
  if (nodeId === "node-temporal-4") return fromLogs({ borge: Math.log10(1.23), mp: 400 * Math.log10(1.005) }, context, bonus);
  if (nodeId === "node-temporal-5") return fromLogs({ mp: context.profile.ships.zag.rank * Math.log10(4) }, context, bonus);
  if (nodeId === "node-temporal-6") return fromLogs({ borge: Math.log10(1.03), ozzy: Math.log10(1.03), knox: Math.log10(1.03), mp: 0.1, ap: 0.1 }, context, bonus);

  if (nodeId === "node-innovation-1") return strategicMetric(context, ["rp"], 20, bonus);
  if (nodeId === "node-innovation-2") return fromLogs({ rp: 25, ozzy: Math.log10(1.25) }, context, bonus);
  if (nodeId === "node-innovation-3") return strategicMetric(context, ["borge", "ozzy"], Math.log10(1.03), bonus);
  if (nodeId === "node-innovation-4") {
    const factor = context.profile.ships.koios.rank * Math.log10(1.02);
    return fromLogs({ cells: factor * (1 + 8 * context.profile.meltdown), mp: factor, shards: factor, rp: factor, ap: factor, mats: factor }, context, bonus);
  }
  if (nodeId === "node-innovation-5") return fromLogs({ mats: context.profile.research * Math.log10(1.02), borge: Math.log10(1.3), ozzy: Math.log10(1.3), knox: Math.log10(1.3) }, context, bonus);
  if (nodeId === "node-innovation-6") {
    const factor = Math.max(1, context.profile.research / 10) * Math.log10(1.00002);
    return fromLogs({ cells: factor, mp: factor, ap: factor }, context, bonus);
  }

  if (nodeId === "node-attraction-1") return fromLogs({ shards: context.profile.ships.demeter.crew * Math.log10(1.1), mats: Math.log10(1.5) }, context, bonus);
  if (nodeId === "node-attraction-2") return strategicMetric(context, ["borge", "mats"], 1, bonus);
  if (nodeId === "node-attraction-3") return fromLogs({ cells: 3, rp: 3, shards: 3, borge: Math.log10(1.25), ozzy: Math.log10(1.25) }, context, bonus);
  if (nodeId === "node-attraction-4") return strategicMetric(context, ["mats", "shards"], Math.log10(1.25), bonus);
  if (nodeId === "node-attraction-5") return fromLogs({ shards: context.profile.ships.demeter.rank * Math.log10(1.75) }, context, bonus);
  if (nodeId === "node-attraction-6") return strategicMetric(context, ["cells", "rp", "shards"], 2.22, bonus);

  if (nodeId === "node-creation-1") return strategicMetric(context, ["mats", "borge"], Math.log10(1.2), bonus);
  if (nodeId === "node-creation-2") return fromLogs({ cells: 1000, borge: Math.log10(1.02) }, context, bonus);
  if (nodeId === "node-creation-3") return strategicMetric(context, ["ap", "mats"], Math.log10(1.01) * 10, bonus);
  if (nodeId === "node-creation-4") return fromLogs({ cells: context.profile.tech * Math.log10(1.01), mats: Math.log10(1.015) * 10, knox: Math.log10(1.08) }, context, bonus);
  if (nodeId === "node-creation-5") return strategicMetric(context, ["cells", "mats"], 50, bonus);
  if (nodeId === "node-creation-6") return strategicMetric(context, ["mp", "mats", "ozzy"], 0.5, bonus);

  if (nodeId === "node-power-1") return mergeMetrics(coreValue(50, context), strategicMetric(context, ["mats"], 1, bonus));
  if (nodeId === "node-power-2") return strategicMetric(context, ["rp", "mats"], 2, bonus);
  if (nodeId === "node-power-3") return strategicMetric(context, ["rp", "mats"], 3, bonus);
  if (nodeId === "node-power-4") return mergeMetrics(coreValue(50, context), strategicMetric(context, ["mats"], Math.log10(2), bonus));
  if (nodeId === "node-power-5") return mergeMetrics(coreValue(3, context), strategicMetric(context, ["rp", "mats"], 2, bonus));
  if (nodeId === "node-power-6") return strategicMetric(context, ["cells", "mp", "shards", "mats", "knox"], 0.5, bonus);

  if (nodeId === "node-evolution-1") return strategicMetric(context, ["borge", "ozzy", "knox"], Math.log10(4), bonus);
  if (nodeId === "node-evolution-2") return strategicMetric(context, ["cells", "mp", "shards", "rp", "borge", "ozzy", "knox"], Math.log10(1.1), bonus);
  if (nodeId === "node-evolution-3") return fromLogs({ cells: context.profile.manualMk9 * 10 + 0.025 * 8 * context.profile.meltdown }, context, bonus);
  if (nodeId === "node-evolution-4") return strategicMetric(context, ["borge", "ozzy", "knox"], Math.log10(2), bonus);
  if (nodeId === "node-evolution-5") return fromLogs({ cells: context.profile.ships.cradle.rank * LOG10_2 / 9, mp: context.profile.ships.cradle.rank * LOG10_2 / 9, shards: context.profile.ships.cradle.rank * LOG10_2 / 9, rp: context.profile.ships.cradle.rank * LOG10_2 / 70 }, context, bonus);
  if (nodeId === "node-evolution-6") return fromLogs({ cells: 2000 + 0.04 * 8 * context.profile.meltdown, borge: Math.log10(1.02), ozzy: Math.log10(1.02), knox: Math.log10(1.02) }, context, bonus);

  return strategicMetric(context, ["cells", "mp", "shards", "rp", "ap", "mats"], 0.01, bonus);
}

export function metricScore(metric: WeightedMetric, cost: number) {
  if (!Number.isFinite(cost)) return 0;
  return metric.value * SCORE_SCALE / Math.max(cost, 1);
}
