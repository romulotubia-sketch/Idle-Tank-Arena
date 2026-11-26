import {
  EQUIPMENT_INVENTORY_CAPACITY,
  FORGE_CONFIG,
  INITIAL_TANK_STATS,
  TANK_STAT_CAPS,
} from '../constants';
import {
  createStarterEquipmentItems,
  EQUIPMENT_RARITY_CONFIG,
  EQUIPMENT_SLOT_META,
  EQUIPMENT_SORT_OPTIONS,
  EQUIPMENT_STAT_ORDER,
} from '../data/equipmentCatalog';
import {
  EquipmentItem,
  EquipmentPreferences,
  EquipmentRarity,
  EquipmentSlotType,
  EquipmentSortOption,
  EquipmentSpecialEffect,
  EquipmentSpecialEffectId,
  EquipmentStatKey,
  EquipmentStatsMap,
  SavedEquipmentState,
  TankStats,
} from '../types';
import { CurrencySystem } from './CurrencySystem';

export interface EquipActionResult {
  success: boolean;
  reason?:
    | 'not_found'
    | 'slot_mismatch'
    | 'already_equipped'
    | 'slot_empty'
    | 'not_equipped'
    | 'inventory_full';
  item?: EquipmentItem;
  replacedItem?: EquipmentItem;
}

export interface AddEquipmentResult {
  success: boolean;
  reason?: 'inventory_full' | 'duplicate_uid';
  item?: EquipmentItem;
}

export interface DismantleItemResult {
  success: boolean;
  reason?: 'not_found' | 'equipped' | 'locked';
  coinsAwarded?: number;
  dismantledItem?: EquipmentItem;
}

export interface BulkDismantleEstimate {
  eligibleItems: EquipmentItem[];
  totalCoins: number;
  skippedCount: number;
}

export interface BulkDismantleResult {
  success: boolean;
  dismantledCount: number;
  coinsAwarded: number;
  dismantledUids: string[];
  skippedCount: number;
}

export interface EquipmentStatDiffRow {
  statKey: EquipmentStatKey;
  selectedValue: number;
  equippedValue: number;
  delta: number;
}

export const DEFAULT_EQUIPMENT_PREFERENCES: EquipmentPreferences = {
  sortBy: 'rarity_desc',
  slotFilter: 'all',
  rarityFilter: 'all',
};

const VALID_SLOTS = new Set<EquipmentSlotType>(
  EQUIPMENT_SLOT_META.map((s) => s.slot)
);

const VALID_RARITIES = new Set<EquipmentRarity>(
  Object.keys(EQUIPMENT_RARITY_CONFIG) as EquipmentRarity[]
);

const VALID_SORT_OPTIONS = new Set<EquipmentSortOption>(
  EQUIPMENT_SORT_OPTIONS.map((o) => o.id)
);

const VALID_EFFECT_IDS = new Set<EquipmentSpecialEffectId>([
  'boss_breaker',
  'reactive_plating',
  'reactive_regen',
  'overcharge_crits',
  'capacitor_boost',
]);

function cloneEffect(
  effect?: EquipmentSpecialEffect
): EquipmentSpecialEffect | undefined {
  return effect ? { ...effect } : undefined;
}

function cloneItem(item: EquipmentItem): EquipmentItem {
  return {
    ...item,
    stats: { ...item.stats },
    specialEffect: cloneEffect(item.specialEffect),
  };
}

function createEmptySlots(): Record<EquipmentSlotType, EquipmentItem | null> {
  return {
    cannon: null,
    armor: null,
    engine: null,
    tracks: null,
    targeting_system: null,
    auxiliary_system: null,
  };
}

export class EquipmentSystem {
  private ownedItems: EquipmentItem[] = [];
  private slots: Record<EquipmentSlotType, EquipmentItem | null> =
    createEmptySlots();
  private capacity: number = EQUIPMENT_INVENTORY_CAPACITY;
  private nextAcquiredOrder = 1;
  private preferences: EquipmentPreferences = {
    ...DEFAULT_EQUIPMENT_PREFERENCES,
  };

