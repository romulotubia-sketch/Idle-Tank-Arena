import { MonetizationOfferId } from '../types';

export interface OfflineRewardBonusConfig {
  readonly id: 'offline_reward_bonus';
  readonly enabled: boolean;
  readonly bonusMultiplier: number;
  readonly maxBonusCoins: number;
  readonly dailyLimit: number;
  readonly cooldownSec: number;
  readonly label: string;
  readonly shortDesc: string;
}

export interface OptionalCoinBonusConfig {
  readonly id: 'optional_coin_bonus';
  readonly enabled: boolean;
  readonly baseCoins: number;
  readonly coinsPerWave: number;
  readonly maxCoins: number;
  readonly dailyLimit: number;
  readonly cooldownSec: number;
  readonly label: string;
  readonly shortDesc: string;
}

export interface TemporaryBoostConfig {
  readonly id: 'temporary_boost';
  readonly enabled: boolean;
  readonly durationSec: number;
  readonly cooldownSec: number;
  readonly dailyLimit: number;
  readonly attackPowerMultiplier: number;
  readonly coinGainMultiplier: number;
  readonly label: string;
  readonly shortDesc: string;
}

export interface MonetizationConfig {
  readonly sdkConnected: boolean;
  readonly providerName: 'Playgama';
  readonly features: {
    readonly offlineRewardBonus: boolean;
    readonly optionalCoinBonus: boolean;
    readonly temporaryBoost: boolean;
  };
  readonly offers: {
    readonly offline_reward_bonus: OfflineRewardBonusConfig;
    readonly optional_coin_bonus: OptionalCoinBonusConfig;
    readonly temporary_boost: TemporaryBoostConfig;
  };
}

export const MONETIZATION_OFFER_IDS: readonly MonetizationOfferId[] = [
  'offline_reward_bonus',
  'optional_coin_bonus',
  'temporary_boost',
] as const;

export const MONETIZATION_CONFIG: MonetizationConfig = {
  // Remains false until the real Playgama Rewarded Ads SDK integration step
  sdkConnected: false,
  providerName: 'Playgama',
  features: {
    offlineRewardBonus: true,
    optionalCoinBonus: true,
    temporaryBoost: true,
  },
  offers: {
    offline_reward_bonus: {
      id: 'offline_reward_bonus',
      enabled: true,
      bonusMultiplier: 0.5, // +50% optional extra Coins on top of base offline Coins
      maxBonusCoins: 25000,
      dailyLimit: 5,
      cooldownSec: 0,
      label: 'Offline Reward Bonus',
      shortDesc: '+50% extra Coins on Offline Rewards',
    },
    optional_coin_bonus: {
      id: 'optional_coin_bonus',
      enabled: true,
      baseCoins: 150,
      coinsPerWave: 35,
      maxCoins: 5000,
      dailyLimit: 5,
      cooldownSec: 300,
      label: 'Supply Drop Bonus',
      shortDesc: 'Optional Coin supply drop scaled to wave',
    },
    temporary_boost: {
      id: 'temporary_boost',
      enabled: true,
      durationSec: 120,
      cooldownSec: 240,
      dailyLimit: 4,
      attackPowerMultiplier: 1.25,
      coinGainMultiplier: 1.35,
      label: 'Tactical Overcharge',
      shortDesc: '+25% Attack Power & +35% Coin Gain for 2m',
    },
  },
} as const;
