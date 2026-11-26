import { FORGE_CONFIG } from '../constants';
import { generateForgedEquipmentItem } from '../data/equipmentCatalog';
import {
  AutoForgeEvent,
  AutoForgeSettings,
  AutoForgeStopReason,
  EquipmentItem,
  ForgeRecipeSlot,
  ForgeState,
  ForgeStatus,
  SavedForgeState,
} from '../types';
import { AutoForgeSystem } from './AutoForgeSystem';
import { CurrencySystem } from './CurrencySystem';
import { EquipActionResult, EquipmentSystem } from './EquipmentSystem';

export interface StartForgeResult {
  success: boolean;
  reason?:
    | 'already_forging'
    | 'result_pending'
    | 'insufficient_currency'
    | 'inventory_full'
    | 'auto_forge_active';
  costCoins?: number;
}

export interface ForgeDismantleResult {
  success: boolean;
  reason?:
    | 'no_pending_item'
    | 'cannot_dismantle_equipped'
    | 'cannot_dismantle_locked';
  coinsAwarded?: number;
  dismantledItem?: EquipmentItem;
}

export interface ForgeEquipResult {
  success: boolean;
  reason?: 'no_pending_item' | 'inventory_full';
  equipResult?: EquipActionResult;
}

export interface ForgeKeepResult {
  success: boolean;
  reason?: 'no_pending_item' | 'inventory_full';
  item?: EquipmentItem;
}

export interface AutoForgeStepOutcome {
  processedItem: boolean;
  kept?: boolean;
  dismantled?: boolean;
  coinsAwarded?: number;
  item?: EquipmentItem;
  stoppedReason?: AutoForgeStopReason;
  startedNextForge?: boolean;
}

export class ForgeSystem {
  readonly autoForge = new AutoForgeSystem();

  private readonly forgeConfig: ForgeRecipeSlot = {
    level: 1,
    scrapCost: FORGE_CONFIG.costCoins,
    unlocked: true,
  };

  private status: ForgeStatus = 'idle';
  private elapsedSec = 0;
  private pendingItem: EquipmentItem | null = null;
  private totalForged = 0;

  getConfig(): ForgeRecipeSlot {
    return { ...this.forgeConfig };
  }

  getState(): ForgeState {
    const durationSec = FORGE_CONFIG.durationSec;
    const progress =
      this.status === 'result_ready'
        ? 1
        : this.status === 'forging'
          ? Math.max(0, Math.min(1, this.elapsedSec / durationSec))
          : 0;

    return {
      status: this.status,
      costCoins: FORGE_CONFIG.costCoins,
      durationSec,
      elapsedSec: this.elapsedSec,
      progress,
      pendingItem: this.pendingItem
        ? {
            ...this.pendingItem,
            stats: { ...this.pendingItem.stats },
            specialEffect: this.pendingItem.specialEffect
              ? { ...this.pendingItem.specialEffect }
              : undefined,
          }
        : null,
      totalForged: this.totalForged,
      autoForge: this.autoForge.getState(),
    };
  }

  getDismantleValue(item: EquipmentItem): number {
    return FORGE_CONFIG.dismantleCoinsByRarity[item.rarity] ?? 20;
  }

  startForge(
    currencies: CurrencySystem,
    equipment?: EquipmentSystem
  ): StartForgeResult {
    if (this.autoForge.isEnabled()) {
      return { success: false, reason: 'auto_forge_active' };
    }
    if (this.status === 'forging') {
      return { success: false, reason: 'already_forging' };
    }
    if (this.status === 'result_ready' && this.pendingItem) {
      return { success: false, reason: 'result_pending' };
    }
    if (equipment && equipment.isInventoryFull()) {
      return { success: false, reason: 'inventory_full' };
    }

    const cost = FORGE_CONFIG.costCoins;
    if (!currencies.canAfford('gold', cost)) {
      return {
        success: false,
        reason: 'insufficient_currency',
        costCoins: cost,
      };
    }

    const spent = currencies.spend('gold', cost);
    if (!spent) {
      return {
        success: false,
        reason: 'insufficient_currency',
        costCoins: cost,
      };
    }

    this.status = 'forging';
    this.elapsedSec = 0;
    this.pendingItem = null;
    return { success: true, costCoins: cost };
  }

