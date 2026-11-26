import { playgamaBridge } from '../../platform/playgamaBridge';
import {
  ActiveTemporaryBoostState,
  InterstitialStatusSnapshot,
  InterstitialTransitionId,
  MonetizationOfferId,
  MonetizationOfferStatus,
  MonetizationSnapshot,
  OfflineBonusPreview,
  SavedMonetizationState,
} from '../types';
import {
  MONETIZATION_CONFIG,
  MONETIZATION_OFFER_IDS,
} from './monetizationConfig';

export type MonetizationClaimFailureReason =
  | 'sdk_not_connected'
  | 'feature_disabled'
  | 'daily_limit_reached'
  | 'cooldown_active'
  | 'invalid_amount'
  | 'ad_in_progress'
  | 'ad_closed_early'
  | 'ad_failed';

export interface MonetizationRewardGrantResult {
  granted: boolean;
  reason?: MonetizationClaimFailureReason;
  offerId: MonetizationOfferId;
  bonusCoinsAwarded: number;
  boostActivated: boolean;
}

export interface InterstitialAttemptResult {
  shown: boolean;
  reason:
    | 'shown'
    | 'disabled'
    | 'unsupported'
    | 'active_combat'
    | 'cooldown'
    | 'gameplay_too_short'
    | 'ad_in_progress'
    | 'failed';
}

export function getMonetizationDayKey(nowMs: number = Date.now()): string {
  const safeMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  return new Date(safeMs).toISOString().slice(0, 10);
}

export class MonetizationSystem {
  private dayKey: string;
  private dailyUses: Record<MonetizationOfferId, number> = {
    offline_reward_bonus: 0,
    optional_coin_bonus: 0,
    temporary_boost: 0,
  };
  private cooldownRemainingSec: Record<MonetizationOfferId, number> = {
    offline_reward_bonus: 0,
    optional_coin_bonus: 0,
    temporary_boost: 0,
  };
  private activeBoost: ActiveTemporaryBoostState = {
    active: false,
    remainingSec: 0,
    totalSec: MONETIZATION_CONFIG.offers.temporary_boost.durationSec,
    attackPowerMultiplier: 1,
    coinGainMultiplier: 1,
  };
  private lastInterstitialAtMs: number | null = null;
  private rewardedRequestInFlight = false;

  constructor(nowMs: number = Date.now()) {
    this.dayKey = getMonetizationDayKey(nowMs);
  }

  private ensureCurrentDay(nowMs: number = Date.now()): boolean {
    const currentKey = getMonetizationDayKey(nowMs);
    if (currentKey === this.dayKey) {
      return false;
    }
    this.dayKey = currentKey;
    for (let i = 0; i < MONETIZATION_OFFER_IDS.length; i++) {
      const id = MONETIZATION_OFFER_IDS[i];
      this.dailyUses[id] = 0;
    }
    return true;
  }

  isSdkConnected(): boolean {
    return (
      MONETIZATION_CONFIG.sdkConnected &&
      MONETIZATION_CONFIG.features.rewardedAds &&
      playgamaBridge.isRewardedAdsSupported()
    );
  }

  isInterstitialSupported(): boolean {
    return (
      MONETIZATION_CONFIG.sdkConnected &&
      MONETIZATION_CONFIG.features.interstitialAds &&
      MONETIZATION_CONFIG.interstitial.enabled &&
      playgamaBridge.isInterstitialAdsSupported()
    );
  }

  isOfferEnabled(offerId: MonetizationOfferId): boolean {
    if (!MONETIZATION_CONFIG.features.rewardedAds) return false;
    switch (offerId) {
      case 'offline_reward_bonus':
        return (
          MONETIZATION_CONFIG.features.offlineRewardBonus &&
          MONETIZATION_CONFIG.offers.offline_reward_bonus.enabled
        );
      case 'optional_coin_bonus':
        return (
          MONETIZATION_CONFIG.features.optionalCoinBonus &&
          MONETIZATION_CONFIG.offers.optional_coin_bonus.enabled
        );
      case 'temporary_boost':
        return (
          MONETIZATION_CONFIG.features.temporaryBoost &&
          MONETIZATION_CONFIG.offers.temporary_boost.enabled
        );
    }
  }

