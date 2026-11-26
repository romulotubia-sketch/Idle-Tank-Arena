import { AutoForgeSystem } from './AutoForgeSystem';
import { SkillUpgradeSystem } from './SkillUpgradeSystem';
import { playgamaBridge } from '../../platform/playgamaBridge';
import {
  EQUIPMENT_INVENTORY_CAPACITY,
  INITIAL_CURRENCIES,
  INITIAL_TANK_STATS,
  INITIAL_WAVE_STATE,
  SAVE_BACKUP_STORAGE_KEY,
  SAVE_STORAGE_KEY,
  SAVE_VERSION,
} from '../constants';
import {
  CurrencyBalances,
  GraphicsQuality,
  SavedMonetizationState,
  SavePayload,
  SaveStatusNotice,
  TankStats,
  WaveState,
} from '../types';

export type SaveLoadStatus =
  | 'empty'
  | 'ok'
  | 'recovered_from_backup'
  | 'corrupt_unrecoverable';

export interface SaveLoadReport {
  status: SaveLoadStatus;
  payload: SavePayload | null;
  notice: SaveStatusNotice | null;
}

const SUPPORTED_SAVE_VERSIONS = new Set<number>([1, SAVE_VERSION]);

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

function sanitizeNonNegativeInt(val: unknown, fallback: number): number {
  return typeof val === 'number' && Number.isFinite(val)
    ? Math.max(0, Math.floor(val))
    : fallback;
}

function sanitizePositiveNumber(val: unknown, fallback: number): number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0
    ? val
    : fallback;
}

function sanitizeUnitVolume(val: unknown, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(0, Math.min(1, Math.round(val * 100) / 100));
}

function sanitizeGraphicsQuality(val: unknown): GraphicsQuality {
  return val === 'low' ? 'low' : 'high';
}

function sanitizeWave(raw: unknown): WaveState | null {
  if (!isPlainObject(raw)) return null;
  const rawCurrent = raw.currentWave;
  const rawHighest = raw.highestWave;
  if (
    typeof rawCurrent !== 'number' ||
    !Number.isFinite(rawCurrent) ||
    rawCurrent < 1
  ) {
    return null;
  }

  const currentWave = Math.max(1, Math.floor(rawCurrent));
  const highestWave =
    typeof rawHighest === 'number' &&
    Number.isFinite(rawHighest) &&
    rawHighest >= 1
      ? Math.max(currentWave, Math.floor(rawHighest))
      : currentWave;

  return {
    ...INITIAL_WAVE_STATE,
    currentWave,
    highestWave,
  };
}

function sanitizeCurrencies(raw: unknown): CurrencyBalances | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.gold !== 'number' || !Number.isFinite(raw.gold) || raw.gold < 0) {
    return null;
  }

  return {
    gold: Math.max(0, Math.floor(raw.gold)),
    scrap: sanitizeNonNegativeInt(raw.scrap, INITIAL_CURRENCIES.scrap),
    gems: sanitizeNonNegativeInt(raw.gems, INITIAL_CURRENCIES.gems),
  };
}

