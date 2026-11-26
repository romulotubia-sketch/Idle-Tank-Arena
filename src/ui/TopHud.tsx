import { useEffect, useRef, useState } from 'react';
import { Coins, Gem, Settings, ShieldAlert, Swords, Wrench } from 'lucide-react';
import {
  BossHudState,
  CurrencyBalances,
  GamePhase,
  WaveState,
} from '../game/types';

interface TopHudProps {
  phase: GamePhase;
  wave: WaveState;
  boss: BossHudState | null;
  currencies: CurrencyBalances;
  onOpenSettings: () => void;
}

export function TopHud({
  phase,
  wave,
  boss,
  currencies,
  onOpenSettings,
}: TopHudProps) {
  const prevGoldRef = useRef<number>(currencies.gold);
  const clearTimerRef = useRef<number | null>(null);
  const [coinGainDelta, setCoinGainDelta] = useState<{
    amount: number;
    key: number;
  } | null>(null);

  useEffect(() => {
    const prev = prevGoldRef.current;
    prevGoldRef.current = currencies.gold;

    if (phase === 'ACTIVE' && currencies.gold > prev) {
      const earned = currencies.gold - prev;
      setCoinGainDelta((curr) => ({
        amount: earned,
        key: (curr?.key ?? 0) + 1,
      }));
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = window.setTimeout(() => {
        setCoinGainDelta(null);
      }, 650);
    } else if (phase !== 'ACTIVE') {
      setCoinGainDelta(null);
    }
  }, [currencies.gold, phase]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);
  const showBossBar = Boolean(boss && boss.active);
  const bossHpPct = boss
    ? Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100))
    : 0;
  const waveProgressPct =
    wave.enemiesTotal > 0
      ? Math.max(
          0,
          Math.min(100, (wave.enemiesDefeatedInWave / wave.enemiesTotal) * 100)
        )
      : 0;

  return (
    <header className="shrink-0 bg-[#1B222B] border-b-2 border-[#2D3846] px-2.5 sm:px-4 py-1.5 select-none shadow-md z-10">
      <div className="flex items-center justify-between gap-2 sm:gap-4 max-w-[1600px] mx-auto">
        {/* Left: Wave Indicator */}
        <div
          className={`flex items-center gap-2 bg-[#12171E] border rounded-lg px-2.5 sm:px-3 py-1.5 shrink-0 ${
            wave.isBossWave ? 'border-rose-500/65' : 'border-[#334155]'
          }`}
        >
          <div className="flex flex-col leading-none">
            <span
              className={`text-[10px] font-semibold tracking-wide ${
                wave.isBossWave ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {wave.isBossWave ? 'Boss Wave' : 'Wave'}
            </span>
            <span className="font-display text-lg sm:text-xl font-bold text-white font-mono-tabular leading-tight">
              {wave.currentWave}
            </span>
          </div>
          <div
            className="hidden md:block h-6 w-px bg-white/10"
            aria-hidden="true"
          />
          <div className="hidden md:flex flex-col leading-none">
            <span className="text-[10px] text-slate-400">
              {wave.isTransitioning
                ? 'Status'
                : wave.isBossWave
                  ? 'Threat'
                  : 'Hostiles'}
            </span>
            <span className="font-mono-tabular text-xs font-semibold text-slate-200 mt-0.5 whitespace-nowrap">
              {wave.isTransitioning
                ? 'Wave Clear'
                : wave.isBossWave
                  ? 'Dreadnought'
                  : `${wave.enemiesRemaining} / ${wave.enemiesTotal}`}
            </span>
          </div>
        </div>

        {/* Center: Dedicated Boss Health Bar (only when Boss is active) or Wave Progress */}
        {showBossBar && boss ? (
          <div
            className="flex-1 max-w-md min-w-[140px] bg-[#1A1116] border border-rose-500/70 rounded-lg px-2.5 sm:px-3 py-1.5 shadow-sm"
            aria-label={`Boss health: ${boss.name}`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
              <span className="inline-flex items-center gap-1.5 font-bold text-rose-200 truncate">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{boss.name}</span>
              </span>
              <span className="font-mono-tabular text-[10px] sm:text-[11px] font-bold text-rose-300 whitespace-nowrap shrink-0">
                {boss.hp} / {boss.maxHp}
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#0B0E13] border border-rose-500/35 rounded-sm overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-[width] duration-100"
                style={{ width: `${bossHpPct}%` }}
              />
            </div>
          </div>
        ) : (
          <div
            className="flex-1 max-w-md min-w-[130px] bg-[#12171E] border border-[#334155] rounded-lg px-2.5 sm:px-3 py-1.5"
            aria-label={`Wave ${wave.currentWave} progress`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300 truncate">
                <Swords className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
                <span className="truncate">
                  {wave.isTransitioning
                    ? `Wave ${wave.currentWave} Cleared`
                    : wave.isBossWave
                      ? 'Boss Incoming'
                      : `Wave ${wave.currentWave} Progress`}
                </span>
              </span>
              <span className="font-mono-tabular text-[10px] sm:text-[11px] text-slate-300 whitespace-nowrap shrink-0">
                {wave.isTransitioning
                  ? 'Next Wave...'
                  : `${wave.enemiesDefeatedInWave} / ${wave.enemiesTotal}`}
              </span>
            </div>
            <div className="w-full h-2 bg-[#0B0E13] border border-white/10 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-[width] duration-150 ${
                  wave.isTransitioning ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{
                  width: `${wave.isTransitioning ? 100 : waveProgressPct}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Right: Currency Display + Settings Button */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div
            className={`relative flex items-center gap-2 sm:gap-3 bg-[#12171E] border rounded-lg px-2.5 sm:px-3 py-1.5 font-mono-tabular text-xs sm:text-sm transition-colors duration-200 ${
              coinGainDelta
                ? 'border-amber-400/80 ring-1 ring-amber-400/40'
                : 'border-[#334155]'
            }`}
          >
            <div className="flex items-center gap-1" title="Coins">
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-amber-300">{currencies.gold}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1" title="Scrap">
              <Wrench className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="font-bold text-slate-200">{currencies.scrap}</span>
            </div>
            <div className="flex items-center gap-1" title="Gems">
              <Gem className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 shrink-0" />
              <span className="font-bold text-sky-300">{currencies.gems}</span>
            </div>

            {coinGainDelta && (
              <span
                key={coinGainDelta.key}
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-5 left-2 font-mono-tabular text-[11px] font-bold text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] animate-coin-gain"
              >
                +{coinGainDelta.amount}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
            disabled={phase === 'TITLE'}
            className="inline-flex items-center justify-center gap-1.5 min-w-[40px] h-9 sm:h-10 px-2.5 rounded-lg bg-[#26303D] hover:bg-[#313D4D] active:bg-[#1E2630] border border-[#3E4C5E] text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <Settings className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="hidden lg:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
