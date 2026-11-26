import {
  ALL_SKILL_IDS,
  MAX_LEVEL_OVERFLOW_FRAGMENTS,
  MAX_LEVEL_OVERFLOW_REFUND_RATIO,
  MAX_PENDING_COPIES_PER_SKILL,
  MAX_SKILL_LEVEL,
  SUMMON_GOLD_COST,
} from '../constants';
import {
  AutoUpgradeEvent,
  AutoUpgradeSettings,
  AutoUpgradeState,
  MaxLevelDuplicateBehavior,
  PendingSkillEntry,
  SavedAutoUpgradeState,
  SavedSkillSlot,
  SkillId,
  SkillUpgradePriorityMode,
} from '../types';
import { CurrencySystem } from './CurrencySystem';
import { SkillCollectionSystem } from './SkillCollectionSystem';
import { SkillSystem } from './SkillSystem';
import { skillRegistry } from './skills/SkillRegistry';

const VALID_SKILL_ID_SET = new Set<SkillId>(ALL_SKILL_IDS);

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

export function createDefaultAutoUpgradeSettings(): AutoUpgradeSettings {
  const enabledSkills = {} as Record<SkillId, boolean>;
  for (let i = 0; i < ALL_SKILL_IDS.length; i++) {
    enabledSkills[ALL_SKILL_IDS[i]] = true;
  }
  return {
    priorityMode: 'custom_priority',
    ignoreMaxLevel: true,
    maxLevelOverflow: 'convert_fragments',
    enabledSkills,
    skillPriorities: [...ALL_SKILL_IDS],
  };
}

export function cloneAutoUpgradeSettings(
  settings: AutoUpgradeSettings
): AutoUpgradeSettings {
  return {
    priorityMode: settings.priorityMode,
    ignoreMaxLevel: settings.ignoreMaxLevel,
    maxLevelOverflow: settings.maxLevelOverflow,
    enabledSkills: { ...settings.enabledSkills },
    skillPriorities: [...settings.skillPriorities],
  };
}

export interface DirectUpgradeStepResult {
  skillId: SkillId;
  slotIndex: number;
  previousLevel: number;
  newLevel: number;
}

export interface DirectDuplicateOutcome {
  kind:
    | 'not_equipped'
    | 'upgraded'
    | 'overflow_fragments'
    | 'overflow_coins'
    | 'stored_pending';
  skillId: SkillId;
  slotIndex?: number;
  previousLevel?: number;
  newLevel?: number;
  fragmentsAwarded?: number;
  coinsRefunded?: number;
  pendingEntry?: PendingSkillEntry;
}

export interface ReplaceWithPendingResult {
  success: boolean;
  reason?:
    | 'not_found_in_pending'
    | 'invalid_slot'
    | 'already_equipped_elsewhere';
  slotIndex?: number;
  skillId?: SkillId;
  replacedSkillId?: SkillId | null;
  replacedLevel?: number;
  autoUpgrades?: DirectUpgradeStepResult[];
}

export interface ApplyPendingUpgradeResult {
  success: boolean;
  reason?: 'not_found_in_pending' | 'not_equipped' | 'max_level';
  skillId?: SkillId;
  slotIndex?: number;
  previousLevel?: number;
  newLevel?: number;
}

export class SkillUpgradeSystem {
  private enabled = true;
  private settings: AutoUpgradeSettings = createDefaultAutoUpgradeSettings();
  private pendingSkills = new Map<SkillId, PendingSkillEntry>();
  private totalAutoUpgrades = 0;
  private eventCounter = 0;
  private lastEvent: AutoUpgradeEvent | null = null;

