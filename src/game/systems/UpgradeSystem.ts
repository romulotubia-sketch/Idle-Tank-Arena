import {
  ARMOR_MITIGATION_CONFIG,
  INITIAL_TANK_STATS,
  TANK_UPGRADE_CONFIG,
} from '../constants';
import {
  SavedUpgradeState,
  TankStats,
  UpgradeEntry,
  UpgradeId,
} from '../types';
import { CurrencySystem } from './CurrencySystem';

export interface UpgradePurchaseResult {
  success: boolean;
  reason?:
    | 'not_found'
    | 'max_level'
    | 'insufficient_currency'
    | 'cooldown_locked';
  entry?: UpgradeEntry;
  previousLevel?: number;
  newLevel?: number;
  costPaid?: number;
}

export class UpgradeSystem {
  private levels = new Map<UpgradeId, number>();
  private lastPurchaseTimestampMs = 0;
  private readonly minPurchaseIntervalMs = 180;

  constructor() {
    for (let i = 0; i < TANK_UPGRADE_CONFIG.length; i++) {
      this.levels.set(TANK_UPGRADE_CONFIG[i].id, 1);
    }
  }

  static computeArmorReductionRatio(armor: number): number {
    const cleanArmor = Math.max(0, armor);
    const rawRatio =
      cleanArmor / (cleanArmor + ARMOR_MITIGATION_CONFIG.halfPointArmor);
    return Math.min(ARMOR_MITIGATION_CONFIG.maxReductionRatio, rawRatio);
  }

  static computeStatValue(
    baseValue: number,
    perLevelBonus: number,
    level: number,
    maxValue: number | null
  ): number {
    const raw = baseValue + Math.max(0, level - 1) * perLevelBonus;
    const rounded = Math.round(raw * 1000) / 1000;
    return maxValue !== null ? Math.min(maxValue, rounded) : rounded;
  }

  static computeCost(
    baseCost: number,
    costGrowth: number,
    level: number
  ): number {
    return Math.max(
      1,
      Math.round(baseCost * Math.pow(costGrowth, Math.max(0, level - 1)))
    );
  }

  getLevel(id: UpgradeId): number {
    return this.levels.get(id) ?? 1;
  }

  getEntry(id: UpgradeId): UpgradeEntry | undefined {
    const cfg = TANK_UPGRADE_CONFIG.find((c) => c.id === id);
    if (!cfg) return undefined;

    const level = this.getLevel(cfg.id);
    const currentValue = UpgradeSystem.computeStatValue(
      cfg.baseValue,
      cfg.perLevelBonus,
      level,
      cfg.maxValue
    );
    const isMaxed =
      level >= cfg.maxLevel ||
      (cfg.maxValue !== null && currentValue >= cfg.maxValue);
    const nextValue = isMaxed
      ? currentValue
      : UpgradeSystem.computeStatValue(
          cfg.baseValue,
          cfg.perLevelBonus,
          level + 1,
          cfg.maxValue
        );
    const nextBonus = Math.max(
      0,
      Math.round((nextValue - currentValue) * 1000) / 1000
    );

    return {
      id: cfg.id,
      label: cfg.label,
      statKey: cfg.statKey,
      level,
      maxLevel: cfg.maxLevel,
      baseValue: cfg.baseValue,
      perLevelBonus: cfg.perLevelBonus,
      maxValue: cfg.maxValue,
      baseCost: cfg.baseCost,
      costGrowth: cfg.costGrowth,
      unit: cfg.unit,
      currentValue,
      nextBonus,
      nextCost: UpgradeSystem.computeCost(cfg.baseCost, cfg.costGrowth, level),
      isMaxed,
    };
  }

  getEntries(): UpgradeEntry[] {
    const list: UpgradeEntry[] = [];
    for (let i = 0; i < TANK_UPGRADE_CONFIG.length; i++) {
      const entry = this.getEntry(TANK_UPGRADE_CONFIG[i].id);
      if (entry) list.push(entry);
    }
    return list;
  }

  getUpgradeCost(entry: UpgradeEntry): number {
    return UpgradeSystem.computeCost(
      entry.baseCost,
      entry.costGrowth,
      entry.level
    );
  }

  computeTankStats(base: TankStats = INITIAL_TANK_STATS): TankStats {
    const stats: TankStats = { ...base };
    for (let i = 0; i < TANK_UPGRADE_CONFIG.length; i++) {
      const cfg = TANK_UPGRADE_CONFIG[i];
      const level = this.getLevel(cfg.id);
      stats[cfg.statKey] = UpgradeSystem.computeStatValue(
        cfg.baseValue,
        cfg.perLevelBonus,
        level,
        cfg.maxValue
      );
    }
    return stats;
  }

  purchaseUpgrade(
    id: UpgradeId,
    currencies: CurrencySystem,
    nowMs: number = performance.now()
  ): UpgradePurchaseResult {
    // Prevent duplicate purchases from rapid tapping
    if (nowMs - this.lastPurchaseTimestampMs < this.minPurchaseIntervalMs) {
      return { success: false, reason: 'cooldown_locked' };
    }

    const currentEntry = this.getEntry(id);
    if (!currentEntry) {
      return { success: false, reason: 'not_found' };
    }

    if (currentEntry.isMaxed) {
      return { success: false, reason: 'max_level', entry: currentEntry };
    }

    const cost = currentEntry.nextCost;
    if (!currencies.canAfford('gold', cost)) {
      return {
        success: false,
        reason: 'insufficient_currency',
        entry: currentEntry,
      };
    }

    const spent = currencies.spend('gold', cost);
    if (!spent) {
      return {
        success: false,
        reason: 'insufficient_currency',
        entry: currentEntry,
      };
    }

    const previousLevel = currentEntry.level;
    const newLevel = previousLevel + 1;
    this.levels.set(id, newLevel);
    this.lastPurchaseTimestampMs = nowMs;

    const updatedEntry = this.getEntry(id)!;
    return {
      success: true,
      entry: updatedEntry,
      previousLevel,
      newLevel,
      costPaid: cost,
    };
  }

  hasAffordableUpgrade(goldBalance: number): boolean {
    for (let i = 0; i < TANK_UPGRADE_CONFIG.length; i++) {
      const entry = this.getEntry(TANK_UPGRADE_CONFIG[i].id);
      if (entry && !entry.isMaxed && goldBalance >= entry.nextCost) {
        return true;
      }
    }
    return false;
  }

  exportState(): SavedUpgradeState[] {
    return TANK_UPGRADE_CONFIG.map((cfg) => ({
      id: cfg.id,
      level: this.getLevel(cfg.id),
    }));
  }

  loadState(saved?: SavedUpgradeState[]): void {
    if (!Array.isArray(saved)) return;
    for (let i = 0; i < saved.length; i++) {
      const item = saved[i];
      if (!item) continue;
      const cfg = TANK_UPGRADE_CONFIG.find((c) => c.id === item.id);
      if (!cfg) continue;
      const cleanLevel =
        typeof item.level === 'number' && Number.isFinite(item.level)
          ? Math.max(1, Math.min(cfg.maxLevel, Math.floor(item.level)))
          : 1;
      this.levels.set(cfg.id, cleanLevel);
    }
  }
}
