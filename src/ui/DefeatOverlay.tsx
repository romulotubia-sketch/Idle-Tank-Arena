import { BattleSummary } from '../game/types';

interface DefeatOverlayProps {
  waveReached: number;
  battle: BattleSummary;
  onRestart: () => void;
  onReturnToTitle: () => void;
}

function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export function DefeatOverlay({
  waveReached,
  battle,
  onRestart,
  onReturnToTitle,
}: DefeatOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#0F1318]/82 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="defeat-heading"
    >
      <div className="w-full max-w-sm max-h-full overflow-y-auto bg-[#1B222B] border-2 border-rose-500/45 rounded-xl p-4 sm:p-5 shadow-2xl text-center">
        <div className="text-xs font-semibold text-rose-400 tracking-wide mb-1">
          Tank Destroyed
        </div>
        <h2
          id="defeat-heading"
          className="font-display text-3xl font-bold text-white mb-2"
        >
          Battle Ended
        </h2>
        <p className="text-xs text-slate-300 mb-4">
          Your tank hull integrity reached zero. Ready for redeployment.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-[#12171E] border border-[#334155] rounded-lg px-2 py-2">
            <div className="text-[11px] text-slate-400">Wave</div>
            <div className="font-mono-tabular text-lg font-bold text-white">
              {waveReached}
            </div>
          </div>
          <div className="bg-[#12171E] border border-[#334155] rounded-lg px-2 py-2">
            <div className="text-[11px] text-slate-400">Defeated</div>
            <div className="font-mono-tabular text-lg font-bold text-amber-300">
              {battle.enemiesDefeated}
            </div>
          </div>
          <div className="bg-[#12171E] border border-[#334155] rounded-lg px-2 py-2">
            <div className="text-[11px] text-slate-400">Survived</div>
            <div className="font-mono-tabular text-lg font-bold text-slate-100">
              {formatDuration(battle.elapsedSeconds)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Restart Battle
          </button>
          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-[#12171E] hover:bg-[#171E27] border border-[#334155] text-slate-300 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}
