import { GAME_BALANCE } from '../balanceConfig';
import {
  EQUIPMENT_RARITY_CONFIG,
  EQUIPMENT_RARITY_ORDER,
  EQUIPMENT_SLOT_META,
  EQUIPMENT_STAT_ORDER,
} from '../data/equipmentCatalog';
import {
  AutoForgeEvent,
  AutoForgeLifetimeStats,
  AutoForgeSessionStats,
  AutoForgeSettings,
  AutoForgeState,
  AutoForgeStatRequirementsMap,
  AutoForgeStopReason,
  EquipmentItem,
  EquipmentRarity,
  EquipmentSlotType,
  EquipmentStatKey,
  SavedAutoForgeState,
} from '../types';

const VALID_RARITY_SET = new Set<EquipmentRarity>(EQUIPMENT_RARITY_ORDER);

const STOP_REASON_MESSAGES: Record<Exclude<AutoForgeStopReason, null>, string> = {
  manual: 'Auto Forge turned off',
  insufficient_coins: 'Auto Forge stopped: Not enough Coins',
  spending_limit_reached: 'Auto Forge stopped: Coin spending limit reached',
  coin_reserve_reached: 'Auto Forge stopped: Minimum Coin reserve reached',
  inventory_full:
    'Inventory full: Forged item waiting in Forge — free 1 slot to resume',
};

export function createDefaultStatFilters(): AutoForgeStatRequirementsMap {
  return {
    attackDamage: { enabled: false, minValue: 5 },
    attackSpeed: { enabled: false, minValue: 0.05 },
    critChance: { enabled: false, minValue: 2 },
    critDamage: { enabled: false, minValue: 0.1 },
    maxHp: { enabled: false, minValue: 20 },
    armor: { enabled: false, minValue: 4 },
    moveSpeed: { enabled: false, minValue: 10 },
    skillDamage: { enabled: false, minValue: 5 },
  };
}

export function createDefaultEnabledSlots(): Record<EquipmentSlotType, boolean> {
  return {
    cannon: true,
    armor: true,
    engine: true,
    tracks: true,
    targeting_system: true,
    auxiliary_system: true,
  };
}

export function createDefaultAutoForgeSettings(): AutoForgeSettings {
  return {
    minRarity: 'scrap',
    enabledSlots: createDefaultEnabledSlots(),
    statFilters: createDefaultStatFilters(),
    requireSpecialEffect: false,
    spendingLimitEnabled: false,
    maxCoinSpend: GAME_BALANCE.equipment.autoForgeDefaults.defaultMaxCoinSpend,
    minCoinReserve: GAME_BALANCE.equipment.autoForgeDefaults.defaultMinCoinReserve,
    autoResumeOnLoad: false,
  };
}

export function cloneAutoForgeSettings(
  settings: AutoForgeSettings
): AutoForgeSettings {
  const statFilters = createDefaultStatFilters();
  for (const key of EQUIPMENT_STAT_ORDER) {
    const src = settings.statFilters[key];
    statFilters[key] = {
      enabled: Boolean(src?.enabled),
      minValue:
        typeof src?.minValue === 'number' && Number.isFinite(src.minValue)
          ? Math.max(0, src.minValue)
          : statFilters[key].minValue,
    };
  }

  const enabledSlots = createDefaultEnabledSlots();
  for (const meta of EQUIPMENT_SLOT_META) {
    enabledSlots[meta.slot] = Boolean(settings.enabledSlots[meta.slot]);
  }

  return {
    minRarity: settings.minRarity,
    enabledSlots,
    statFilters,
    requireSpecialEffect: Boolean(settings.requireSpecialEffect),
    spendingLimitEnabled: Boolean(settings.spendingLimitEnabled),
    maxCoinSpend: Math.max(0, Math.floor(settings.maxCoinSpend)),
    minCoinReserve: Math.max(0, Math.floor(settings.minCoinReserve)),
    autoResumeOnLoad: Boolean(settings.autoResumeOnLoad),
  };
}