  update(dt: number, isActive: boolean, nowMs: number = Date.now()): boolean {
    let changed = this.ensureCurrentDay(nowMs);
    if (!isActive || dt <= 0) {
      return changed;
    }

    for (let i = 0; i < MONETIZATION_OFFER_IDS.length; i++) {
      const id = MONETIZATION_OFFER_IDS[i];
      if (this.cooldownRemainingSec[id] > 0) {
        this.cooldownRemainingSec[id] = Math.max(
          0,
          this.cooldownRemainingSec[id] - dt
        );
        changed = true;
      }
    }

    if (this.activeBoost.active) {
      this.activeBoost.remainingSec = Math.max(
        0,
        this.activeBoost.remainingSec - dt
      );
      if (this.activeBoost.remainingSec <= 0) {
        this.clearTransientBoost();
      }
      changed = true;
    }

    return changed;
  }

  clearTransientBoost(): void {
    this.activeBoost = {
      active: false,
      remainingSec: 0,
      totalSec: MONETIZATION_CONFIG.offers.temporary_boost.durationSec,
      attackPowerMultiplier: 1,
      coinGainMultiplier: 1,
    };
  }

  getAttackPowerMultiplier(): number {
    return this.activeBoost.active
      ? this.activeBoost.attackPowerMultiplier
      : 1;
  }

  getCoinGainMultiplier(): number {
    return this.activeBoost.active ? this.activeBoost.coinGainMultiplier : 1;
  }

  getActiveBoostState(): ActiveTemporaryBoostState {
    return { ...this.activeBoost };
  }

  getOptionalCoinBonusAmount(wave: number): number {
    const cfg = MONETIZATION_CONFIG.offers.optional_coin_bonus;
    const cleanWave = Math.max(1, Math.floor(wave));
    return Math.min(
      cfg.maxCoins,
      Math.max(0, cfg.baseCoins + cleanWave * cfg.coinsPerWave)
    );
  }

  computeOfflineBonusPreview(
    baseCoins: number,
    nowMs: number = Date.now()
  ): OfflineBonusPreview {
    this.ensureCurrentDay(nowMs);
    const cfg = MONETIZATION_CONFIG.offers.offline_reward_bonus;
    const cleanBase = Math.max(0, Math.floor(baseCoins));
    const rawBonus = Math.round(cleanBase * cfg.bonusMultiplier);
    const bonusCoins = Math.min(cfg.maxBonusCoins, Math.max(0, rawBonus));
    const status = this.getOfferStatus('offline_reward_bonus', nowMs);

    return {
      enabled: status.enabled,
      sdkConnected: status.sdkConnected,
      bonusPct: Math.round(cfg.bonusMultiplier * 100),
      bonusCoins,
      totalWithBonus: cleanBase + bonusCoins,
      dailyRemaining: status.dailyRemaining,
      dailyLimit: status.dailyLimit,
    };
  }

  getOfferStatus(
    offerId: MonetizationOfferId,
    nowMs: number = Date.now()
  ): MonetizationOfferStatus {
    this.ensureCurrentDay(nowMs);
    const cfg = MONETIZATION_CONFIG.offers[offerId];
    const enabled = this.isOfferEnabled(offerId);
    const sdkConnected = this.isSdkConnected();
    const dailyUsed = this.dailyUses[offerId] ?? 0;
    const dailyRemaining = Math.max(0, cfg.dailyLimit - dailyUsed);
    const cooldownRemainingSec = Math.max(
      0,
      Math.ceil(this.cooldownRemainingSec[offerId] ?? 0)
    );
    const canClaim =
      enabled &&
      sdkConnected &&
      dailyRemaining > 0 &&
      cooldownRemainingSec <= 0 &&
      !this.rewardedRequestInFlight &&
      !playgamaBridge.isAdPlaying();

    return {
      id: offerId,
      label: cfg.label,
      shortDesc: cfg.shortDesc,
      enabled,
      sdkConnected,
      dailyUsed,
      dailyLimit: cfg.dailyLimit,
      dailyRemaining,
      cooldownSec: cfg.cooldownSec,
      cooldownRemainingSec,
      canClaim,
    };
  }

  getInterstitialMinIntervalSec(): number {
    return Math.max(
      MONETIZATION_CONFIG.interstitial.minIntervalSec,
      playgamaBridge.getMinimumDelayBetweenInterstitialSec()
    );
  }

  getInterstitialStatus(nowMs: number = Date.now()): InterstitialStatusSnapshot {
    const minIntervalSec = this.getInterstitialMinIntervalSec();
    let cooldownRemainingSec = 0;
    if (this.lastInterstitialAtMs !== null) {
      const elapsedSec = Math.max(0, (nowMs - this.lastInterstitialAtMs) / 1000);
      cooldownRemainingSec = Math.max(
        0,
        Math.ceil(minIntervalSec - elapsedSec)
      );
    }

    return {
      enabled:
        MONETIZATION_CONFIG.sdkConnected &&
        MONETIZATION_CONFIG.features.interstitialAds &&
        MONETIZATION_CONFIG.interstitial.enabled,
      supported: this.isInterstitialSupported(),
      cooldownRemainingSec,
      minIntervalSec,
    };
  }

