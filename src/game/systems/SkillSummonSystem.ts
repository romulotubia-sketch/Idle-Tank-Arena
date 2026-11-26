import { GAME_BALANCE } from '../balanceConfig';
import {
  ALL_SKILL_IDS,
  MAX_SKILL_LEVEL,
  SKILL_RARITY_ORDER,
  SKILL_SLOT_COUNT,
  SKILL_SUMMON_RARITY_WEIGHTS,
} from '../constants';
import { PendingSkillEntry, SkillId, SkillRarity, SummonRule } from '../types';
import { CurrencySystem } from './CurrencySystem';
import { SkillCollectionSystem } from './SkillCollectionSystem';
import { skillRegistry } from './skills/SkillRegistry';
import { SkillSystem } from './SkillSystem';
import {
  DirectUpgradeStepResult,
  SkillUpgradeSystem,
} from './SkillUpgradeSystem';

export type SummonOutcomeKind =
  | 'equipped_new'
  | 'upgraded'
  | 'pending_choice'
  | 'overflow_fragments'
  | 'overflow_coins'
  | 'stored_pending';

export interface SummonAttemptResult {
  success: boolean;
  reason?: 'insufficient_currency' | 'cooldown_locked' | 'empty_pool';
  outcome?: SummonOutcomeKind;
  slotIndex?: number;
  skillId?: SkillId;
  level?: number;
  previousLevel?: number;
  unlockedNew?: boolean;
  fragmentsAwarded?: number;
  overflowFragments?: number;
  overflowCoins?: number;
  pendingEntry?: PendingSkillEntry;
  autoUpgrades?: DirectUpgradeStepResult[];
}

export class SkillSummonSystem {
  private rule: SummonRule = {
    costCurrency: 'gold',
    costAmount: CurrencySystem.getSummonCost(),
    maxSlots: SKILL_SLOT_COUNT,
  };

  private pool: SkillId[] = [...ALL_SKILL_IDS];
  private lastSummonTimestampMs = -10000;
  private readonly minSummonIntervalMs =
    GAME_BALANCE.skillUpgrade.minSummonIntervalMs;

  getRule(): SummonRule {
    return { ...this.rule };
  }

  setCost(costAmount: number): void {
    this.rule = {
      ...this.rule,
      costAmount: Math.max(0, Math.floor(costAmount)),
    };
  }

  getCost(): number {
    return this.rule.costAmount;
  }

  getPool(): readonly SkillId[] {
    return this.pool;
  }

  rollWeightedRarity(rng: () => number = Math.random): SkillRarity {
    const weights = SKILL_SUMMON_RARITY_WEIGHTS;
    let totalWeight = 0;
    for (let i = 0; i < SKILL_RARITY_ORDER.length; i++) {
      totalWeight += Math.max(0, weights[SKILL_RARITY_ORDER[i]] ?? 0);
    }
    if (totalWeight <= 0) {
      return 'common';
    }

    let roll = rng() * totalWeight;
    for (let i = 0; i < SKILL_RARITY_ORDER.length; i++) {
      const rarity = SKILL_RARITY_ORDER[i];
      const w = Math.max(0, weights[rarity] ?? 0);
      if (roll < w) {
        return rarity;
      }
      roll -= w;
    }
    return SKILL_RARITY_ORDER[SKILL_RARITY_ORDER.length - 1];
  }

  rollWeightedSkillId(rng: () => number = Math.random): SkillId | null {
    if (this.pool.length === 0) return null;
    const rolledRarity = this.rollWeightedRarity(rng);
    const matching: SkillId[] = [];
    for (let i = 0; i < this.pool.length; i++) {
      const id = this.pool[i];
      if (skillRegistry.getDefinition(id)?.rarity === rolledRarity) {
        matching.push(id);
      }
    }
    const candidates = matching.length > 0 ? matching : this.pool;
    const idx = Math.floor(rng() * candidates.length);
    return candidates[Math.min(candidates.length - 1, Math.max(0, idx))];
  }

  // Summoning is always allowed regardless of whether all 6 slots are occupied
  canSummon(currencies: CurrencySystem, _skills?: SkillSystem): boolean {
    if (this.pool.length === 0) return false;
    return currencies.canAfford(this.rule.costCurrency, this.rule.costAmount);
  }