  static sanitizeSettings(raw: unknown): AutoUpgradeSettings {
    const defaults = createDefaultAutoUpgradeSettings();
    if (!isPlainObject(raw)) {
      return defaults;
    }

    const priorityMode: SkillUpgradePriorityMode =
      raw.priorityMode === 'lowest_level' || raw.priorityMode === 'custom_priority'
        ? raw.priorityMode
        : defaults.priorityMode;

    const maxLevelOverflow: MaxLevelDuplicateBehavior =
      raw.maxLevelOverflow === 'convert_fragments' ||
      raw.maxLevelOverflow === 'refund_coins' ||
      raw.maxLevelOverflow === 'store_pending'
        ? raw.maxLevelOverflow
        : defaults.maxLevelOverflow;

    const enabledSkills = { ...defaults.enabledSkills };
    if (isPlainObject(raw.enabledSkills)) {
      for (let i = 0; i < ALL_SKILL_IDS.length; i++) {
        const id = ALL_SKILL_IDS[i];
        if (typeof raw.enabledSkills[id] === 'boolean') {
          enabledSkills[id] = raw.enabledSkills[id] as boolean;
        }
      }
    }

    const seen = new Set<SkillId>();
    const skillPriorities: SkillId[] = [];
    if (Array.isArray(raw.skillPriorities)) {
      for (let i = 0; i < raw.skillPriorities.length; i++) {
        const id = raw.skillPriorities[i] as SkillId;
        if (VALID_SKILL_ID_SET.has(id) && !seen.has(id)) {
          seen.add(id);
          skillPriorities.push(id);
        }
      }
    }
    for (let i = 0; i < ALL_SKILL_IDS.length; i++) {
      const id = ALL_SKILL_IDS[i];
      if (!seen.has(id)) {
        seen.add(id);
        skillPriorities.push(id);
      }
    }

    return {
      priorityMode,
      ignoreMaxLevel:
        typeof raw.ignoreMaxLevel === 'boolean'
          ? raw.ignoreMaxLevel
          : defaults.ignoreMaxLevel,
      maxLevelOverflow,
      enabledSkills,
      skillPriorities,
    };
  }

  static sanitizePendingSkills(raw: unknown): PendingSkillEntry[] {
    if (!Array.isArray(raw)) return [];
    const bySkill = new Map<SkillId, PendingSkillEntry>();
    for (let i = 0; i < raw.length; i++) {
      const entry = raw[i];
      if (!isPlainObject(entry)) continue;
      const skillId = entry.skillId as SkillId;
      if (!VALID_SKILL_ID_SET.has(skillId)) continue;
      const rawCopies =
        typeof entry.copies === 'number' && Number.isFinite(entry.copies)
          ? Math.floor(entry.copies)
          : 0;
      if (rawCopies <= 0) continue;

      const addedAt =
        typeof entry.addedAt === 'number' &&
        Number.isFinite(entry.addedAt) &&
        entry.addedAt > 0
          ? Math.floor(entry.addedAt)
          : Date.now();

      const existing = bySkill.get(skillId);
      const nextCopies = Math.min(
        MAX_PENDING_COPIES_PER_SKILL,
        (existing?.copies ?? 0) + rawCopies
      );
      bySkill.set(skillId, {
        skillId,
        copies: nextCopies,
        addedAt: existing ? Math.min(existing.addedAt, addedAt) : addedAt,
      });
    }
    return Array.from(bySkill.values());
  }

  static sanitizeSavedSkillSlots(raw: unknown): SavedSkillSlot[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const seenSkills = new Set<SkillId>();
    const byIndex = new Map<number, SavedSkillSlot>();

    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (!isPlainObject(item)) continue;
      const idx =
        typeof item.index === 'number' && Number.isInteger(item.index)
          ? item.index
          : -1;
      if (idx < 0 || idx >= 6 || byIndex.has(idx)) continue;

      if (item.skillId === null || item.skillId === undefined) {
        byIndex.set(idx, { index: idx, skillId: null, level: 0 });
        continue;
      }

      const skillId = item.skillId as SkillId;
      if (!VALID_SKILL_ID_SET.has(skillId) || seenSkills.has(skillId)) {
        continue;
      }

      seenSkills.add(skillId);
      const level =
        typeof item.level === 'number' && Number.isFinite(item.level)
          ? Math.max(1, Math.min(MAX_SKILL_LEVEL, Math.floor(item.level)))
          : 1;
      byIndex.set(idx, { index: idx, skillId, level });
    }