  getSnapshot(
    wave: number,
    offlineBaseCoins: number | null,
    nowMs: number = Date.now()
  ): MonetizationSnapshot {
    this.ensureCurrentDay(nowMs);
    return {
      providerName: MONETIZATION_CONFIG.providerName,
      sdkConnected: this.isSdkConnected(),
      isAdPlaying: playgamaBridge.isAdPlaying() || this.rewardedRequestInFlight,
      dayKey: this.dayKey,
      activeBoost: this.getActiveBoostState(),
      optionalCoinBonusPreview: this.getOptionalCoinBonusAmount(wave),
      offlineBonusPreview:
        offlineBaseCoins !== null
          ? this.computeOfflineBonusPreview(offlineBaseCoins, nowMs)
          : null,
      offers: {
        offline_reward_bonus: this.getOfferStatus('offline_reward_bonus', nowMs),
        optional_coin_bonus: this.getOfferStatus('optional_coin_bonus', nowMs),
        temporary_boost: this.getOfferStatus('temporary_boost', nowMs),
      },
      interstitial: this.getInterstitialStatus(nowMs),
    };
  }

  /**
   * Synchronous pre-flight validation for rewarded offers.
   * Does not mutate state or grant unverified rewards.
   */
  tryRequestPreparedOffer(
    offerId: MonetizationOfferId,
    params: { baseOfflineCoins?: number; wave?: number } = {},
    nowMs: number = Date.now()
  ): MonetizationRewardGrantResult {
    this.ensureCurrentDay(nowMs);
    if (!this.isOfferEnabled(offerId)) {
      return {
        granted: false,
        reason: 'feature_disabled',
        offerId,
        bonusCoinsAwarded: 0,
        boostActivated: false,
      };
    }

    if (!this.isSdkConnected()) {
      return {
        granted: false,
        reason: 'sdk_not_connected',
        offerId,
        bonusCoinsAwarded: 0,
        boostActivated: false,
      };
    }

    if (this.rewardedRequestInFlight || playgamaBridge.isAdPlaying()) {
      return {
        granted: false,
        reason: 'ad_in_progress',
        offerId,
        bonusCoinsAwarded: 0,
        boostActivated: false,
      };
    }

    const status = this.getOfferStatus(offerId, nowMs);
    if (status.dailyRemaining <= 0) {
      return {
        granted: false,
        reason: 'daily_limit_reached',
        offerId,
        bonusCoinsAwarded: 0,
        boostActivated: false,
      };
    }
    if (status.cooldownRemainingSec > 0) {
      return {
        granted: false,
        reason: 'cooldown_active',
        offerId,
        bonusCoinsAwarded: 0,
        boostActivated: false,
      };
    }

    if (offerId === 'offline_reward_bonus') {
      const preview = this.computeOfflineBonusPreview(
        params.baseOfflineCoins ?? 0,
        nowMs
      );
      if (preview.bonusCoins <= 0) {
        return {
          granted: false,
          reason: 'invalid_amount',
          offerId,
          bonusCoinsAwarded: 0,
          boostActivated: false,
        };
      }
    }

    if (offerId === 'optional_coin_bonus') {
      const amount = this.getOptionalCoinBonusAmount(params.wave ?? 1);
      if (amount <= 0) {
        return {
          granted: false,
          reason: 'invalid_amount',
          offerId,
          bonusCoinsAwarded: 0,
          boostActivated: false,
        };
      }
    }

    return {
      granted: false,
      reason: 'sdk_not_connected',
      offerId,
      bonusCoinsAwarded: 0,
      boostActivated: false,
    };
  }

