import { AlertOctagon, RotateCw } from 'lucide-react';
import { BattleRecoveryState } from '../game/types';

interface DefeatOverlayProps {
  wave: number;
  recovery: BattleRecoveryState | null;
}

export function DefeatOverlay({ wave, recovery }: DefeatOverlayProps) {
  const targetWave = recovery?.wave ?? wave;
  const totalSec = Math.max(0.1, recovery?.totalSec ?? 2.2);
  const remainingSec = Math.max(0, recovery?.remainingSec ?? 0);
  const progressPct = Math.max(
    0,
    Math.min(100, ((totalSec - remainingSec) / totalSec) * 100)
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-3"
      role="status"
      aria-live="assertive"
      aria-labelledby="defeat-recovery-heading"
    >
      <div className="w-[min(calc(100%-16px),21rem)] bg-[#141A22]/92 border border-rose-500/70 rounded-xl px-4 py-3 shadow-2xl text-center animate-toast-in">
        <div className="inline-flex items-center justify-center gap-1.5 text-rose-400 text-xs font-bold tracking-wide uppercase mb-1">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
          <span>Tank Destroyed</span>
        </div>

        <h2
          id="defeat-recovery-heading"
          className="font-display text-lg sm:text-xl font-bold text-white leading-tight mb-1"
        >
          Recovering Wave {targetWave}
        </h2>

        <p className="text-[11px] text-slate-300 mb-2.5">
          All coins, upgrades, equipment &amp; skills preserved
        </p>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-[#0B0F14] border border-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-[width] duration-75"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="inline-flex items-center gap-1 font-mono-tabular text-[11px] font-bold text-amber-300 whitespace-nowrap shrink-0">
            <RotateCw className="w-3 h-3 animate-spin" />
            {remainingSec.toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );
}
