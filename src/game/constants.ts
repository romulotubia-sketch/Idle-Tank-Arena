import { GAME_BALANCE } from './balanceConfig';
import {
  ArenaBounds,
  CurrencyBalances,
  EquipmentSlotType,
  SkillId,
  SkillRarity,
  TankStats,
  UpgradeEntry,
  WaveState,
} from './types';

export const ARENA_BOUNDS: ArenaBounds = {
  width: GAME_BALANCE.arena.width,
  height: GAME_BALANCE.arena.height,
  gridSize: GAME_BALANCE.arena.gridSize,
  safeMargin: GAME_BALANCE.arena.safeMargin,
};

export const MOVEMENT_CONFIG = {
  boundaryRadius: GAME_BALANCE.arena.movementBoundaryRadius,
  moveSpeed: GAME_BALANCE.tankStats.initial.moveSpeed,
  hullTurnSpeedRad: GAME_BALANCE.arena.hullTurnSpeedRad,
} as const;

export const INITIAL_TANK_STATS: TankStats = {
  ...GAME_BALANCE.tankStats.initial,
};

export const TANK_STAT_CAPS = {
  ...GAME_BALANCE.tankStats.caps,
} as const;

export const ARMOR_MITIGATION_CONFIG = {
  ...GAME_BALANCE.tankStats.armorMitigation,
} as const;

export const COMBAT_CONFIG = {
  ...GAME_BALANCE.combat,
} as const;

export const SPAWN_CONFIG = {
  ...GAME_BALANCE.spawning,
} as const;

export const INITIAL_SKILL_LOADOUT: SkillId[] = [];

export const ALL_SKILL_IDS: SkillId[] = [
  // Common (5)
  'cannon',
  'machine_gun',
  'landmines',
  'piercing_shot',
  'shockwave',
  // Uncommon (5)
  'ricochet',
  'frost_cannon',
  'acid_shells',
  'shrapnel_burst',
  'shield_pulse',
  // Rare (6)
  'rocket_barrage',
  'mortar',
  'flame_thrower',
  'cluster_bombs',
  'hunter_missiles',
  'gatling_overdrive',
  // Epic (5)
  'railgun',
  'tesla',
  'laser_array',
  'plasma_cannon',
  'sentry_turret',
  // Legendary (3)
  'drone_squadron',
  'orbital_strike',
  'thunderstorm',
];

export const SKILL_RARITY_ORDER: readonly SkillRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

export const SKILL_SUMMON_RARITY_WEIGHTS =
  GAME_BALANCE.skillSummon.rarityWeights;

export const INITIAL_WAVE_STATE: WaveState = {
  currentWave: 1,
  highestWave: 1,
  enemiesRemaining: GAME_BALANCE.waveProgression.baseEnemyCount,
  enemiesTotal: GAME_BALANCE.waveProgression.baseEnemyCount,
  enemiesSpawned: 0,
  enemiesDefeatedInWave: 0,
  isBossWave: false,
  isTransitioning: false,
  transitionRemainingSec: 0,
};

export const ECONOMY_CONFIG = {
  ...GAME_BALANCE.economy,
} as const;

export const FORGE_CONFIG = {
  costCoins: GAME_BALANCE.economy.forgeCostCoins,
  durationSec: GAME_BALANCE.equipment.forgeDurationSec,
  rarityWeights: GAME_BALANCE.equipment.rarityWeights,
  dismantleCoinsByRarity: GAME_BALANCE.equipment.dismantleCoinsByRarity,
  specialEffectChanceByRarity:
    GAME_BALANCE.equipment.specialEffectChanceByRarity,
} as const;

export const INITIAL_CURRENCIES: CurrencyBalances = {
  gold: GAME_BALANCE.economy.startingCoins,
  scrap: GAME_BALANCE.economy.startingScrap,
  gems: GAME_BALANCE.economy.startingGems,
};

export const TANK_UPGRADE_CONFIG = GAME_BALANCE.tankUpgrades;

export const INITIAL_UPGRADES: UpgradeEntry[] = TANK_UPGRADE_CONFIG.map((cfg) => ({
  id: cfg.id,
  label: cfg.label,
  statKey: cfg.statKey,
  level: 1,
  maxLevel: cfg.maxLevel,
  baseValue: cfg.baseValue,
  perLevelBonus: cfg.perLevelBonus,
  maxValue: cfg.maxValue,
  baseCost: cfg.baseCost,
  costGrowth: cfg.costGrowth,
  unit: cfg.unit,
  currentValue: cfg.baseValue,
  nextBonus: cfg.perLevelBonus,
  nextCost: cfg.baseCost,
  isMaxed: false,
}));

export const SKILL_SLOT_COUNT = GAME_BALANCE.skillUpgrade.slotCount;
export const MAX_SKILL_LEVEL = GAME_BALANCE.skillUpgrade.maxSkillLevel;
export const MAX_PENDING_COPIES_PER_SKILL =
  GAME_BALANCE.skillUpgrade.maxPendingCopiesPerSkill;
export const MAX_LEVEL_OVERFLOW_FRAGMENTS =
  GAME_BALANCE.skillUpgrade.maxLevelOverflowFragments;
export const MAX_LEVEL_OVERFLOW_REFUND_RATIO =
  GAME_BALANCE.skillUpgrade.maxLevelRefundCoinsRatio;
export const SUMMON_GOLD_COST = GAME_BALANCE.economy.summonCostCoins;
export const INVENTORY_CAPACITY = GAME_BALANCE.inventory.generalCapacity;
export const EQUIPMENT_INVENTORY_CAPACITY: number =
  GAME_BALANCE.inventory.equipmentCapacity;

export const EQUIPMENT_SLOT_ORDER: { slot: EquipmentSlotType; label: string }[] = [
  { slot: 'cannon', label: 'Cannon' },
  { slot: 'armor', label: 'Armor' },
  { slot: 'engine', label: 'Engine' },
  { slot: 'tracks', label: 'Tracks' },
  { slot: 'targeting_system', label: 'Targeting System' },
  { slot: 'auxiliary_system', label: 'Auxiliary System' },
];

export const SAVE_STORAGE_KEY = 'idle_tank_arena_save_v1';
export const SAVE_BACKUP_STORAGE_KEY = 'idle_tank_arena_save_backup_v1';
export const SAVE_VERSION = 2;

export const OFFLINE_REWARD_CONFIG = {
  ...GAME_BALANCE.offlineRewards,
} as const;

export const WAVE_CONFIG = {
  ...GAME_BALANCE.waveProgression,
  ...GAME_BALANCE.enemyScaling,
} as const;

export const BOSS_CONFIG = {
  ...GAME_BALANCE.bossProgression,
  rewardGold: GAME_BALANCE.economy.bossBaseCoins,
} as const;

export const SKILL_COLLECTION_CONFIG = {
  ...GAME_BALANCE.skillCollection,
} as const;