function sanitizeTankStats(raw: unknown): TankStats {
  if (!isPlainObject(raw)) {
    return { ...INITIAL_TANK_STATS };
  }

  const maxHp = Math.max(
    10,
    Math.round(sanitizePositiveNumber(raw.maxHp, INITIAL_TANK_STATS.maxHp))
  );
  return {
    hp: maxHp,
    maxHp,
    armor: Math.round(sanitizePositiveNumber(raw.armor, INITIAL_TANK_STATS.armor)),
    attackPower: Math.max(
      1,
      Math.round(
        sanitizePositiveNumber(raw.attackPower, INITIAL_TANK_STATS.attackPower)
      )
    ),
    fireRate: Math.max(
      0.2,
      sanitizePositiveNumber(raw.fireRate, INITIAL_TANK_STATS.fireRate)
    ),
    range: Math.max(
      80,
      sanitizePositiveNumber(raw.range, INITIAL_TANK_STATS.range)
    ),
    critChance: sanitizePositiveNumber(
      raw.critChance,
      INITIAL_TANK_STATS.critChance
    ),
    critDamage: Math.max(
      1.1,
      sanitizePositiveNumber(raw.critDamage, INITIAL_TANK_STATS.critDamage)
    ),
    moveSpeed: Math.max(
      60,
      sanitizePositiveNumber(raw.moveSpeed, INITIAL_TANK_STATS.moveSpeed)
    ),
    skillDamageBonus: sanitizePositiveNumber(
      raw.skillDamageBonus,
      INITIAL_TANK_STATS.skillDamageBonus
    ),
    hpOnKill: sanitizePositiveNumber(raw.hpOnKill, INITIAL_TANK_STATS.hpOnKill),
    flatDamageBlock: sanitizePositiveNumber(
      raw.flatDamageBlock,
      INITIAL_TANK_STATS.flatDamageBlock
    ),
    bossDamageBonusPct: sanitizePositiveNumber(
      raw.bossDamageBonusPct,
      INITIAL_TANK_STATS.bossDamageBonusPct
    ),
    critBonusFlat: sanitizePositiveNumber(
      raw.critBonusFlat,
      INITIAL_TANK_STATS.critBonusFlat
    ),
  };
}

export class SaveSystem {
  private protectedCorruptState = false;

  hasProtectedCorruptSave(): boolean {
    return this.protectedCorruptState;
  }

  clearCorruptProtection(): void {
    this.protectedCorruptState = false;
  }

