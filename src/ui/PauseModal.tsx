interface PauseModalProps {
  soundEnabled: boolean;
  showRangeRing: boolean;
  onResume: () => void;
  onToggleSound: () => void;
  onToggleRangeRing: () => void;
  onReturnToTitle: () => void;
}

export function PauseModal({
  soundEnabled,
  showRangeRing,
  onResume,
  onToggleSound,
  onToggleRangeRing,
  onReturnToTitle,
}: PauseModalProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#0F1318]/80 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-heading"
    >
      <div className="w-full max-w-sm max-h-full overflow-y-auto bg-[#1B222B] border-2 border-[#334155] rounded-xl p-4 sm:p-5 shadow-2xl">
        <h2
          id="pause-heading"
          className="font-display text-2xl font-bold text-white mb-1"
        >
          Settings
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Arena paused. Adjust battle display and audio options.
        </p>

        <div className="flex flex-col gap-2 mb-4">
          <button
            type="button"
            onClick={onToggleSound}
            className="flex items-center justify-between w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#12171E] hover:bg-[#171E27] border border-[#334155] text-sm text-slate-200 transition-colors"
          >
            <span>Sound Effects</span>
            <span className="font-mono-tabular text-xs font-bold text-amber-400">
              {soundEnabled ? 'On' : 'Off'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleRangeRing}
            className="flex items-center justify-between w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#12171E] hover:bg-[#171E27] border border-[#334155] text-sm text-slate-200 transition-colors"
          >
            <span>Tactical Range Ring</span>
            <span className="font-mono-tabular text-xs font-bold text-amber-400">
              {showRangeRing ? 'Visible' : 'Hidden'}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap shrink-0"
          >
            Resume Battle
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
