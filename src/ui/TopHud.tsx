import { useEffect, useRef, useState } from 'react';
import {
  Coins,
  Layers,
  Pause,
  Play,
  Settings,
  ShieldAlert,
  Swords,
  Zap,
} from 'lucide-react';
import {
  ActiveTemporaryBoostState,
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
  totalSkillFragments: number;
  activeBoost?: ActiveTemporaryBoostState;
  onOpenCollection?: () => void;
  onTogglePause: () => void;
  onOpenSettings: () => void;
}

export function TopHud({
  phase,
  wave,
  boss,
  currencies,
  totalSkillFragments,
  activeBoost,
  onOpenCollection,
  onTogglePause,
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
    <header className="shrink-0 h-11 bg-[#161C24] border-b border-[#2D3846] px-2 sm:px-3 select-none z-20">
      <div className="h-full flex items-center justify-between gap-2 sm:gap-3 max-w-[1600px] mx-auto">
        {/* Left: Compact Wave Number + Inline Wave/Boss Progress */}
        <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[440px]">
          <div
            className={`flex items-center gap-1.5 h-7 sm:h-8 px-2 rounded-md bg-[#10151B] border shrink-0 ${
              wave.isBossWave ? 'border-rose-500/65' : 'border-[#2E3A48]'
            }`}
            aria-label={`Current wave ${wave.currentWave}`}
          >
            <span
              className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wide ${
                wave.isBossWave ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {wave.isBossWave ? 'Boss' : 'W'}
            </span>
            <span className="font-display text-base sm:text-lg font-bold text-white font-mono-tabular leading-none">
              {wave.currentWave}
            </span>
          </div>

          {showBossBar && boss ? (
            <div
              className="flex-1 min-w-[116px] h-7 sm:h-8 flex flex-col justify-center px-2 rounded-md bg-gradient-to-r from-[#241017] to-[#1A1116] border border-rose-500/80 shadow-sm"
              aria-label={`Boss health: ${boss.name}`}
            >
              <div className="flex items-center justify-between gap-1.5 text-[10px] leading-none mb-1">
                <span className="inline-flex items-center gap-1 font-bold text-rose-100 truncate">
                  <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                  <span className="px-1 py-0.2 rounded bg-rose-500/25 border border-rose-400/50 text-[9px] font-extrabold text-rose-300 uppercase tracking-wider shrink-0">
                    Boss
                  </span>
                  <span className="truncate">{boss.name}</span>
                </span>
                <span className="font-mono-tabular font-bold text-rose-200 whitespace-nowrap shrink-0">
                  {boss.hp}/{boss.maxHp}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#090C10] rounded-xs overflow-hidden border border-rose-500/25">
                <div
                  className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-400 transition-[width] duration-100"
                  style={{ width: `${bossHpPct}%` }}
                />
              </div>
            </div>
          ) : (
            <div
              className="flex-1 min-w-[96px] h-7 sm:h-8 flex flex-col justify-center px-2 rounded-md bg-[#10151B] border border-[#2E3A48]"
              aria-label={`Wave ${wave.currentWave} progress`}
            >
              <div className="flex items-center justify-between gap-1.5 text-[10px] leading-none mb-1">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-300 truncate">
                  <Swords className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {wave.isTransitioning
                      ? 'Wave Clear'
                      : wave.isBossWave
                        ? 'Boss Incoming'
                        : `Wave ${wave.currentWave}`}
                  </span>
                </span>
                <span className="font-mono-tabular text-slate-300 font-semibold whitespace-nowrap shrink-0">
                  {wave.isTransitioning
                    ? 'Next...'
                    : `${wave.enemiesDefeatedInWave}/${wave.enemiesTotal}`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#090C10] rounded-xs overflow-hidden">
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
        </div>

        {/* Right: Coins, Active Boost (if running), Skill Fragments & Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {activeBoost?.active && (
            <div
              title={`Active Boost: +${Math.round((activeBoost.attackPowerMultiplier - 1) * 100)}% ATK, +${Math.round((activeBoost.coinGainMultiplier - 1) * 100)}% Coins`}
              className="flex items-center gap-1 h-7 sm:h-8 px-2 rounded-md bg-emerald-950/75 border border-emerald-400/60 font-mono-tabular text-[11px] font-bold text-emerald-200 whitespace-nowrap"
            >
              <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{Math.ceil(activeBoost.remainingSec)}s</span>
            </div>
          )}

          {/* Coins */}
          <div
            title="Coins"
            aria-label={`Coins: ${currencies.gold}`}
            className={`relative flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-md bg-[#10151B] border font-mono-tabular text-xs sm:text-sm transition-colors duration-200 ${
              coinGainDelta
                ? 'border-amber-400/80 text-amber-200'
                : 'border-[#2E3A48] text-amber-300'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-bold">{currencies.gold}</span>
            {coinGainDelta && (
              <span
                key={coinGainDelta.key}
                aria-hidden="true"
                className="hidden sm:inline text-[10px] font-bold text-emerald-300 animate-coin-gain"
              >
                +{coinGainDelta.amount}
              </span>
            )}
          </div>

          {/* Skill Fragments */}
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenCollection?.();
            }}
            disabled={phase !== 'ACTIVE' || !onOpenCollection}
            title="Total Skill Fragments (Open Skill Collection)"
            aria-label={`Skill Fragments: ${totalSkillFragments}`}
            className="flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-md bg-[#10151B] hover:bg-[#17202B] border border-[#2E3A48] font-mono-tabular text-xs sm:text-sm text-sky-300 transition-colors cursor-pointer disabled:cursor-default disabled:hover:bg-[#10151B] focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-bold">{totalSkillFragments}</span>
            <span className="hidden md:inline text-[10px] font-sans font-semibold text-slate-400">
              Frags
            </span>
          </button>

          {/* Pause / Resume */}
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePause();
            }}
            aria-label={phase === 'PAUSED' ? 'Resume battle' : 'Pause battle'}
            title={phase === 'PAUSED' ? 'Resume Battle (Esc)' : 'Pause Battle (Esc)'}
            disabled={phase !== 'ACTIVE' && phase !== 'PAUSED'}
            className={`inline-flex items-center justify-center gap-1.5 min-w-[36px] h-8 sm:h-9 px-2 lg:px-2.5 rounded-md border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
              phase === 'PAUSED'
                ? 'bg-emerald-950/80 hover:bg-emerald-900/80 border-emerald-400/70 text-emerald-100'
                : 'bg-[#232D3A] hover:bg-[#2E3A4A] active:bg-[#1B232D] border-[#3C4A5C] text-slate-100'
            }`}
          >
            {phase === 'PAUSED' ? (
              <Play className="w-4 h-4 text-emerald-300 shrink-0" />
            ) : (
              <Pause className="w-4 h-4 text-sky-300 shrink-0" />
            )}
            <span className="hidden lg:inline">
              {phase === 'PAUSED' ? 'Resume' : 'Pause'}
            </span>
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenSettings();
            }}
            aria-label="Open settings"
            title="Settings"
            disabled={phase === 'TITLE'}
            className="inline-flex items-center justify-center gap-1.5 min-w-[36px] h-8 sm:h-9 px-2 lg:px-2.5 rounded-md bg-[#232D3A] hover:bg-[#2E3A4A] active:bg-[#1B232D] border border-[#3C4A5C] text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <Settings className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="hidden lg:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
