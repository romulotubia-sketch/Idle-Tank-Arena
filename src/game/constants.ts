import {
  ArenaBounds,
  CurrencyBalances,
  EquipmentSlotType,
  SkillId,
  TankStats,
  UpgradeEntry,
  WaveState,
} from './types';

export const ARENA_BOUNDS: ArenaBounds = {
  width: 1120,
  height: 620,
  gridSize: 62,
  safeMargin: 36,
};

export const MOVEMENT_CONFIG = {
  boundaryRadius: 125,
  moveSpeed: 152,
  hullTurnSpeedRad: 9.5,
} as const;

export const INITIAL_TANK_STATS: TankStats = {
  hp: 250,
  maxHp: 250,
  armor: 12,
  attackPower: 28,
  fireRate: 1.35,
  range: 345,
  critChance: 5,
  critDamage: 1.5,
  moveSpeed: MOVEMENT_CONFIG.moveSpeed,
  skillDamageBonus: 0,
  hpOnKill: 0,
  flatDamageBlock: 0,
  bossDamageBonusPct: 0,
  critBonusFlat: 0,
};

export const TANK_STAT_CAPS = {
  maxFireRate: 4.8,
  maxCritChance: 75,
  maxCritDamage: 4.5,
  maxArmor: 340,
  maxMoveSpeed: 260,
  maxSkillDamageBonus: 120,
  maxHpOnKill: 12,
  maxFlatDamageBlock: 12,
  maxBossDamageBonusPct: 60,
  maxCritBonusFlat: 60,
} as const;

export const ARMOR_MITIGATION_CONFIG = {
  halfPointArmor: 80,
  maxReductionRatio: 0.72,
} as const;

export const COMBAT_CONFIG = {
  turretTurnSpeedRad: 5.5,
  turretFireToleranceRad: 0.2,
  projectileSpeed: 580,
  projectileRadius: 5,
  projectileTtlSec: 2.0,
  tankMuzzleOffset: 48,
  tankCollisionRadius: 28,
  maxProjectiles: 96,
  maxVisualEffects: 128,
  maxMines: 12,
} as const;

export const SPAWN_CONFIG = {
  initialDelaySec: 0.45,
  spawnIntervalSec: 1.65,
  maxActiveEnemies: 18,
  minDistanceFromTank: 380,
  boundaryPadding: 18,
} as const;

export const INITIAL_SKILL_LOADOUT: SkillId[] = [];

export const ALL_SKILL_IDS: SkillId[] = [
  'cannon',
  'machine_gun',
  'rocket_barrage',
  'mortar',
  'railgun',
  'flame_thrower',
  'tesla',
  'landmines',
];

export const INITIAL_WAVE_STATE: WaveState = {
  currentWave: 1,
  highestWave: 1,
  enemiesRemaining: 8,
  enemiesTotal: 8,
  enemiesSpawned: 0,
  enemiesDefeatedInWave: 0,
  isBossWave: false,
  isTransitioning: false,
  transitionRemainingSec: 0,
};

export const ECONOMY_CONFIG = {
  startingCoins: 120,
  summonCostCoins: 50,
  forgeCostCoins: 60,
  normalEnemyBaseCoins: 5,
  normalEnemyScalingPerWave: 0.08,
  bossBaseCoins: 100,
  bossScalingPerTier: 0.4,
  waveClearBaseCoins: 25,
  waveClearScalingPerWave: 0.12,
  bossWaveClearMultiplier: 1.5,
} as const;

export const FORGE_CONFIG = {
  costCoins: ECONOMY_CONFIG.forgeCostCoins,
  durationSec: 2.0,
  rarityWeights: {
    scrap: 44,
    reinforced: 27,
    military: 15,
    advanced: 8,
    elite: 4.5,
    prototype: 1.5,
  },
  dismantleCoinsByRarity: {
    scrap: 20,
    reinforced: 35,
    military: 55,
    advanced: 85,
    elite: 130,
    prototype: 200,
  },
  specialEffectChanceByRarity: {
    scrap: 0,
    reinforced: 0,
    military: 0.4,
    advanced: 0.78,
    elite: 1.0,
    prototype: 1.0,
  },
} as const;

export const INITIAL_CURRENCIES: CurrencyBalances = {
  gold: ECONOMY_CONFIG.startingCoins,
  scrap: 25,
  gems: 10,
};