    return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
  }

  private emitEvent(event: Omit<AutoUpgradeEvent, 'id'>): void {
    this.eventCounter += 1;
    this.lastEvent = {
      ...event,
      id: this.eventCounter,
    };
  }

  isAutoUpgradeEnabled(): boolean {
    return this.enabled;
  }

  getSettings(): AutoUpgradeSettings {
    return cloneAutoUpgradeSettings(this.settings);
  }

  getState(): AutoUpgradeState {
    return {
      enabled: this.enabled,
      settings: cloneAutoUpgradeSettings(this.settings),
      totalAutoUpgrades: this.totalAutoUpgrades,
      lastEvent: this.lastEvent ? { ...this.lastEvent } : null,
    };
  }

  getPendingSkills(): PendingSkillEntry[] {
    const order = new Map<SkillId, number>();
    for (let i = 0; i < this.settings.skillPriorities.length; i++) {
      order.set(this.settings.skillPriorities[i], i);
    }
    return Array.from(this.pendingSkills.values())
      .map((entry) => ({ ...entry }))
      .sort((a, b) => {
        if (b.addedAt !== a.addedAt) return b.addedAt - a.addedAt;
        return (order.get(a.skillId) ?? 99) - (order.get(b.skillId) ?? 99);
      });
  }

  getPendingCount(): number {
    let total = 0;
    this.pendingSkills.forEach((entry) => {
      total += entry.copies;
    });
    return total;
  }

  getPendingCopies(skillId: SkillId): number {
    return this.pendingSkills.get(skillId)?.copies ?? 0;
  }

  addPendingSkill(
    skillId: SkillId,
    copies = 1,
    addedAt: number = Date.now()
  ): { added: number; capped: boolean; entry: PendingSkillEntry } {
    const cleanCopies = Math.max(1, Math.floor(copies));
    const existing = this.pendingSkills.get(skillId);
    const currentCopies = existing?.copies ?? 0;
    const nextCopies = Math.min(
      MAX_PENDING_COPIES_PER_SKILL,
      currentCopies + cleanCopies
    );
    const added = nextCopies - currentCopies;
    const entry: PendingSkillEntry = {
      skillId,
      copies: nextCopies,
      addedAt,
    };
    this.pendingSkills.set(skillId, entry);
    return {
      added,
      capped: added < cleanCopies,
      entry: { ...entry },
    };
  }

  private consumePendingCopy(skillId: SkillId, count = 1): number {
    const existing = this.pendingSkills.get(skillId);
    if (!existing || existing.copies <= 0) return 0;
    const removeCount = Math.min(existing.copies, Math.max(1, Math.floor(count)));
    const remaining = existing.copies - removeCount;
    if (remaining <= 0) {
      this.pendingSkills.delete(skillId);
    } else {
      this.pendingSkills.set(skillId, {
        ...existing,
        copies: remaining,
      });
    }
    return removeCount;
  }

  processDirectDuplicate(
    skillId: SkillId,
    skills: SkillSystem,
    currencies: CurrencySystem,
    collection?: SkillCollectionSystem,
    summonCost: number = SUMMON_GOLD_COST
  ): DirectDuplicateOutcome {
    const slotIndex = skills.findSlotIndexBySkillId(skillId);
    if (slotIndex === -1) {
      return { kind: 'not_equipped', skillId };
    }

    const slot = skills.getSlot(slotIndex);
    if (!slot || !slot.skillId) {
      return { kind: 'not_equipped', skillId };
    }

    if (slot.level < MAX_SKILL_LEVEL) {
      const previousLevel = slot.level;
      const newLevel = Math.min(MAX_SKILL_LEVEL, previousLevel + 1);
      skills.upgradeSlotSkill(slotIndex, newLevel, collection);
      return {
        kind: 'upgraded',
        skillId,
        slotIndex,
        previousLevel,
        newLevel,
      };
    }

    // Skill is already at MAX_SKILL_LEVEL (Lv.5): never exceed Lv.5; apply overflow rule
    const def = skillRegistry.getDefinition(skillId);
    const skillName = def?.shortLabel ?? skillId;

    if (this.settings.maxLevelOverflow === 'refund_coins') {
      const refund = Math.max(
        1,
        Math.floor(summonCost * MAX_LEVEL_OVERFLOW_REFUND_RATIO)
      );
      currencies.add('gold', refund);
      return {
        kind: 'overflow_coins',
        skillId,
        slotIndex,
        previousLevel: slot.level,
        newLevel: slot.level,
        coinsRefunded: refund,
      };
    }

    if (this.settings.maxLevelOverflow === 'store_pending') {
      const stored = this.addPendingSkill(skillId, 1);
      if (stored.added > 0) {
        return {
          kind: 'stored_pending',
          skillId,
          slotIndex,
          previousLevel: slot.level,
          newLevel: slot.level,
          pendingEntry: stored.entry,
        };
      }
      // Fall back to bonus fragments if pending queue for this skill hit cap
    }

    const awarded =
      collection?.awardBonusFragments(skillId, MAX_LEVEL_OVERFLOW_FRAGMENTS) ??
      0;
    if (awarded > 0) {
      this.emitEvent({
        kind: 'overflow',
        skillId,
        previousLevel: slot.level,
        newLevel: slot.level,
        message: `${skillName} Lv.${MAX_SKILL_LEVEL} max · +${awarded} Overflow Frags`,
      });
    }
    return {
      kind: 'overflow_fragments',
      skillId,
      slotIndex,
      previousLevel: slot.level,
      newLevel: slot.level,
      fragmentsAwarded: awarded,
    };
  }

  runAutoUpgradePass(
    skills: SkillSystem,
    collection?: SkillCollectionSystem
  ): DirectUpgradeStepResult[] {
    if (!this.enabled) return [];

    const applied: DirectUpgradeStepResult[] = [];
    const priorityIndex = new Map<SkillId, number>();
    for (let i = 0; i < this.settings.skillPriorities.length; i++) {
      priorityIndex.set(this.settings.skillPriorities[i], i);
    }

    // Hard safety loop cap prevents infinite loops regardless of data
    for (let iter = 0; iter < 50; iter++) {
      const slots = skills.getSlots();
      const candidates = slots.filter((slot) => {
        if (!slot.unlocked || !slot.skillId) return false;
        // Max level 5 is always strictly enforced
        if (slot.level >= MAX_SKILL_LEVEL) return false;
        if (!this.settings.enabledSkills[slot.skillId]) return false;
        return this.getPendingCopies(slot.skillId) > 0;
      });

      if (candidates.length === 0) break;

      candidates.sort((a, b) => {
        const aId = a.skillId!;
        const bId = b.skillId!;
        const aPrio = priorityIndex.get(aId) ?? 99;
        const bPrio = priorityIndex.get(bId) ?? 99;

        if (this.settings.priorityMode === 'lowest_level') {
          if (a.level !== b.level) return a.level - b.level;
          if (aPrio !== bPrio) return aPrio - bPrio;
          return a.index - b.index;
        }

        if (aPrio !== bPrio) return aPrio - bPrio;
        if (a.level !== b.level) return a.level - b.level;
        return a.index - b.index;
      });

      const target = candidates[0];
      const skillId = target.skillId!;
      const consumed = this.consumePendingCopy(skillId, 1);
      if (consumed <= 0) break;

      const previousLevel = target.level;
      const newLevel = Math.min(MAX_SKILL_LEVEL, previousLevel + 1);
      const upgraded = skills.upgradeSlotSkill(
        target.index,
        newLevel,
        collection
      );
      if (!upgraded) break;

      this.totalAutoUpgrades += 1;
      const def = skillRegistry.getDefinition(skillId);
      this.emitEvent({
        kind: 'upgraded',
        skillId,
        previousLevel,
        newLevel,
        message: `Auto Upgraded ${def?.name ?? skillId} Lv.${previousLevel} → Lv.${newLevel}`,
      });
      applied.push({
        skillId,
        slotIndex: target.index,
        previousLevel,
        newLevel,
      });
    }

    return applied;
  }

  equipOrReplacePendingSkill(
    slotIndex: number,
    skillId: SkillId,
    skills: SkillSystem,
    collection?: SkillCollectionSystem
  ): ReplaceWithPendingResult {
    if (this.getPendingCopies(skillId) <= 0) {
      return { success: false, reason: 'not_found_in_pending' };
    }

    const slot = skills.getSlot(slotIndex);
    if (!slot || !slot.unlocked) {
      return { success: false, reason: 'invalid_slot' };
    }

    const existingIdx = skills.findSlotIndexBySkillId(skillId);
    if (existingIdx !== -1 && existingIdx !== slotIndex) {
      return { success: false, reason: 'already_equipped_elsewhere' };
    }

    const replaceRes = skills.replaceSlotSkill(slotIndex, skillId, 1, collection);
    if (!replaceRes.success) {
      return { success: false, reason: 'invalid_slot' };
    }

    this.consumePendingCopy(skillId, 1);

    const autoUpgrades = this.enabled
      ? this.runAutoUpgradePass(skills, collection)
      : [];

    return {
      success: true,
      slotIndex,
      skillId,
      replacedSkillId: replaceRes.previousSkillId,
      replacedLevel: replaceRes.previousLevel,
      autoUpgrades,
    };
  }

  applyPendingUpgradeToEquipped(
    skillId: SkillId,
    skills: SkillSystem,
    collection?: SkillCollectionSystem
  ): ApplyPendingUpgradeResult {
    if (this.getPendingCopies(skillId) <= 0) {
      return { success: false, reason: 'not_found_in_pending' };
    }

    const slotIndex = skills.findSlotIndexBySkillId(skillId);
    if (slotIndex === -1) {
      return { success: false, reason: 'not_equipped' };
    }

    const slot = skills.getSlot(slotIndex);
    if (!slot || !slot.skillId) {
      return { success: false, reason: 'not_equipped' };
    }

    if (slot.level >= MAX_SKILL_LEVEL) {
      return { success: false, reason: 'max_level' };
    }

    this.consumePendingCopy(skillId, 1);
    const previousLevel = slot.level;
    const newLevel = Math.min(MAX_SKILL_LEVEL, previousLevel + 1);
    skills.upgradeSlotSkill(slotIndex, newLevel, collection);

    return {
      success: true,
      skillId,
      slotIndex,
      previousLevel,
      newLevel,
    };
  }

  convertPendingToFragments(
    skillId: SkillId,
    collection: SkillCollectionSystem,
    count?: number
  ): { convertedCopies: number; fragmentsAwarded: number } {
    const available = this.getPendingCopies(skillId);
    if (available <= 0) {
      return { convertedCopies: 0, fragmentsAwarded: 0 };
    }
    const targetCount =
      count === undefined ? available : Math.min(available, Math.max(1, count));
    const removed = this.consumePendingCopy(skillId, targetCount);
    const fragmentsAwarded = collection.awardBonusFragments(
      skillId,
      removed * MAX_LEVEL_OVERFLOW_FRAGMENTS
    );
    return {
      convertedCopies: removed,
      fragmentsAwarded,
    };
  }

  discardPendingSkill(skillId: SkillId, count?: number): number {
    const available = this.getPendingCopies(skillId);
    if (available <= 0) return 0;
    const targetCount =
      count === undefined ? available : Math.min(available, Math.max(1, count));
    return this.consumePendingCopy(skillId, targetCount);
  }

  clearPendingSkills(): void {
    this.pendingSkills.clear();
  }

  setAutoUpgradeEnabled(
    enabled: boolean,
    skills: SkillSystem,
    collection?: SkillCollectionSystem
  ): { enabled: boolean; upgrades: DirectUpgradeStepResult[] } {
    this.enabled = Boolean(enabled);
    const upgrades = this.enabled
      ? this.runAutoUpgradePass(skills, collection)
      : [];
    return {
      enabled: this.enabled,
      upgrades,
    };
  }

  updateSettings(
    partial: Partial<AutoUpgradeSettings>,
    skills: SkillSystem,
    collection?: SkillCollectionSystem
  ): { settings: AutoUpgradeSettings; upgrades: DirectUpgradeStepResult[] } {
    this.settings = SkillUpgradeSystem.sanitizeSettings({
      ...this.settings,
      ...partial,
      enabledSkills: {
        ...this.settings.enabledSkills,
        ...(partial.enabledSkills ?? {}),
      },
      skillPriorities: partial.skillPriorities ?? this.settings.skillPriorities,
    });

    const upgrades = this.enabled
      ? this.runAutoUpgradePass(skills, collection)
      : [];
    return {
      settings: this.getSettings(),
      upgrades,
    };
  }

  resetSettings(): AutoUpgradeSettings {
    this.settings = createDefaultAutoUpgradeSettings();
    return this.getSettings();
  }

  exportPendingSkills(): PendingSkillEntry[] {
    return this.getPendingSkills();
  }

  exportAutoUpgradeState(): SavedAutoUpgradeState {
    return {
      enabled: this.enabled,
      settings: cloneAutoUpgradeSettings(this.settings),
      totalAutoUpgrades: this.totalAutoUpgrades,
    };
  }

  loadState(
    savedPending?: PendingSkillEntry[],
    savedAutoUpgrade?: SavedAutoUpgradeState
  ): void {
    this.pendingSkills.clear();
    const cleanPending = SkillUpgradeSystem.sanitizePendingSkills(savedPending);
    for (let i = 0; i < cleanPending.length; i++) {
      this.pendingSkills.set(cleanPending[i].skillId, cleanPending[i]);
    }

    if (savedAutoUpgrade) {
      this.enabled =
        typeof savedAutoUpgrade.enabled === 'boolean'
          ? savedAutoUpgrade.enabled
          : true;
      this.settings = SkillUpgradeSystem.sanitizeSettings(
        savedAutoUpgrade.settings
      );
      this.totalAutoUpgrades =
        typeof savedAutoUpgrade.totalAutoUpgrades === 'number' &&
        Number.isFinite(savedAutoUpgrade.totalAutoUpgrades)
          ? Math.max(0, Math.floor(savedAutoUpgrade.totalAutoUpgrades))
          : 0;
    } else {
      this.enabled = true;
      this.settings = createDefaultAutoUpgradeSettings();
      this.totalAutoUpgrades = 0;
    }
    this.lastEvent = null;
  }
}
