import { Clock, Coins } from 'lucide-react';
import { OfflineProgressSystem } from '../game/systems/OfflineProgressSystem';
import { OfflineRewardSummary } from '../game/types';

interface OfflineRewardModalProps {
  reward: OfflineRewardSummary;
  onClaim: () => void;
}

export function OfflineRewardModal({
  reward,
  onClaim,
}: OfflineRewardModalProps) {
  const durationLabel = OfflineProgressSystem.formatDuration(
    reward.effectiveSeconds
  );
  const maxHours = Math.round(reward.maxDurationSeconds / 3600);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#0B0F14]/82 backdrop-blur-xs p-3 sm:p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-reward-heading"
    >
      <div className="w-full max-w-sm max-h-full overflow-y-auto panel-scroll bg-[#131920]/98 border border-[#334155] rounded-xl shadow-2xl animate-toast-in">
        <header className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-white/10 bg-[#18202A]">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <h2
              id="offline-reward-heading"
              className="text-sm font-bold text-white tracking-tight truncate"
            >
              Offline Rewards
            </h2>
          </div>
          <span className="font-mono-tabular text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
            Wave {reward.waveUsed}
          </span>
        </header>

        <div className="p-3.5 sm:p-4 flex flex-col gap-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            Your automated defense battery continued patrolling while you were
            away.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#10151B] border border-[#334155] rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-slate-400 mb-0.5">Time Away</div>
              <div className="font-mono-tabular text-base sm:text-lg font-bold text-slate-100">
                {durationLabel}
              </div>
              {reward.wasCapped && (
                <div className="text-[10px] text-amber-300/90 mt-0.5">
                  Capped at {maxHours}h max
                </div>
              )}
            </div>

            <div className="bg-[#10151B] border border-amber-500/35 rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-slate-400 mb-0.5">
                Coins Earned
              </div>
              <div className="flex items-center gap-1.5 font-mono-tabular text-base sm:text-lg font-bold text-amber-300">
                <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                <span>+{reward.coinsEarned.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 font-mono-tabular pt-0.5">
            <span>{reward.efficiencyPct}% offline efficiency</span>
            <span aria-hidden="true">·</span>
            <span>{reward.coinsPerMinuteRate} Coins/min</span>
            <span aria-hidden="true">·</span>
            <span>Coins only</span>
          </div>

          <button
            type="button"
            disabled={reward.claimed}
            onClick={onClaim}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            Claim Rewards
          </button>
        </div>
      </div>
    </div>
  );
}