  summonRandomSkill(
    currencies: CurrencySystem,
    skills: SkillSystem,
    collection?: SkillCollectionSystem,
    upgradeSystem?: SkillUpgradeSystem,
    nowMs: number = performance.now(),
    rng: () => number = Math.random
  ): SummonAttemptResult {
    // Guard against accidental double-triggers from a single tap/click
    if (nowMs - this.lastSummonTimestampMs < this.minSummonIntervalMs) {
      return { success: false, reason: 'cooldown_locked' };
    }

    if (this.pool.length === 0) {
      return { success: false, reason: 'empty_pool' };
    }

    if (!currencies.canAfford(this.rule.costCurrency, this.rule.costAmount)) {
      return { success: false, reason: 'insufficient_currency' };
    }

    const chosenSkillId = this.rollWeightedSkillId(rng);
    if (!chosenSkillId) {
      return { success: false, reason: 'empty_pool' };
    }

    const spent = currencies.spend(this.rule.costCurrency, this.rule.costAmount);
    if (!spent) {
      return { success: false, reason: 'insufficient_currency' };
    }

    this.lastSummonTimestampMs = nowMs;
    const collectionOutcome = collection?.recordSummon(chosenSkillId);

    const existingSlotIndex = skills.findSlotIndexBySkillId(chosenSkillId);

    // Case A: Summoned skill is already equipped on the battlefield
    if (existingSlotIndex !== -1) {
      if (upgradeSystem) {
        const dupOutcome = upgradeSystem.processDirectDuplicate(
          chosenSkillId,
          skills,
          currencies,
          collection,
          this.rule.costAmount
        );
        if (dupOutcome.kind === 'upgraded') {
          return {
            success: true,
            outcome: 'upgraded',
            slotIndex: dupOutcome.slotIndex,
            skillId: chosenSkillId,
            level: dupOutcome.newLevel,
            previousLevel: dupOutcome.previousLevel,
            unlockedNew: collectionOutcome?.unlockedNew ?? false,
            fragmentsAwarded: collectionOutcome?.fragmentsAwarded ?? 0,
          };
        }
        if (dupOutcome.kind === 'overflow_coins') {
          return {
            success: true,
            outcome: 'overflow_coins',
            slotIndex: dupOutcome.slotIndex,
            skillId: chosenSkillId,
            level: dupOutcome.newLevel,
            previousLevel: dupOutcome.previousLevel,
            unlockedNew: collectionOutcome?.unlockedNew ?? false,
            fragmentsAwarded: collectionOutcome?.fragmentsAwarded ?? 0,
            overflowCoins: dupOutcome.coinsRefunded ?? 0,
          };
        }
        if (dupOutcome.kind === 'stored_pending') {
          return {
            success: true,
            outcome: 'stored_pending',
            slotIndex: dupOutcome.slotIndex,
            skillId: chosenSkillId,
            level: dupOutcome.newLevel,
            previousLevel: dupOutcome.previousLevel,
            unlockedNew: collectionOutcome?.unlockedNew ?? false,
            fragmentsAwarded: collectionOutcome?.fragmentsAwarded ?? 0,
            pendingEntry: dupOutcome.pendingEntry,
          };
        }
        return {
          success: true,
          outcome: 'overflow_fragments',
          slotIndex: dupOutcome.slotIndex,
          skillId: chosenSkillId,
          level: dupOutcome.newLevel,
          previousLevel: dupOutcome.previousLevel,
          unlockedNew: collectionOutcome?.unlockedNew ?? false,
          fragmentsAwarded: collectionOutcome?.fragmentsAwarded ?? 0,
          overflowFragments: dupOutcome.fragmentsAwarded ?? 0,
        };
      }

      // Fallback if upgradeSystem wasn't passed explicitly
      const slot = skills.getSlot(existingSlotIndex);
      if (slot && slot.level < 5) {
        const prev = slot.level;
        const next = prev + 1;
        skills.upgradeSlotSkill(existingSlotIndex, next, collection);
        return {
          success: true,
          outcome: 'upgraded',
          slotIndex: existingSlotIndex,
          skillId: chosenSkillId,
          level: next,
          previousLevel: prev,
          unlockedNew: collectionOutcome?.unlockedNew ?? false,
          fragmentsAwarded: collectionOutcome?.fragmentsAwarded ?? 0,
        };
      }
    }

    // Case B1: Not currently equipped, and a vacant slot is available
    const vacantIndex = skills.findFirstVacantSlotIndex();
    if (vacantIndex !== -1) {
      const remembered = skills.getLearnedSkillLevel(chosenSkillId);
      const startLevel =
        remembered >= 1 ? Math.min(MAX_SKILL_LEVEL, remembered + 1) : 1;
      skills.assignToVacantSlot(vacantIndex, chosenSkillId, startLevel, collection);
      const autoUpgrades =
        upgradeSystem && upgradeSystem.isAutoUpgradeEnabled()
          ? upgradeSystem.runAutoUpgradePass(skills, collection)
          : [];
      const finalSlot = skills.getSlot(vacantIndex);
      return {
        success: true,
        outcome: 'equipped_new',
        slotIndex: vacantIndex,
        skillId: chosenSkillId,
        level: finalSlot?.level ?? 1,
        unlockedNew: collectionOutcome?.unlockedNew ?? false,
        fragmentsAwarded: collectionOutcome?.fragmentsAwarded ?? 0,
        autoUpgrades,
      };
    }

    // Case B2: Not currently equipped, and all 6 slots are occupied -> add to Pending Skills for player review/replacement
    const pendingRes = upgradeSystem?.addPendingSkill(chosenSkillId, 1);
    return {
      success: true,
      outcome: 'pending_choice',
      skillId: chosenSkillId,
      level: 1,
      unlockedNew: collectionOutcome?.unlockedNew ?? false,
      fragmentsAwarded: collectionOutcome?.fragmentsAwarded ?? 0,
      pendingEntry: pendingRes?.entry ?? {
        skillId: chosenSkillId,
        copies: 1,
        addedAt: Date.now(),
      },
    };
  }
}
