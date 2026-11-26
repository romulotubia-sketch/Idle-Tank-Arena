import { OFFLINE_REWARD_CONFIG } from '../constants';
import { OfflineRewardSummary } from '../types';

export interface OfflineCalculationInput {
  lastRewardTimestampMs: number;
  nowMs?: number;
  waveNumber: number;
}

export class OfflineProgressSystem {
  static calculateOfflineRewards(
    input: OfflineCalculationInput
  ): OfflineRewardSummary | null {
    const nowMs =
      typeof input.nowMs === 'number' && Number.isFinite(input.nowMs)
        ? Math.floor(input.nowMs)
        : Date.now();
    const sourceTimestamp = input.lastRewardTimestampMs;

    if (
      typeof sourceTimestamp !== 'number' ||
      !Number.isFinite(sourceTimestamp) ||
      sourceTimestamp <= 0
    ) {
      return null;
    }

    // Prevent negative or zero elapsed time from granting rewards
    if (nowMs <= sourceTimestamp) {
      return null;
    }

    const rawElapsedSeconds = Math.floor((nowMs - sourceTimestamp) / 1000);
    if (rawElapsedSeconds < OFFLINE_REWARD_CONFIG.minElapsedSec) {
      return null;
    }

    const maxDurationSeconds = OFFLINE_REWARD_CONFIG.maxDurationSec;
    const effectiveSeconds = Math.min(rawElapsedSeconds, maxDurationSeconds);
    const wasCapped = rawElapsedSeconds > maxDurationSeconds;

    const waveUsed = Math.max(1, Math.floor(input.waveNumber || 1));
    const waveMultiplier =
      1 + (waveUsed - 1) * OFFLINE_REWARD_CONFIG.waveBonusMultiplierPerWave;
    const rawCoinsPerMinute =
      OFFLINE_REWARD_CONFIG.baseCoinsPerMinute *
      waveMultiplier *
      OFFLINE_REWARD_CONFIG.efficiency;

    const coinsPerMinuteRate = Math.round(rawCoinsPerMinute * 10) / 10;
    const coinsEarned = Math.max(
      1,
      Math.floor((effectiveSeconds / 60) * rawCoinsPerMinute)
    );

    return {
      elapsedSeconds: rawElapsedSeconds,
      effectiveSeconds,
      wasCapped,
      maxDurationSeconds,
      coinsEarned,
      coinsPerMinuteRate,
      efficiencyPct: Math.round(OFFLINE_REWARD_CONFIG.efficiency * 100),
      waveUsed,
      sourceTimestamp,
      calculatedAt: nowMs,
      claimed: false,
    };
  }

  static formatDuration(totalSeconds: number): string {
    const clean = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(clean / 3600);
    const minutes = Math.floor((clean % 3600) / 60);
    const seconds = clean % 60;

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }
}
