import { ALL_SKILL_IDS, MAX_SKILL_LEVEL, SKILL_SLOT_COUNT } from '../constants';
import {
  SavedSkillSlot,
  SkillDefinition,
  SkillId,
  SkillSlot,
} from '../types';
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

  findSlotIndexBySkillId(skillId: SkillId): number {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.unlocked && slot.skillId === skillId) {
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

  replaceSlotSkill(
    slotIndex: number,
    skillId: SkillId,
    level = 1,
    collection?: SkillCollectionSystem
  ): { success: boolean; previousSkillId: SkillId | null; previousLevel: number } {
    const slot = this.slots[slotIndex];
    if (!slot || !slot.unlocked) {
      return { success: false, previousSkillId: null, previousLevel: 0 };
    }
    // Prevent duplicating an already-equipped skill into another slot
    const existingIndex = this.findSlotIndexBySkillId(skillId);
    if (existingIndex !== -1 && existingIndex !== slotIndex) {
      return { success: false, previousSkillId: null, previousLevel: 0 };
    }
    const module = skillRegistry.getModule(skillId);
    if (!module) {
      return { success: false, previousSkillId: null, previousLevel: 0 };
    }

    const previousSkillId = slot.skillId;
    const previousLevel = slot.level;
    const clampedLevel = Math.max(1, Math.min(MAX_SKILL_LEVEL, Math.floor(level)));
    const cd = module.getCooldown(
      clampedLevel,
      collection?.getComputedBonuses(skillId)
    );

    slot.skillId = skillId;
    slot.level = clampedLevel;
    slot.tier = clampedLevel;
    slot.cooldownTotal = cd;
    slot.cooldownRemaining = Math.min(0.2, cd);
    return { success: true, previousSkillId, previousLevel };
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

  exportState(): SavedSkillSlot[] {
    return this.slots.map((slot) => ({
      index: slot.index,
      skillId: slot.skillId,
      level: slot.level,
    }));
  }

  loadState(
    saved?: SavedSkillSlot[],
    collection?: SkillCollectionSystem
  ): void {
    this.resetToEmpty();
    if (!Array.isArray(saved)) return;

    const validIds = new Set<SkillId>(ALL_SKILL_IDS);
    const seenSkills = new Set<SkillId>();

    for (let i = 0; i < saved.length; i++) {
      const raw = saved[i];
      if (!raw || typeof raw.index !== 'number' || !Number.isInteger(raw.index)) {
        continue;
      }
      if (raw.index < 0 || raw.index >= this.slots.length) continue;
      if (!raw.skillId || !validIds.has(raw.skillId)) continue;
      if (seenSkills.has(raw.skillId)) continue;

      const cleanLevel =
        typeof raw.level === 'number' && Number.isFinite(raw.level)
          ? Math.max(1, Math.min(MAX_SKILL_LEVEL, Math.floor(raw.level)))
          : 1;

      const slot = this.slots[raw.index];
      if (!slot || !slot.unlocked) continue;
      const module = skillRegistry.getModule(raw.skillId);
      if (!module) continue;

      seenSkills.add(raw.skillId);
      slot.skillId = raw.skillId;
      slot.level = cleanLevel;
      slot.tier = cleanLevel;
      const cd = module.getCooldown(
        cleanLevel,
        collection?.getComputedBonuses(raw.skillId)
      );
      slot.cooldownTotal = cd;
      slot.cooldownRemaining = cd * (0.15 + raw.index * 0.12);
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
