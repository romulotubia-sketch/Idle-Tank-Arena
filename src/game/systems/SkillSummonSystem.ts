import { ALL_SKILL_IDS, SKILL_SLOT_COUNT } from '../constants';
import { SkillId, SummonRule } from '../types';
import { CurrencySystem } from './CurrencySystem';
import { SkillCollectionSystem } from './SkillCollectionSystem';
import { SkillSystem } from './SkillSystem';

export interface SummonAttemptResult {
  success: boolean;
  reason?: 'insufficient_currency' | 'slots_full' | 'cooldown_locked' | 'empty_pool';
  slotIndex?: number;
  skillId?: SkillId;
  level?: number;
  unlockedNew?: boolean;
  fragmentsAwarded?: number;
}

export class SkillSummonSystem {
  private rule: SummonRule = {
    costCurrency: 'gold',
    costAmount: CurrencySystem.getSummonCost(),
    maxSlots: SKILL_SLOT_COUNT,
  };

  private pool: SkillId[] = [...ALL_SKILL_IDS];
  private lastSummonTimestampMs = 0;
  private readonly minSummonIntervalMs = 240;

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

  canSummon(currencies: CurrencySystem, skills: SkillSystem): boolean {
    if (!currencies.canAfford(this.rule.costCurrency, this.rule.costAmount)) {
      return false;
    }
    return skills.findFirstVacantSlotIndex() !== -1;
  }

  summonRandomSkill(
    currencies: CurrencySystem,
    skills: SkillSystem,
    collection?: SkillCollectionSystem,
    nowMs: number = performance.now()
  ): SummonAttemptResult {
    // Guard against accidental double-triggers from a single tap/click
    if (nowMs - this.lastSummonTimestampMs < this.minSummonIntervalMs) {
      return { success: false, reason: 'cooldown_locked' };
    }

    if (this.pool.length === 0) {
      return { success: false, reason: 'empty_pool' };
    }

    // 1. Check currency
    if (!currencies.canAfford(this.rule.costCurrency, this.rule.costAmount)) {
      return { success: false, reason: 'insufficient_currency' };
    }

    // 2. Check vacant slot
    const vacantIndex = skills.findFirstVacantSlotIndex();
    if (vacantIndex === -1) {
      return { success: false, reason: 'slots_full' };
    }

    // 3. Randomly pick from full pool (duplicates allowed)
    const randomPoolIdx = Math.floor(Math.random() * this.pool.length);
    const chosenSkillId = this.pool[randomPoolIdx];

    // 4. Assign at Level 1 first, then deduct currency
    const assigned = skills.assignToVacantSlot(
      vacantIndex,
      chosenSkillId,
      1,
      collection
    );
    if (!assigned) {
      return { success: false, reason: 'slots_full' };
    }

    const spent = currencies.spend(this.rule.costCurrency, this.rule.costAmount);
    if (!spent) {
      skills.clearSlot(vacantIndex);
      return { success: false, reason: 'insufficient_currency' };
    }

    this.lastSummonTimestampMs = nowMs;

    const collectionOutcome = collection?.recordSummon(chosenSkillId);

    return {
      success: true,
      slotIndex: vacantIndex,
      skillId: chosenSkillId,
      level: 1,
      unlockedNew: collectionOutcome?.unlockedNew ?? false,
      fragmentsAwarded: collectionOutcome?.fragmentsAwarded ?? 0,
    };
  }
}