export const TANK_UPGRADE_CONFIG = [
  {
    id: 'attack',
    label: 'Attack Power',
    statKey: 'attackPower',
    baseValue: INITIAL_TANK_STATS.attackPower,
    perLevelBonus: 5,
    maxValue: null,
    maxLevel: 250,
    baseCost: 20,
    costGrowth: 1.24,
    unit: 'DMG',
  },
  {
    id: 'attack_speed',
    label: 'Attack Speed',
    statKey: 'fireRate',
    baseValue: INITIAL_TANK_STATS.fireRate,
    perLevelBonus: 0.12,
    maxValue: 4.5,
    maxLevel: 28,
    baseCost: 25,
    costGrowth: 1.28,
    unit: '/s',
  },
  {
    id: 'crit_chance',
    label: 'Critical Chance',
    statKey: 'critChance',
    baseValue: INITIAL_TANK_STATS.critChance,
    perLevelBonus: 2.5,
    maxValue: 70,
    maxLevel: 27,
    baseCost: 25,
    costGrowth: 1.26,
    unit: '%',
  },
  {
    id: 'crit_damage',
    label: 'Critical Damage',
    statKey: 'critDamage',
    baseValue: INITIAL_TANK_STATS.critDamage,
    perLevelBonus: 0.15,
    maxValue: 4.0,
    maxLevel: 18,
    baseCost: 28,
    costGrowth: 1.26,
    unit: 'x',
  },
  {
    id: 'max_hp',
    label: 'Hull Max HP',
    statKey: 'maxHp',
    baseValue: INITIAL_TANK_STATS.maxHp,
    perLevelBonus: 35,
    maxValue: null,
    maxLevel: 250,
    baseCost: 18,
    costGrowth: 1.22,
    unit: 'HP',
  },
  {
    id: 'armor',
    label: 'Armor Plating',
    statKey: 'armor',
    baseValue: INITIAL_TANK_STATS.armor,
    perLevelBonus: 4,
    maxValue: 300,
    maxLevel: 73,
    baseCost: 22,
    costGrowth: 1.24,
    unit: 'ARM',
  },
] as const;

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

export const SKILL_SLOT_COUNT = 6;
export const MAX_SKILL_LEVEL = 5;
export const SUMMON_GOLD_COST = ECONOMY_CONFIG.summonCostCoins;
export const INVENTORY_CAPACITY = 16;
export const EQUIPMENT_INVENTORY_CAPACITY = 24;

export const EQUIPMENT_SLOT_ORDER: { slot: EquipmentSlotType; label: string }[] = [
  { slot: 'cannon', label: 'Cannon' },
  { slot: 'armor', label: 'Armor' },
  { slot: 'engine', label: 'Engine' },
  { slot: 'tracks', label: 'Tracks' },
  { slot: 'targeting_system', label: 'Targeting System' },
  { slot: 'auxiliary_system', label: 'Auxiliary System' },
];

export const SAVE_STORAGE_KEY = 'idle_tank_arena_save_v1';
export const SAVE_VERSION = 1;

export const WAVE_CONFIG = {
  bossWaveInterval: 10,
  baseEnemyCount: 8,
  enemiesPerWaveStep: 2,
  maxEnemiesPerWave: 38,
  baseSpawnIntervalSec: 1.65,
  spawnIntervalDecayPerWave: 0.045,
  minSpawnIntervalSec: 0.65,
  waveTransitionDelaySec: 1.85,
  hpGrowthPerWave: 0.14,
  hpTierBonusPer5Waves: 0.12,
  damageGrowthPerWave: 0.08,
  speedGrowthPerWave: 0.02,
  maxSpeedMultiplier: 1.35,
} as const;

export const BOSS_CONFIG = {
  kind: 'siege_boss' as const,
  name: 'Ironclad Dreadnought',
  baseHp: 900,
  hpScalePerBossTier: 0.85,
  speed: 32,
  maxSpeed: 44,
  attackDamage: 22,
  attackIntervalSec: 1.65,
  attackRange: 175,
  radius: 30,
  rewardGold: ECONOMY_CONFIG.bossBaseCoins,
  specialIntervalSec: 4.6,
  specialTriggerRange: 270,
  specialTelegraphSec: 1.15,
  specialRadius: 72,
  specialDamageMultiplier: 1.65,
} as const;

export const SKILL_COLLECTION_CONFIG = {
  initiallyUnlocked: ['cannon'] as readonly SkillId[],
  maxLevel: 10,
  firstDiscoveryFragments: 5,
  duplicateDiscoveryFragments: 4,
  // Progressive fragment cost for Lv.1->2 through Lv.9->10 (9 upgrades)
  upgradeCostsByLevel: [5, 8, 12, 16, 21, 27, 34, 42, 52] as readonly number[],
  perSkillBonuses: {
    cannon: {
      damagePctPerLevel: 4,
      speedPctPerLevel: 2,
    },
    machine_gun: {
      fireRatePctPerLevel: 3.5,
      damagePctPerLevel: 2.5,
    },
    rocket_barrage: {
      damagePctPerLevel: 4,
      aoeRadiusPerLevel: 2.5,
    },
    mortar: {
      aoeRadiusPerLevel: 4,
      damagePctPerLevel: 3,
    },
    railgun: {
      damagePctPerLevel: 3.5,
      bonusPierceAtLevels: [4, 7, 10] as readonly number[],
    },
    flame_thrower: {
      rangePerLevel: 4,
      coneAnglePerLevel: 0.018,
      damagePctPerLevel: 3,
    },
    tesla: {
      damagePctPerLevel: 3,
      chainRadiusPerLevel: 5,
      bonusChainAtLevels: [5, 9] as readonly number[],
    },
    landmines: {
      aoeRadiusPerLevel: 3.5,
      damagePctPerLevel: 3.5,
      bonusMaxMinesAtLevels: [5, 9] as readonly number[],
    },
  },
} as const;