  private startAutoForgeCycle(
    currencies: CurrencySystem,
    precedingItemEvent?: AutoForgeEvent | null
  ): {
    success: boolean;
    costCoins?: number;
  } {
    if (!this.autoForge.isEnabled()) {
      return { success: false };
    }
    if (this.status !== 'idle' || this.pendingItem !== null) {
      return { success: false };
    }

    const cost = FORGE_CONFIG.costCoins;
    const balance = currencies.getBalances().gold;
    const budgetCheck = this.autoForge.canSpendForForge(cost, balance);
    if (!budgetCheck.allowed) {
      this.autoForge.stop(
        budgetCheck.stopReason ?? 'insufficient_coins',
        undefined,
        precedingItemEvent
      );
      return { success: false };
    }

    const spent = currencies.spend('gold', cost);
    if (!spent) {
      this.autoForge.stop(
        'insufficient_coins',
        undefined,
        precedingItemEvent
      );
      return { success: false };
    }

    this.status = 'forging';
    this.elapsedSec = 0;
    this.pendingItem = null;
    this.autoForge.recordCoinSpent(cost);
    return { success: true, costCoins: cost };
  }

  enableAutoForge(
    currencies: CurrencySystem,
    equipment: EquipmentSystem
  ): AutoForgeStepOutcome {
    if (this.autoForge.isEnabled()) {
      return { processedItem: false };
    }

    // If a qualifying item is still blocked by a full inventory, preserve session counters and prompt player
    if (this.status === 'result_ready' && this.pendingItem) {
      const evaluation = this.autoForge.evaluateItem(this.pendingItem);
      if (evaluation.keep && equipment.isInventoryFull()) {
        this.autoForge.stop(
          'inventory_full',
          `Inventory full: ${this.pendingItem.name} waiting in Forge — free 1 slot to resume`
        );
        return {
          processedItem: false,
          stoppedReason: 'inventory_full',
        };
      }
    }

    this.autoForge.startSession();
    return this.processAutoForgeStep(currencies, equipment);
  }

  disableAutoForge(): void {
    this.autoForge.stop('manual');
  }

  updateAutoForgeSettings(
    partial: Partial<AutoForgeSettings>
  ): AutoForgeSettings {
    return this.autoForge.setSettings(partial);
  }

  resetAutoForgeSettings(): AutoForgeSettings {
    return this.autoForge.resetSettings();
  }

  consumePendingAutoResume(): boolean {
    return this.autoForge.consumePendingAutoResume();
  }

  processAutoForgeStep(
    currencies: CurrencySystem,
    equipment: EquipmentSystem
  ): AutoForgeStepOutcome {
    if (!this.autoForge.isEnabled()) {
      return { processedItem: false };
    }

    if (this.status === 'result_ready' && this.pendingItem) {
      this.autoForge.recordItemForgedIfNeeded(this.pendingItem.uid);
      const evaluation = this.autoForge.evaluateItem(this.pendingItem);

      if (evaluation.keep) {
        const keepResult = this.resolveKeepInInventory(equipment);
        if (keepResult.success && keepResult.item) {
          const keptEvent = this.autoForge.recordKept(keepResult.item);
          const next = this.startAutoForgeCycle(currencies, keptEvent);
          return {
            processedItem: true,
            kept: true,
            item: keepResult.item,
            startedNextForge: next.success,
            stoppedReason: next.success
              ? null
              : this.autoForge.getState().stopReason,
          };
        }

        // Inventory is full: keep forged item safely in Forge and stop Auto Forge
        this.autoForge.stop(
          'inventory_full',
          `Inventory full: ${this.pendingItem.name} waiting in Forge — free 1 slot to resume`
        );
        return {
          processedItem: true,
          kept: false,
          stoppedReason: 'inventory_full',
        };
      }

      // Failed filter requirements: dismantle using existing dismantle rules
      const dismantleResult = this.resolveDismantle(currencies);
      if (dismantleResult.success && dismantleResult.dismantledItem) {
        const coinsAwarded = dismantleResult.coinsAwarded ?? 0;
        const dismantledEvent = this.autoForge.recordDismantled(
          dismantleResult.dismantledItem,
          coinsAwarded
        );
        const next = this.startAutoForgeCycle(currencies, dismantledEvent);
        return {
          processedItem: true,
          dismantled: true,
          item: dismantleResult.dismantledItem,
          coinsAwarded,
          startedNextForge: next.success,
          stoppedReason: next.success
            ? null
            : this.autoForge.getState().stopReason,
        };
      }

      return { processedItem: false };
    }

    if (this.status === 'idle' && !this.pendingItem) {
      const next = this.startAutoForgeCycle(currencies);
      return {
        processedItem: false,
        startedNextForge: next.success,
        stoppedReason: next.success
          ? null
          : this.autoForge.getState().stopReason,
      };
    }

    return { processedItem: false };
  }

