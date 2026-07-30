"use client";

import { useEffect, useMemo, useState } from "react";
import sourceGemData from "./source-gem-data.json";
import sourceGemNodes from "./source-gem-nodes.json";
import sourceUpgradeCaps from "./source-upgrade-caps.json";
import {
  calculateNodeMetric,
  calculateUpgradeMetric,
  metricScore,
  NODE_EFFECTS,
  PLANNER_RESOURCES,
  SHIP_IDS,
  type CalculationProfile,
  type PlannerResource,
  type ShipId,
} from "./planner-calculations";

type Resource = PlannerResource;
type View = "planner" | "profile" | "weights";
const GEM_NAMES = ["Exodus", "Temporal", "Innovation", "Power", "Attraction", "Creation", "Evolution"] as const;
type GemName = (typeof GEM_NAMES)[number];

type Profile = CalculationProfile & {
  savedOrbs: number;
  currentTrOrbs: number;
};

type GemProgress = { level: number; nodes: number; maxNodes: number };
type Upgrade = {
  id: string;
  gem: GemName;
  accent: string;
  name: string;
  effect: string;
  resource: Resource;
  max: number;
  costs: number[];
  defaultLevel: number;
  sourceScore: number;
  referenceCost: number;
  sourceBonus: string;
  isGemLevel: boolean;
  gain: number;
  requiredLevel: number;
};

type SourceUpgradeData = { defaultLevel: number; requiredLevel: number; costs: number[]; sourceScore: number; referenceCost: number; bonusText: string; sourceRow: number };
type GemNode = { id: string; gem: GemName; index: number; cost: number; sourceOwned: boolean };
type BudgetRecommendation = {
  kind: "upgrade" | "node";
  id: string;
  gem: GemName;
  name: string;
  fromLevel: number;
  toLevel: number;
  cost: number;
  bonus: string;
  score: number;
  resource?: Resource;
};
const SOURCE_GEM_DATA = sourceGemData as Record<string, SourceUpgradeData>;
const GEM_NODES = sourceGemNodes as GemNode[];
const UPGRADE_LEVEL_CAPS = sourceUpgradeCaps as Record<string, number>;

const DEFAULT_SHIPS: CalculationProfile["ships"] = {
  cradle: { rank: 266, crew: 2098 },
  aux: { rank: 154, crew: 1723 },
  zag: { rank: 120, crew: 1261 },
  hephaestus: { rank: 544, crew: 1116 },
  demeter: { rank: 51, crew: 1059 },
  koios: { rank: 81, crew: 1012 },
  zeus: { rank: 37, crew: 865 },
};
const DEFAULT_PROFILE: Profile = { lrs: 6200, tech: 23000, research: 425, meltdown: 0.75, quantum: 75, manualMk9: 0, mk9Output: 0, relic26Level: 0, ultimaBadgeCost: 0, ships: DEFAULT_SHIPS, savedOrbs: 1.63e9, currentTrOrbs: 1.15e12 };
type ProgressionExampleValues = Omit<Profile, "savedOrbs" | "currentTrOrbs" | "ships" | "relic26Level" | "ultimaBadgeCost">;
const PROGRESSION_EXAMPLES: Array<{ name: string; description: string; values: ProgressionExampleValues }> = [
  { name: "Hito 1", description: "Early reference", values: { lrs: 5500, tech: 22000, research: 420, meltdown: 0.74, quantum: 75, manualMk9: 0, mk9Output: 0 } },
  { name: "Hito 2", description: "Mid reference", values: { lrs: 6400, tech: 24000, research: 450, meltdown: 0.76, quantum: 80, manualMk9: 20, mk9Output: 400 } },
  { name: "Hito 3", description: "Advanced reference", values: { lrs: 9250, tech: 31000, research: 500, meltdown: 0.85, quantum: 100, manualMk9: 80, mk9Output: 1200 } },
];
const DEFAULT_WEIGHTS: Record<Resource, number> = { cells: 1, mp: 20, shards: 15, rp: 10, ap: 14.9, mats: 100, borge: 10000, ozzy: 10000, knox: 10000 };
const RESOURCE_META: Record<Resource, { label: string; short: string; color: string }> = {
  cells: { label: "Cells", short: "C", color: "#73e6b1" },
  mp: { label: "Mod Points", short: "MP", color: "#ff7e98" },
  shards: { label: "Shards", short: "S", color: "#67b7ff" },
  rp: { label: "Research Points", short: "RP", color: "#ffd263" },
  ap: { label: "Academy Points", short: "AP", color: "#8b8cff" },
  mats: { label: "Materials", short: "M", color: "#d89a68" },
  borge: { label: "Borge Loot", short: "B", color: "#ff9866" },
  ozzy: { label: "Ozzy Loot", short: "O", color: "#e66fff" },
  knox: { label: "Knox Loot", short: "K", color: "#66e8ee" },
};

const GEM_META: Record<GemName, { accent: string; defaultProgress: GemProgress }> = {
  Creation: { accent: "#ff9d53", defaultProgress: { level: 4, nodes: 3, maxNodes: 6 } },
  Evolution: { accent: "#78e1a1", defaultProgress: { level: 0, nodes: 0, maxNodes: 3 } },
  Temporal: { accent: "#ff5eb8", defaultProgress: { level: 3, nodes: 3, maxNodes: 6 } },
  Exodus: { accent: "#d9d8ff", defaultProgress: { level: 4, nodes: 0, maxNodes: 6 } },
  Attraction: { accent: "#74dfff", defaultProgress: { level: 3, nodes: 3, maxNodes: 6 } },
  Innovation: { accent: "#d7e65b", defaultProgress: { level: 2, nodes: 3, maxNodes: 6 } },
  Power: { accent: "#9482ff", defaultProgress: { level: 2, nodes: 3, maxNodes: 6 } },
};

const BASE_NODE_EXODUS_LEVEL = 3;
const EXTRA_NODE_EXODUS_LEVEL = 5;
const EVOLUTION_NODE_LEVEL = 1;

function availableNodeLimit(gem: GemName, exodusLevel: number, gemLevel: number) {
  if (gem === "Exodus") return exodusLevel >= EXTRA_NODE_EXODUS_LEVEL ? GEM_META.Exodus.defaultProgress.maxNodes : 0;
  if (gem === "Evolution") return gemLevel >= EVOLUTION_NODE_LEVEL ? GEM_META.Evolution.defaultProgress.maxNodes : 0;
  if (exodusLevel >= EXTRA_NODE_EXODUS_LEVEL) return GEM_META[gem].defaultProgress.maxNodes;
  return exodusLevel >= BASE_NODE_EXODUS_LEVEL ? 3 : 0;
}

function nodeLockReason(gem: GemName, nodeIndex: number, exodusLevel: number, gemLevel: number) {
  if (nodeIndex <= availableNodeLimit(gem, exodusLevel, gemLevel)) return "";
  if (gem === "Evolution") return "Requires Evolution Gem level 1";
  if (gem === "Exodus") return "Requires Exodus Gem level 5";
  if (nodeIndex > 3) return "Requires Exodus Gem level 5";
  return "Requires Exodus Gem level 3";
}

function gemLevelLockReason(gem: GemName, targetLevel: number, levels: Record<GemName, number>) {
  if (gem === "Exodus" && targetLevel >= 5 && levels.Evolution < 1) return "Requires Evolution Gem level 1";
  if (gem === "Power" && targetLevel >= 3 && levels.Exodus < 5) return "Requires Exodus Gem level 5";
  return "";
}

function constrainGemLevels(levels: Record<GemName, number>) {
  const next = { ...levels };
  if (next.Evolution < 1) next.Exodus = Math.min(next.Exodus, 4);
  if (next.Exodus < 5) next.Power = Math.min(next.Power, 2);
  return next;
}

function availableGemLevelMax(gem: GemName, absoluteMax: number, levels: Record<GemName, number>) {
  if (gem === "Exodus" && levels.Evolution < 1) return Math.min(absoluteMax, 4);
  if (gem === "Power" && levels.Exodus < 5) return Math.min(absoluteMax, 2);
  return absoluteMax;
}

const DEFAULT_GEM_PROGRESS = Object.fromEntries(
  GEM_NAMES.map((gem) => [gem, { ...GEM_META[gem].defaultProgress }]),
) as Record<GemName, GemProgress>;

type UpgradeSeed = [id: string, name: string, effect: string, resource: Resource, cost: number, gain: number, max: number, requiredLevel?: number];
function gemCatalog(gem: GemName, seeds: UpgradeSeed[]): Upgrade[] {
  return seeds.map(([id, name, effect, resource, fallbackCost, gain, fallbackMax, fallbackRequiredLevel = 0]) => {
    const upgradeId = `${gem.toLowerCase()}-${id}`;
    const source = SOURCE_GEM_DATA[upgradeId];
    const costs = source?.costs?.length ? source.costs : Array.from({ length: fallbackMax }, (_, level) => fallbackCost * 1.85 ** level);
    return {
      id: upgradeId,
      gem,
      accent: GEM_META[gem].accent,
      name,
      effect,
      resource,
      costs,
      defaultLevel: source?.defaultLevel ?? 0,
      sourceScore: source?.sourceScore ?? 0,
      referenceCost: source?.referenceCost ?? fallbackCost,
      sourceBonus: source?.bonusText ?? "",
      isGemLevel: id === "quality",
      gain,
      max: UPGRADE_LEVEL_CAPS[upgradeId] ?? costs.length,
      requiredLevel: source?.requiredLevel ?? fallbackRequiredLevel,
    };
  });
}