  validateAndParse(rawString: string | null): SavePayload | null {
    if (!rawString || typeof rawString !== 'string') return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawString);
    } catch {
      return null;
    }

    if (!isPlainObject(parsed)) return null;
    if (
      typeof parsed.version !== 'number' ||
      !SUPPORTED_SAVE_VERSIONS.has(parsed.version)
    ) {
      return null;
    }

    const wave = sanitizeWave(parsed.wave);
    const currencies = sanitizeCurrencies(parsed.currencies);
    if (!wave || !currencies) {
      return null;
    }

    const now = Date.now();
    const savedAt =
      typeof parsed.savedAt === 'number' &&
      Number.isFinite(parsed.savedAt) &&
      parsed.savedAt > 0
        ? Math.floor(parsed.savedAt)
        : now;

    const lastOfflineRewardAt =
      typeof parsed.lastOfflineRewardAt === 'number' &&
      Number.isFinite(parsed.lastOfflineRewardAt) &&
      parsed.lastOfflineRewardAt > 0
        ? Math.floor(parsed.lastOfflineRewardAt)
        : savedAt;

    const equipmentRaw = isPlainObject(parsed.equipment)
      ? parsed.equipment
      : undefined;
    const sanitizedEquipment = equipmentRaw
      ? {
          ownedItems: Array.isArray(equipmentRaw.ownedItems)
            ? equipmentRaw.ownedItems
            : [],
          equippedIds: isPlainObject(equipmentRaw.equippedIds)
            ? equipmentRaw.equippedIds
            : {},
          capacity:
            typeof equipmentRaw.capacity === 'number' &&
            Number.isFinite(equipmentRaw.capacity)
              ? Math.max(
                  EQUIPMENT_INVENTORY_CAPACITY,
                  Math.floor(equipmentRaw.capacity)
                )
              : EQUIPMENT_INVENTORY_CAPACITY,
          nextAcquiredOrder:
            typeof equipmentRaw.nextAcquiredOrder === 'number' &&
            Number.isFinite(equipmentRaw.nextAcquiredOrder)
              ? Math.max(1, Math.floor(equipmentRaw.nextAcquiredOrder))
              : undefined,
          preferences: isPlainObject(equipmentRaw.preferences)
            ? equipmentRaw.preferences
            : undefined,
        }
      : undefined;

    const forgeRaw = isPlainObject(parsed.forge) ? parsed.forge : undefined;
    const autoForgeRaw =
      forgeRaw && isPlainObject(forgeRaw.autoForge)
        ? forgeRaw.autoForge
        : undefined;
    const rawLife =
      autoForgeRaw && isPlainObject(autoForgeRaw.lifetime)
        ? autoForgeRaw.lifetime
        : undefined;
    const sanitizedAutoForge = autoForgeRaw
      ? {
          enabled: Boolean(autoForgeRaw.enabled),
          settings: AutoForgeSystem.sanitizeSettings(autoForgeRaw.settings),
          lifetime: {
            coinsSpent: sanitizeNonNegativeInt(rawLife?.coinsSpent, 0),
            itemsForged: sanitizeNonNegativeInt(rawLife?.itemsForged, 0),
            itemsKept: sanitizeNonNegativeInt(rawLife?.itemsKept, 0),
            itemsDismantled: sanitizeNonNegativeInt(rawLife?.itemsDismantled, 0),
          },
        }
      : undefined;

    const sanitizedForge = forgeRaw
      ? {
          totalForged: sanitizeNonNegativeInt(forgeRaw.totalForged, 0),
          pendingItem: isPlainObject(forgeRaw.pendingItem)
            ? forgeRaw.pendingItem
            : null,
          autoForge: sanitizedAutoForge,
        }
      : undefined;

    const collectionRaw = isPlainObject(parsed.skillCollection)
      ? parsed.skillCollection
      : undefined;
    const sanitizedCollection =
      collectionRaw && Array.isArray(collectionRaw.entries)
        ? { entries: collectionRaw.entries }
        : undefined;

    const sanitizedSkillSlots = SkillUpgradeSystem.sanitizeSavedSkillSlots(
      parsed.skillSlots
    );
    const sanitizedPendingSkills = SkillUpgradeSystem.sanitizePendingSkills(
      parsed.pendingSkills
    );
    const autoUpgradeRaw = isPlainObject(parsed.autoUpgrade)
      ? parsed.autoUpgrade
      : undefined;
    const sanitizedAutoUpgrade = autoUpgradeRaw
      ? {
          enabled:
            typeof autoUpgradeRaw.enabled === 'boolean'
              ? autoUpgradeRaw.enabled
              : true,
          settings: SkillUpgradeSystem.sanitizeSettings(autoUpgradeRaw.settings),
          totalAutoUpgrades: sanitizeNonNegativeInt(
            autoUpgradeRaw.totalAutoUpgrades,
            0
          ),
        }
      : undefined;

    const monetizationRaw = isPlainObject(parsed.monetization)
      ? parsed.monetization
      : undefined;
    let sanitizedMonetization: SavedMonetizationState | undefined;
    if (monetizationRaw && typeof monetizationRaw.dayKey === 'string') {
      const dailyRaw = isPlainObject(monetizationRaw.dailyUses)
        ? monetizationRaw.dailyUses
        : {};
      const cdRaw = isPlainObject(monetizationRaw.cooldownRemainingSec)
        ? monetizationRaw.cooldownRemainingSec
        : {};
      sanitizedMonetization = {
        dayKey: monetizationRaw.dayKey.slice(0, 16),
        dailyUses: {
          offline_reward_bonus: sanitizeNonNegativeInt(
            dailyRaw.offline_reward_bonus,
            0
          ),
          optional_coin_bonus: sanitizeNonNegativeInt(
            dailyRaw.optional_coin_bonus,
            0
          ),
          temporary_boost: sanitizeNonNegativeInt(dailyRaw.temporary_boost, 0),
        },
        cooldownRemainingSec: {
          offline_reward_bonus: sanitizeNonNegativeInt(
            cdRaw.offline_reward_bonus,
            0
          ),
          optional_coin_bonus: sanitizeNonNegativeInt(
            cdRaw.optional_coin_bonus,
            0
          ),
          temporary_boost: sanitizeNonNegativeInt(cdRaw.temporary_boost, 0),
        },
      };
    }

    return {
      version: SAVE_VERSION,
      savedAt,
      lastOfflineRewardAt,
      wave,
      currencies,
      tankStats: sanitizeTankStats(parsed.tankStats),
      upgrades: Array.isArray(parsed.upgrades)
        ? (parsed.upgrades as SavePayload['upgrades'])
        : undefined,
      equipment: sanitizedEquipment as SavePayload['equipment'],
      forge: sanitizedForge as SavePayload['forge'],
      skillCollection: sanitizedCollection as SavePayload['skillCollection'],
      skillSlots: sanitizedSkillSlots,
      pendingSkills:
        sanitizedPendingSkills.length > 0 ? sanitizedPendingSkills : undefined,
      autoUpgrade: sanitizedAutoUpgrade,
      monetization: sanitizedMonetization,
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      soundVolume: sanitizeUnitVolume(parsed.soundVolume, 0.75),
      musicEnabled:
        typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : true,
      musicVolume: sanitizeUnitVolume(parsed.musicVolume, 0.4),
      graphicsQuality: sanitizeGraphicsQuality(parsed.graphicsQuality),
      showRangeRing:
        typeof parsed.showRangeRing === 'boolean' ? parsed.showRangeRing : true,
    };
  }

  async loadWithReport(): Promise<SaveLoadReport> {
    const primaryRaw = await playgamaBridge.loadStorage(SAVE_STORAGE_KEY);
    const primaryValid = this.validateAndParse(primaryRaw);

    if (primaryValid) {
      this.protectedCorruptState = false;
      return {
        status: 'ok',
        payload: primaryValid,
        notice: null,
      };
    }

    const backupRaw = await playgamaBridge.loadStorage(SAVE_BACKUP_STORAGE_KEY);
    const backupValid = this.validateAndParse(backupRaw);

    if (backupValid) {
      this.protectedCorruptState = false;
      // Repair primary save with verified backup data
      await playgamaBridge.saveStorage(
        SAVE_STORAGE_KEY,
        JSON.stringify(backupValid)
      );
      return {
        status: 'recovered_from_backup',
        payload: backupValid,
        notice: {
          kind: 'recovered_from_backup',
          message:
            'Primary save data was incomplete and has been restored from your backup save.',
        },
      };
    }

    const hasAnyRawData =
      (typeof primaryRaw === 'string' && primaryRaw.trim().length > 0) ||
      (typeof backupRaw === 'string' && backupRaw.trim().length > 0);

    if (hasAnyRawData) {
      this.protectedCorruptState = true;
      return {
        status: 'corrupt_unrecoverable',
        payload: null,
        notice: {
          kind: 'corrupt_unrecoverable',
          message:
            'Saved progress appears corrupted and could not be restored automatically. Existing save data has been preserved without overwriting.',
        },
      };
    }

    this.protectedCorruptState = false;
    return {
      status: 'empty',
      payload: null,
      notice: null,
    };
  }

  async load(): Promise<SavePayload | null> {
    const report = await this.loadWithReport();
    return report.payload;
  }

  async save(
    payload: Omit<SavePayload, 'version' | 'savedAt'>,
    options?: { forceOverwrite?: boolean }
  ): Promise<boolean> {
    if (this.protectedCorruptState && !options?.forceOverwrite) {
      return false;
    }

    const now = Date.now();
    const record: SavePayload = {
      ...payload,
      version: SAVE_VERSION,
      savedAt: now,
      lastOfflineRewardAt:
        typeof payload.lastOfflineRewardAt === 'number' &&
        Number.isFinite(payload.lastOfflineRewardAt) &&
        payload.lastOfflineRewardAt > 0
          ? Math.floor(payload.lastOfflineRewardAt)
          : now,
    };

    const serialized = JSON.stringify(record);
    const verified = this.validateAndParse(serialized);
    if (!verified) {
      return false;
    }

    if (options?.forceOverwrite) {
      this.protectedCorruptState = false;
    }

    await playgamaBridge.saveStorage(SAVE_STORAGE_KEY, serialized);
    await playgamaBridge.saveStorage(SAVE_BACKUP_STORAGE_KEY, serialized);
    return true;
  }
}
