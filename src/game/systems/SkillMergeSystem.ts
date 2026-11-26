import { MAX_SKILL_LEVEL } from '../constants';
import { MergeRule, SkillId, SkillSlot } from '../types';
import { SkillCollectionSystem } from './SkillCollectionSystem';
import { skillRegistry } from './skills/SkillRegistry';
import { SkillSystem } from './SkillSystem';

export type MergeFailureReason =
  | 'not_active'
  | 'same_slot'
  | 'invalid_slot'
  | 'empty_slot'
  | 'invalid_skill'
  | 'skill_mismatch'
  | 'level_mismatch'
  | 'max_level'
  | 'cooldown_locked';

export interface MergeValidationResult {
  valid: boolean;
  reason?: MergeFailureReason;
  skillId?: SkillId;
  currentLevel?: number;
  nextLevel?: number;
}

export interface MergeAttemptResult {
  success: boolean;
  reason?: MergeFailureReason;
  targetSlotIndex?: number;
  consumedSlotIndex?: number;
  skillId?: SkillId;
  previousLevel?: number;
  newLevel?: number;
}

export class SkillMergeSystem {
  private readonly rule: MergeRule = {
    requiredTierMatch: true,
    maxTier: MAX_SKILL_LEVEL,
  };

  private lastMergeTimestampMs = 0;
  private readonly minMergeIntervalMs = 220;

  getRule(): MergeRule {
    return { ...this.rule };
  }

  validateMerge(
    skills: SkillSystem,
    firstSlotIndex: number,
    secondSlotIndex: number
  ): MergeValidationResult {
    if (firstSlotIndex === secondSlotIndex) {
      return { valid: false, reason: 'same_slot' };
    }

    const first = skills.getSlot(firstSlotIndex);
    const second = skills.getSlot(secondSlotIndex);
    if (!first || !second || !first.unlocked || !second.unlocked) {
      return { valid: false, reason: 'invalid_slot' };
    }

    if (!first.skillId || !second.skillId) {
      return { valid: false, reason: 'empty_slot' };
    }

    const firstModule = skillRegistry.getModule(first.skillId);
    const secondModule = skillRegistry.getModule(second.skillId);
    if (!firstModule || !secondModule) {
      return { valid: false, reason: 'invalid_skill' };
    }

    if (first.skillId !== second.skillId) {
      return { valid: false, reason: 'skill_mismatch' };
    }

    if (first.level >= this.rule.maxTier || second.level >= this.rule.maxTier) {
      return { valid: false, reason: 'max_level' };
    }

    if (this.rule.requiredTierMatch && first.level !== second.level) {
      return { valid: false, reason: 'level_mismatch' };
    }

    if (first.level < 1) {
      return { valid: false, reason: 'invalid_skill' };
    }

    return {
      valid: true,
      skillId: first.skillId,
      currentLevel: first.level,
      nextLevel: first.level + 1,
    };
  }

  canSlotsMerge(first: SkillSlot, second: SkillSlot): boolean {
    if (first.index === second.index) return false;
    if (!first.unlocked || !second.unlocked) return false;
    if (!first.skillId || !second.skillId) return false;
    if (first.skillId !== second.skillId) return false;
    if (first.level !== second.level) return false;
    if (first.level < 1 || first.level >= this.rule.maxTier) return false;
    return Boolean(skillRegistry.getModule(first.skillId));
  }

  hasAvailableMerge(slots: readonly SkillSlot[]): boolean {
    for (let i = 0; i < slots.length; i++) {
      const a = slots[i];
      if (!a.unlocked || !a.skillId || a.level >= this.rule.maxTier) continue;
      for (let j = i + 1; j < slots.length; j++) {
        if (this.canSlotsMerge(a, slots[j])) {
          return true;
        }
      }
    }
    return false;
  }

  mergeSlots(
    skills: SkillSystem,
    firstSlotIndex: number,
    secondSlotIndex: number,
    nowMs: number = performance.now(),
    collection?: SkillCollectionSystem
  ): MergeAttemptResult {
    // Prevent duplicate merges from rapid tapping
    if (nowMs - this.lastMergeTimestampMs < this.minMergeIntervalMs) {
      return { success: false, reason: 'cooldown_locked' };
    }

    const validation = this.validateMerge(skills, firstSlotIndex, secondSlotIndex);
    if (
      !validation.valid ||
      !validation.skillId ||
      validation.currentLevel === undefined ||
      validation.nextLevel === undefined
    ) {
      return {
        success: false,
        reason: validation.reason ?? 'invalid_slot',
      };
    }

    // Retain resulting upgraded skill in the first selected slot, vacate second slot
    // Merging never unlocks separate skills or awards fragments; collection is used solely for cooldown scaling.
    const upgraded = skills.upgradeSlotSkill(
      firstSlotIndex,
      validation.nextLevel,
      collection
    );
    if (!upgraded) {
      return { success: false, reason: 'invalid_skill' };
    }

    skills.clearSlot(secondSlotIndex);
    this.lastMergeTimestampMs = nowMs;

    return {
      success: true,
      targetSlotIndex: firstSlotIndex,
      consumedSlotIndex: secondSlotIndex,
      skillId: validation.skillId,
      previousLevel: validation.currentLevel,
      newLevel: validation.nextLevel,
    };
  }
}