const UPGRADES: Upgrade[] = [
  ...gemCatalog("Exodus", [
    ["quality", "Exodus Gem Level", "Raises the Gem level and unlocks new bonuses", "cells", 4.57e10, 19.8, 20],
    ["cells", "Cells Bonus", "Global Cells multiplier", "cells", 4.57e10, 8.1, 30],
    ["shards", "Shards Bonus", "Global Shards multiplier", "shards", 6.73e9, 10.8, 30],
    ["rp", "RP Bonus", "Research Point multiplier", "rp", 5.08e10, 11.1, 30, 1],
    ["mp", "MP Bonus", "Mod Point multiplier", "mp", 8.99e10, 13.4, 30, 1],
    ["ap", "AP Bonus", "Academy Point multiplier", "ap", 3.24e10, 12.7, 30, 2],
    ["mats", "Mats Bonus", "Materials multiplier", "mats", 1.42e11, 14.2, 25, 3],
    ["orbs", "Orbs Bonus", "Orb income multiplier", "mats", 2.85e11, 15.6, 25, 4],
  ]),
  ...gemCatalog("Temporal", [
    ["quality", "Temporal Gem Level", "Raises the Gem level and unlocks new bonuses", "mp", 7.2e9, 16.8, 20],
    ["lms", "MP (LMs)", "Mod Point loop-mod output", "mp", 4.03e8, 18.2, 25],
    ["ticks", "MP (Ticks)", "Mod Point tick multiplier", "mp", 4.03e8, 16.1, 25],
    ["zag-ranks", "MP (Zag Ranks)", "Mod Points from Zag ranks", "mp", 1e7, 8.2, 30, 1],
    ["lm-max", "LM Max Levels", "Raises Loop Mod maximum levels", "rp", 1.31e11, 13.7, 18, 2],
    ["zag-crew", "MP (Zag Crew)", "Mod Points from Zag crew", "mp", 5.31e10, 14.4, 25, 2],
    ["lrs", "MP (LRs)", "Mod Points from loop resets", "mp", 4.9e11, 15.2, 25, 3],
  ]),
  ...gemCatalog("Innovation", [
    ["quality", "Innovation Gem Level", "Raises the Gem level and unlocks new bonuses", "cells", 6.6e10, 13.3, 20],
    ["studies", "Studies Bonus", "Boosts Study effectiveness", "rp", 2.54e10, 12.5, 25],
    ["cells", "Cells Bonus", "Global Cells multiplier", "cells", 1e11, 12.8, 30],
    ["mp", "MP Bonus", "Mod Point multiplier", "mp", 2e11, 12.6, 30, 1],
    ["shards", "Shards Bonus", "Global Shards multiplier", "shards", 3e11, 11.9, 30, 1],
    ["rp", "RP Bonus", "Research Point multiplier", "rp", 4e11, 12.2, 30, 1],
    ["ap", "AP Bonus", "Academy Point multiplier", "ap", 5e11, 13.1, 25, 2],
    ["mats", "Mats Bonus", "Materials multiplier", "mats", 1e12, 13.7, 25, 2],
    ["blueprints", "Bonus Blueprints", "Adds bonus Innovation blueprints", "rp", 1e13, 15.1, 15, 3],
    ["cores", "Bonus Inno Cores", "Adds bonus Innovation cores", "mats", 1e13, 15.9, 15, 3],
  ]),
  ...gemCatalog("Attraction", [
    ["quality", "Attraction Gem Level", "Raises the Gem level and unlocks new bonuses", "borge", 4.8e10, 14.3, 20],
    ["borge", "Borge Loot", "Increases Borge loot multiplier", "borge", 2.61e11, 19.4, 16],
    ["ozzy", "Ozzy Loot", "Increases Ozzy loot multiplier", "ozzy", 4.56e10, 16.4, 16],
    ["catch-up", "Catch-Up (Borge)", "Boosts Borge catch-up power", "borge", 1, 6.2, 12],
    ["gu1", "Knox Loot", "Increases Knox loot multiplier", "knox", 7.5e10, 11.3, 20, 4],
    ["gu2", "Catch-Up (Knox)", "Boosts Knox catch-up power", "knox", 2.4e11, 12.1, 20, 4],
    ["gu3", "Ship Evo Bonus", "Boosts ship evolution gains", "ap", 9e11, 13.6, 20, 4],
  ]),
  ...gemCatalog("Creation", [
    ["quality", "Creation Gem Level", "Raises the Gem level and unlocks new bonuses", "cells", 3.8e10, 14.7, 20],
    ["mech-cap", "Mech Bonus Cap", "Raises the effective mech bonus cap", "cells", 1e12, 16.7, 20],
    ["hardware", "Hardware Bonus", "Boosts hardware production", "cells", 4.75e10, 12.9, 25],
    ["software", "Software Bonus", "Boosts software production", "cells", 4.19e10, 12.4, 25],
    ["cells", "Cells Bonus", "Global Cells multiplier", "cells", 9.92e10, 11.6, 30, 1],
    ["mp", "MP Bonus", "Mod Point multiplier", "mp", 7.24e11, 13.2, 30, 1],
    ["shards", "Shards Bonus", "Global Shards multiplier", "shards", 7.4e12, 10.1, 22, 1],
    ["rp", "RP Bonus", "Research Point multiplier", "rp", 1.8e11, 12.1, 30, 2],
    ["trinkets", "+F Trinket Tiers", "Unlocks stronger +F Trinket tiers", "mats", 2.11e11, 14.8, 18, 2],
    ["borge", "Borge Stats", "Boosts Borge combat stats", "borge", 1e12, 13.4, 20, 3],
    ["ozzy", "Ozzy Stats", "Boosts Ozzy combat stats", "ozzy", 1e12, 13.6, 20, 3],
    ["knox", "Knox Stats", "Boosts Knox combat stats", "knox", 1e12, 13.9, 20, 4],
  ]),
  ...gemCatalog("Power", [
    ["quality", "Power Gem Level", "Raises the Gem level and unlocks new bonuses", "rp", 5.9e10, 13.9, 20],
    ["cradle", "Cradle Power Bonus", "Boosts Cradle production power", "rp", 8.86e10, 14.9, 18],
    ["aux", "Aux Power Bonus", "Boosts Auxiliary production power", "rp", 1.31e11, 13.5, 18],
    ["zag", "Zag Power Bonus", "Boosts Zag production power", "rp", 2.34e11, 14.1, 18, 1],
    ["hephaestus", "Hephaestus Power Bonus", "Boosts Hephaestus production power", "rp", 1.87e12, 15.2, 18, 1],
    ["demeter", "Demeter Power Bonus", "Boosts Demeter production power", "rp", 1.2e12, 14.8, 18, 2],
    ["koios", "Koios Power Bonus", "Boosts Koios production power", "rp", 3.07e11, 14.3, 18, 2],
    ["zeus", "Zeus Power Bonus", "Boosts Zeus production power", "rp", 5.1e11, 15.4, 18, 2],
    ["blueprints", "Bonus Blueprints", "Adds bonus Power blueprints", "rp", 1e10, 11.8, 15, 3],
    ["cores", "Bonus Inno Cores", "Adds bonus Innovation cores", "mats", 1e11, 12.7, 15, 3],
  ]),
  ...gemCatalog("Evolution", [
    ["quality", "Evolution Gem Level", "Raises the Gem level and unlocks new bonuses", "ap", 7.5e10, 13.8, 20],
    ["gens", "All Gens", "Boosts all generator output", "ap", 1.1e11, 14.3, 25],
    ["lp", "LP Bonus", "Loop Point multiplier", "ap", 2.8e11, 14.9, 25, 1],
    ["stability", "MK9 Stability", "Improves MK9 stability", "mats", 8.2e11, 15.5, 20, 2],
    ["resonance", "MK9 Resonance", "Improves MK9 resonance", "mats", 1.6e12, 16.2, 20, 3],
  ]),
];

function normalizeUpgradeLevels(levels: Record<string, number>, gemLevels: Record<GemName, number>) {
  return Object.fromEntries(UPGRADES.filter((upgrade) => !upgrade.isGemLevel).map((upgrade) => {
    const stored = levels[upgrade.id] ?? upgrade.defaultLevel;
    const level = gemLevels[upgrade.gem] >= upgrade.requiredLevel ? Math.min(upgrade.max, Math.max(0, stored)) : 0;
    return [upgrade.id, level];
  })) as Record<string, number>;
}

function normalizeUpgradePlan(plan: Record<string, number>, plannedGemLevels: Record<GemName, number>) {
  const normalized = { ...plan };
  UPGRADES.filter((upgrade) => !upgrade.isGemLevel).forEach((upgrade) => {
    if (plannedGemLevels[upgrade.gem] < upgrade.requiredLevel) delete normalized[upgrade.id];
  });
  return normalized;
}

const STORAGE_KEY = "cifi-gem-planner-prototype-v5";
const LEGACY_STORAGE_KEY = "cifi-gem-planner-prototype-v4";

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) < 1000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
  const units = ["", "K", "M", "B", "T", "Qa", "Qu", "Sx", "Sp", "Oc", "No", "Dc"];
  const tier = Math.min(Math.floor(Math.log10(Math.abs(value)) / 3), units.length - 1);
  const scaled = value / 1000 ** tier;
  return `${scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)}${units[tier]}`;
}

function ResourceIcon({ resource }: { resource: Resource }) {
  const meta = RESOURCE_META[resource];
  return <span className="resource-icon" style={{ "--resource": meta.color } as React.CSSProperties}>{meta.short}</span>;
}

function GemArtwork({ gem }: { gem: GemName }) {
  return <img className={`gem-art gem-${gem.toLowerCase()}`} src={`gem-${gem.toLowerCase()}.png`} alt={`${gem} Gem`} />;
}

function Stepper({ label, value, step = 1, max, onChange, suffix, increaseDisabledReason }: { label: string; value: number; step?: number; max?: number; onChange: (value: number) => void; suffix?: string; increaseDisabledReason?: string }) {
  const clamp = (next: number) => Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(0, next));
  return (
    <label className="stepper-field">
      <span>{label}</span>
      <div className="stepper-control">
        <button type="button" disabled={value <= 0} onClick={() => onChange(clamp(value - step))} aria-label={`Decrease ${label}`}>−</button>
        <div><input type="number" value={value} step={step} max={max} min={0} onChange={(event) => onChange(clamp(Number(event.target.value) || 0))} />{suffix && <em>{suffix}</em>}</div>
        <button type="button" disabled={max !== undefined && value >= max} title={increaseDisabledReason} onClick={() => onChange(clamp(value + step))} aria-label={`Increase ${label}`}>+</button>
      </div>
    </label>
  );
}