function roundFilterValue(key: EquipmentStatKey, raw: number): number {
  const clamped = Math.max(0, raw);
  if (key === 'attackSpeed' || key === 'critDamage') {
    return Math.round(clamped * 100) / 100;
  }
  if (key === 'critChance') {
    return Math.round(clamped * 10) / 10;
  }
  return Math.round(clamped);
}

export interface AutoForgeEvaluationResult {
  keep: boolean;
  failReason?: string;
}

export class AutoForgeSystem {
  private enabled = false;
  private savedEnabledPreference = false;
  private pendingAutoResume = false;
  private settings: AutoForgeSettings = createDefaultAutoForgeSettings();
  private session: AutoForgeSessionStats = {
    coinsSpent: 0,
    itemsForged: 0,
    itemsKept: 0,
    itemsDismantled: 0,
    dismantleCoinsEarned: 0,
  };
  private lifetime: AutoForgeLifetimeStats = {
    coinsSpent: 0,
    itemsForged: 0,
    itemsKept: 0,
    itemsDismantled: 0,
  };
  private stopReason: AutoForgeStopReason = null;
  private lastEvent: AutoForgeEvent | null = null;
  private eventCounter = 0;
  private countedItemUids = new Set<string>();

  static sanitizeSettings(raw: unknown): AutoForgeSettings {
    const defaults = createDefaultAutoForgeSettings();
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }
    const input = raw as Partial<AutoForgeSettings>;

    const minRarity =
      typeof input.minRarity === 'string' &&
      VALID_RARITY_SET.has(input.minRarity as EquipmentRarity)
        ? (input.minRarity as EquipmentRarity)
        : defaults.minRarity;

    const enabledSlots = createDefaultEnabledSlots();
    if (input.enabledSlots && typeof input.enabledSlots === 'object') {
      for (const meta of EQUIPMENT_SLOT_META) {
        const val = (input.enabledSlots as Record<string, unknown>)[meta.slot];
        if (typeof val === 'boolean') {
          enabledSlots[meta.slot] = val;
        }
      }
    }

    const statFilters = createDefaultStatFilters();
    if (input.statFilters && typeof input.statFilters === 'object') {
      for (const key of EQUIPMENT_STAT_ORDER) {
        const rawEntry = (input.statFilters as Record<string, unknown>)[key];
        if (rawEntry && typeof rawEntry === 'object') {
          const entryObj = rawEntry as { enabled?: unknown; minValue?: unknown };
          const enabled =
            typeof entryObj.enabled === 'boolean' ? entryObj.enabled : false;
          const minValue =
            typeof entryObj.minValue === 'number' &&
            Number.isFinite(entryObj.minValue) &&
            entryObj.minValue >= 0
              ? roundFilterValue(key, entryObj.minValue)
              : statFilters[key].minValue;
          statFilters[key] = { enabled, minValue };
        }
      }
    }

    const maxCoinSpend =
      typeof input.maxCoinSpend === 'number' &&
      Number.isFinite(input.maxCoinSpend) &&
      input.maxCoinSpend >= 0
        ? Math.floor(input.maxCoinSpend)
        : defaults.maxCoinSpend;

    const minCoinReserve =
      typeof input.minCoinReserve === 'number' &&
      Number.isFinite(input.minCoinReserve) &&
      input.minCoinReserve >= 0
        ? Math.floor(input.minCoinReserve)
        : defaults.minCoinReserve;

