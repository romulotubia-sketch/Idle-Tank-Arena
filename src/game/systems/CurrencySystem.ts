import { ECONOMY_CONFIG, INITIAL_CURRENCIES, WAVE_CONFIG } from '../constants';
import { CurrencyBalances } from '../types';

export class CurrencySystem {
  private balances: CurrencyBalances = { ...INITIAL_CURRENCIES };

  static calculateNormalEnemyReward(waveNumber: number): number {
    const wave = Math.max(1, Math.floor(waveNumber));
    const scale = 1 + (wave - 1) * ECONOMY_CONFIG.normalEnemyScalingPerWave;
    return Math.max(1, Math.round(ECONOMY_CONFIG.normalEnemyBaseCoins * scale));
  }

  static calculateBossReward(waveNumber: number): number {
    const wave = Math.max(1, Math.floor(waveNumber));
    const bossTier = Math.max(
      1,
      Math.floor(wave / WAVE_CONFIG.bossWaveInterval)
    );
    const scale = 1 + (bossTier - 1) * ECONOMY_CONFIG.bossScalingPerTier;
    return Math.max(1, Math.round(ECONOMY_CONFIG.bossBaseCoins * scale));
  }

  static calculateWaveClearReward(waveNumber: number, isBossWave: boolean): number {
    const wave = Math.max(1, Math.floor(waveNumber));
    const scale = 1 + (wave - 1) * ECONOMY_CONFIG.waveClearScalingPerWave;
    const base = Math.round(ECONOMY_CONFIG.waveClearBaseCoins * scale);
    const finalAmount = isBossWave
      ? Math.round(base * ECONOMY_CONFIG.bossWaveClearMultiplier)
      : base;
    return Math.max(1, finalAmount);
  }

  static getSummonCost(): number {
    return ECONOMY_CONFIG.summonCostCoins;
  }

  getBalances(): CurrencyBalances {
    return { ...this.balances };
  }

  loadBalances(saved: CurrencyBalances): void {
    const sanitize = (val: unknown, fallback: number): number =>
      typeof val === 'number' && Number.isFinite(val)
        ? Math.max(0, Math.floor(val))
        : fallback;

    this.balances = {
      gold: sanitize(saved.gold, INITIAL_CURRENCIES.gold),
      scrap: sanitize(saved.scrap, INITIAL_CURRENCIES.scrap),
      gems: sanitize(saved.gems, INITIAL_CURRENCIES.gems),
    };
  }

  reset(): void {
    this.balances = { ...INITIAL_CURRENCIES };
  }

  canAfford(currency: keyof CurrencyBalances, amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0) return false;
    return this.balances[currency] >= Math.floor(amount);
  }

  add(currency: keyof CurrencyBalances, amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      return this.balances[currency];
    }
    const cleanAdd = Math.max(0, Math.round(amount));
    this.balances[currency] = Math.max(0, this.balances[currency] + cleanAdd);
    return this.balances[currency];
  }

  spend(currency: keyof CurrencyBalances, amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0) {
      return false;
    }
    const cleanSpend = Math.floor(amount);
    if (this.balances[currency] < cleanSpend) {
      return false;
    }
    this.balances[currency] = Math.max(0, this.balances[currency] - cleanSpend);
    return true;
  }
}