function GemSetupCard({ gem, progress, maxLevel, allowedMaxLevel, levelLockReason, plannedNodes, nodes, currentExodusLevel, plannedExodusLevel, plannedGemLevel, ownedNodeLimit, plannedNodeLimit, onLevel, onNodes, onAddNode, onRemoveNode }: { gem: GemName; progress: GemProgress; maxLevel: number; allowedMaxLevel: number; levelLockReason: string; plannedNodes: number; nodes: GemNode[]; currentExodusLevel: number; plannedExodusLevel: number; plannedGemLevel: number; ownedNodeLimit: number; plannedNodeLimit: number; onLevel: (level: number) => void; onNodes: (nodes: number) => void; onAddNode: () => void; onRemoveNode: () => void }) {
  const plannedEnd = Math.min(plannedNodeLimit, progress.nodes + plannedNodes);
  const nextNode = nodes.find((node) => node.index === plannedEnd + 1 && node.index <= plannedNodeLimit);
  const blockedNextNode = nodes.find((node) => node.index === plannedEnd + 1);
  const blockedReason = blockedNextNode ? nodeLockReason(gem, blockedNextNode.index, plannedExodusLevel, plannedGemLevel) : "";
  return (
    <article className="gem-setup-card panel" style={{ "--gem": GEM_META[gem].accent } as React.CSSProperties}>
      <div className="gem-setup-title"><GemArtwork gem={gem} /><div><strong>{gem}</strong><small>{progress.nodes}{plannedNodes ? `→${plannedEnd}` : ""}/{nodes.length} nodes</small></div></div>
      <Stepper label="Gem level" value={progress.level} max={allowedMaxLevel} onChange={onLevel} increaseDisabledReason={levelLockReason} />
      {levelLockReason && allowedMaxLevel < maxLevel && <p className="gem-level-unlock-note">{levelLockReason}.</p>}
      <div className="node-editor"><span>Owned & planned nodes</span><div>{nodes.map((node) => {
        const locked = node.index > ownedNodeLimit;
        const state = node.index <= progress.nodes ? "active" : node.index <= plannedEnd ? "planned" : locked ? "locked" : "";
        const reason = nodeLockReason(gem, node.index, currentExodusLevel, progress.level);
        return <button key={node.id} type="button" disabled={locked} title={reason || `Node ${node.index}: ◈ ${formatNumber(node.cost)} · ${NODE_EFFECTS[node.id] ?? "Permanent Gem node effects"}`} className={state} onClick={() => onNodes(progress.nodes === node.index ? node.index - 1 : node.index)}>{node.index}</button>;
      })}</div></div>
      {blockedReason && <p className="node-unlock-note">{blockedReason}.</p>}
      <div className="node-purchase-actions"><button type="button" disabled={!plannedNodes} onClick={onRemoveNode}>−</button><button type="button" className="node-purchase-button" disabled={!nextNode} title={nextNode ? NODE_EFFECTS[nextNode.id] : blockedReason} onClick={onAddNode}>{nextNode ? `Add node ${nextNode.index} · ◈ ${formatNumber(nextNode.cost)}` : blockedReason || "All nodes owned"}</button></div>
      {(nextNode || blockedNextNode) && <p className="node-effect-note"><span>Node {(nextNode || blockedNextNode)?.index} effect</span>{NODE_EFFECTS[(nextNode || blockedNextNode)?.id ?? ""] ?? "Permanent Gem node effects."}</p>}
    </article>
  );
}

function upgradeCostAt(upgrade: Upgrade, level: number) {
  return upgrade.costs[level] ?? Number.POSITIVE_INFINITY;
}

function upgradeCostRange(upgrade: Upgrade, fromLevel: number, quantity: number) {
  let total = 0;
  for (let offset = 0; offset < quantity; offset += 1) total += upgradeCostAt(upgrade, fromLevel + offset);
  return total;
}

const SHIP_META: Record<ShipId, { label: string }> = {
  cradle: { label: "Cradle" },
  aux: { label: "Auxesia" },
  zag: { label: "Zagreus" },
  hephaestus: { label: "Hephaestus" },
  demeter: { label: "Demeter" },
  koios: { label: "Koios" },
  zeus: { label: "Zeus" },
};

function normalizeStoredProfile(stored: Partial<Profile> & { mk9?: number; production?: number } = {}, resetAdvanced = false): Profile {
  const normalizedShips = Object.fromEntries(SHIP_IDS.map((ship) => [
    ship,
    {
      rank: Math.max(0, Number(stored.ships?.[ship]?.rank ?? DEFAULT_SHIPS[ship].rank)),
      crew: Math.max(0, Number(stored.ships?.[ship]?.crew ?? DEFAULT_SHIPS[ship].crew)),
    },
  ])) as Profile["ships"];
  return {
    lrs: Math.max(0, Number(stored.lrs ?? DEFAULT_PROFILE.lrs)),
    tech: Math.max(0, Number(stored.tech ?? DEFAULT_PROFILE.tech)),
    research: Math.max(0, Number(stored.research ?? DEFAULT_PROFILE.research)),
    meltdown: Math.max(0, Number(stored.meltdown ?? DEFAULT_PROFILE.meltdown)),
    quantum: Math.max(0, Number(stored.quantum ?? DEFAULT_PROFILE.quantum)),
    manualMk9: Math.max(0, Number(stored.manualMk9 ?? 0)),
    mk9Output: Math.max(0, Number(stored.mk9Output ?? stored.production ?? DEFAULT_PROFILE.mk9Output)),
    relic26Level: resetAdvanced ? 0 : Math.min(40, Math.max(0, Math.trunc(Number(stored.relic26Level ?? DEFAULT_PROFILE.relic26Level)))),
    ultimaBadgeCost: resetAdvanced ? 0 : Math.max(0, Number(stored.ultimaBadgeCost ?? DEFAULT_PROFILE.ultimaBadgeCost)),
    ships: normalizedShips,
    savedOrbs: Math.max(0, Number(stored.savedOrbs ?? DEFAULT_PROFILE.savedOrbs)),
    currentTrOrbs: Math.max(0, Number(stored.currentTrOrbs ?? DEFAULT_PROFILE.currentTrOrbs)),
  };
}

function normalizeStoredWeights(stored: Partial<Record<Resource, number>> = {}) {
  return Object.fromEntries(PLANNER_RESOURCES.map((resource) => [
    resource,
    Math.max(0, Number(stored[resource] ?? DEFAULT_WEIGHTS[resource])),
  ])) as Record<Resource, number>;
}