    return {
      minRarity,
      enabledSlots,
      statFilters,
      requireSpecialEffect:
        typeof input.requireSpecialEffect === 'boolean'
          ? input.requireSpecialEffect
          : defaults.requireSpecialEffect,
      spendingLimitEnabled:
        typeof input.spendingLimitEnabled === 'boolean'
          ? input.spendingLimitEnabled
          : defaults.spendingLimitEnabled,
      maxCoinSpend,
      minCoinReserve,
      autoResumeOnLoad:
        typeof input.autoResumeOnLoad === 'boolean'
          ? input.autoResumeOnLoad
          : defaults.autoResumeOnLoad,
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getSettings(): AutoForgeSettings {
    return cloneAutoForgeSettings(this.settings);
  }

  getState(): AutoForgeState {
    return {
      enabled: this.enabled,
      settings: this.getSettings(),
      session: { ...this.session },
      lifetime: { ...this.lifetime },
      stopReason: this.stopReason,
      lastEvent: this.lastEvent ? { ...this.lastEvent } : null,
    };
  }

  setSettings(next: Partial<AutoForgeSettings>): AutoForgeSettings {
    const merged: AutoForgeSettings = {
      ...this.settings,
      ...next,
      enabledSlots: next.enabledSlots
        ? { ...this.settings.enabledSlots, ...next.enabledSlots }
        : this.settings.enabledSlots,
      statFilters: next.statFilters
        ? { ...this.settings.statFilters, ...next.statFilters }
        : this.settings.statFilters,
    };
    this.settings = AutoForgeSystem.sanitizeSettings(merged);
    return this.getSettings();
  }

  resetSettings(): AutoForgeSettings {
    this.settings = createDefaultAutoForgeSettings();
    return this.getSettings();
  }

  startSession(): void {
    this.enabled = true;
    this.savedEnabledPreference = true;
    this.pendingAutoResume = false;
    this.stopReason = null;
    this.countedItemUids.clear();
    this.session = {
      coinsSpent: 0,
      itemsForged: 0,
      itemsKept: 0,
      itemsDismantled: 0,
      dismantleCoinsEarned: 0,
    };
  }

  stop(
    reason: Exclude<AutoForgeStopReason, null>,
    customMessage?: string
  ): void {
    const wasEnabled = this.enabled;
    this.enabled = false;
    this.savedEnabledPreference = false;
    this.pendingAutoResume = false;
    this.stopReason = reason;

    if (reason !== 'manual' || wasEnabled) {
      const message = customMessage ?? STOP_REASON_MESSAGES[reason];
      this.lastEvent = {
        id: ++this.eventCounter,
        kind: 'stopped',
        stopReason: reason,
        message,
      };
    }
  }

  consumePendingAutoResume(): boolean {
    const shouldResume =
      this.pendingAutoResume &&
      this.settings.autoResumeOnLoad &&
      this.savedEnabledPreference;
    this.pendingAutoResume = false;
    return shouldResume;
  }

  canSpendForForge(
    forgeCost: number,
    currentCoins: number
  ): { allowed: boolean; stopReason?: Exclude<AutoForgeStopReason, null> } {
    if (
      this.settings.spendingLimitEnabled &&
      this.session.coinsSpent + forgeCost > this.settings.maxCoinSpend
    ) {
      return { allowed: false, stopReason: 'spending_limit_reached' };
    }

    if (currentCoins < forgeCost) {
      return { allowed: false, stopReason: 'insufficient_coins' };
    }

    if (currentCoins - forgeCost < this.settings.minCoinReserve) {
      return { allowed: false, stopReason: 'coin_reserve_reached' };
    }

    return { allowed: true };
  }

  recordCoinSpent(amount: number): void {
    const safeAmount = Math.max(0, Math.floor(amount));
    this.session.coinsSpent += safeAmount;
    this.lifetime.coinsSpent += safeAmount;
  }

  recordItemForgedIfNeeded(itemUid: string): void {
    if (this.countedItemUids.has(itemUid)) return;
    this.countedItemUids.add(itemUid);
    if (this.countedItemUids.size > 40) {
      const oldest = this.countedItemUids.values().next().value;
      if (oldest) this.countedItemUids.delete(oldest);
    }
    this.session.itemsForged += 1;
    this.lifetime.itemsForged += 1;
  }

  evaluateItem(item: EquipmentItem): AutoForgeEvaluationResult {
    const itemTier = EQUIPMENT_RARITY_CONFIG[item.rarity].tier;
    const minTier = EQUIPMENT_RARITY_CONFIG[this.settings.minRarity].tier;
    if (itemTier < minTier) {
      return { keep: false, failReason: 'rarity' };
    }

    if (!this.settings.enabledSlots[item.slot]) {
      return { keep: false, failReason: 'slot' };
    }

    if (this.settings.requireSpecialEffect && !item.specialEffect) {
      return { keep: false, failReason: 'special_effect' };
    }

    for (const key of EQUIPMENT_STAT_ORDER) {
      const rule = this.settings.statFilters[key];
      if (!rule || !rule.enabled) continue;
      const itemVal = item.stats[key] ?? 0;
      if (itemVal + 1e-6 < rule.minValue) {
        return { keep: false, failReason: `stat_${key}` };
      }
    }

    return { keep: true };
  }

  recordKept(item: EquipmentItem): void {
    this.session.itemsKept += 1;
    this.lifetime.itemsKept += 1;
    const rarityLabel = EQUIPMENT_RARITY_CONFIG[item.rarity].label;
    this.lastEvent = {
      id: ++this.eventCounter,
      kind: 'kept',
      itemName: item.name,
      itemRarity: item.rarity,
      itemSlot: item.slot,
      message: `Auto Forge Kept: ${item.name} (${rarityLabel})`,
    };
  }

  recordDismantled(item: EquipmentItem, coinsAwarded: number): void {
    this.session.itemsDismantled += 1;
    this.session.dismantleCoinsEarned += Math.max(0, Math.floor(coinsAwarded));
    this.lifetime.itemsDismantled += 1;
    this.lastEvent = {
      id: ++this.eventCounter,
      kind: 'dismantled',
      itemName: item.name,
      itemRarity: item.rarity,
      itemSlot: item.slot,
      dismantleCoins: coinsAwarded,
      message: `Auto Dismantled: ${item.name} (+${coinsAwarded} Coins)`,
    };
  }

  exportState(): SavedAutoForgeState {
    return {
      enabled: this.enabled || this.savedEnabledPreference,
      settings: this.getSettings(),
      lifetime: { ...this.lifetime },
    };
  }

  loadState(saved?: SavedAutoForgeState): void {
    this.enabled = false;
    this.savedEnabledPreference = false;
    this.pendingAutoResume = false;
    this.stopReason = null;
    this.lastEvent = null;
    this.countedItemUids.clear();
    this.session = {
      coinsSpent: 0,
      itemsForged: 0,
      itemsKept: 0,
      itemsDismantled: 0,
      dismantleCoinsEarned: 0,
    };

    if (!saved || typeof saved !== 'object') {
      this.settings = createDefaultAutoForgeSettings();
      this.lifetime = {
        coinsSpent: 0,
        itemsForged: 0,
        itemsKept: 0,
        itemsDismantled: 0,
      };
      return;
    }

    this.settings = AutoForgeSystem.sanitizeSettings(saved.settings);

    const rawLife = saved.lifetime;
    this.lifetime = {
      coinsSpent:
        rawLife &&
        typeof rawLife.coinsSpent === 'number' &&
        Number.isFinite(rawLife.coinsSpent)
          ? Math.max(0, Math.floor(rawLife.coinsSpent))
          : 0,
      itemsForged:
        rawLife &&
        typeof rawLife.itemsForged === 'number' &&
        Number.isFinite(rawLife.itemsForged)
          ? Math.max(0, Math.floor(rawLife.itemsForged))
          : 0,
      itemsKept:
        rawLife &&
        typeof rawLife.itemsKept === 'number' &&
        Number.isFinite(rawLife.itemsKept)
          ? Math.max(0, Math.floor(rawLife.itemsKept))
          : 0,
      itemsDismantled:
        rawLife &&
        typeof rawLife.itemsDismantled === 'number' &&
        Number.isFinite(rawLife.itemsDismantled)
          ? Math.max(0, Math.floor(rawLife.itemsDismantled))
          : 0,
    };

    const wantsResume = Boolean(saved.enabled) && this.settings.autoResumeOnLoad;
    this.savedEnabledPreference = wantsResume;
    this.pendingAutoResume = wantsResume;
  }
}