  /**
   * Executes a live Playgama Rewarded Ad and grants the reward ONLY after
   * the SDK confirms 'rewarded' completion. Prevents concurrent or duplicate claims.
   */
  async executeRewardedOffer(
    offerId: MonetizationOfferId,
    params: { baseOfflineCoins?: number; wave?: number } = {},
    nowMs: number = Date.now()
  ): Promise<MonetizationRewardGrantResult> {
    const preflight = this.tryRequestPreparedOffer(offerId, params, nowMs);
    // All reasons except placeholder 'sdk_not_connected' after passing sdk check should abort
    if (
      preflight.reason !== 'sdk_not_connected' ||
      !this.isSdkConnected()
    ) {
      return preflight;
    }

    this.rewardedRequestInFlight = true;
    try {
      const placementId = MONETIZATION_CONFIG.offers[offerId].placementId;
      const adRes = await playgamaBridge.showRewardedAd(placementId);

      if (!adRes.rewarded) {
        const mappedReason: MonetizationClaimFailureReason =
          adRes.status === 'closed_early'
            ? 'ad_closed_early'
            : adRes.status === 'unavailable'
              ? 'sdk_not_connected'
              : adRes.status === 'in_progress'
                ? 'ad_in_progress'
                : 'ad_failed';

        return {
          granted: false,
          reason: mappedReason,
          offerId,
          bonusCoinsAwarded: 0,
          boostActivated: false,
        };
      }

      return this.applyVerifiedReward(offerId, params, Date.now());
    } finally {
      this.rewardedRequestInFlight = false;
    }
  }

  /**
   * Checks whether an interstitial ad can safely be shown at a non-combat transition.
   */
  canShowInterstitial(
    transition: InterstitialTransitionId,
    context: { isCombatActive: boolean; gameplayElapsedSec: number },
    nowMs: number = Date.now()
  ): { allowed: boolean; reason: InterstitialAttemptResult['reason'] } {
    if (context.isCombatActive) {
      return { allowed: false, reason: 'active_combat' };
    }
    if (
      !MONETIZATION_CONFIG.sdkConnected ||
      !MONETIZATION_CONFIG.features.interstitialAds ||
      !MONETIZATION_CONFIG.interstitial.enabled ||
      !MONETIZATION_CONFIG.interstitial.allowedTransitions[transition]
    ) {
      return { allowed: false, reason: 'disabled' };
    }
    if (!this.isInterstitialSupported()) {
      return { allowed: false, reason: 'unsupported' };
    }
    if (this.rewardedRequestInFlight || playgamaBridge.isAdPlaying()) {
      return { allowed: false, reason: 'ad_in_progress' };
    }
    if (
      context.gameplayElapsedSec <
      MONETIZATION_CONFIG.interstitial.minGameplaySecBeforeFirst
    ) {
      return { allowed: false, reason: 'gameplay_too_short' };
    }

    const status = this.getInterstitialStatus(nowMs);
    if (status.cooldownRemainingSec > 0) {
      return { allowed: false, reason: 'cooldown' };
    }

    return { allowed: true, reason: 'shown' };
  }

  async executeTransitionInterstitial(
    transition: InterstitialTransitionId,
    context: { isCombatActive: boolean; gameplayElapsedSec: number },
    nowMs: number = Date.now()
  ): Promise<InterstitialAttemptResult> {
    const check = this.canShowInterstitial(transition, context, nowMs);
    if (!check.allowed) {
      return { shown: false, reason: check.reason };
    }

    const placementId = MONETIZATION_CONFIG.interstitial.placements[transition];
    const res = await playgamaBridge.showInterstitialAd(placementId);
    if (res.shown) {
      this.lastInterstitialAtMs = Date.now();
      return { shown: true, reason: 'shown' };
    }
    if (res.status === 'unavailable') {
      return { shown: false, reason: 'unsupported' };
    }
    if (res.status === 'in_progress') {
      return { shown: false, reason: 'ad_in_progress' };
    }
    return { shown: false, reason: 'failed' };
  }

