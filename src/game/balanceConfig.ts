import {
  EquipmentRarity,
  EquipmentSlotType,
  EquipmentSpecialEffectId,
  EquipmentStatKey,
  SkillId,
  SkillRarity,
  UpgradeId,
} from './types';

export interface UpgradeConfigSpec {
  readonly id: UpgradeId;
  readonly label: string;
  readonly statKey:
    | 'attackPower'
    | 'fireRate'
    | 'critChance'
    | 'critDamage'
    | 'maxHp'
    | 'armor';
  readonly baseValue: number;
  readonly perLevelBonus: number;
  readonly maxValue: number | null;
  readonly maxLevel: number;
  readonly baseCost: number;
  readonly costGrowth: number;
  readonly softCapLevel: number;
  readonly postCapLinearSlope: number;
  readonly unit: string;
}

export interface StatRangeConfigSpec {
  readonly key: EquipmentStatKey;
  readonly min: number;
  readonly max: number;
}

export interface SlotBalanceBlueprint {
  readonly primaryStats: readonly StatRangeConfigSpec[];
  readonly secondaryStats: readonly StatRangeConfigSpec[];
  readonly preferredEffects: readonly EquipmentSpecialEffectId[];
}

export const GAME_BALANCE = {
  arena: {
    width: 1120,
    height: 620,
    gridSize: 62,
    safeMargin: 36,
    movementBoundaryRadius: 125,
    hullTurnSpeedRad: 9.5,
  },

  combat: {
    turretTurnSpeedRad: 5.5,
    turretFireToleranceRad: 0.2,
    projectileSpeed: 580,
    projectileRadius: 6.5,
    projectileTtlSec: 2.0,
    tankMuzzleOffset: 72,
    tankCollisionRadius: 34,
    maxProjectiles: 96,
    maxVisualEffects: 128,
    maxMines: 12,
  },

  tankStats: {
    initial: {
      hp: 250,
      maxHp: 250,
      armor: 12,
      attackPower: 28,
      fireRate: 1.35,
      range: 345,
      critChance: 5,
      critDamage: 1.5,
      moveSpeed: 152,
      skillDamageBonus: 0,
      hpOnKill: 0,
      flatDamageBlock: 0,
      bossDamageBonusPct: 0,
      critBonusFlat: 0,
    },
    caps: {
      maxFireRate: 4.5,
      maxCritChance: 70,
      maxCritDamage: 4.0,
      maxArmor: 320,
      maxMoveSpeed: 255,
      maxSkillDamageBonus: 110,
      maxHpOnKill: 10,
      maxFlatDamageBlock: 10,
      maxBossDamageBonusPct: 55,
      maxCritBonusFlat: 50,
    },
    armorMitigation: {
      halfPointArmor: 110,
      maxReductionRatio: 0.72,
    },
  },

  tankUpgrades: [
    {
      id: 'attack',
      label: 'Attack Power',
      statKey: 'attackPower',
      baseValue: 28,
      perLevelBonus: 5,
      maxValue: null,
      maxLevel: 250,
      baseCost: 20,
      costGrowth: 1.13,
      softCapLevel: 22,
      postCapLinearSlope: 0.12,
      unit: 'DMG',
    },
    {
      id: 'attack_speed',
      label: 'Attack Speed',
      statKey: 'fireRate',
      baseValue: 1.35,
      perLevelBonus: 0.1,
      maxValue: 4.0,
      maxLevel: 28,
      baseCost: 24,
      costGrowth: 1.18,
      softCapLevel: 28,
      postCapLinearSlope: 0.15,
      unit: '/s',
    },
    {
      id: 'crit_chance',
      label: 'Critical Chance',
      statKey: 'critChance',
      baseValue: 5,
      perLevelBonus: 2.5,
      maxValue: 65,
      maxLevel: 25,
      baseCost: 24,
      costGrowth: 1.18,
      softCapLevel: 25,
      postCapLinearSlope: 0.15,
      unit: '%',
    },
    {
      id: 'crit_damage',
      label: 'Critical Damage',
      statKey: 'critDamage',
      baseValue: 1.5,
      perLevelBonus: 0.12,
      maxValue: 3.5,
      maxLevel: 18,
      baseCost: 26,
      costGrowth: 1.2,
      softCapLevel: 18,
      postCapLinearSlope: 0.16,
      unit: 'x',
    },
    {
      id: 'max_hp',
      label: 'Hull Max HP',
      statKey: 'maxHp',
      baseValue: 250,
      perLevelBonus: 38,
      maxValue: null,
      maxLevel: 250,
      baseCost: 18,
      costGrowth: 1.12,
      softCapLevel: 22,
      postCapLinearSlope: 0.11,
      unit: 'HP',
    },
    {
      id: 'armor',
      label: 'Armor Plating',
      statKey: 'armor',
      baseValue: 12,
      perLevelBonus: 4,
      maxValue: 280,
      maxLevel: 68,
      baseCost: 22,
      costGrowth: 1.12,
      softCapLevel: 24,
      postCapLinearSlope: 0.12,
      unit: 'ARM',
    },
  ] as readonly UpgradeConfigSpec[],

  spawning: {
    initialDelaySec: 0.5,
    spawnIntervalSec: 1.7,
    maxActiveEnemies: 18,
    minDistanceFromTank: 380,
    boundaryPadding: 18,
    spawnProfiles: [
      {
        minWave: 1,
        weights: {
          assault_tank: 65,
          scout: 35,
          heavy_tank: 0,
          runner: 0,
          artillery: 0,
        },
      },
      {
        minWave: 2,
        weights: {
          assault_tank: 50,
          scout: 35,
          heavy_tank: 15,
          runner: 0,
          artillery: 0,
        },
      },
      {
        minWave: 4,
        weights: {
          assault_tank: 42,
          scout: 28,
          heavy_tank: 16,
          runner: 14,
          artillery: 0,
        },
      },
      {
        minWave: 6,
        weights: {
          assault_tank: 34,
          scout: 24,
          heavy_tank: 18,
          runner: 14,
          artillery: 10,
        },
      },
      {
        minWave: 11,
        weights: {
          assault_tank: 30,
          scout: 20,
          heavy_tank: 20,
          runner: 16,
          artillery: 14,
        },
      },
    ],
  },

  waveProgression: {
    bossWaveInterval: 10,
    baseEnemyCount: 8,
    enemiesPerWaveStep: 2,
    maxEnemiesPerWave: 36,
    baseSpawnIntervalSec: 1.7,
    spawnIntervalDecayPerWave: 0.04,
    minSpawnIntervalSec: 0.72,
    waveTransitionDelaySec: 1.85,
  },

  enemyDefinitions: {
    scout: {
      id: 'scout' as const,
      name: 'Recon Scout',
      behavior: 'skirmisher' as const,
      baseHp: 34,
      speed: 74,
      maxSpeed: 102,
      attackDamage: 5,
      attackIntervalSec: 1.05,
      attackRange: 120,
      preferredMinRange: 0,
      radius: 15,
      rewardMultiplier: 0.85,
      unlockWave: 1,
    },
    assault_tank: {
      id: 'assault_tank' as const,
      name: 'Assault Tank',
      behavior: 'standard' as const,
      baseHp: 64,
      speed: 48,
      maxSpeed: 68,
      attackDamage: 9,
      attackIntervalSec: 1.45,
      attackRange: 145,
      preferredMinRange: 0,
      radius: 20,
      rewardMultiplier: 1.0,
      unlockWave: 1,
    },
    heavy_tank: {
      id: 'heavy_tank' as const,
      name: 'Heavy Tank',
      behavior: 'juggernaut' as const,
      baseHp: 148,
      speed: 29,
      maxSpeed: 42,
      attackDamage: 16,
      attackIntervalSec: 1.85,
      attackRange: 138,
      preferredMinRange: 0,
      radius: 26,
      rewardMultiplier: 1.35,
      unlockWave: 2,
    },
    runner: {
      id: 'runner' as const,
      name: 'Blade Runner',
      behavior: 'rusher' as const,
      baseHp: 38,
      speed: 92,
      maxSpeed: 126,
      attackDamage: 10,
      attackIntervalSec: 0.9,
      attackRange: 64,
      preferredMinRange: 0,
      radius: 16,
      rewardMultiplier: 0.95,
      unlockWave: 4,
    },
    artillery: {
      id: 'artillery' as const,
      name: 'Siege Artillery',
      behavior: 'artillery_ranged' as const,
      baseHp: 52,
      speed: 38,
      maxSpeed: 54,
      attackDamage: 14,
      attackIntervalSec: 2.35,
      attackRange: 315,
      preferredMinRange: 175,
      radius: 20,
      rewardMultiplier: 1.15,
      unlockWave: 6,
    },
  },

  enemyScaling: {
    hpGrowthPerWave: 0.135,
    hpTierBonusPer5Waves: 0.12,
    hpLateWaveThreshold: 30,
    hpLateWaveBonusPerWave: 0.08,
    damageGrowthPerWave: 0.075,
    damageLateWaveThreshold: 40,
    damageLateWaveBonusPerWave: 0.035,
    speedGrowthPerWave: 0.015,
    maxSpeedMultiplier: 1.32,
  },

  bossProgression: {
    kind: 'siege_boss' as const,
    name: 'Ironclad Dreadnought',
    behavior: 'boss' as const,
    baseHp: 1150,
    hpScalePerBossTier: 0.9,
    hpWaveLinearFactor: 0.035,
    speed: 31,
    maxSpeed: 42,
    attackDamage: 20,
    attackIntervalSec: 1.7,
    attackRange: 235,
    preferredMinRange: 0,
    radius: 45,
    rewardMultiplier: 1,
    unlockWave: 10,
    introDurationSec: 0.9,
    heavyShellSpeed: 330,
    burstCooldownSec: 6.4,
    burstChargeSec: 0.38,
    burstShotCount: 3,
    burstShotIntervalSec: 0.16,
    burstSpreadRad: 0.15,
    burstDamageMultiplier: 0.68,
    specialIntervalSec: 5.0,
    specialTriggerRange: 280,
    specialTelegraphSec: 1.25,
    specialRadius: 74,
    specialDamageMultiplier: 1.6,
  },

  battleRecovery: {
    delaySec: 2.2,
  },

  economy: {
    startingCoins: 120,
    startingScrap: 25,
    startingGems: 10,
    summonCostCoins: 50,
    forgeCostCoins: 60,
    normalEnemyBaseCoins: 5,
    normalEnemyScalingPerWave: 0.08,
    bossBaseCoins: 110,
    bossScalingPerTier: 0.45,
    waveClearBaseCoins: 25,
    waveClearScalingPerWave: 0.12,
    bossWaveClearMultiplier: 1.6,
  },

  offlineRewards: {
    maxDurationSec: 8 * 60 * 60, // 8 hours cap
    minElapsedSec: 60,
    efficiency: 0.5, // 50% efficiency vs active play
    baseCoinsPerMinute: 18,
    waveBonusMultiplierPerWave: 0.08,
  },

  inventory: {
    generalCapacity: 16,
    equipmentCapacity: 24,
  },

  skillUpgrade: {
    slotCount: 6,
    maxSkillLevel: 5,
    minSummonIntervalMs: 240,
    maxPendingCopiesPerSkill: 25,
    maxLevelOverflowFragments: 4,
    maxLevelRefundCoinsRatio: 0.5,
  },

  skillSummon: {
    rarityWeights: {
      common: 55,
      uncommon: 25,
      rare: 12,
      epic: 6,
      legendary: 2,
    } as Record<SkillRarity, number>,
  },

  skillCollection: {
    initiallyUnlocked: ['cannon'] as readonly SkillId[],
    maxLevel: 10,
    firstDiscoveryFragments: 5,
    duplicateDiscoveryFragments: 4,
    upgradeCostsByLevel: [5, 8, 12, 16, 21, 27, 34, 42, 52] as readonly number[],
    perSkillBonuses: {
      cannon: {
        damagePctPerLevel: 4,
        speedPctPerLevel: 2,
      },
      machine_gun: {
        fireRatePctPerLevel: 3,
        damagePctPerLevel: 2.5,
      },
      rocket_barrage: {
        damagePctPerLevel: 3.5,
        aoeRadiusPerLevel: 2.5,
      },
      mortar: {
        aoeRadiusPerLevel: 3.5,
        damagePctPerLevel: 3,
      },
      railgun: {
        damagePctPerLevel: 3.5,
        bonusPierceAtLevels: [4, 7, 10] as readonly number[],
      },
      flame_thrower: {
        rangePerLevel: 4,
        coneAnglePerLevel: 0.015,
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
      piercing_shot: {
        damagePctPerLevel: 3.5,
        bonusPierceAtLevels: [4, 8] as readonly number[],
      },
      shockwave: {
        damagePctPerLevel: 3.5,
        aoeRadiusPerLevel: 4,
      },
      ricochet: {
        damagePctPerLevel: 3.5,
        bonusBounceAtLevels: [4, 8] as readonly number[],
      },
      frost_cannon: {
        damagePctPerLevel: 3,
        aoeRadiusPerLevel: 3,
      },
      acid_shells: {
        damagePctPerLevel: 3.5,
        aoeRadiusPerLevel: 2.5,
      },
      shrapnel_burst: {
        damagePctPerLevel: 3.5,
        speedPctPerLevel: 2.5,
      },
      shield_pulse: {
        damagePctPerLevel: 3.5,
        shieldPctPerLevel: 5,
      },
      cluster_bombs: {
        damagePctPerLevel: 3.5,
        aoeRadiusPerLevel: 3,
      },
      hunter_missiles: {
        damagePctPerLevel: 3.5,
        speedPctPerLevel: 2.5,
      },
      gatling_overdrive: {
        damagePctPerLevel: 3,
        fireRatePctPerLevel: 3,
      },
      laser_array: {
        damagePctPerLevel: 3.5,
        rangePerLevel: 5,
      },
      plasma_cannon: {
        damagePctPerLevel: 3.5,
        aoeRadiusPerLevel: 3.5,
      },
      sentry_turret: {
        damagePctPerLevel: 3.5,
        rangePerLevel: 5,
      },
      drone_squadron: {
        damagePctPerLevel: 3.5,
        fireRatePctPerLevel: 2.5,
      },
      orbital_strike: {
        damagePctPerLevel: 3.5,
        aoeRadiusPerLevel: 4,
      },
      thunderstorm: {
        damagePctPerLevel: 3.5,
        rangePerLevel: 6,
      },
    },
  },

  skills: {
    cannon: [
      { damage: 36, interval: 2.1, range: 355, speed: 610, salvoCount: 1, pierceCount: 1, shellRadius: 7 },
      { damage: 48, interval: 1.95, range: 370, speed: 650, salvoCount: 1, pierceCount: 1, shellRadius: 7.5 },
      { damage: 64, interval: 1.8, range: 385, speed: 690, salvoCount: 1, pierceCount: 2, shellRadius: 8 },
      { damage: 52, interval: 1.65, range: 400, speed: 735, salvoCount: 2, pierceCount: 2, shellRadius: 8.5 },
      { damage: 78, interval: 1.5, range: 420, speed: 780, salvoCount: 2, pierceCount: 2, shellRadius: 9 },
    ],
    machine_gun: [
      { damage: 6, interval: 0.34, range: 285, speed: 690, bulletsPerBurst: 1, pierceCount: 1 },
      { damage: 8, interval: 0.3, range: 300, speed: 720, bulletsPerBurst: 1, pierceCount: 1 },
      { damage: 7, interval: 0.3, range: 315, speed: 745, bulletsPerBurst: 2, pierceCount: 1 },
      { damage: 8, interval: 0.27, range: 330, speed: 775, bulletsPerBurst: 2, pierceCount: 1 },
      { damage: 8, interval: 0.25, range: 345, speed: 805, bulletsPerBurst: 3, pierceCount: 1 },
    ],
    rocket_barrage: [
      { damage: 22, aoeRadius: 54, interval: 3.0, range: 350, rockets: 2, speed: 420 },
      { damage: 29, aoeRadius: 60, interval: 2.75, range: 365, rockets: 2, speed: 440 },
      { damage: 29, aoeRadius: 68, interval: 2.55, range: 380, rockets: 3, speed: 460 },
      { damage: 32, aoeRadius: 76, interval: 2.35, range: 395, rockets: 4, speed: 480 },
      { damage: 36, aoeRadius: 84, interval: 2.2, range: 410, rockets: 5, speed: 500 },
    ],
    mortar: [
      { damage: 44, aoeRadius: 76, interval: 3.4, range: 385, shells: 1, flightDuration: 0.72 },
      { damage: 58, aoeRadius: 84, interval: 3.15, range: 400, shells: 1, flightDuration: 0.68 },
      { damage: 46, aoeRadius: 94, interval: 2.9, range: 415, shells: 2, flightDuration: 0.64 },
      { damage: 62, aoeRadius: 104, interval: 2.65, range: 430, shells: 2, flightDuration: 0.6 },
      { damage: 64, aoeRadius: 116, interval: 2.4, range: 445, shells: 3, flightDuration: 0.56 },
    ],
    railgun: [
      { damage: 42, interval: 3.0, range: 400, pierceCount: 3, speed: 980, beamWidth: 3.5 },
      { damage: 56, interval: 2.8, range: 420, pierceCount: 4, speed: 1040, beamWidth: 4.2 },
      { damage: 74, interval: 2.6, range: 440, pierceCount: 5, speed: 1100, beamWidth: 5.0 },
      { damage: 98, interval: 2.4, range: 460, pierceCount: 7, speed: 1160, beamWidth: 6.0 },
      { damage: 132, interval: 2.2, range: 485, pierceCount: 99, speed: 1240, beamWidth: 7.4 },
    ],
    flame_thrower: [
      { damage: 6, interval: 0.38, range: 150, coneHalfAngle: 0.44, closeBonusRatio: 1.0 },
      { damage: 8, interval: 0.35, range: 162, coneHalfAngle: 0.49, closeBonusRatio: 1.1 },
      { damage: 10, interval: 0.32, range: 175, coneHalfAngle: 0.54, closeBonusRatio: 1.2 },
      { damage: 13, interval: 0.29, range: 188, coneHalfAngle: 0.6, closeBonusRatio: 1.3 },
      { damage: 17, interval: 0.26, range: 205, coneHalfAngle: 0.66, closeBonusRatio: 1.4 },
    ],
    tesla: [
      { damage: 25, interval: 1.9, range: 320, chainTargets: 2, chainRadius: 120, chainRetention: 0.78 },
      { damage: 33, interval: 1.75, range: 335, chainTargets: 3, chainRadius: 135, chainRetention: 0.81 },
      { damage: 42, interval: 1.6, range: 350, chainTargets: 4, chainRadius: 150, chainRetention: 0.84 },
      { damage: 52, interval: 1.45, range: 365, chainTargets: 5, chainRadius: 165, chainRetention: 0.86 },
      { damage: 66, interval: 1.35, range: 385, chainTargets: 6, chainRadius: 180, chainRetention: 0.87 },
    ],
    landmines: [
      { damage: 42, aoeRadius: 66, interval: 3.3, maxMines: 4, deployCount: 1, triggerRadius: 24, armTimer: 0.4 },
      { damage: 56, aoeRadius: 74, interval: 3.0, maxMines: 5, deployCount: 1, triggerRadius: 26, armTimer: 0.35 },
      { damage: 48, aoeRadius: 82, interval: 2.8, maxMines: 6, deployCount: 2, triggerRadius: 28, armTimer: 0.3 },
      { damage: 64, aoeRadius: 90, interval: 2.55, maxMines: 8, deployCount: 2, triggerRadius: 31, armTimer: 0.25 },
      { damage: 62, aoeRadius: 100, interval: 2.3, maxMines: 10, deployCount: 3, triggerRadius: 34, armTimer: 0.2 },
    ],
    piercing_shot: [
      { damage: 28, interval: 1.75, range: 390, speed: 840, pierceCount: 2 },
      { damage: 36, interval: 1.6, range: 410, speed: 880, pierceCount: 3 },
      { damage: 46, interval: 1.48, range: 430, speed: 920, pierceCount: 4 },
      { damage: 58, interval: 1.35, range: 450, speed: 960, pierceCount: 5 },
      { damage: 74, interval: 1.22, range: 475, speed: 1020, pierceCount: 6 },
    ],
    shockwave: [
      { damage: 24, interval: 2.8, radius: 120, knockback: 26 },
      { damage: 33, interval: 2.55, radius: 132, knockback: 31 },
      { damage: 44, interval: 2.3, radius: 144, knockback: 36 },
      { damage: 58, interval: 2.05, radius: 158, knockback: 42 },
      { damage: 76, interval: 1.85, radius: 175, knockback: 48 },
    ],
    ricochet: [
      { damage: 22, interval: 1.45, range: 340, speed: 650, bounces: 2, bounceRadius: 175, retention: 0.85 },
      { damage: 28, interval: 1.32, range: 355, speed: 685, bounces: 3, bounceRadius: 190, retention: 0.88 },
      { damage: 35, interval: 1.2, range: 370, speed: 720, bounces: 4, bounceRadius: 205, retention: 0.9 },
      { damage: 44, interval: 1.08, range: 385, speed: 760, bounces: 5, bounceRadius: 220, retention: 0.92 },
      { damage: 55, interval: 0.96, range: 405, speed: 800, bounces: 6, bounceRadius: 240, retention: 0.94 },
    ],
    frost_cannon: [
      { damage: 24, interval: 2.15, range: 355, speed: 560, aoeRadius: 56, slowFactor: 0.30, slowDuration: 2.4 },
      { damage: 32, interval: 1.98, range: 370, speed: 585, aoeRadius: 63, slowFactor: 0.34, slowDuration: 2.6 },
      { damage: 41, interval: 1.82, range: 385, speed: 615, aoeRadius: 70, slowFactor: 0.38, slowDuration: 2.9 },
      { damage: 53, interval: 1.66, range: 400, speed: 645, aoeRadius: 78, slowFactor: 0.42, slowDuration: 3.2 },
      { damage: 68, interval: 1.5, range: 420, speed: 680, aoeRadius: 88, slowFactor: 0.48, slowDuration: 3.5 },
    ],
    acid_shells: [
      { damage: 18, interval: 2.25, range: 355, speed: 540, aoeRadius: 52, acidDps: 9, acidDuration: 3.0 },
      { damage: 24, interval: 2.08, range: 370, speed: 565, aoeRadius: 58, acidDps: 13, acidDuration: 3.3 },
      { damage: 31, interval: 1.9, range: 385, speed: 590, aoeRadius: 65, acidDps: 18, acidDuration: 3.6 },
      { damage: 40, interval: 1.75, range: 400, speed: 620, aoeRadius: 72, acidDps: 24, acidDuration: 3.9 },
      { damage: 52, interval: 1.6, range: 420, speed: 650, aoeRadius: 80, acidDps: 32, acidDuration: 4.2 },
    ],
    shrapnel_burst: [
      { damage: 26, interval: 2.0, range: 340, speed: 600, shards: 4, shardDamage: 10, shardSpeed: 540 },
      { damage: 34, interval: 1.85, range: 355, speed: 630, shards: 5, shardDamage: 13, shardSpeed: 570 },
      { damage: 44, interval: 1.7, range: 370, speed: 660, shards: 6, shardDamage: 16, shardSpeed: 600 },
      { damage: 56, interval: 1.55, range: 385, speed: 690, shards: 7, shardDamage: 20, shardSpeed: 630 },
      { damage: 72, interval: 1.4, range: 405, speed: 720, shards: 8, shardDamage: 25, shardSpeed: 665 },
    ],
    shield_pulse: [
      { shieldAmount: 24, duration: 4.2, pulseDamage: 18, pulseRadius: 105, interval: 6.2 },
      { shieldAmount: 34, duration: 4.6, pulseDamage: 25, pulseRadius: 118, interval: 5.8 },
      { shieldAmount: 46, duration: 5.0, pulseDamage: 34, pulseRadius: 132, interval: 5.4 },
      { shieldAmount: 62, duration: 5.4, pulseDamage: 45, pulseRadius: 148, interval: 5.0 },
      { shieldAmount: 82, duration: 5.8, pulseDamage: 60, pulseRadius: 165, interval: 4.6 },
    ],
    cluster_bombs: [
      { damage: 34, interval: 3.2, range: 370, speed: 430, bomblets: 3, bombletDamage: 16, bombletAoe: 46 },
      { damage: 44, interval: 2.95, range: 385, speed: 450, bomblets: 4, bombletDamage: 20, bombletAoe: 50 },
      { damage: 56, interval: 2.75, range: 400, speed: 470, bomblets: 4, bombletDamage: 26, bombletAoe: 55 },
      { damage: 70, interval: 2.55, range: 415, speed: 495, bomblets: 5, bombletDamage: 32, bombletAoe: 60 },
      { damage: 88, interval: 2.35, range: 435, speed: 520, bomblets: 6, bombletDamage: 40, bombletAoe: 66 },
    ],
    hunter_missiles: [
      { damage: 22, interval: 2.55, range: 385, speed: 420, missiles: 2, aoeRadius: 34, turnRate: 6.5 },
      { damage: 28, interval: 2.35, range: 400, speed: 445, missiles: 3, aoeRadius: 38, turnRate: 7.2 },
      { damage: 36, interval: 2.18, range: 415, speed: 470, missiles: 3, aoeRadius: 42, turnRate: 8.0 },
      { damage: 44, interval: 2.0, range: 430, speed: 495, missiles: 4, aoeRadius: 46, turnRate: 8.8 },
      { damage: 54, interval: 1.85, range: 450, speed: 520, missiles: 5, aoeRadius: 52, turnRate: 9.6 },
    ],
    gatling_overdrive: [
      { fireRateBonus: 0.40, duration: 3.2, volleyBullets: 4, bulletDamage: 8, speed: 740, range: 320, interval: 6.0 },
      { fireRateBonus: 0.50, duration: 3.5, volleyBullets: 5, bulletDamage: 10, speed: 765, range: 335, interval: 5.6 },
      { fireRateBonus: 0.62, duration: 3.9, volleyBullets: 6, bulletDamage: 13, speed: 790, range: 350, interval: 5.2 },
      { fireRateBonus: 0.74, duration: 4.3, volleyBullets: 7, bulletDamage: 16, speed: 820, range: 365, interval: 4.8 },
      { fireRateBonus: 0.88, duration: 4.8, volleyBullets: 8, bulletDamage: 20, speed: 850, range: 385, interval: 4.4 },
    ],
    laser_array: [
      { damage: 36, interval: 2.45, range: 350, beams: 2, beamWidth: 4.2, sweepSpread: 0.24 },
      { damage: 46, interval: 2.25, range: 370, beams: 2, beamWidth: 4.8, sweepSpread: 0.28 },
      { damage: 54, interval: 2.05, range: 390, beams: 3, beamWidth: 5.4, sweepSpread: 0.30 },
      { damage: 70, interval: 1.88, range: 410, beams: 3, beamWidth: 6.2, sweepSpread: 0.34 },
      { damage: 84, interval: 1.7, range: 435, beams: 4, beamWidth: 7.0, sweepSpread: 0.38 },
    ],
    plasma_cannon: [
      { damage: 44, vortexDamage: 14, interval: 2.9, range: 375, speed: 440, aoeRadius: 72 },
      { damage: 58, vortexDamage: 19, interval: 2.68, range: 390, speed: 465, aoeRadius: 80 },
      { damage: 76, vortexDamage: 25, interval: 2.48, range: 405, speed: 490, aoeRadius: 88 },
      { damage: 98, vortexDamage: 33, interval: 2.28, range: 420, speed: 515, aoeRadius: 96 },
      { damage: 126, vortexDamage: 44, interval: 2.08, range: 440, speed: 545, aoeRadius: 108 },
    ],
    sentry_turret: [
      { damage: 11, fireInterval: 0.55, duration: 8.5, range: 260, maxTurrets: 1, interval: 5.4 },
      { damage: 15, fireInterval: 0.48, duration: 9.2, range: 280, maxTurrets: 2, interval: 5.0 },
      { damage: 19, fireInterval: 0.42, duration: 10.0, range: 300, maxTurrets: 2, interval: 4.7 },
      { damage: 25, fireInterval: 0.36, duration: 11.0, range: 320, maxTurrets: 3, interval: 4.4 },
      { damage: 32, fireInterval: 0.31, duration: 12.0, range: 345, maxTurrets: 3, interval: 4.1 },
    ],
    drone_squadron: [
      { drones: 2, damage: 12, fireInterval: 0.62, duration: 9.5, range: 290, interval: 6.2 },
      { drones: 2, damage: 16, fireInterval: 0.54, duration: 10.5, range: 310, interval: 5.8 },
      { drones: 3, damage: 20, fireInterval: 0.48, duration: 11.2, range: 330, interval: 5.4 },
      { drones: 3, damage: 26, fireInterval: 0.42, duration: 12.0, range: 350, interval: 5.0 },
      { drones: 4, damage: 33, fireInterval: 0.36, duration: 13.0, range: 375, interval: 4.6 },
    ],
    orbital_strike: [
      { damage: 95, aoeRadius: 96, delaySec: 0.45, range: 410, interval: 3.8 },
      { damage: 128, aoeRadius: 106, delaySec: 0.42, range: 425, interval: 3.5 },
      { damage: 168, aoeRadius: 118, delaySec: 0.38, range: 440, interval: 3.2 },
      { damage: 220, aoeRadius: 130, delaySec: 0.35, range: 460, interval: 2.9 },
      { damage: 285, aoeRadius: 145, delaySec: 0.32, range: 480, interval: 2.65 },
    ],
    thunderstorm: [
      { damage: 38, strikes: 4, aoeRadius: 46, range: 390, interval: 3.5 },
      { damage: 50, strikes: 5, aoeRadius: 50, range: 405, interval: 3.25 },
      { damage: 64, strikes: 6, aoeRadius: 55, range: 420, interval: 3.0 },
      { damage: 82, strikes: 7, aoeRadius: 60, range: 440, interval: 2.75 },
      { damage: 105, strikes: 8, aoeRadius: 66, range: 460, interval: 2.5 },
    ],
  },

  equipment: {
    forgeDurationSec: 2.0,
    autoForgeDefaults: {
      defaultMaxCoinSpend: 600,
      defaultMinCoinReserve: 0,
    },
    rarityWeights: {
      scrap: 45,
      reinforced: 27,
      military: 15,
      advanced: 8,
      elite: 3.8,
      prototype: 1.2,
    } as Record<EquipmentRarity, number>,
    dismantleCoinsByRarity: {
      scrap: 20,
      reinforced: 32,
      military: 50,
      advanced: 75,
      elite: 115,
      prototype: 165,
    } as Record<EquipmentRarity, number>,
    rarityStatMultipliers: {
      scrap: 1.0,
      reinforced: 1.35,
      military: 1.75,
      advanced: 2.2,
      elite: 2.75,
      prototype: 3.4,
    } as Record<EquipmentRarity, number>,
    specialEffectChanceByRarity: {
      scrap: 0,
      reinforced: 0,
      military: 0.4,
      advanced: 0.78,
      elite: 1.0,
      prototype: 1.0,
    } as Record<EquipmentRarity, number>,
    specialEffectTierScale: {
      scrap: 1,
      reinforced: 1,
      military: 1.0,
      advanced: 1.4,
      elite: 1.9,
      prototype: 2.5,
    } as Record<EquipmentRarity, number>,
    specialEffectRanges: {
      boss_breaker: { min: 6, max: 10 },
      reactive_plating: { min: 1, max: 2 },
      reactive_regen: { min: 1, max: 2 },
      overcharge_crits: { min: 4, max: 8 },
      capacitor_boost: { min: 5, max: 9 },
    } as Record<EquipmentSpecialEffectId, { min: number; max: number }>,
    slotBlueprints: {
      cannon: {
        primaryStats: [
          { key: 'attackDamage', min: 5, max: 8 },
          { key: 'attackSpeed', min: 0.06, max: 0.11 },
        ],
        secondaryStats: [
          { key: 'critChance', min: 1.5, max: 2.8 },
          { key: 'critDamage', min: 0.07, max: 0.13 },
          { key: 'skillDamage', min: 4, max: 7 },
        ],
        preferredEffects: ['boss_breaker', 'overcharge_crits'],
      },
      armor: {
        primaryStats: [
          { key: 'armor', min: 4, max: 7 },
          { key: 'maxHp', min: 22, max: 36 },
        ],
        secondaryStats: [
          { key: 'maxHp', min: 18, max: 28 },
          { key: 'moveSpeed', min: 4, max: 8 },
          { key: 'attackDamage', min: 2, max: 4 },
        ],
        preferredEffects: ['reactive_plating', 'reactive_regen'],
      },
      engine: {
        primaryStats: [
          { key: 'moveSpeed', min: 11, max: 18 },
          { key: 'attackSpeed', min: 0.05, max: 0.09 },
        ],
        secondaryStats: [
          { key: 'maxHp', min: 14, max: 24 },
          { key: 'skillDamage', min: 4, max: 8 },
          { key: 'armor', min: 2, max: 4 },
        ],
        preferredEffects: ['reactive_regen', 'capacitor_boost'],
      },
      tracks: {
        primaryStats: [
          { key: 'moveSpeed', min: 8, max: 15 },
          { key: 'armor', min: 3, max: 6 },
        ],
        secondaryStats: [
          { key: 'maxHp', min: 16, max: 26 },
          { key: 'critChance', min: 1.2, max: 2.4 },
          { key: 'attackSpeed', min: 0.04, max: 0.07 },
        ],
        preferredEffects: ['reactive_plating', 'reactive_regen'],
      },
      targeting_system: {
        primaryStats: [
          { key: 'critChance', min: 2.5, max: 4.2 },
          { key: 'critDamage', min: 0.09, max: 0.16 },
        ],
        secondaryStats: [
          { key: 'attackDamage', min: 3, max: 5 },
          { key: 'attackSpeed', min: 0.05, max: 0.08 },
          { key: 'skillDamage', min: 4, max: 8 },
        ],
        preferredEffects: ['overcharge_crits', 'boss_breaker'],
      },
      auxiliary_system: {
        primaryStats: [
          { key: 'skillDamage', min: 7, max: 12 },
          { key: 'attackSpeed', min: 0.05, max: 0.09 },
        ],
        secondaryStats: [
          { key: 'critDamage', min: 0.07, max: 0.14 },
          { key: 'maxHp', min: 15, max: 26 },
          { key: 'attackDamage', min: 3, max: 5 },
        ],
        preferredEffects: ['capacitor_boost', 'reactive_regen'],
      },
    } as Record<EquipmentSlotType, SlotBalanceBlueprint>,
  },
} as const;
