import { GAME_BALANCE } from './balanceConfig';
import { EQUIPMENT_RARITY_ORDER } from './data/equipmentCatalog';
import { CurrencySystem } from './systems/CurrencySystem';
import { OfflineProgressSystem } from './systems/OfflineProgressSystem';
import { SkillCollectionSystem } from './systems/SkillCollectionSystem';
import { UpgradeSystem } from './systems/UpgradeSystem';
import { WaveSystem } from './systems/WaveSystem';
import { EquipmentRarity, SkillId, UpgradeId } from './types';

export interface WaveBalanceRow {
  wave: number;
  isBossWave: boolean;
  totalEnemies: number;
  spawnIntervalSec: number;
  hpMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
  scoutHp: number;
  assaultHp: number;
  heavyHp: number;
  runnerHp: number;
  artilleryHp: number;
  bossHp: number | null;
  enemyDamage: number;
  bossDamage: number | null;
  normalEnemyCoins: number;
  bossCoins: number | null;
  clearRewardCoins: number;
  totalWaveCoins: number;
  offlineCoinsPerHour: number;
}

export interface UpgradeCheckpointRow {
  id: UpgradeId;
  label: string;
  maxLevel: number;
  checkpoints: {
    level: number;
    statValue: number;
    nextCost: number;
  }[];
}

export interface ForgingProbabilityRow {
  rarity: EquipmentRarity;
  weight: number;
  probabilityPct: number;
  statMultiplier: number;
  specialEffectChancePct: number;
  dismantleCoins: number;
}

export interface SkillProgressionRow {
  skillId: SkillId;
  levels: {
    level: number;
    cooldownSec: number;
    singleTargetDps: number;
    multiTargetNotes: string;
  }[];
  collectionMaxLevel: number;
  collectionTotalFragmentCost: number;
}

export interface BalanceInspectionReport {
  waveScaling: WaveBalanceRow[];
  upgradeCosts: UpgradeCheckpointRow[];
  forgingProbabilities: {
    forgeCostCoins: number;
    expectedDismantleReturnCoins: number;
    netExpectedForgeCostCoins: number;
    rarities: ForgingProbabilityRow[];
  };
  skillProgression: SkillProgressionRow[];
}