  /**
   * Executes a verified rewarded-ad grant after Playgama SDK confirms completion.
   * Enforces enabled flags, daily limits, cooldowns, and reward caps cleanly.
   */
  applyVerifiedReward(
    offerId: MonetizationOfferId,
    params: { baseOfflineCoins?: number; wave?: number } = {},
    nowMs: number = Date.now()
  ): MonetizationRewardGrantResult {
    this.ensureCurrentDay(nowMs);
    if (!this.isOfferEnabled(offerId)) {
      return {
        granted: false,
        reason: 'feature_disabled',
        offerId,
        bonusCoinsAwarded: 0,
        boostActivated: false,
      };
    }

    const cfg = MONETIZATION_CONFIG.offers[offerId];
    if (this.dailyUses[offerId] >= cfg.dailyLimit) {
      return {
        granted: false,
        reason: 'daily_limit_reached',
        offerId,
        bonusCoinsAwarded: 0,
        boostActivated: false,
      };
    }
    if (this.cooldownRemainingSec[offerId] > 0) {
      return {
        granted: false,
        reason: 'cooldown_active',
        offerId,
        bonusCoinsAwarded: 0,
        boostActivated: false,
      };
    }

    if (offerId === 'offline_reward_bonus') {
      const baseCoins = Math.max(0, Math.floor(params.baseOfflineCoins ?? 0));
      const preview = this.computeOfflineBonusPreview(baseCoins, nowMs);
      if (preview.bonusCoins <= 0) {
        return {
          granted: false,
          reason: 'invalid_amount',
          offerId,
          bonusCoinsAwarded: 0,
          boostActivated: false,
        };
      }
      this.dailyUses[offerId] += 1;
      this.cooldownRemainingSec[offerId] = cfg.cooldownSec;
      return {
        granted: true,
        offerId,
        bonusCoinsAwarded: preview.bonusCoins,
        boostActivated: false,
      };
    }

    if (offerId === 'optional_coin_bonus') {
      const amount = this.getOptionalCoinBonusAmount(params.wave ?? 1);
      if (amount <= 0) {
        return {
          granted: false,
          reason: 'invalid_amount',
          offerId,
          bonusCoinsAwarded: 0,
          boostActivated: false,
        };
      }
      this.dailyUses[offerId] += 1;
      this.cooldownRemainingSec[offerId] = cfg.cooldownSec;
      return {
        granted: true,
        offerId,
        bonusCoinsAwarded: amount,
        boostActivated: false,
      };
    }

    const boostCfg = MONETIZATION_CONFIG.offers.temporary_boost;
    this.dailyUses.temporary_boost += 1;
    this.cooldownRemainingSec.temporary_boost = boostCfg.cooldownSec;
    this.activeBoost = {
      active: true,
      remainingSec: boostCfg.durationSec,
      totalSec: boostCfg.durationSec,
      attackPowerMultiplier: boostCfg.attackPowerMultiplier,
      coinGainMultiplier: boostCfg.coinGainMultiplier,
    };

    return {
      granted: true,
      offerId: 'temporary_boost',
      bonusCoinsAwarded: 0,
      boostActivated: true,
    };
  }

  exportState(nowMs: number = Date.now()): SavedMonetizationState {
    this.ensureCurrentDay(nowMs);
    return {
      dayKey: this.dayKey,
      dailyUses: { ...this.dailyUses },
      cooldownRemainingSec: {
        offline_reward_bonus: Math.max(
          0,
          Math.ceil(this.cooldownRemainingSec.offline_reward_bonus)
        ),
        optional_coin_bonus: Math.max(
          0,
          Math.ceil(this.cooldownRemainingSec.optional_coin_bonus)
        ),
        temporary_boost: Math.max(
          0,
          Math.ceil(this.cooldownRemainingSec.temporary_boost)
        ),
      },
    };
  }

  loadState(
    saved?: SavedMonetizationState,
    nowMs: number = Date.now()
  ): void {
    const currentKey = getMonetizationDayKey(nowMs);
    this.clearTransientBoost();
    this.dayKey = currentKey;
    this.dailyUses = {
      offline_reward_bonus: 0,
      optional_coin_bonus: 0,
      temporary_boost: 0,
    };
    this.cooldownRemainingSec = {
      offline_reward_bonus: 0,
      optional_coin_bonus: 0,
      temporary_boost: 0,
    };

    if (!saved || typeof saved !== 'object') return;

    if (typeof saved.dayKey === 'string' && saved.dayKey === currentKey) {
      for (let i = 0; i < MONETIZATION_OFFER_IDS.length; i++) {
        const id = MONETIZATION_OFFER_IDS[i];
        const rawUses = saved.dailyUses?.[id];
        const maxUses = MONETIZATION_CONFIG.offers[id].dailyLimit;
        if (typeof rawUses === 'number' && Number.isFinite(rawUses)) {
          this.dailyUses[id] = Math.max(
            0,
            Math.min(maxUses, Math.floor(rawUses))
          );
        }
      }
    }

    if (
      saved.cooldownRemainingSec &&
      typeof saved.cooldownRemainingSec === 'object'
    ) {
      for (let i = 0; i < MONETIZATION_OFFER_IDS.length; i++) {
        const id = MONETIZATION_OFFER_IDS[i];
        const rawCd = saved.cooldownRemainingSec[id];
        const maxCd = MONETIZATION_CONFIG.offers[id].cooldownSec;
        if (typeof rawCd === 'number' && Number.isFinite(rawCd)) {
          this.cooldownRemainingSec[id] = Math.max(0, Math.min(maxCd, rawCd));
        }
      }
    }
  }
}
