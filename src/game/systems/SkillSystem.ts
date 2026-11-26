import { MAX_SKILL_LEVEL, SKILL_SLOT_COUNT } from '../constants';
import { SkillDefinition, SkillId, SkillSlot } from '../types';
import { SkillCollectionSystem } from './SkillCollectionSystem';
import { SkillExecutionContext } from './skills/BaseSkill';
import { skillRegistry } from './skills/SkillRegistry';

export class SkillSystem {
  private readonly catalog = new Map<SkillId, SkillDefinition>();
  private slots: SkillSlot[];

  constructor(slotCount: number = SKILL_SLOT_COUNT) {
    for (const def of skillRegistry.getAllDefinitions()) {
      this.catalog.set(def.id, def);
    }

    // All 6 battlefield slots start vacant so players can summon skills
    this.slots = Array.from({ length: slotCount }, (_, index) => ({
      index,
      skillId: null,
      level: 0,
      tier: 0,
      unlocked: index < 6,
      cooldownRemaining: 0,
      cooldownTotal: 0,
    }));
  }

  registerSkill(def: SkillDefinition): void {
    this.catalog.set(def.id, def);
  }

  getDefinition(id: SkillId): SkillDefinition | undefined {
    return this.catalog.get(id) ?? skillRegistry.getDefinition(id);
  }

  getSlots(): SkillSlot[] {
    return this.slots.map((slot) => ({ ...slot }));
  }

  getSlot(slotIndex: number): SkillSlot | undefined {
    const slot = this.slots[slotIndex];
    return slot ? { ...slot } : undefined;
  }

  findFirstVacantSlotIndex(): number {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.unlocked && slot.skillId === null) {
        return i;
      }
    }
    return -1;
  }

  hasVacantSlot(): boolean {
    return this.findFirstVacantSlotIndex() !== -1;
  }

  assignToVacantSlot(
    slotIndex: number,
    skillId: SkillId,
    level = 1,
    collection?: SkillCollectionSystem
  ): boolean {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.unlocked || slot.skillId !== null) {
      return false;
    }
    const clampedLevel = Math.max(1, Math.min(MAX_SKILL_LEVEL, Math.floor(level)));
    const module = skillRegistry.getModule(skillId);
    const cd = module
      ? module.getCooldown(clampedLevel, collection?.getComputedBonuses(skillId))
      : 0;

    slot.skillId = skillId;
    slot.level = clampedLevel;
    slot.tier = clampedLevel;
    slot.cooldownTotal = cd;
    slot.cooldownRemaining = Math.min(0.2, cd);
    return true;
  }

  upgradeSlotSkill(
    slotIndex: number,
    nextLevel: number,
    collection?: SkillCollectionSystem
  ): boolean {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.unlocked || !slot.skillId) {
      return false;
    }
    const module = skillRegistry.getModule(slot.skillId);
    if (!module) {
      return false;
    }

    const clampedLevel = Math.max(1, Math.min(MAX_SKILL_LEVEL, Math.floor(nextLevel)));
    const newCooldownTotal = module.getCooldown(
      clampedLevel,
      collection?.getComputedBonuses(slot.skillId)
    );

    slot.level = clampedLevel;
    slot.tier = clampedLevel;
    slot.cooldownTotal = newCooldownTotal;
    // Preserve remaining cooldown progress capped to the faster upgraded cooldown
    slot.cooldownRemaining = Math.min(slot.cooldownRemaining, newCooldownTotal);
    return true;
  }

  refreshCooldowns(collection: SkillCollectionSystem): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.unlocked || !slot.skillId) continue;
      const module = skillRegistry.getModule(slot.skillId);
      if (!module) continue;
      const cd = module.getCooldown(
        slot.level,
        collection.getComputedBonuses(slot.skillId)
      );
      slot.cooldownTotal = cd;
      slot.cooldownRemaining = Math.min(slot.cooldownRemaining, cd);
    }
  }

  clearSlot(slotIndex: number): void {
    const slot = this.slots[slotIndex];
    if (!slot) return;
    slot.skillId = null;
    slot.level = 0;
    slot.tier = 0;
    slot.cooldownRemaining = 0;
    slot.cooldownTotal = 0;
  }

  resetToEmpty(): void {
    for (let i = 0; i < this.slots.length; i++) {
      this.clearSlot(i);
    }
  }

  resetCooldowns(collection?: SkillCollectionSystem): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.skillId) continue;
      const module = skillRegistry.getModule(slot.skillId);
      const cd = module
        ? module.getCooldown(slot.level, collection?.getComputedBonuses(slot.skillId))
        : 0;
      slot.cooldownTotal = cd;
      slot.cooldownRemaining = cd * (0.15 + i * 0.12);
    }
  }

  update(dt: number, ctx?: SkillExecutionContext): void {
    if (!ctx) return;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.unlocked || !slot.skillId) continue;

      const module = skillRegistry.getModule(slot.skillId);
      if (!module) continue;

      if (slot.cooldownRemaining > 0) {
        slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - dt);
      }

      if (slot.cooldownRemaining <= 0) {
        const executed = module.execute(slot.level, ctx);
        if (executed) {
          const bonuses = ctx.getCollectionBonuses?.(slot.skillId);
          const cd = module.getCooldown(slot.level, bonuses);
          slot.cooldownTotal = cd;
          slot.cooldownRemaining = cd;
        } else {
          slot.cooldownRemaining = 0.18;
        }
      }
    }
  }
}
