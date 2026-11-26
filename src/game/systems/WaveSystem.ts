import { INITIAL_WAVE_STATE, WAVE_CONFIG } from '../constants';
import { WaveState } from '../types';
import { CurrencySystem } from './CurrencySystem';

export interface WavePlan {
  wave: number;
  isBossWave: boolean;
  totalEnemies: number;
  spawnIntervalSec: number;
  hpMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
  normalEnemyReward: number;
  bossReward: number;
  clearRewardGold: number;
}

export interface WaveCompletedEvent {
  wave: number;
  isBossWave: boolean;
  rewardGold: number;
  nextWave: number;
}

export interface WaveStepResult {
  completedEvent: WaveCompletedEvent | null;
  startedWave: number | null;
  startedBossWave: boolean;
}

export class WaveSystem {
  private state: WaveState;
  private currentPlan: WavePlan;
  private lastRewardedWave = 0;

  constructor() {
    this.state = {
      ...INITIAL_WAVE_STATE,
      enemiesSpawned: 0,
      enemiesDefeatedInWave: 0,
      isTransitioning: false,
      transitionRemainingSec: 0,
    };
    this.currentPlan = this.computeWavePlan(1);
    this.applyPlanToState(1);
  }

  getState(): WaveState {
    return { ...this.state };
  }

  getCurrentPlan(): WavePlan {
    return this.currentPlan;
  }

  exportPersistentState(): WaveState {
    const plan = this.computeWavePlan(this.state.currentWave);
    return {
      currentWave: plan.wave,
      highestWave: Math.max(this.state.highestWave, plan.wave),
      enemiesRemaining: plan.totalEnemies,
      enemiesTotal: plan.totalEnemies,
      enemiesSpawned: 0,
      enemiesDefeatedInWave: 0,
      isBossWave: plan.isBossWave,
      isTransitioning: false,
      transitionRemainingSec: 0,
    };
  }

  loadState(saved?: Partial<WaveState>): void {
    if (!saved || typeof saved !== 'object') return;
    const savedCurrent =
      typeof saved.currentWave === 'number' &&
      Number.isFinite(saved.currentWave) &&
      saved.currentWave >= 1
        ? Math.floor(saved.currentWave)
        : 1;
    const savedHigh =
      typeof saved.highestWave === 'number' &&
      Number.isFinite(saved.highestWave) &&
      saved.highestWave >= 1
        ? Math.floor(saved.highestWave)
        : 1;

    this.lastRewardedWave = Math.max(0, savedCurrent - 1);
    this.state.highestWave = Math.max(1, savedHigh, savedCurrent);
    this.applyPlanToState(savedCurrent);
  }

  restartWave(waveNumber: number): void {
    const safeWave = Math.max(1, Math.floor(waveNumber));
    this.lastRewardedWave = Math.max(0, safeWave - 1);
    this.applyPlanToState(safeWave);
  }

  resetForNewRun(): void {
    this.lastRewardedWave = 0;
    this.applyPlanToState(1);
  }

  reset(): void {
    this.state.highestWave = 1;
    this.resetForNewRun();
  }

