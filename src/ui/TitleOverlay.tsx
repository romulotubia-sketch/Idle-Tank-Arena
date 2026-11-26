interface TitleOverlayProps {
  highestWave: number;
  isInitializing?: boolean;
  onStart: () => void;
}

export function TitleOverlay({
  highestWave,
  isInitializing = false,
  onStart,
}: TitleOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#0F1318]/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="title-heading"
    >
      <div className="w-full max-w-md max-h-full overflow-y-auto bg-[#191F27] border border-white/12 rounded-xl p-4 sm:p-6 shadow-2xl text-center">
        <div className="text-xs font-medium text-amber-400 tracking-wide mb-1.5">
          Top-Down Idle Tank Survival
        </div>
        <h1
          id="title-heading"
          className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white mb-2 sm:mb-3 text-balance"
        >
          Idle Tank Arena
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4 sm:mb-5">
          Command an armored defense platform in an endless tactical arena.
          Core systems are online and ready for wave deployment.
        </p>

        <div className="flex items-center justify-center gap-3 text-xs text-slate-400 mb-4 sm:mb-6 font-mono-tabular">
          <span>Best Wave {highestWave}</span>
          <span aria-hidden="true">·</span>
          <span>Landscape Ready</span>
        </div>

        <button
          type="button"
          disabled={isInitializing}
          onClick={onStart}
          className="w-full min-h-[44px] px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-70 disabled:cursor-wait text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          {isInitializing ? 'Loading Progress...' : 'Start Game'}
        </button>
      </div>
    </div>
  );
}