  constructor() {
    this.ownedItems = createStarterEquipmentItems();
    this.nextAcquiredOrder = this.computeNextOrderFromItems(this.ownedItems);
  }

  private computeNextOrderFromItems(items: readonly EquipmentItem[]): number {
    let maxOrder = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].acquiredOrder > maxOrder) {
        maxOrder = items[i].acquiredOrder;
      }
    }
    return maxOrder + 1;
  }

  getCapacity(): number {
    return this.capacity;
  }

  getUnequippedCount(): number {
    let count = 0;
    for (let i = 0; i < this.ownedItems.length; i++) {
      if (!this.ownedItems[i].equipped) count += 1;
    }
    return count;
  }

  isInventoryFull(): boolean {
    return this.getUnequippedCount() >= this.capacity;
  }

  canAddToInventory(count = 1): boolean {
    return this.getUnequippedCount() + count <= this.capacity;
  }

  getPreferences(): EquipmentPreferences {
    return { ...this.preferences };
  }

  setPreferences(
    partial: Partial<EquipmentPreferences>
  ): EquipmentPreferences {
    if (partial.sortBy && VALID_SORT_OPTIONS.has(partial.sortBy)) {
      this.preferences.sortBy = partial.sortBy;
    }
    if (
      partial.slotFilter === 'all' ||
      (partial.slotFilter && VALID_SLOTS.has(partial.slotFilter))
    ) {
      this.preferences.slotFilter = partial.slotFilter;
    }
    if (
      partial.rarityFilter === 'all' ||
      (partial.rarityFilter && VALID_RARITIES.has(partial.rarityFilter))
    ) {
      this.preferences.rarityFilter = partial.rarityFilter;
    }
    return this.getPreferences();
  }

  getSlots(): Record<EquipmentSlotType, EquipmentItem | null> {
    return {
      cannon: this.slots.cannon ? cloneItem(this.slots.cannon) : null,
      armor: this.slots.armor ? cloneItem(this.slots.armor) : null,
      engine: this.slots.engine ? cloneItem(this.slots.engine) : null,
      tracks: this.slots.tracks ? cloneItem(this.slots.tracks) : null,
      targeting_system: this.slots.targeting_system
        ? cloneItem(this.slots.targeting_system)
        : null,
      auxiliary_system: this.slots.auxiliary_system
        ? cloneItem(this.slots.auxiliary_system)
        : null,
    };
  }

  getOwnedItems(): EquipmentItem[] {
    return this.ownedItems.map(cloneItem);
  }

  getItemByUid(uid: string): EquipmentItem | undefined {
    const found = this.ownedItems.find((item) => item.uid === uid);
    return found ? cloneItem(found) : undefined;
  }

  getDismantleValue(item: EquipmentItem): number {
    return FORGE_CONFIG.dismantleCoinsByRarity[item.rarity] ?? 20;
  }

  addItem(item: EquipmentItem): AddEquipmentResult {
    const existing = this.ownedItems.find((entry) => entry.uid === item.uid);
    if (existing) {
      return {
        success: false,
        reason: 'duplicate_uid',
        item: cloneItem(existing),
      };
    }

    if (this.isInventoryFull()) {
      return { success: false, reason: 'inventory_full' };
    }

    const assignedOrder =
      typeof item.acquiredOrder === 'number' &&
      Number.isFinite(item.acquiredOrder) &&
      item.acquiredOrder > 0
        ? Math.floor(item.acquiredOrder)
        : this.nextAcquiredOrder++;
    if (assignedOrder >= this.nextAcquiredOrder) {
      this.nextAcquiredOrder = assignedOrder + 1;
    }

    const clean = cloneItem({
      ...item,
      equipped: false,
      locked: Boolean(item.locked),
      acquiredOrder: assignedOrder,
    });
    this.ownedItems.push(clean);
    return { success: true, item: cloneItem(clean) };
  }

  addAndEquipItem(item: EquipmentItem): EquipActionResult {
    if (!VALID_SLOTS.has(item.slot)) {
      return { success: false, reason: 'slot_mismatch', item: cloneItem(item) };
    }

    const existing = this.ownedItems.find((entry) => entry.uid === item.uid);
    if (existing) {
      return this.equipItem(existing.uid, item.slot);
    }

    // Replacing an equipped item returns the displaced item to unequipped storage (+1 unequipped).
    // Equipping into an empty slot does not consume unequipped capacity (+0 unequipped).
    const currentInSlot = this.slots[item.slot];
    if (currentInSlot && this.isInventoryFull()) {
      return {
        success: false,
        reason: 'inventory_full',
        item: cloneItem(item),
      };
    }

    const assignedOrder =
      typeof item.acquiredOrder === 'number' &&
      Number.isFinite(item.acquiredOrder) &&
      item.acquiredOrder > 0
        ? Math.floor(item.acquiredOrder)
        : this.nextAcquiredOrder++;
    if (assignedOrder >= this.nextAcquiredOrder) {
      this.nextAcquiredOrder = assignedOrder + 1;
    }

    const clean = cloneItem({
      ...item,
      equipped: true,
      locked: Boolean(item.locked),
      acquiredOrder: assignedOrder,
    });

    let replacedItem: EquipmentItem | undefined;
    if (currentInSlot) {
      currentInSlot.equipped = false;
      replacedItem = cloneItem(currentInSlot);
    }

    this.ownedItems.push(clean);
    this.slots[item.slot] = clean;

    return {
      success: true,
      item: cloneItem(clean),
      replacedItem,
    };
  }

  equipItem(
    uid: string,
    expectedSlot?: EquipmentSlotType
  ): EquipActionResult {
    const item = this.ownedItems.find((entry) => entry.uid === uid);
    if (!item) {
      return { success: false, reason: 'not_found' };
    }

    if (!VALID_SLOTS.has(item.slot)) {
      return { success: false, reason: 'slot_mismatch', item: cloneItem(item) };
    }

    if (expectedSlot !== undefined && item.slot !== expectedSlot) {
      return { success: false, reason: 'slot_mismatch', item: cloneItem(item) };
    }

    const currentInSlot = this.slots[item.slot];
    if (currentInSlot && currentInSlot.uid === item.uid) {
      return {
        success: false,
        reason: 'already_equipped',
        item: cloneItem(item),
      };
    }

    // Swapping an owned unequipped item with an equipped item leaves unequipped count unchanged.
    let replacedItem: EquipmentItem | undefined;
    if (currentInSlot) {
      currentInSlot.equipped = false;
      replacedItem = cloneItem(currentInSlot);
    }

    item.equipped = true;
    this.slots[item.slot] = item;

    return {
      success: true,
      item: cloneItem(item),
      replacedItem,
    };
  }

  unequipSlot(slot: EquipmentSlotType): EquipActionResult {
    if (!VALID_SLOTS.has(slot)) {
      return { success: false, reason: 'slot_mismatch' };
    }
    const current = this.slots[slot];
    if (!current) {
      return { success: false, reason: 'slot_empty' };
    }

    if (this.isInventoryFull()) {
      return {
        success: false,
        reason: 'inventory_full',
        item: cloneItem(current),
      };
    }

    current.equipped = false;
    this.slots[slot] = null;

    return {
      success: true,
      item: cloneItem(current),
    };
  }

  unequipItem(uid: string): EquipActionResult {
    const item = this.ownedItems.find((entry) => entry.uid === uid);
    if (!item) {
      return { success: false, reason: 'not_found' };
    }
    if (!item.equipped || this.slots[item.slot]?.uid !== uid) {
      return {
        success: false,
        reason: 'not_equipped',
        item: cloneItem(item),
      };
    }
    return this.unequipSlot(item.slot);
  }

  toggleLock(uid: string): { success: boolean; item?: EquipmentItem } {
    const item = this.ownedItems.find((entry) => entry.uid === uid);
    if (!item) return { success: false };
    item.locked = !item.locked;
    return { success: true, item: cloneItem(item) };
  }

  setItemLocked(
    uid: string,
    locked: boolean
  ): { success: boolean; item?: EquipmentItem } {
    const item = this.ownedItems.find((entry) => entry.uid === uid);
    if (!item) return { success: false };
    item.locked = Boolean(locked);
    return { success: true, item: cloneItem(item) };
  }

  dismantleItem(
    uid: string,
    currencies: CurrencySystem
  ): DismantleItemResult {
    const idx = this.ownedItems.findIndex((entry) => entry.uid === uid);
    if (idx === -1) {
      return { success: false, reason: 'not_found' };
    }

    const target = this.ownedItems[idx];
    if (target.equipped || this.slots[target.slot]?.uid === uid) {
      return {
        success: false,
        reason: 'equipped',
        dismantledItem: cloneItem(target),
      };
    }
    if (target.locked) {
      return {
        success: false,
        reason: 'locked',
        dismantledItem: cloneItem(target),
      };
    }

    const coinsAwarded = this.getDismantleValue(target);
    const snapshot = cloneItem(target);
    // Remove item BEFORE awarding Coins to guarantee zero duplicate rewards
    this.ownedItems.splice(idx, 1);
    currencies.add('gold', coinsAwarded);

    return {
      success: true,
      coinsAwarded,
      dismantledItem: snapshot,
    };
  }

  estimateBulkDismantle(uids: readonly string[]): BulkDismantleEstimate {
    const uniqueUids = new Set(uids);
    const eligibleItems: EquipmentItem[] = [];
    let totalCoins = 0;
    let skippedCount = 0;

    for (const uid of uniqueUids) {
      const item = this.ownedItems.find((entry) => entry.uid === uid);
      if (
        !item ||
        item.equipped ||
        item.locked ||
        this.slots[item.slot]?.uid === uid
      ) {
        skippedCount += 1;
        continue;
      }
      eligibleItems.push(cloneItem(item));
      totalCoins += this.getDismantleValue(item);
    }

    return {
      eligibleItems,
      totalCoins,
      skippedCount,
    };
  }

  bulkDismantle(
    uids: readonly string[],
    currencies: CurrencySystem
  ): BulkDismantleResult {
    const uniqueUids = new Set(uids);
    const eligibleSet = new Set<string>();
    let coinsAwarded = 0;
    let skippedCount = 0;

    for (const uid of uniqueUids) {
      const item = this.ownedItems.find((entry) => entry.uid === uid);
      if (
        !item ||
        item.equipped ||
        item.locked ||
        this.slots[item.slot]?.uid === uid
      ) {
        skippedCount += 1;
        continue;
      }
      eligibleSet.add(uid);
      coinsAwarded += this.getDismantleValue(item);
    }

    if (eligibleSet.size === 0) {
      return {
        success: false,
        dismantledCount: 0,
        coinsAwarded: 0,
        dismantledUids: [],
        skippedCount,
      };
    }

    const dismantledUids = Array.from(eligibleSet);
    // Remove all eligible items atomically BEFORE adding Coins
    this.ownedItems = this.ownedItems.filter(
      (entry) => !eligibleSet.has(entry.uid)
    );
    currencies.add('gold', coinsAwarded);

    return {
      success: true,
      dismantledCount: dismantledUids.length,
      coinsAwarded,
      dismantledUids,
      skippedCount,
    };
  }

  private static computeLoadoutBonuses(
    loadout: Record<EquipmentSlotType, EquipmentItem | null>
  ): EquipmentStatsMap {
    const totals: EquipmentStatsMap = {};
    for (const meta of EQUIPMENT_SLOT_META) {
      const equipped = loadout[meta.slot];
      if (!equipped) continue;

      for (const key of EQUIPMENT_STAT_ORDER) {
        const val = equipped.stats[key];
        if (typeof val !== 'number' || !Number.isFinite(val)) continue;
        totals[key] =
          Math.round(((totals[key] ?? 0) + val) * 1000) / 1000;
      }
    }
    return totals;
  }

  private static computeLoadoutSpecialEffects(
    loadout: Record<EquipmentSlotType, EquipmentItem | null>
  ): {
    hpOnKill: number;
    flatDamageBlock: number;
    bossDamageBonusPct: number;
    critBonusFlat: number;
    extraSkillBonusPct: number;
  } {
    let hpOnKill = 0;
    let flatDamageBlock = 0;
    let bossDamageBonusPct = 0;
    let critBonusFlat = 0;
    let extraSkillBonusPct = 0;

    for (const meta of EQUIPMENT_SLOT_META) {
      const fx = loadout[meta.slot]?.specialEffect;
      if (!fx || !Number.isFinite(fx.value)) continue;
      switch (fx.id) {
        case 'reactive_regen':
          hpOnKill += fx.value;
          break;
        case 'reactive_plating':
          flatDamageBlock += fx.value;
          break;
        case 'boss_breaker':
          bossDamageBonusPct += fx.value;
          break;
        case 'overcharge_crits':
          critBonusFlat += fx.value;
          break;
        case 'capacitor_boost':
          extraSkillBonusPct += fx.value;
          break;
      }
    }

    return {
      hpOnKill: Math.min(TANK_STAT_CAPS.maxHpOnKill, Math.max(0, hpOnKill)),
      flatDamageBlock: Math.min(
        TANK_STAT_CAPS.maxFlatDamageBlock,
        Math.max(0, flatDamageBlock)
      ),
      bossDamageBonusPct: Math.min(
        TANK_STAT_CAPS.maxBossDamageBonusPct,
        Math.max(0, bossDamageBonusPct)
      ),
      critBonusFlat: Math.min(
        TANK_STAT_CAPS.maxCritBonusFlat,
        Math.max(0, critBonusFlat)
      ),
      extraSkillBonusPct: Math.max(0, extraSkillBonusPct),
    };
  }

  private static computeTankStatsFromLoadout(
    loadout: Record<EquipmentSlotType, EquipmentItem | null>,
    baseUpgradeStats: TankStats = INITIAL_TANK_STATS
  ): TankStats {
    const bonuses = EquipmentSystem.computeLoadoutBonuses(loadout);
    const special = EquipmentSystem.computeLoadoutSpecialEffects(loadout);

    const attackPower = Math.max(
      1,
      Math.round(baseUpgradeStats.attackPower + (bonuses.attackDamage ?? 0))
    );
    const fireRate = Math.min(
      TANK_STAT_CAPS.maxFireRate,
      Math.max(
        0.2,
        Math.round(
          (baseUpgradeStats.fireRate + (bonuses.attackSpeed ?? 0)) * 1000
        ) / 1000
      )
    );
    const critChance = Math.min(
      TANK_STAT_CAPS.maxCritChance,
      Math.max(
        0,
        Math.round(
          (baseUpgradeStats.critChance + (bonuses.critChance ?? 0)) * 100
        ) / 100
      )
    );
    const critDamage = Math.min(
      TANK_STAT_CAPS.maxCritDamage,
      Math.max(
        1.1,
        Math.round(
          (baseUpgradeStats.critDamage + (bonuses.critDamage ?? 0)) * 1000
        ) / 1000
      )
    );
    const maxHp = Math.max(
      10,
      Math.round(baseUpgradeStats.maxHp + (bonuses.maxHp ?? 0))
    );
    const armor = Math.min(
      TANK_STAT_CAPS.maxArmor,
      Math.max(0, Math.round(baseUpgradeStats.armor + (bonuses.armor ?? 0)))
    );
    const moveSpeed = Math.min(
      TANK_STAT_CAPS.maxMoveSpeed,
      Math.max(
        60,
        Math.round(baseUpgradeStats.moveSpeed + (bonuses.moveSpeed ?? 0))
      )
    );
    const skillDamageBonus = Math.min(
      TANK_STAT_CAPS.maxSkillDamageBonus,
      Math.max(
        0,
        Math.round(
          baseUpgradeStats.skillDamageBonus +
            (bonuses.skillDamage ?? 0) +
            special.extraSkillBonusPct
        )
      )
    );

    return {
      ...baseUpgradeStats,
      hp: Math.min(maxHp, baseUpgradeStats.hp),
      maxHp,
      armor,
      attackPower,
      fireRate,
      critChance,
      critDamage,
      moveSpeed,
      skillDamageBonus,
      hpOnKill: special.hpOnKill,
      flatDamageBlock: special.flatDamageBlock,
      bossDamageBonusPct: special.bossDamageBonusPct,
      critBonusFlat: special.critBonusFlat,
    };
  }

  getTotalStatBonuses(): EquipmentStatsMap {
    return EquipmentSystem.computeLoadoutBonuses(this.slots);
  }

  getSpecialEffectTotals(): {
    hpOnKill: number;
    flatDamageBlock: number;
    bossDamageBonusPct: number;
    critBonusFlat: number;
    extraSkillBonusPct: number;
  } {
    return EquipmentSystem.computeLoadoutSpecialEffects(this.slots);
  }

  applyBonusesToTankStats(
    baseUpgradeStats: TankStats = INITIAL_TANK_STATS
  ): TankStats {
    return EquipmentSystem.computeTankStatsFromLoadout(
      this.slots,
      baseUpgradeStats
    );
  }

  previewStatsAfterEquip(
    candidateItem: EquipmentItem,
    baseUpgradeStats: TankStats = INITIAL_TANK_STATS
  ): TankStats {
    const simulatedLoadout: Record<EquipmentSlotType, EquipmentItem | null> = {
      ...this.slots,
      [candidateItem.slot]: candidateItem,
    };
    return EquipmentSystem.computeTankStatsFromLoadout(
      simulatedLoadout,
      baseUpgradeStats
    );
  }

  static compareItems(
    selected: EquipmentItem,
    equippedInSlot: EquipmentItem | null
  ): EquipmentStatDiffRow[] {
    const rows: EquipmentStatDiffRow[] = [];
    for (const key of EQUIPMENT_STAT_ORDER) {
      const selectedValue = selected.stats[key] ?? 0;
      const equippedValue = equippedInSlot?.stats[key] ?? 0;
      if (selectedValue === 0 && equippedValue === 0) continue;

      const delta = Math.round((selectedValue - equippedValue) * 1000) / 1000;
      rows.push({
        statKey: key,
        selectedValue,
        equippedValue,
        delta,
      });
    }
    return rows;
  }

  static sanitizeItem(
    raw: unknown,
    fallbackAcquiredOrder = 1
  ): EquipmentItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Partial<EquipmentItem>;
    if (typeof item.uid !== 'string' || !item.uid) return null;
    if (!item.slot || !VALID_SLOTS.has(item.slot)) return null;
    if (!item.rarity || !VALID_RARITIES.has(item.rarity)) return null;

    const cleanStats: EquipmentStatsMap = {};
    if (item.stats && typeof item.stats === 'object') {
      for (const key of EQUIPMENT_STAT_ORDER) {
        const val = item.stats[key];
        if (typeof val === 'number' && Number.isFinite(val) && val !== 0) {
          cleanStats[key] = val;
        }
      }
    }

    let cleanEffect: EquipmentSpecialEffect | undefined;
    if (
      item.specialEffect &&
      typeof item.specialEffect === 'object' &&
      VALID_EFFECT_IDS.has(item.specialEffect.id) &&
      typeof item.specialEffect.value === 'number' &&
      Number.isFinite(item.specialEffect.value) &&
      item.specialEffect.value > 0
    ) {
      cleanEffect = {
        id: item.specialEffect.id,
        name:
          typeof item.specialEffect.name === 'string'
            ? item.specialEffect.name
            : 'Special Module',
        description:
          typeof item.specialEffect.description === 'string'
            ? item.specialEffect.description
            : '',
        value: item.specialEffect.value,
      };
    }

    const acquiredOrder =
      typeof item.acquiredOrder === 'number' &&
      Number.isFinite(item.acquiredOrder) &&
      item.acquiredOrder > 0
        ? Math.floor(item.acquiredOrder)
        : Math.max(1, Math.floor(fallbackAcquiredOrder));

    return {
      uid: item.uid,
      templateId:
        typeof item.templateId === 'string' ? item.templateId : item.uid,
      name: typeof item.name === 'string' ? item.name : 'Tank Component',
      slot: item.slot,
      rarity: item.rarity,
      stats: cleanStats,
      description:
        typeof item.description === 'string' ? item.description : '',
      iconId: item.iconId ?? 'cannon_barrel',
      equipped: Boolean(item.equipped),
      locked: Boolean(item.locked),
      acquiredOrder,
      specialEffect: cleanEffect,
    };
  }

  exportState(): SavedEquipmentState {
    const equippedIds: Partial<Record<EquipmentSlotType, string | null>> = {};
    for (const meta of EQUIPMENT_SLOT_META) {
      equippedIds[meta.slot] = this.slots[meta.slot]?.uid ?? null;
    }

    return {
      ownedItems: this.ownedItems.map(cloneItem),
      equippedIds,
      capacity: this.capacity,
      nextAcquiredOrder: this.nextAcquiredOrder,
      preferences: { ...this.preferences },
    };
  }

  loadState(saved?: SavedEquipmentState): void {
    const savedCapacity =
      saved &&
      typeof saved.capacity === 'number' &&
      Number.isFinite(saved.capacity)
        ? Math.max(EQUIPMENT_INVENTORY_CAPACITY, Math.floor(saved.capacity))
        : EQUIPMENT_INVENTORY_CAPACITY;
    this.capacity = savedCapacity;
    this.preferences = { ...DEFAULT_EQUIPMENT_PREFERENCES };

    if (
      !saved ||
      !Array.isArray(saved.ownedItems) ||
      saved.ownedItems.length === 0
    ) {
      this.ownedItems = createStarterEquipmentItems();
      this.slots = createEmptySlots();
      this.nextAcquiredOrder = this.computeNextOrderFromItems(this.ownedItems);
      return;
    }

    if (saved.preferences && typeof saved.preferences === 'object') {
      this.setPreferences(saved.preferences);
    }

    const sanitizedItems: EquipmentItem[] = [];
    const seenUids = new Set<string>();

    for (let i = 0; i < saved.ownedItems.length; i++) {
      const clean = EquipmentSystem.sanitizeItem(saved.ownedItems[i], i + 1);
      if (!clean || seenUids.has(clean.uid)) continue;
      clean.equipped = false;
      seenUids.add(clean.uid);
      sanitizedItems.push(clean);
    }

    if (sanitizedItems.length === 0) {
      this.ownedItems = createStarterEquipmentItems();
      this.slots = createEmptySlots();
      this.nextAcquiredOrder = this.computeNextOrderFromItems(this.ownedItems);
      return;
    }

    this.ownedItems = sanitizedItems;
    this.slots = createEmptySlots();

    if (saved.equippedIds && typeof saved.equippedIds === 'object') {
      for (const meta of EQUIPMENT_SLOT_META) {
        const uid = saved.equippedIds[meta.slot];
        if (typeof uid !== 'string' || !uid) continue;
        const match = this.ownedItems.find(
          (item) => item.uid === uid && item.slot === meta.slot
        );
        if (match) {
          match.equipped = true;
          this.slots[meta.slot] = match;
        }
      }
    }

    const computedNext = this.computeNextOrderFromItems(this.ownedItems);
    const savedNext =
      typeof saved.nextAcquiredOrder === 'number' &&
      Number.isFinite(saved.nextAcquiredOrder)
        ? Math.floor(saved.nextAcquiredOrder)
        : 0;
    this.nextAcquiredOrder = Math.max(computedNext, savedNext);
  }
}