export function generateBalanceReport(
  waves: readonly number[] = [1, 5, 10, 20, 30, 50, 75, 100, 125]
): BalanceInspectionReport {
  const waveSystem = new WaveSystem();

  const waveScaling: WaveBalanceRow[] = waves.map((wave) => {
    const plan = waveSystem.computeWavePlan(wave);
    const scoutHp = Math.round(
      GAME_BALANCE.enemyDefinitions.scout.baseHp * plan.hpMultiplier
    );
    const assaultHp = Math.round(
      GAME_BALANCE.enemyDefinitions.assault_tank.baseHp * plan.hpMultiplier
    );
    const heavyHp = Math.round(
      GAME_BALANCE.enemyDefinitions.heavy_tank.baseHp * plan.hpMultiplier
    );
    const runnerHp = Math.round(
      GAME_BALANCE.enemyDefinitions.runner.baseHp * plan.hpMultiplier
    );
    const artilleryHp = Math.round(
      GAME_BALANCE.enemyDefinitions.artillery.baseHp * plan.hpMultiplier
    );
    const enemyDamage = Math.round(
      GAME_BALANCE.enemyDefinitions.assault_tank.attackDamage *
        plan.damageMultiplier
    );

    const bossTier = Math.max(
      1,
      Math.floor(wave / GAME_BALANCE.waveProgression.bossWaveInterval)
    );
    const bossHp = plan.isBossWave
      ? Math.round(
          GAME_BALANCE.bossProgression.baseHp *
            (1 + (bossTier - 1) * GAME_BALANCE.bossProgression.hpScalePerBossTier) *
            (1 +
              Math.max(0, wave - GAME_BALANCE.waveProgression.bossWaveInterval) *
                GAME_BALANCE.bossProgression.hpWaveLinearFactor)
        )
      : null;
    const bossDamage = plan.isBossWave
      ? Math.round(
          GAME_BALANCE.bossProgression.attackDamage * plan.damageMultiplier
        )
      : null;

    const totalWaveCoins = plan.isBossWave
      ? plan.bossReward + plan.clearRewardGold
      : plan.totalEnemies * plan.normalEnemyReward + plan.clearRewardGold;

    const oneHourOffline = OfflineProgressSystem.calculateOfflineRewards({
      lastRewardTimestampMs: 1_000_000,
      nowMs: 1_000_000 + 3600 * 1000,
      waveNumber: wave,
    });

    return {
      wave,
      isBossWave: plan.isBossWave,
      totalEnemies: plan.totalEnemies,
      spawnIntervalSec: Math.round(plan.spawnIntervalSec * 100) / 100,
      hpMultiplier: Math.round(plan.hpMultiplier * 100) / 100,
      damageMultiplier: Math.round(plan.damageMultiplier * 100) / 100,
      speedMultiplier: Math.round(plan.speedMultiplier * 100) / 100,
      scoutHp,
      assaultHp,
      heavyHp,
      runnerHp,
      artilleryHp,
      bossHp,
      enemyDamage,
      bossDamage,
      normalEnemyCoins: plan.normalEnemyReward,
      bossCoins: plan.isBossWave ? plan.bossReward : null,
      clearRewardCoins: plan.clearRewardGold,
      totalWaveCoins,
      offlineCoinsPerHour: oneHourOffline?.coinsEarned ?? 0,
    };
  });

  const upgradeCheckpoints = [1, 5, 10, 20, 35, 50, 75, 100];
  const upgradeCosts: UpgradeCheckpointRow[] = GAME_BALANCE.tankUpgrades.map(
    (cfg) => {
      const levels = Array.from(
        new Set(
          upgradeCheckpoints
            .filter((lvl) => lvl <= cfg.maxLevel)
            .concat([cfg.maxLevel])
        )
      ).sort((a, b) => a - b);

      return {
        id: cfg.id,
        label: cfg.label,
        maxLevel: cfg.maxLevel,
        checkpoints: levels.map((lvl) => ({
          level: lvl,
          statValue: UpgradeSystem.computeStatValue(
            cfg.baseValue,
            cfg.perLevelBonus,
            lvl,
            cfg.maxValue
          ),
          nextCost: UpgradeSystem.computeCost(
            cfg.baseCost,
            cfg.costGrowth,
            lvl,
            cfg.softCapLevel,
            cfg.postCapLinearSlope
          ),
        })),
      };
    }
  );

  const weights = GAME_BALANCE.equipment.rarityWeights;
  const totalWeight = EQUIPMENT_RARITY_ORDER.reduce(
    (sum, r) => sum + weights[r],
    0
  );
  let expectedDismantle = 0;
  const rarities: ForgingProbabilityRow[] = EQUIPMENT_RARITY_ORDER.map(
    (rarity) => {
      const prob = weights[rarity] / totalWeight;
      const dismantleCoins =
        GAME_BALANCE.equipment.dismantleCoinsByRarity[rarity];
      expectedDismantle += prob * dismantleCoins;
      return {
        rarity,
        weight: weights[rarity],
        probabilityPct: Math.round(prob * 10000) / 100,
        statMultiplier: GAME_BALANCE.equipment.rarityStatMultipliers[rarity],
        specialEffectChancePct: Math.round(
          GAME_BALANCE.equipment.specialEffectChanceByRarity[rarity] * 100
        ),
        dismantleCoins,
      };
    }
  );

  const totalFragmentCost = GAME_BALANCE.skillCollection.upgradeCostsByLevel.reduce(
    (s, c) => s + c,
    0
  );

  const skillProgression: SkillProgressionRow[] = [
    {
      skillId: 'cannon',
      levels: GAME_BALANCE.skills.cannon.map((s, idx) => ({
        level: idx + 1,
        cooldownSec: s.interval,
        singleTargetDps:
          Math.round(((s.damage * s.salvoCount) / s.interval) * 10) / 10,
        multiTargetNotes: `salvo=${s.salvoCount}, pierce=${s.pierceCount}, range=${s.range}`,
      })),
      collectionMaxLevel: GAME_BALANCE.skillCollection.maxLevel,
      collectionTotalFragmentCost: totalFragmentCost,
    },
    {
      skillId: 'machine_gun',
      levels: GAME_BALANCE.skills.machine_gun.map((s, idx) => ({
        level: idx + 1,
        cooldownSec: s.interval,
        singleTargetDps:
          Math.round(((s.damage * s.bulletsPerBurst) / s.interval) * 10) / 10,
        multiTargetNotes: `burst=${s.bulletsPerBurst}, pierce=${s.pierceCount}, range=${s.range}`,
      })),
      collectionMaxLevel: GAME_BALANCE.skillCollection.maxLevel,
      collectionTotalFragmentCost: totalFragmentCost,
    },
    {
      skillId: 'rocket_barrage',
      levels: GAME_BALANCE.skills.rocket_barrage.map((s, idx) => ({
        level: idx + 1,
        cooldownSec: s.interval,
        singleTargetDps:
          Math.round(((s.damage * s.rockets) / s.interval) * 10) / 10,
        multiTargetNotes: `rockets=${s.rockets}, aoe=${s.aoeRadius}px, range=${s.range}`,
      })),
      collectionMaxLevel: GAME_BALANCE.skillCollection.maxLevel,
      collectionTotalFragmentCost: totalFragmentCost,
    },
    {
      skillId: 'mortar',
      levels: GAME_BALANCE.skills.mortar.map((s, idx) => ({
        level: idx + 1,
        cooldownSec: s.interval,
        singleTargetDps:
          Math.round(((s.damage * s.shells) / s.interval) * 10) / 10,
        multiTargetNotes: `shells=${s.shells}, aoe=${s.aoeRadius}px, range=${s.range}`,
      })),
      collectionMaxLevel: GAME_BALANCE.skillCollection.maxLevel,
      collectionTotalFragmentCost: totalFragmentCost,
    },
    {
      skillId: 'railgun',
      levels: GAME_BALANCE.skills.railgun.map((s, idx) => ({
        level: idx + 1,
        cooldownSec: s.interval,
        singleTargetDps: Math.round((s.damage / s.interval) * 10) / 10,
        multiTargetNotes: `pierce=${s.pierceCount}, lineDPS(3x)=${Math.round(((s.damage * 3) / s.interval) * 10) / 10}, range=${s.range}`,
      })),
      collectionMaxLevel: GAME_BALANCE.skillCollection.maxLevel,
      collectionTotalFragmentCost: totalFragmentCost,
    },
    {
      skillId: 'flame_thrower',
      levels: GAME_BALANCE.skills.flame_thrower.map((s, idx) => ({
        level: idx + 1,
        cooldownSec: s.interval,
        singleTargetDps: Math.round((s.damage / s.interval) * 10) / 10,
        multiTargetNotes: `innerDPS=${Math.round(((s.damage * s.closeBonusRatio) / s.interval) * 10) / 10}/target, range=${s.range}px`,
      })),
      collectionMaxLevel: GAME_BALANCE.skillCollection.maxLevel,
      collectionTotalFragmentCost: totalFragmentCost,
    },
    {
      skillId: 'tesla',
      levels: GAME_BALANCE.skills.tesla.map((s, idx) => {
        let totalMult = 0;
        for (let h = 0; h < s.chainTargets; h++) {
          totalMult += Math.pow(s.chainRetention, h);
        }
        return {
          level: idx + 1,
          cooldownSec: s.interval,
          singleTargetDps: Math.round((s.damage / s.interval) * 10) / 10,
          multiTargetNotes: `hops=${s.chainTargets}, chainDPS=${Math.round(((s.damage * totalMult) / s.interval) * 10) / 10}, radius=${s.chainRadius}px`,
        };
      }),
      collectionMaxLevel: GAME_BALANCE.skillCollection.maxLevel,
      collectionTotalFragmentCost: totalFragmentCost,
    },
    {
      skillId: 'landmines',
      levels: GAME_BALANCE.skills.landmines.map((s, idx) => ({
        level: idx + 1,
        cooldownSec: s.interval,
        singleTargetDps:
          Math.round(((s.damage * s.deployCount) / s.interval) * 10) / 10,
        multiTargetNotes: `deploy=${s.deployCount}, maxMines=${s.maxMines}, aoe=${s.aoeRadius}px`,
      })),
      collectionMaxLevel: GAME_BALANCE.skillCollection.maxLevel,
      collectionTotalFragmentCost: totalFragmentCost,
    },
  ];

  // Keep reference to SkillCollectionSystem / CurrencySystem helpers so inspector works standalone
  void CurrencySystem;
  void SkillCollectionSystem;

  return {
    waveScaling,
    upgradeCosts,
    forgingProbabilities: {
      forgeCostCoins: GAME_BALANCE.economy.forgeCostCoins,
      expectedDismantleReturnCoins: Math.round(expectedDismantle * 100) / 100,
      netExpectedForgeCostCoins:
        Math.round(
          (GAME_BALANCE.economy.forgeCostCoins - expectedDismantle) * 100
        ) / 100,
      rarities,
    },
    skillProgression,
  };
}
