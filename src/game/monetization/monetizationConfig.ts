import { InterstitialTransitionId, MonetizationOfferId } from '../types';

export interface OfflineRewardBonusConfig {
  readonly id: 'offline_reward_bonus';
  readonly placementId: string;
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
  readonly placementId: string;
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
  readonly placementId: string;
  readonly enabled: boolean;
  readonly durationSec: number;
  readonly cooldownSec: number;
  readonly dailyLimit: number;
  readonly attackPowerMultiplier: number;
  readonly coinGainMultiplier: number;
  readonly label: string;
  readonly shortDesc: string;
}

export interface InterstitialConfig {
  readonly enabled: boolean;
  readonly minIntervalSec: number;
  readonly minGameplaySecBeforeFirst: number;
  readonly allowedTransitions: Record<InterstitialTransitionId, boolean>;
  readonly placements: Record<InterstitialTransitionId, string>;
}

export interface MonetizationConfig {
  // Master switch allowing runtime Playgama Bridge SDK ad availability detection
  readonly sdkConnected: boolean;
  readonly providerName: 'Playgama';
  readonly features: {
    readonly rewardedAds: boolean;
    readonly interstitialAds: boolean;
    readonly offlineRewardBonus: boolean;
    readonly optionalCoinBonus: boolean;
    readonly temporaryBoost: boolean;
  };
  readonly adBehavior: {
    readonly pauseGameplayDuringAds: boolean;
    readonly muteAudioDuringAds: boolean;
    readonly allowAdFreeFallback: boolean;
  };
  readonly interstitial: InterstitialConfig;
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
  sdkConnected: true,
  providerName: 'Playgama',
  features: {
    rewardedAds: true,
    interstitialAds: true,
    offlineRewardBonus: true,
    optionalCoinBonus: true,
    temporaryBoost: true,
  },
  adBehavior: {
    pauseGameplayDuringAds: true,
    muteAudioDuringAds: true,
    allowAdFreeFallback: true,
  },
  interstitial: {
    enabled: true,
    minIntervalSec: 90,
    minGameplaySecBeforeFirst: 45,
    allowedTransitions: {
      return_to_title: true,
      battle_restart: true,
    },
    placements: {
      return_to_title: 'title_return',
      battle_restart: 'battle_restart',
    },
  },
  offers: {
    offline_reward_bonus: {
      id: 'offline_reward_bonus',
      placementId: 'offline_reward_bonus',
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
      placementId: 'optional_coin_bonus',
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
      placementId: 'temporary_boost',
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