  // Advances the 2.0-second forging timer and generates the item upon completion
  update(dt: number): EquipmentItem | null {
    if (this.status !== 'forging') return null;

    this.elapsedSec += Math.max(0, dt);
    if (this.elapsedSec < FORGE_CONFIG.durationSec) {
      return null;
    }

    this.elapsedSec = FORGE_CONFIG.durationSec;
    this.totalForged += 1;
    this.pendingItem = generateForgedEquipmentItem(this.totalForged);
    this.status = 'result_ready';
    return this.getState().pendingItem;
  }

  resolveEquip(equipment: EquipmentSystem): ForgeEquipResult {
    if (this.status !== 'result_ready' || !this.pendingItem) {
      return { success: false, reason: 'no_pending_item' };
    }

    const equipResult = equipment.addAndEquipItem(this.pendingItem);
    if (!equipResult.success) {
      // Preserve pendingItem safely if equipping would displace an item into a full inventory
      return {
        success: false,
        reason:
          equipResult.reason === 'inventory_full'
            ? 'inventory_full'
            : undefined,
        equipResult,
      };
    }

    this.pendingItem = null;
    this.status = 'idle';
    this.elapsedSec = 0;

    return {
      success: true,
      equipResult,
    };
  }

  resolveDismantle(currencies: CurrencySystem): ForgeDismantleResult {
    if (this.status !== 'result_ready' || !this.pendingItem) {
      return { success: false, reason: 'no_pending_item' };
    }

    const item = this.pendingItem;
    if (item.equipped) {
      return { success: false, reason: 'cannot_dismantle_equipped' };
    }
    if (item.locked) {
      return { success: false, reason: 'cannot_dismantle_locked' };
    }

    const coinsAwarded = this.getDismantleValue(item);
    // Clear atomically BEFORE awarding Coins to guarantee single claim
    this.pendingItem = null;
    this.status = 'idle';
    this.elapsedSec = 0;

    currencies.add('gold', coinsAwarded);

    return {
      success: true,
      coinsAwarded,
      dismantledItem: item,
    };
  }

  resolveKeepInInventory(equipment: EquipmentSystem): ForgeKeepResult {
    if (this.status !== 'result_ready' || !this.pendingItem) {
      return { success: false, reason: 'no_pending_item' };
    }

    const addResult = equipment.addItem({
      ...this.pendingItem,
      equipped: false,
    });
    if (!addResult.success) {
      // Keep pendingItem intact so full inventory never discards a forged item
      return {
        success: false,
        reason:
          addResult.reason === 'inventory_full'
            ? 'inventory_full'
            : undefined,
      };
    }

    this.pendingItem = null;
    this.status = 'idle';
    this.elapsedSec = 0;

    return {
      success: true,
      item: addResult.item,
    };
  }

  exportState(): SavedForgeState {
    return {
      totalForged: this.totalForged,
      pendingItem: this.pendingItem
        ? {
            ...this.pendingItem,
            stats: { ...this.pendingItem.stats },
            specialEffect: this.pendingItem.specialEffect
              ? { ...this.pendingItem.specialEffect }
              : undefined,
          }
        : null,
      autoForge: this.autoForge.exportState(),
    };
  }

  loadState(saved?: SavedForgeState): void {
    this.status = 'idle';
    this.elapsedSec = 0;
    this.pendingItem = null;

    if (!saved || typeof saved !== 'object') {
      this.totalForged = 0;
      this.autoForge.loadState(undefined);
      return;
    }

    this.totalForged =
      typeof saved.totalForged === 'number' && Number.isFinite(saved.totalForged)
        ? Math.max(0, Math.floor(saved.totalForged))
        : 0;

    if (saved.pendingItem) {
      const cleanPending = EquipmentSystem.sanitizeItem(saved.pendingItem);
      if (cleanPending) {
        cleanPending.equipped = false;
        this.pendingItem = cleanPending;
        this.status = 'result_ready';
        this.elapsedSec = FORGE_CONFIG.durationSec;
      }
    }

    this.autoForge.loadState(saved.autoForge);
  }
}
