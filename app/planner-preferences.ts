export const MIN_WEIGHT_PRIORITY = 0;
export const MAX_WEIGHT_PRIORITY = 200;
export const DEFAULT_WEIGHT_PRIORITY = 100;
export const TEMPORAL_LEVEL_4_COST = 5e20;

export function clampWeightPriority(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_WEIGHT_PRIORITY;
  return Math.min(MAX_WEIGHT_PRIORITY, Math.max(MIN_WEIGHT_PRIORITY, value));
}

export function priorityFromWeight(effectiveWeight: number, defaultWeight: number) {
  if (!Number.isFinite(defaultWeight) || defaultWeight <= 0) return DEFAULT_WEIGHT_PRIORITY;
  return clampWeightPriority((effectiveWeight / defaultWeight) * DEFAULT_WEIGHT_PRIORITY);
}

export function weightFromPriority(priority: number, defaultWeight: number) {
  if (!Number.isFinite(defaultWeight) || defaultWeight < 0) return 0;
  return defaultWeight * clampWeightPriority(priority) / DEFAULT_WEIGHT_PRIORITY;
}

export function canRecommendUpgrade(level: number, maxLevel: number, unlocked: boolean, priceAvailable: boolean) {
  return level < maxLevel && unlocked && priceAvailable;
}

export function isMandatoryTemporalLevel4(upgradeId: string, level: number, exodusLevel: number, availableOrbs: number) {
  return upgradeId === "temporal-quality"
    && level === 3
    && exodusLevel >= 5
    && availableOrbs >= TEMPORAL_LEVEL_4_COST;
}