  computeWavePlan(waveNumber: number): WavePlan {
    const wave = Math.max(1, Math.floor(waveNumber));
    const isBossWave = wave % WAVE_CONFIG.bossWaveInterval === 0;
    const wOffset = wave - 1;

    const totalEnemies = isBossWave
      ? 1
      : Math.min(
          WAVE_CONFIG.maxEnemiesPerWave,
          WAVE_CONFIG.baseEnemyCount + wOffset * WAVE_CONFIG.enemiesPerWaveStep
        );

    const spawnIntervalSec = Math.max(
      WAVE_CONFIG.minSpawnIntervalSec,
      WAVE_CONFIG.baseSpawnIntervalSec -
        wOffset * WAVE_CONFIG.spawnIntervalDecayPerWave
    );

    const tierBonus =
      Math.floor(wOffset / 5) * WAVE_CONFIG.hpTierBonusPer5Waves;
    const lateHpWaves = Math.max(0, wave - WAVE_CONFIG.hpLateWaveThreshold);
    const hpMultiplier =
      1 +
      wOffset * WAVE_CONFIG.hpGrowthPerWave +
      tierBonus +
      lateHpWaves * WAVE_CONFIG.hpLateWaveBonusPerWave;

    const lateDmgWaves = Math.max(
      0,
      wave - WAVE_CONFIG.damageLateWaveThreshold
    );
    const damageMultiplier =
      1 +
      wOffset * WAVE_CONFIG.damageGrowthPerWave +
      lateDmgWaves * WAVE_CONFIG.damageLateWaveBonusPerWave;

    const speedMultiplier = Math.min(
      WAVE_CONFIG.maxSpeedMultiplier,
      1 + wOffset * WAVE_CONFIG.speedGrowthPerWave
    );

    const normalEnemyReward = CurrencySystem.calculateNormalEnemyReward(wave);
    const bossReward = CurrencySystem.calculateBossReward(wave);
    const clearRewardGold = CurrencySystem.calculateWaveClearReward(
      wave,
      isBossWave
    );

    return {
      wave,
      isBossWave,
      totalEnemies,
      spawnIntervalSec,
      hpMultiplier,
      damageMultiplier,
      speedMultiplier,
      normalEnemyReward,
      bossReward,
      clearRewardGold,
    };
  }

  canSpawnMoreEnemies(): boolean {
    if (this.state.isTransitioning) return false;
    return this.state.enemiesSpawned < this.state.enemiesTotal;
  }

  recordEnemySpawned(): void {
    if (this.state.isTransitioning) return;
    if (this.state.enemiesSpawned < this.state.enemiesTotal) {
      this.state.enemiesSpawned++;
    }
  }

  recordEnemyDefeated(): void {
    if (this.state.enemiesDefeatedInWave < this.state.enemiesTotal) {
      this.state.enemiesDefeatedInWave++;
    }
    this.state.enemiesRemaining = Math.max(
      0,
      this.state.enemiesTotal - this.state.enemiesDefeatedInWave
    );
  }

  update(dt: number, activeAliveEnemies: number): WaveStepResult {
    const step: WaveStepResult = {
      completedEvent: null,
      startedWave: null,
      startedBossWave: false,
    };

    if (this.state.isTransitioning) {
      this.state.transitionRemainingSec = Math.max(
        0,
        this.state.transitionRemainingSec - dt
      );
      if (this.state.transitionRemainingSec <= 0) {
        const nextWave = this.state.currentWave + 1;
        this.applyPlanToState(nextWave);
        step.startedWave = nextWave;
        step.startedBossWave = this.state.isBossWave;
      }
      return step;
    }

    // Wave completes ONLY when all required enemies (or boss) have spawned and been defeated,
    // and zero living enemies remain on the battlefield.
    const allSpawned = this.state.enemiesSpawned >= this.state.enemiesTotal;
    const allDefeated =
      this.state.enemiesDefeatedInWave >= this.state.enemiesTotal;

    if (allSpawned && allDefeated && activeAliveEnemies === 0) {
      // Guard against duplicate wave completion or duplicate reward events
      if (this.lastRewardedWave !== this.state.currentWave) {
        this.lastRewardedWave = this.state.currentWave;
        this.state.isTransitioning = true;
        this.state.transitionRemainingSec = WAVE_CONFIG.waveTransitionDelaySec;
        this.state.enemiesRemaining = 0;

        step.completedEvent = {
          wave: this.state.currentWave,
          isBossWave: this.state.isBossWave,
          rewardGold: this.currentPlan.clearRewardGold,
          nextWave: this.state.currentWave + 1,
        };
      }
    }

    return step;
  }

  private applyPlanToState(waveNumber: number): void {
    this.currentPlan = this.computeWavePlan(waveNumber);
    this.state.currentWave = this.currentPlan.wave;
    this.state.highestWave = Math.max(
      this.state.highestWave,
      this.currentPlan.wave
    );
    this.state.enemiesTotal = this.currentPlan.totalEnemies;
    this.state.enemiesSpawned = 0;
    this.state.enemiesDefeatedInWave = 0;
    this.state.enemiesRemaining = this.currentPlan.totalEnemies;
    this.state.isBossWave = this.currentPlan.isBossWave;
    this.state.isTransitioning = false;
    this.state.transitionRemainingSec = 0;
  }
}