export default function Home() {
  const [view, setView] = useState<View>("planner");
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [plan, setPlan] = useState<Record<string, number>>({});
  const [nodePlan, setNodePlan] = useState<Partial<Record<GemName, number>>>({});
  const [gemProgress, setGemProgress] = useState<Record<GemName, GemProgress>>(DEFAULT_GEM_PROGRESS);
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Resource | "all">("all");
  const [selectedGem, setSelectedGem] = useState<GemName | "all">("all");
  const [availability, setAvailability] = useState<"all" | "available" | "locked">("all");
  const [sort, setSort] = useState<"efficiency" | "cost">("efficiency");
  const [mobileNav, setMobileNav] = useState(false);
  const [openUpgradeGroup, setOpenUpgradeGroup] = useState<GemName | null>("Exodus");
  const [notice, setNotice] = useState("Saved locally");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const currentStored = window.localStorage.getItem(STORAGE_KEY);
      const legacyStored = currentStored ? null : window.localStorage.getItem(LEGACY_STORAGE_KEY);
      const stored = currentStored ?? legacyStored;
      if (!stored) { setHydrated(true); return; }
      try {
        const parsed = JSON.parse(stored);
        const storedPlan = (parsed.plan ?? {}) as Record<string, number>;
        const storedProgress = (parsed.gemProgress ?? {}) as Partial<Record<GemName, Partial<GemProgress>>>;
        const storedGemLevels = constrainGemLevels(Object.fromEntries(GEM_NAMES.map((gem) => [
          gem,
          Math.max(0, Number(storedProgress[gem]?.level ?? DEFAULT_GEM_PROGRESS[gem].level)),
        ])) as Record<GemName, number>);
        const normalizedProgress = Object.fromEntries(GEM_NAMES.map((gem) => {
          const saved = storedProgress[gem] ?? {};
          const level = storedGemLevels[gem];
          const maxNodes = DEFAULT_GEM_PROGRESS[gem].maxNodes;
          const nodes = Math.min(availableNodeLimit(gem, storedGemLevels.Exodus, level), Math.max(0, Number(saved.nodes ?? DEFAULT_GEM_PROGRESS[gem].nodes)));
          return [gem, { level, nodes, maxNodes }];
        })) as Record<GemName, GemProgress>;
        const storedPlannedGemLevels = constrainGemLevels(Object.fromEntries(GEM_NAMES.map((gem) => {
          const maxLevel = SOURCE_GEM_DATA[`${gem.toLowerCase()}-quality`]?.costs.length ?? normalizedProgress[gem].level;
          return [gem, Math.min(maxLevel, normalizedProgress[gem].level + Math.max(0, Number(storedPlan[`${gem.toLowerCase()}-quality`] ?? 0)))];
        })) as Record<GemName, number>);
        let normalizedStoredPlan = { ...storedPlan };
        GEM_NAMES.forEach((gem) => {
          const id = `${gem.toLowerCase()}-quality`;
          const quantity = Math.max(0, storedPlannedGemLevels[gem] - normalizedProgress[gem].level);
          if (quantity > 0) normalizedStoredPlan[id] = quantity; else delete normalizedStoredPlan[id];
        });
        normalizedStoredPlan = normalizeUpgradePlan(normalizedStoredPlan, storedPlannedGemLevels);
        const storedNodePlan = (parsed.nodePlan ?? {}) as Partial<Record<GemName, number>>;
        const normalizedNodePlan = Object.fromEntries(GEM_NAMES.flatMap((gem) => {
          const quantity = Math.min(
            Math.max(0, availableNodeLimit(gem, storedPlannedGemLevels.Exodus, storedPlannedGemLevels[gem]) - normalizedProgress[gem].nodes),
            Math.max(0, Number(storedNodePlan[gem] ?? 0)),
          );
          return quantity > 0 ? [[gem, quantity]] : [];
        })) as Partial<Record<GemName, number>>;
        if (parsed.profile) setProfile(normalizeStoredProfile(parsed.profile, Boolean(legacyStored)));
        if (parsed.weights) setWeights(normalizeStoredWeights(parsed.weights));
        setPlan(normalizedStoredPlan);
        setNodePlan(normalizedNodePlan);
        setGemProgress(normalizedProgress);
        setUpgradeLevels(normalizeUpgradeLevels(parsed.upgradeLevels ?? {}, storedGemLevels));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        if (legacyStored) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      finally { setHydrated(true); }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, weights, plan, nodePlan, gemProgress, upgradeLevels }));
  }, [hydrated, profile, weights, plan, nodePlan, gemProgress, upgradeLevels]);

  const currentGemLevels = useMemo(() => Object.fromEntries(GEM_NAMES.map((gem) => [gem, gemProgress[gem].level])) as Record<GemName, number>, [gemProgress]);
  const plannedGemLevels = useMemo(() => constrainGemLevels(Object.fromEntries(GEM_NAMES.map((gem) => [gem, Math.min(
    UPGRADES.find((upgrade) => upgrade.gem === gem && upgrade.isGemLevel)?.max ?? 12,
    gemProgress[gem].level + (plan[`${gem.toLowerCase()}-quality`] ?? 0),
  )])) as Record<GemName, number>), [gemProgress, plan]);
  const plannedExodusLevel = plannedGemLevels.Exodus;
  const plannedGemNodeCounts = useMemo(() => Object.fromEntries(GEM_NAMES.map((gem) => [
    gem,
    Math.min(
      availableNodeLimit(gem, plannedExodusLevel, plannedGemLevels[gem]),
      gemProgress[gem].nodes + Math.max(0, nodePlan[gem] ?? 0),
    ),
  ])) as Record<GemName, number>, [gemProgress, nodePlan, plannedExodusLevel, plannedGemLevels]);
  const calculationUpgradeLevels = useMemo(() => Object.fromEntries(UPGRADES.map((upgrade) => {
    if (upgrade.isGemLevel) return [upgrade.id, plannedGemLevels[upgrade.gem]];
    const current = gemProgress[upgrade.gem].level >= upgrade.requiredLevel ? (upgradeLevels[upgrade.id] ?? upgrade.defaultLevel) : 0;
    return [upgrade.id, Math.min(upgrade.max, current + Math.max(0, plan[upgrade.id] ?? 0))];
  })) as Record<string, number>, [gemProgress, plan, plannedGemLevels, upgradeLevels]);
  const calculationContext = useMemo(() => ({
    profile,
    weights,
    gemLevels: plannedGemLevels,
    gemNodes: plannedGemNodeCounts,
    upgradeLevels: calculationUpgradeLevels,
  }), [calculationUpgradeLevels, plannedGemLevels, plannedGemNodeCounts, profile, weights]);

  const catalog = useMemo(() => {
    return UPGRADES.map((upgrade) => {
      const storedLevel = upgrade.isGemLevel ? gemProgress[upgrade.gem].level : (gemProgress[upgrade.gem].level >= upgrade.requiredLevel ? (upgradeLevels[upgrade.id] ?? upgrade.defaultLevel) : 0);
      const current = Math.min(upgrade.max, Math.max(0, storedLevel));
      const requestedQuantity = Math.min(plan[upgrade.id] ?? 0, Math.max(0, upgrade.max - current));
      const plannedQuantity = upgrade.isGemLevel ? Math.min(requestedQuantity, Math.max(0, plannedGemLevels[upgrade.gem] - current)) : requestedQuantity;
      const nextCost = upgradeCostAt(upgrade, current + plannedQuantity);
      const planCost = upgradeCostRange(upgrade, current, plannedQuantity);
      const priceAvailable = Number.isFinite(nextCost);
      const nextTargetLevel = current + plannedQuantity + 1;
      const currentLevelLockReason = upgrade.isGemLevel ? gemLevelLockReason(upgrade.gem, nextTargetLevel, currentGemLevels) : "";
      const plannedLevelLockReason = upgrade.isGemLevel ? gemLevelLockReason(upgrade.gem, nextTargetLevel, plannedGemLevels) : "";
      const unlocked = gemProgress[upgrade.gem].level >= upgrade.requiredLevel && !currentLevelLockReason;
      const unlockedInPlan = plannedGemLevels[upgrade.gem] >= upgrade.requiredLevel && !plannedLevelLockReason;
      const metric = calculateUpgradeMetric(upgrade.id, current + plannedQuantity, calculationContext);
      const fallbackScore = (upgrade.gain * DEFAULT_WEIGHTS[upgrade.resource] * 1e10) / Math.max(1, upgrade.referenceCost || nextCost);
      const baseScore = upgrade.sourceScore > 0 ? upgrade.sourceScore : fallbackScore;
      const weightFactor = weights[upgrade.resource] / DEFAULT_WEIGHTS[upgrade.resource];
      const costFactor = Number.isFinite(nextCost) && upgrade.referenceCost > 0 ? upgrade.referenceCost / nextCost : 1;
      const score = priceAvailable ? (metric ? metricScore(metric, nextCost) : baseScore * weightFactor * costFactor) : 0;
      const bonus = metric?.bonus || upgrade.sourceBonus || (upgrade.isGemLevel ? "Unlocks and amplifies Gem bonuses" : upgrade.effect);
      return { ...upgrade, current, plannedQuantity, plannedLevel: current + plannedQuantity, nextCost, planCost, priceAvailable, unlocked, unlockedInPlan, score, bonus, scoreComponents: metric?.components ?? {}, maxed: current >= upgrade.max, levelLockReason: plannedLevelLockReason };
    });
  }, [calculationContext, currentGemLevels, gemProgress, plan, plannedGemLevels, upgradeLevels, weights]);

  const ranked = useMemo(() => catalog
    .filter((upgrade) => filter === "all" || upgrade.resource === filter)
    .filter((upgrade) => selectedGem === "all" || upgrade.gem === selectedGem)
    .filter((upgrade) => availability === "all" || (availability === "available" ? upgrade.unlockedInPlan : !upgrade.unlockedInPlan))
    .sort((a, b) => sort === "cost" ? a.nextCost - b.nextCost : b.score - a.score), [availability, catalog, filter, selectedGem, sort]);

  const plannedItems = Object.keys(plan).map((id) => catalog.find((upgrade) => upgrade.id === id)).filter((upgrade) => upgrade && upgrade.plannedQuantity > 0) as (typeof catalog);
  const plannedNodeItems = GEM_NAMES.map((gem) => {
    const current = gemProgress[gem].nodes;
    const nodeLimit = availableNodeLimit(gem, plannedExodusLevel, plannedGemLevels[gem]);
    const quantity = Math.min(nodePlan[gem] ?? 0, Math.max(0, nodeLimit - current));
    const nodes = GEM_NODES.filter((node) => node.gem === gem && node.index > current && node.index <= current + quantity);
    const metrics = nodes.map((node) => ({ node, metric: calculateNodeMetric(node.id, calculationContext) }));
    return { gem, current, quantity, plannedEnd: current + quantity, nodes, metrics, cost: nodes.reduce((sum, node) => sum + node.cost, 0) };
  }).filter((item) => item.quantity > 0);
  const upgradeIncrementCount = plannedItems.reduce((sum, upgrade) => sum + upgrade.plannedQuantity, 0);
  const nodeIncrementCount = plannedNodeItems.reduce((sum, item) => sum + item.quantity, 0);
  const plannedCount = upgradeIncrementCount + nodeIncrementCount;
  const totalCost = plannedItems.reduce((sum, upgrade) => sum + upgrade.planCost, 0) + plannedNodeItems.reduce((sum, item) => sum + item.cost, 0);
  const availableOrbs = profile.savedOrbs + profile.currentTrOrbs;
  const budgetDifference = availableOrbs - totalCost;
  const budgetRecommendations = useMemo(() => {
    if (budgetDifference < 0) return { items: [], remaining: 0 };
    const simulatedLevels = Object.fromEntries(catalog.map((upgrade) => [upgrade.id, upgrade.plannedLevel])) as Record<string, number>;
    const simulatedGemLevels = Object.fromEntries(GEM_NAMES.map((gem) => [
      gem,
      catalog.find((upgrade) => upgrade.gem === gem && upgrade.isGemLevel)?.plannedLevel ?? gemProgress[gem].level,
    ])) as Record<GemName, number>;
    const simulatedNodes = Object.fromEntries(GEM_NAMES.map((gem) => [gem, gemProgress[gem].nodes + (nodePlan[gem] ?? 0)])) as Record<GemName, number>;
    const items: BudgetRecommendation[] = [];
    let remaining = budgetDifference;
    const simulatedContext = () => ({
      ...calculationContext,
      gemLevels: simulatedGemLevels,
      gemNodes: simulatedNodes,
      upgradeLevels: simulatedLevels,
    });

    const affordableGemLevels = catalog.filter((upgrade) => {
      const level = simulatedLevels[upgrade.id];
      const cost = upgradeCostAt(upgrade, level);
      return upgrade.isGemLevel && level < upgrade.max && !gemLevelLockReason(upgrade.gem, level + 1, simulatedGemLevels) && Number.isFinite(cost) && cost <= remaining;
    }).sort((a, b) => {
      const aSelected = selectedGem !== "all" && a.gem === selectedGem ? 1 : 0;
      const bSelected = selectedGem !== "all" && b.gem === selectedGem ? 1 : 0;
      return bSelected - aSelected || b.score - a.score || a.nextCost - b.nextCost;
    });
    const initialGemLevel = affordableGemLevels[0];
    if (initialGemLevel) {
      const fromLevel = simulatedLevels[initialGemLevel.id];
      const cost = upgradeCostAt(initialGemLevel, fromLevel);
      items.push({ kind: "upgrade", id: initialGemLevel.id, gem: initialGemLevel.gem, name: initialGemLevel.name, resource: initialGemLevel.resource, fromLevel, toLevel: fromLevel + 1, cost, bonus: initialGemLevel.bonus, score: initialGemLevel.score });
      simulatedLevels[initialGemLevel.id] = fromLevel + 1;
      simulatedGemLevels[initialGemLevel.gem] = fromLevel + 1;
      remaining -= cost;
    }

    const priorityGem = initialGemLevel?.gem ?? (selectedGem === "all" ? undefined : selectedGem);
    const affordableNodes = GEM_NAMES.flatMap((gem) => {
      const fromLevel = simulatedNodes[gem];
      if (fromLevel >= availableNodeLimit(gem, simulatedGemLevels.Exodus, simulatedGemLevels[gem])) return [];
      const node = GEM_NODES.find((candidate) => candidate.gem === gem && candidate.index === fromLevel + 1);
      if (!node || node.cost > remaining) return [];
      const metric = calculateNodeMetric(node.id, simulatedContext());
      return [{ gem, node, fromLevel, metric, score: metricScore(metric, node.cost) }];
    }).sort((a, b) => Number(b.gem === priorityGem) - Number(a.gem === priorityGem) || b.score - a.score || a.node.cost - b.node.cost);
    const initialNode = affordableNodes[0];
    if (initialNode) {
      items.push({ kind: "node", id: initialNode.node.id, gem: initialNode.gem, name: `${initialNode.gem} Gem Node ${initialNode.node.index}`, fromLevel: initialNode.fromLevel, toLevel: initialNode.node.index, cost: initialNode.node.cost, bonus: initialNode.metric.bonus, score: initialNode.score });
      simulatedNodes[initialNode.gem] = initialNode.node.index;
      remaining -= initialNode.node.cost;
    }

    while (items.length < 6) {
      const upgradeCandidates = catalog.flatMap((upgrade) => {
        const fromLevel = simulatedLevels[upgrade.id];
        if (fromLevel >= upgrade.max || simulatedGemLevels[upgrade.gem] < upgrade.requiredLevel) return [];
        if (upgrade.isGemLevel && gemLevelLockReason(upgrade.gem, fromLevel + 1, simulatedGemLevels)) return [];
        const cost = upgradeCostAt(upgrade, fromLevel);
        if (!Number.isFinite(cost) || cost > remaining) return [];
        const metric = calculateUpgradeMetric(upgrade.id, fromLevel, simulatedContext());
        const score = metric ? metricScore(metric, cost) : upgrade.score * (upgrade.nextCost > 0 && Number.isFinite(upgrade.nextCost) ? upgrade.nextCost / Math.max(cost, 1) : 1);
        return [{ kind: "upgrade" as const, upgrade, fromLevel, cost, score, bonus: metric?.bonus || upgrade.bonus }];
      });
      const nodeCandidates = GEM_NAMES.flatMap((gem) => {
        const fromLevel = simulatedNodes[gem];
        if (fromLevel >= availableNodeLimit(gem, simulatedGemLevels.Exodus, simulatedGemLevels[gem])) return [];
        const node = GEM_NODES.find((candidate) => candidate.gem === gem && candidate.index === fromLevel + 1);
        if (!node || node.cost > remaining) return [];
        const metric = calculateNodeMetric(node.id, simulatedContext());
        return [{ kind: "node" as const, node, gem, fromLevel, cost: node.cost, score: metricScore(metric, node.cost), bonus: metric.bonus }];
      });
      const candidates = [...upgradeCandidates, ...nodeCandidates].sort((a, b) => b.score - a.score || a.cost - b.cost);
      const best = candidates[0];
      if (!best) break;
      const toLevel = best.fromLevel + 1;
      if (best.kind === "upgrade") {
        items.push({ kind: "upgrade", id: best.upgrade.id, gem: best.upgrade.gem, name: best.upgrade.name, resource: best.upgrade.resource, fromLevel: best.fromLevel, toLevel, cost: best.cost, bonus: best.bonus, score: best.score });
        simulatedLevels[best.upgrade.id] = toLevel;
        if (best.upgrade.isGemLevel) simulatedGemLevels[best.upgrade.gem] = toLevel;
      } else {
        items.push({ kind: "node", id: best.node.id, gem: best.gem, name: `${best.gem} Gem Node ${best.node.index}`, fromLevel: best.fromLevel, toLevel, cost: best.cost, bonus: best.bonus, score: best.score });
        simulatedNodes[best.gem] = toLevel;
      }
      remaining -= best.cost;
    }
    return { items, remaining };
  }, [budgetDifference, calculationContext, catalog, gemProgress, nodePlan, selectedGem]);
  const selectedProgress = selectedGem === "all" ? null : gemProgress[selectedGem];
  const selectedGemUpgrade = selectedGem === "all" ? null : catalog.find((upgrade) => upgrade.gem === selectedGem && upgrade.isGemLevel);
  const selectedPlannedNodes = selectedGem === "all" ? 0 : (nodePlan[selectedGem] ?? 0);
  const selectedNodeLimit = selectedGem === "all" ? 0 : availableNodeLimit(selectedGem, plannedExodusLevel, plannedGemLevels[selectedGem]);
  const selectedPlannedNodeEnd = selectedProgress ? Math.min(selectedNodeLimit, selectedProgress.nodes + selectedPlannedNodes) : 0;
  const selectedNextNode = selectedGem === "all" ? undefined : GEM_NODES.find((node) => node.gem === selectedGem && node.index === selectedPlannedNodeEnd + 1 && node.index <= selectedNodeLimit);
  const selectedBlockedNode = selectedGem === "all" ? undefined : GEM_NODES.find((node) => node.gem === selectedGem && node.index === selectedPlannedNodeEnd + 1 && node.index <= gemProgress[selectedGem].maxNodes);
  const selectedNodeBlockReason = selectedGem === "all" || !selectedBlockedNode ? "" : nodeLockReason(selectedGem, selectedBlockedNode.index, plannedExodusLevel, plannedGemLevels[selectedGem]);

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((current) => ({ ...current, [key]: value })); }
  function updateShip(ship: ShipId, key: "rank" | "crew", value: number) {
    setProfile((current) => ({
      ...current,
      ships: { ...current.ships, [ship]: { ...current.ships[ship], [key]: Math.max(0, Math.trunc(value)) } },
    }));
  }
  function updateGem(gem: GemName, patch: Partial<GemProgress>) { setGemProgress((current) => ({ ...current, [gem]: { ...current[gem], ...patch } })); }
  function normalizeGemLevelPlan(baseLevels: Record<GemName, number>, sourcePlan: Record<string, number>) {
    const rawPlannedLevels = Object.fromEntries(GEM_NAMES.map((gem) => [
      gem,
      Math.min(
        UPGRADES.find((upgrade) => upgrade.gem === gem && upgrade.isGemLevel)?.max ?? baseLevels[gem],
        baseLevels[gem] + Math.max(0, sourcePlan[`${gem.toLowerCase()}-quality`] ?? 0),
      ),
    ])) as Record<GemName, number>;
    const levels = constrainGemLevels(rawPlannedLevels);
    const normalizedPlan = { ...sourcePlan };
    GEM_NAMES.forEach((gem) => {
      const id = `${gem.toLowerCase()}-quality`;
      const quantity = Math.max(0, levels[gem] - baseLevels[gem]);
      if (quantity > 0) normalizedPlan[id] = quantity; else delete normalizedPlan[id];
    });
    return { levels, plan: normalizedPlan };
  }
  function applyProgressionExample(example: (typeof PROGRESSION_EXAMPLES)[number]) {
    setProfile((current) => ({ ...current, ...example.values }));
    setNotice(`${example.name} example loaded`);
  }
  function addPlanIncrement(id: string) {
    const upgrade = catalog.find((item) => item.id === id);
    if (!upgrade || !upgrade.unlockedInPlan || !upgrade.priceAvailable || upgrade.current + upgrade.plannedQuantity >= upgrade.max) return;
    setPlan((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }
  function addAllRecommendations() {
    if (!budgetRecommendations.items.length) return;
    let recommendationGemLevels = { ...plannedGemLevels };
    budgetRecommendations.items.filter((item) => item.kind === "upgrade" && item.id.endsWith("-quality")).forEach((item) => {
      recommendationGemLevels[item.gem] += 1;
    });
    recommendationGemLevels = constrainGemLevels(recommendationGemLevels);
    setPlan((current) => {
      const next = { ...current };
      budgetRecommendations.items.filter((item) => item.kind === "upgrade").forEach((item) => { next[item.id] = (next[item.id] ?? 0) + 1; });
      return normalizeGemLevelPlan(currentGemLevels, next).plan;
    });
    setNodePlan((current) => {
      const next = { ...current };
      budgetRecommendations.items.filter((item) => item.kind === "node").forEach((item) => {
        const allowed = availableNodeLimit(item.gem, recommendationGemLevels.Exodus, recommendationGemLevels[item.gem]);
        const planned = next[item.gem] ?? 0;
        if (gemProgress[item.gem].nodes + planned < allowed) next[item.gem] = planned + 1;
      });
      return next;
    });
    setNotice(`${budgetRecommendations.items.length} recommended purchases added`);
  }
  function removePlanIncrement(id: string, all = false) {
    const next = { ...plan };
    if (all || (next[id] ?? 0) <= 1) delete next[id]; else next[id] -= 1;
    const normalized = normalizeGemLevelPlan(currentGemLevels, next);
    setPlan(normalized.plan);
    clampNodePlanForLevels(normalized.levels);
  }
  function clampNodePlanForLevels(levels: Record<GemName, number>) {
    setNodePlan((current) => {
      const next: Partial<Record<GemName, number>> = {};
      GEM_NAMES.forEach((gem) => {
        const allowed = Math.max(0, availableNodeLimit(gem, levels.Exodus, levels[gem]) - gemProgress[gem].nodes);
        const quantity = Math.min(allowed, Math.max(0, current[gem] ?? 0));
        if (quantity > 0) next[gem] = quantity;
      });
      return next;
    });
  }
  function addNodeToPlan(gem: GemName) {
    const nodeLimit = availableNodeLimit(gem, plannedExodusLevel, plannedGemLevels[gem]);
    setNodePlan((current) => {
      const planned = current[gem] ?? 0;
      if (gemProgress[gem].nodes + planned >= nodeLimit) return current;
      return { ...current, [gem]: planned + 1 };
    });
  }
  function removeNodeFromPlan(gem: GemName, all = false) {
    setNodePlan((current) => {
      const next = { ...current };
      if (all || (next[gem] ?? 0) <= 1) delete next[gem]; else next[gem] = (next[gem] ?? 0) - 1;
      return next;
    });
  }
  function setOwnedNodes(gem: GemName, nodes: number) {
    const nodeLimit = availableNodeLimit(gem, gemProgress.Exodus.level, gemProgress[gem].level);
    updateGem(gem, { nodes: Math.min(nodeLimit, Math.max(0, nodes)) });
    removeNodeFromPlan(gem, true);
  }
  function changeGemSetupLevel(gem: GemName, level: number) {
    const nextCurrentLevels = constrainGemLevels({ ...currentGemLevels, [gem]: level });
    setGemProgress((current) => {
      const next = { ...current };
      GEM_NAMES.forEach((name) => {
        next[name] = { ...next[name], level: nextCurrentLevels[name], nodes: Math.min(next[name].nodes, availableNodeLimit(name, nextCurrentLevels.Exodus, nextCurrentLevels[name])) };
      });
      return next;
    });
    const nextPlan = { ...plan };
    delete nextPlan[`${gem.toLowerCase()}-quality`];
    const normalized = normalizeGemLevelPlan(nextCurrentLevels, nextPlan);
    setPlan(normalizeUpgradePlan(normalized.plan, normalized.levels));
    setUpgradeLevels((current) => normalizeUpgradeLevels(current, nextCurrentLevels));
    clampNodePlanForLevels(normalized.levels);
  }
  function changeUpgradeLevel(upgrade: Upgrade, delta: number) {
    setCurrentUpgradeLevel(upgrade, upgrade.current + delta);
  }
  function setCurrentUpgradeLevel(upgrade: Upgrade, value: number) {
    if (!upgrade.isGemLevel && value > 0 && currentGemLevels[upgrade.gem] < upgrade.requiredLevel) return;
    const next = Math.min(upgrade.max, Math.max(0, Math.trunc(value)));
    if (upgrade.isGemLevel) changeGemSetupLevel(upgrade.gem, next);
    else setUpgradeLevels((current) => ({ ...current, [upgrade.id]: next }));
    if (!upgrade.isGemLevel) removePlanIncrement(upgrade.id, true);
  }
  function reset() {
    setProfile(DEFAULT_PROFILE); setWeights(DEFAULT_WEIGHTS); setPlan({}); setNodePlan({}); setGemProgress(DEFAULT_GEM_PROGRESS); setUpgradeLevels({});
    setFilter("all"); setSelectedGem("all"); setAvailability("all"); setNotice("Planner reset");
  }
  function applyPlan() {
    if (!plannedCount || totalCost > availableOrbs || !Number.isFinite(totalCost)) return;
    const nextUpgradeLevels = { ...upgradeLevels };
    const nextGemProgress = { ...gemProgress };
    plannedItems.forEach((upgrade) => {
      if (upgrade.isGemLevel) nextGemProgress[upgrade.gem] = { ...nextGemProgress[upgrade.gem], level: upgrade.plannedLevel };
      else nextUpgradeLevels[upgrade.id] = upgrade.plannedLevel;
    });
    plannedNodeItems.forEach((item) => { nextGemProgress[item.gem] = { ...nextGemProgress[item.gem], nodes: item.plannedEnd }; });
    setUpgradeLevels(nextUpgradeLevels);
    setGemProgress(nextGemProgress);
    setProfile((current) => {
      const fromCurrentTr = Math.min(current.currentTrOrbs, totalCost);
      return { ...current, currentTrOrbs: current.currentTrOrbs - fromCurrentTr, savedOrbs: Math.max(0, current.savedOrbs - (totalCost - fromCurrentTr)) };
    });
    setPlan({});
    setNodePlan({});
    setNotice("Purchase plan applied");
  }
  async function copyPlan() {
    const upgradeLines = plannedItems.map((upgrade) => `${upgrade.gem} — ${upgrade.name} (${upgrade.current} → ${upgrade.plannedLevel}, ${upgrade.plannedQuantity} level${upgrade.plannedQuantity === 1 ? "" : "s"}, ◈ ${formatNumber(upgrade.planCost)})`);
    const nodeLines = plannedNodeItems.map((item) => `${item.gem} — Gem Nodes (${item.current} → ${item.plannedEnd}, ${item.quantity} node${item.quantity === 1 ? "" : "s"}, ◈ ${formatNumber(item.cost)})`);
    const lines = [...upgradeLines, ...nodeLines].map((line, index) => `${index + 1}. ${line}`);
    await navigator.clipboard.writeText(["CIFI Gem Plan", ...lines, `Total: ◈ ${formatNumber(totalCost)}`].join("\n"));
    setNotice("Plan copied to clipboard");
  }

  const navItems: Array<{ id: View; label: string; icon: string }> = [
    { id: "planner", label: "Planner", icon: "✦" }, { id: "profile", label: "Gem setup", icon: "◆" },
    { id: "weights", label: "Weights", icon: "◎" },
  ];

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><img src="gem-planner-mark.png" alt="Gem Planner" /></div><div><strong>Gem Planner</strong><small>CIFI community tool</small></div></div>
        <nav aria-label="Main navigation"><p>PLANNING</p>{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMobileNav(false); }}><i>{item.icon}</i><span>{item.label}</span>{item.id === "planner" && plannedCount > 0 && <b>{plannedCount}</b>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="save-state"><i /><span>{notice}</span></div><button className="ghost-button" onClick={reset}>Reset planner</button><p>Local preview <span>1.11.2</span></p></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><button className="menu-button" onClick={() => setMobileNav((value) => !value)} aria-label="Open navigation">☰</button><div className="crumbs"><span>Game tools</span><b>/</b><strong>{navItems.find((item) => item.id === view)?.label}</strong></div><div className="top-actions"><span className="prototype-pill">Unofficial community preview</span></div></header>
        <div className="content">
          {view === "planner" && <>
            <section className="hero-row"><div><p className="eyebrow">OPTIMIZE YOUR NEXT PURCHASES</p><h1>Plan your next <span>Gem upgrades</span></h1><p className="hero-copy">All {UPGRADES.length} Gem upgrades are visible. Set your real levels, nodes and priorities to build a personal purchase plan.</p></div><div className="hero-actions"><button className="primary-button" onClick={() => setView("profile")}>Edit my progression</button></div></section>

            <section className="stats-grid">
              <article><div className="stat-icon orb">◈</div><div><span>Available orbs</span><strong>{formatNumber(availableOrbs)}</strong><small>{formatNumber(profile.savedOrbs)} saved · {formatNumber(profile.currentTrOrbs)} this TR</small></div></article>
              <article><div className="stat-icon target">↗</div><div><span>Your progression</span><strong>Custom profile</strong><small>{profile.research} research · {profile.meltdown} meltdown</small></div></article>
              <article><div className="stat-icon plan">≡</div><div><span>Plan cost</span><strong>{formatNumber(totalCost)}</strong><small>{plannedCount} level increments selected</small></div></article>
              <article><div className="stat-icon score">✦</div><div><span>Best score</span><strong>{ranked[0]?.score.toFixed(1) ?? "—"}</strong><small>{ranked.length} of {UPGRADES.length} options shown</small></div></article>
            </section>

            <section className="gem-network" aria-label="Gem network">
              <button className={`all-gems ${selectedGem === "all" ? "active" : ""}`} onClick={() => setSelectedGem("all")}><span>ALL</span><i><strong>All gems</strong><small>{UPGRADES.length} upgrades</small></i></button>
              {GEM_NAMES.map((gem) => { const progress = gemProgress[gem]; const plannedNodes = nodePlan[gem] ?? 0; const nodeLimit = availableNodeLimit(gem, plannedExodusLevel, plannedGemLevels[gem]); return <button className={selectedGem === gem ? "active" : ""} key={gem} onClick={() => setSelectedGem((current) => current === gem ? "all" : gem)}><GemArtwork gem={gem} /><i><strong>{gem}</strong><small>Lv {progress.level} · {progress.nodes}{plannedNodes ? `→${Math.min(nodeLimit, progress.nodes + plannedNodes)}` : ""}/{progress.maxNodes} nodes</small></i></button>; })}
            </section>

            {selectedGem !== "all" && selectedProgress && <section className="quick-gem-editor panel" style={{ "--gem": GEM_META[selectedGem].accent } as React.CSSProperties}>
              <div className="quick-gem-title"><GemArtwork gem={selectedGem} /><div><span>PLANNING FOR</span><strong>{selectedGem}</strong></div></div>
              <div className="gem-state-summary"><span>CURRENT SETUP</span><strong>Lv {selectedProgress.level} · {selectedProgress.nodes}/{selectedProgress.maxNodes} nodes</strong></div>
              <div className="gem-state-summary planned"><span>AFTER PLAN</span><strong>Lv {selectedGemUpgrade?.plannedLevel ?? selectedProgress.level} · {selectedPlannedNodeEnd}/{selectedProgress.maxNodes} nodes</strong></div>
              <div className="quick-plan-actions"><button disabled={!selectedGemUpgrade || !selectedGemUpgrade.unlockedInPlan || !selectedGemUpgrade.priceAvailable || selectedGemUpgrade.current + selectedGemUpgrade.plannedQuantity >= selectedGemUpgrade.max} title={selectedGemUpgrade?.levelLockReason || (!selectedGemUpgrade?.priceAvailable ? "Price unavailable in source data" : "")} onClick={() => selectedGemUpgrade && addPlanIncrement(selectedGemUpgrade.id)}>{selectedGemUpgrade?.levelLockReason ? selectedGemUpgrade.levelLockReason : selectedGemUpgrade?.maxed ? "Gem level maxed" : selectedGemUpgrade?.priceAvailable ? `+ Gem level · ◈ ${formatNumber(selectedGemUpgrade.nextCost)}` : "Price unavailable"}</button><button disabled={!selectedNextNode} onClick={() => addNodeToPlan(selectedGem)}>{selectedNextNode ? `+ Node ${selectedNextNode.index} · ◈ ${formatNumber(selectedNextNode.cost)}` : selectedNodeBlockReason || "All nodes owned"}</button></div>
              <button className="edit-setup-link" onClick={() => setView("profile")}>Edit current setup →</button>
            </section>}

            <section className="planner-layout">
              <div className="recommendations panel">
                <div className="panel-heading"><div><p className="eyebrow">LIVE RESULTS</p><h2>Recommended upgrades <small>{ranked.length}/{UPGRADES.length}</small></h2></div><div className="result-controls">
                  <label><span>Resource</span><select value={filter} onChange={(event) => setFilter(event.target.value as Resource | "all")}><option value="all">All resources</option>{Object.entries(RESOURCE_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}</select></label>
                  <label><span>Availability</span><select value={availability} onChange={(event) => setAvailability(event.target.value as typeof availability)}><option value="all">All options</option><option value="available">Available now</option><option value="locked">Locked</option></select></label>
                  <button onClick={() => setSort((value) => value === "efficiency" ? "cost" : "efficiency")}>Sort: {sort === "efficiency" ? "Efficiency" : "Cost"} ↕</button>
                </div></div>

                <div className="upgrade-list">{ranked.map((upgrade, index) => {
                  const selected = upgrade.plannedQuantity > 0;
                  const locked = !upgrade.unlockedInPlan;
                  return <article className={`upgrade-row ${selected ? "selected" : ""} ${locked ? "locked" : ""}`} key={upgrade.id}>
                    <span className="rank">#{index + 1}</span><div className="gem-badge" style={{ "--gem": upgrade.accent } as React.CSSProperties}><GemArtwork gem={upgrade.gem} /></div>
                    <div className="upgrade-main"><strong>{upgrade.name}</strong><span>{upgrade.gem} Gem · {upgrade.effect}</span>{!upgrade.unlocked && upgrade.unlockedInPlan && <em>Will unlock with the Gem levels in your plan</em>}{locked && <em>{upgrade.levelLockReason || `Unlocks at Gem level ${upgrade.requiredLevel}`}</em>}</div>
                    <div className="level level-readonly"><span>{upgrade.isGemLevel ? "GEM LEVEL" : "LEVEL"}</span><strong>{upgrade.current}{selected ? ` → ${upgrade.plannedLevel}` : ""} / {upgrade.max}</strong></div>
                    <div className="cost"><span>{selected ? `PLAN · ${upgrade.plannedQuantity}` : "NEXT COST"}</span><strong>{upgrade.maxed ? "MAX" : upgrade.priceAvailable ? `◈ ${formatNumber(selected ? upgrade.planCost : upgrade.nextCost)}` : "Unavailable"}</strong></div>
                    <div className="bonus" title={upgrade.bonus}><span>BONUS</span><strong>{upgrade.bonus}</strong></div>
                    <div className="efficiency"><span>SCORE</span><strong>{upgrade.score.toFixed(1)}</strong><div><i style={{ width: `${Math.min(100, upgrade.score * 2.2)}%` }} /></div></div>
                    <ResourceIcon resource={upgrade.resource} /><button className="add-button" disabled={locked || !upgrade.priceAvailable || upgrade.current + upgrade.plannedQuantity >= upgrade.max} title={!upgrade.priceAvailable && !upgrade.maxed ? "Price unavailable in source data" : ""} onClick={() => addPlanIncrement(upgrade.id)} aria-label={`Add one level of ${upgrade.name}`}>{selected ? <span>+{upgrade.plannedQuantity}</span> : locked ? "×" : upgrade.priceAvailable ? "+" : "?"}</button>
                  </article>;
                })}</div>
                {!ranked.length && <div className="no-results"><strong>No upgrades match these filters.</strong><button onClick={() => { setFilter("all"); setAvailability("all"); setSelectedGem("all"); }}>Clear filters</button></div>}
              </div>

              <aside className="plan-panel panel"><div className="panel-heading"><div><p className="eyebrow">PURCHASE PLAN</p><h2>Next upgrades</h2></div><span>{plannedCount}</span></div>{plannedCount ? <div className="plan-items">
                {plannedItems.map((upgrade, index) => <article key={upgrade.id}><i>{index + 1}</i><span><strong>{upgrade.name}</strong><small>{upgrade.gem} · {upgrade.current}→{upgrade.plannedLevel}/{upgrade.max} · ◈ {formatNumber(upgrade.planCost)}</small></span><div className="plan-quantity"><button onClick={() => removePlanIncrement(upgrade.id)} aria-label={`Remove one level of ${upgrade.name}`}>−</button><b>{upgrade.plannedQuantity}</b><button disabled={!upgrade.unlockedInPlan || !upgrade.priceAvailable || upgrade.current + upgrade.plannedQuantity >= upgrade.max} title={upgrade.levelLockReason || (!upgrade.priceAvailable ? "Price unavailable in source data" : "")} onClick={() => addPlanIncrement(upgrade.id)} aria-label={`Add one level of ${upgrade.name}`}>+</button></div><button className="remove-plan" onClick={() => removePlanIncrement(upgrade.id, true)} aria-label={`Remove ${upgrade.name} from plan`}>×</button></article>)}
                {plannedNodeItems.map((item, index) => <article className="node-plan-item" key={`node-${item.gem}`} title={item.metrics.map(({ metric }) => metric.bonus).join(" · ")}><i>{plannedItems.length + index + 1}</i><span><strong>{item.gem} Gem Nodes</strong><small>Nodes {item.current}→{item.plannedEnd} · ◈ {formatNumber(item.cost)} · weighted effects included</small></span><div className="plan-quantity"><button onClick={() => removeNodeFromPlan(item.gem)} aria-label={`Remove one ${item.gem} node`}>−</button><b>{item.quantity}</b><button disabled={item.plannedEnd >= availableNodeLimit(item.gem, plannedExodusLevel, plannedGemLevels[item.gem])} onClick={() => addNodeToPlan(item.gem)} aria-label={`Add one ${item.gem} node`}>+</button></div><button className="remove-plan" onClick={() => removeNodeFromPlan(item.gem, true)} aria-label={`Remove ${item.gem} nodes from plan`}>×</button></article>)}
              </div> : <div className="empty-plan"><div>＋</div><strong>Your plan is empty</strong><p>Add Gem levels, upgrades or nodes to build your purchase plan.</p></div>}<div className="plan-total"><span>Total cost · {plannedCount} increments</span><strong>◈ {formatNumber(totalCost)}</strong><small>{availableOrbs >= totalCost ? "Available now" : `${formatNumber(totalCost - availableOrbs)} more orbs needed`}</small></div><div className="plan-actions"><button className="ghost-button" disabled={!plannedCount} onClick={copyPlan}>Copy</button><button className="primary-button" disabled={!plannedCount || totalCost > availableOrbs || !Number.isFinite(totalCost)} onClick={applyPlan}>Apply purchases</button></div></aside>
            </section>

            <section className={`budget-advisor panel ${budgetDifference < 0 ? "is-short" : plannedCount ? "is-ready" : "is-open"}`}>
              <div className="budget-advisor-heading"><div><p className="eyebrow">ORB BUDGET</p><h2>Plan feasibility</h2><p>Costs include every selected Gem level, upgrade and node.</p></div><span className="budget-status">{budgetDifference < 0 ? "More orbs needed" : plannedCount ? "Ready to apply" : "Budget available"}</span></div>
              <div className="budget-overview">
                <article><span>PLAN REQUIRES</span><strong>◈ {formatNumber(totalCost)}</strong><small>{plannedCount ? `${plannedCount} increments selected` : "No purchases selected yet"}</small></article>
                <article><span>YOU HAVE</span><strong>◈ {formatNumber(availableOrbs)}</strong><small>{formatNumber(profile.savedOrbs)} saved + {formatNumber(profile.currentTrOrbs)} this TR</small></article>
                <article className={budgetDifference < 0 ? "negative" : "positive"}><span>{budgetDifference < 0 ? "STILL NEEDED" : plannedCount ? "LEFT AFTER PLAN" : "AVAILABLE TO PLAN"}</span><strong>{budgetDifference < 0 ? "−" : "+"} ◈ {formatNumber(Math.abs(budgetDifference))}</strong><small>{budgetDifference < 0 ? "Keep earning before applying this plan" : plannedCount ? "Your complete plan is affordable" : "Ready for weighted recommendations"}</small></article>
              </div>
              {budgetDifference < 0 ? <div className="budget-message deficit"><span>!</span><div><strong>Your plan is not affordable yet</strong><p>Earn another ◈ {formatNumber(Math.abs(budgetDifference))}, or remove purchases from the plan to apply it now.</p></div></div> : <div className="surplus-recommendations">
                <div className="surplus-heading"><div><span>PRIORITIZED SUGGESTIONS</span><h3>{plannedCount ? `Best use of the remaining ◈ ${formatNumber(budgetDifference)}` : `Best purchases for your ◈ ${formatNumber(availableOrbs)}`}</h3><p>Gem level first, then an available node, followed by upgrades ranked with your resource weights.</p></div><button className="primary-button" disabled={!budgetRecommendations.items.length} onClick={addAllRecommendations}>Add all suggestions</button></div>
                {budgetRecommendations.items.length ? <div className="suggestion-list">{budgetRecommendations.items.map((item, index) => {
                  const prerequisiteReady = item.kind === "node" || (catalog.find((upgrade) => upgrade.id === item.id)?.unlockedInPlan ?? false);
                  return <article key={`${item.id}-${item.fromLevel}-${index}`}><i>{index + 1}</i><GemArtwork gem={item.gem} /><span><strong>{item.name}</strong><small>{item.gem} · {item.kind === "node" ? "Node" : "Level"} {item.fromLevel}→{item.toLevel} · <b>{item.bonus}</b></small></span><div><small>NEXT COST</small><strong>◈ {formatNumber(item.cost)}</strong></div>{item.resource ? <ResourceIcon resource={item.resource} /> : <span className="node-suggestion-badge">N</span>}<button className="add-button" disabled={!prerequisiteReady} title={prerequisiteReady ? "Add this suggestion" : "Add its earlier prerequisite first"} onClick={() => item.kind === "node" ? addNodeToPlan(item.gem) : addPlanIncrement(item.id)}>+</button></article>;
                })}</div> : <div className="budget-message"><span>✓</span><div><strong>No additional upgrade fits this budget</strong><p>Your plan already uses the available orbs efficiently, or the next weighted options cost more than the remaining balance.</p></div></div>}
              </div>}
            </section>
          </>}

          {view === "profile" && <section className="single-view"><div className="section-heading"><div><p className="eyebrow">GEM SETUP</p><h1>Your progression</h1><p>Enter the values you can see in your game. Gem availability and recommendations update immediately.</p></div><button className="primary-button" onClick={() => setView("planner")}>Back to planner</button></div>
            <h2 className="subsection-title">Gem levels & nodes</h2><div className="gem-setup-grid">{GEM_NAMES.map((gem) => {
              const maxLevel = UPGRADES.find((upgrade) => upgrade.gem === gem && upgrade.isGemLevel)?.max ?? 5;
              const allowedMaxLevel = availableGemLevelMax(gem, maxLevel, currentGemLevels);
              const levelLockReason = allowedMaxLevel < maxLevel ? gemLevelLockReason(gem, allowedMaxLevel + 1, currentGemLevels) : "";
              return <GemSetupCard key={gem} gem={gem} progress={gemProgress[gem]} maxLevel={maxLevel} allowedMaxLevel={allowedMaxLevel} levelLockReason={levelLockReason} plannedNodes={nodePlan[gem] ?? 0} nodes={GEM_NODES.filter((node) => node.gem === gem && node.index <= gemProgress[gem].maxNodes)} currentExodusLevel={gemProgress.Exodus.level} plannedExodusLevel={plannedExodusLevel} plannedGemLevel={plannedGemLevels[gem]} ownedNodeLimit={availableNodeLimit(gem, gemProgress.Exodus.level, gemProgress[gem].level)} plannedNodeLimit={availableNodeLimit(gem, plannedExodusLevel, plannedGemLevels[gem])} onLevel={(level) => changeGemSetupLevel(gem, level)} onNodes={(nodes) => setOwnedNodes(gem, nodes)} onAddNode={() => addNodeToPlan(gem)} onRemoveNode={() => removeNodeFromPlan(gem)} />;
            })}</div>
            <h2 className="subsection-title progression-title">Current upgrade levels</h2><p className="setup-hint">This is the only place where current levels are edited. Planned levels remain separate in the Planner.</p>
            <div className="setup-upgrade-groups">
              {[GEM_NAMES.filter((_, index) => index % 2 === 0), GEM_NAMES.filter((_, index) => index % 2 === 1)].map((column, columnIndex) => <div className="setup-upgrade-column" key={columnIndex}>
                {column.map((gem) => {
                  const upgrades = catalog.filter((upgrade) => upgrade.gem === gem && !upgrade.isGemLevel);
                  const isOpen = openUpgradeGroup === gem;
                  return <details className="setup-upgrade-group panel" key={gem} open={isOpen} style={{ "--gem-order": GEM_NAMES.indexOf(gem) } as React.CSSProperties}>
                    <summary aria-expanded={isOpen} onClick={(event) => { event.preventDefault(); setOpenUpgradeGroup((current) => current === gem ? null : gem); }}><GemArtwork gem={gem} /><span><strong>{gem} upgrades</strong><small>{upgrades.length} Gem upgrades available</small></span><b>⌄</b></summary>
                    <div>{upgrades.map((upgrade) => {
                      const locked = currentGemLevels[gem] < upgrade.requiredLevel;
                      return <article className={locked ? "locked" : ""} key={upgrade.id}><span><strong>{upgrade.name}</strong><small className={locked ? "current-upgrade-lock" : ""}>{locked ? `Requires ${gem} Gem level ${upgrade.requiredLevel}` : `Maximum level ${upgrade.max}`}</small></span><div className="current-level-control"><button disabled={upgrade.current === 0} onClick={() => changeUpgradeLevel(upgrade, -1)} aria-label={`Decrease ${upgrade.name}`}>−</button><input type="number" min={0} max={upgrade.max} inputMode="numeric" disabled={locked} value={upgrade.current} onFocus={(event) => event.currentTarget.select()} onChange={(event) => { const normalized = Math.min(upgrade.max, Math.max(0, Math.trunc(Number(event.currentTarget.value) || 0))); event.currentTarget.value = String(normalized); setCurrentUpgradeLevel(upgrade, normalized); }} aria-label={`Current level of ${upgrade.name}`} /><button disabled={locked || upgrade.maxed} title={locked ? `Requires ${gem} Gem level ${upgrade.requiredLevel}` : ""} onClick={() => changeUpgradeLevel(upgrade, 1)} aria-label={`Increase ${upgrade.name}`}>+</button></div></article>;
                    })}</div>
                  </details>;
                })}
              </div>)}
            </div>
            <h2 className="subsection-title progression-title">Global progression</h2><div className="setup-grid panel"><Stepper label="Loop resets" value={profile.lrs} step={100} onChange={(value) => updateProfile("lrs", value)} /><Stepper label="Tech upgrades" value={profile.tech} step={100} onChange={(value) => updateProfile("tech", value)} /><Stepper label="Research levels" value={profile.research} onChange={(value) => updateProfile("research", value)} /><Stepper label="Meltdown" value={profile.meltdown} step={0.01} onChange={(value) => updateProfile("meltdown", value)} /><Stepper label="Quantum tech" value={profile.quantum} onChange={(value) => updateProfile("quantum", value)} /><Stepper label="Manual MK9 purchases" value={profile.manualMk9} onChange={(value) => updateProfile("manualMk9", value)} /><Stepper label="MK9 output exponent (e###)" value={profile.mk9Output} step={100} onChange={(value) => updateProfile("mk9Output", value)} /><Stepper label="Orbs saved from previous TR" value={profile.savedOrbs} step={1e9} onChange={(value) => updateProfile("savedOrbs", value)} /><Stepper label="Orbs earned this TR" value={profile.currentTrOrbs} step={1e9} onChange={(value) => updateProfile("currentTrOrbs", value)} /><div className="orb-total-card"><span>Total available</span><strong>◈ {formatNumber(availableOrbs)}</strong><small>Saved + current TR</small></div></div>
            <h2 className="subsection-title progression-title">Ship stats</h2><p className="setup-hint">Used by Power upgrades and Zagreus Temporal upgrades. For purchase planning, estimate Rank and Crew at the end of your next long TR.</p>
            <div className="ship-stats-tables">{[SHIP_IDS.slice(0, 4), SHIP_IDS.slice(4)].map((ships, tableIndex) => <div className="ship-stats-panel panel" key={tableIndex}><div className="ship-stats-heading"><strong>Ship</strong><span>Rank</span><span>Crew</span></div><div className="ship-stats-grid">{ships.map((ship) => <label className="ship-stat-row" key={ship}><strong>{SHIP_META[ship].label}</strong><input type="number" min={0} inputMode="numeric" value={profile.ships[ship].rank} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateShip(ship, "rank", Number(event.currentTarget.value) || 0)} aria-label={`${SHIP_META[ship].label} Rank`} /><input type="number" min={0} inputMode="numeric" value={profile.ships[ship].crew} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateShip(ship, "crew", Number(event.currentTarget.value) || 0)} aria-label={`${SHIP_META[ship].label} Crew`} /></label>)}</div></div>)}</div>
            <details className="advanced-parameters panel"><summary><span><strong>Advanced calculation parameters</strong><small>Relic and Innovation Core valuation assumptions</small></span><b>⌄</b></summary><div className="advanced-parameters-body"><p>Only parameters that affect Gem upgrade calculations are included.</p><div className="advanced-parameters-grid"><div className="advanced-parameter-field"><Stepper label="Relic 26 level" value={profile.relic26Level} max={40} onChange={(value) => updateProfile("relic26Level", Math.trunc(value))} /><small>Adds 2% per level to Max LM Levels and LP Bonus valuation when Exodus Node 3 is active. Requires Power Gem level 3.</small></div><div className="advanced-parameter-field"><Stepper label="Ultima Badge cost" value={profile.ultimaBadgeCost} onChange={(value) => updateProfile("ultimaBadgeCost", Math.max(0, value))} /><small>Innovation Cores are divided by this value to rank Bonus Inno Cores upgrades. A value of 0 leaves those cores unvalued.</small></div></div></div></details>
            <h2 className="subsection-title progression-title">Optional starting points</h2><p className="setup-hint">Community examples only — these milestone names do not exist in the game. Applying one keeps your orb balance and you can adjust every value afterwards.</p><div className="milestone-grid">{PROGRESSION_EXAMPLES.map((example) => <button key={example.name} onClick={() => applyProgressionExample(example)}><span>{example.name}</span><strong>{example.description}</strong><small>{example.values.research} research · {formatNumber(example.values.tech)} tech · {example.values.meltdown} meltdown</small></button>)}</div>
          </section>}

          {view === "weights" && <section className="single-view"><div className="section-heading"><div><p className="eyebrow">PERSONAL PRIORITIES</p><h1>Resource weights</h1><p>Tell the planner what matters most to your build.</p></div><button className="ghost-button" onClick={() => setWeights(DEFAULT_WEIGHTS)}>Restore defaults</button></div><div className="weights-grid">{PLANNER_RESOURCES.map((resource) => { const sliderMax = resource === "borge" || resource === "ozzy" || resource === "knox" ? 20000 : 120; return <article className="weight-card panel" key={resource}><ResourceIcon resource={resource} /><div><strong>{RESOURCE_META[resource].label}</strong><small>Relative value</small></div><input type="range" min="0" max={sliderMax} value={Math.min(sliderMax, weights[resource])} onChange={(event) => setWeights((current) => ({ ...current, [resource]: Number(event.target.value) }))} style={{ "--range": RESOURCE_META[resource].color } as React.CSSProperties} /><input className="weight-number" type="number" min={0} value={weights[resource]} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setWeights((current) => ({ ...current, [resource]: Math.max(0, Number(event.currentTarget.value) || 0) }))} aria-label={`${RESOURCE_META[resource].label} weight`} /></article>; })}</div><div className="info-panel panel"><span>i</span><div><strong>How weights work</strong><p>Each upgrade can now contribute to several resources at once. Borge, Ozzy and Knox loot use the larger defaults from the original planner, so compare the balance between weights rather than their absolute values.</p></div></div></section>}

          <footer className="site-footer">
            <div><strong>Unofficial, non-commercial community tool</strong><p>Not affiliated with or endorsed by Octocube Games. CIFI and its game assets belong to their respective rights holders.</p><p className="creator-credit">Community adaptation and web development by <a href="https://github.com/Deathsunset" target="_blank" rel="noreferrer">Deathsunset</a>.</p></div>
            <div className="footer-links"><a href="https://octocubegames.com/" target="_blank" rel="noreferrer">CIFI by Octocube Games</a><a href="https://docs.google.com/spreadsheets/d/1tpf9QzHdih9E8R0_IA96FY4cMOHRM0cO0a5rd9TtD-I/edit?gid=0#gid=0" target="_blank" rel="noreferrer">Original community Gem Planner spreadsheet</a><span>Your progression stays in this browser.</span></div>
          </footer>
        </div>
      </section>
    </main>
  );
}
