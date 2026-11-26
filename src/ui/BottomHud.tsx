import {
  ArrowRight,
  ArrowUpCircle,
  Atom,
  Bomb,
  Boxes,
  CloudLightning,
  Coins,
  Cpu,
  Crosshair,
  Disc,
  Droplets,
  Flame,
  Focus,
  Gauge,
  Inbox,
  Navigation,
  Orbit,
  Plus,
  Radar,
  RefreshCw,
  Rocket,
  Shield,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  Waves,
  Zap,
} from 'lucide-react';
import { MAX_SKILL_LEVEL } from '../game/constants';
import { skillRegistry } from '../game/systems/skills/SkillRegistry';
import { GamePhase, SkillId, SkillRarity, SkillSlot } from '../game/types';

export interface ActionBannerInfo {
  kind: 'summon' | 'upgrade' | 'overflow';
  skillId: SkillId;
  name: string;
  rarity?: SkillRarity;
  level: number;
  previousLevel?: number;
  accentColor: string;
  unlockedNew?: boolean;
  fragmentsAwarded?: number;
  overflowFragments?: number;
  overflowCoins?: number;
}

export interface StatusNoticeInfo {
  text: string;
  tone?: 'info' | 'error';
}

interface BottomHudProps {
  phase: GamePhase;
  skillSlots: SkillSlot[];
  goldBalance: number;
  summonCost: number;
  pendingSkillCount: number;
  autoUpgradeEnabled: boolean;
  highlightedSlotIndex: number | null;
  upgradedSlotIndex: number | null;
  onSummonClick: () => void;
  onSkillSlotClick: (slotIndex: number) => void;
  onOpenPendingSkills: () => void;
  onToggleAutoUpgrade: () => void;
  onOpenAutoUpgradeSettings: () => void;
}

export function renderSkillIcon(
  skillId: SkillId,
  color: string,
  className = 'w-4 h-4'
) {
  const style = { color };
  switch (skillId) {
    case 'cannon':
      return <Crosshair className={className} style={style} />;
    case 'machine_gun':
      return <Sparkles className={className} style={style} />;
    case 'landmines':
      return <Disc className={className} style={style} />;
    case 'piercing_shot':
      return <ArrowRight className={className} style={style} />;
    case 'shockwave':
      return <Waves className={className} style={style} />;
    case 'ricochet':
      return <RefreshCw className={className} style={style} />;
    case 'frost_cannon':
      return <Snowflake className={className} style={style} />;
    case 'acid_shells':
      return <Droplets className={className} style={style} />;
    case 'shrapnel_burst':
      return <Sun className={className} style={style} />;
    case 'shield_pulse':
      return <Shield className={className} style={style} />;
    case 'rocket_barrage':
      return <Rocket className={className} style={style} />;
    case 'mortar':
      return <Bomb className={className} style={style} />;
    case 'flame_thrower':
      return <Flame className={className} style={style} />;
    case 'cluster_bombs':
      return <Boxes className={className} style={style} />;
    case 'hunter_missiles':
      return <Navigation className={className} style={style} />;
    case 'gatling_overdrive':
      return <Gauge className={className} style={style} />;
    case 'railgun':
      return <Zap className={className} style={style} />;
    case 'tesla':
      return <Zap className={className} style={style} />;
    case 'laser_array':
      return <Focus className={className} style={style} />;
    case 'plasma_cannon':
      return <Atom className={className} style={style} />;
    case 'sentry_turret':
      return <Cpu className={className} style={style} />;
    case 'drone_squadron':
      return <Radar className={className} style={style} />;
    case 'orbital_strike':
      return <Orbit className={className} style={style} />;
    case 'thunderstorm':
      return <CloudLightning className={className} style={style} />;
  }
}

export function BottomHud({
  phase,
  skillSlots,
  goldBalance,
  summonCost,
  pendingSkillCount,
  autoUpgradeEnabled,
  highlightedSlotIndex,
  upgradedSlotIndex,
  onSummonClick,
  onSkillSlotClick,
  onOpenPendingSkills,
  onToggleAutoUpgrade,
  onOpenAutoUpgradeSettings,
}: BottomHudProps) {
  const canAfford = goldBalance >= summonCost;
  // Summon remains enabled even when all 6 slots are occupied
  const canSummon = phase === 'ACTIVE' && canAfford;

  return (
    <footer className="relative shrink-0 bg-[#161C24] border-t border-[#2D3846] px-2 sm:px-3 py-1.5 select-none z-20">
      <div className="flex flex-col sm:flex-row landscape:flex-row items-stretch sm:items-center landscape:items-center justify-between gap-1.5 sm:gap-2 max-w-[1600px] mx-auto">
        {/* 6 Adaptive Skill Slots */}
        <div
          className="grid grid-cols-6 sm:flex landscape:flex items-center gap-1 sm:gap-1.5"
          aria-label="Active skill slots"
        >
          {skillSlots.slice(0, 6).map((slot) => {
            const def = slot.skillId
              ? skillRegistry.getDefinition(slot.skillId)
              : undefined;
            const isHighlighted = highlightedSlotIndex === slot.index;
            const isUpgraded = upgradedSlotIndex === slot.index;
            const isMaxLevel = Boolean(def && slot.level >= MAX_SKILL_LEVEL);

            const cdRatio =
              slot.cooldownTotal > 0
                ? Math.max(
                    0,
                    Math.min(1, slot.cooldownRemaining / slot.cooldownTotal)
                  )
                : 0;

            let borderColor: string | undefined;
            if (isUpgraded) {
              borderColor = '#34D399';
            } else if (isHighlighted) {
              borderColor = '#FCD34D';
            } else if (def) {
              borderColor = `${def.accentColor}88`;
            }

            return (
              <button
                key={slot.index}
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSkillSlotClick(slot.index);
                }}
                title={
                  def
                    ? `${def.name} Lv.${slot.level}${isMaxLevel ? ' (Max)' : ''}`
                    : `Skill slot ${slot.index + 1} (Empty)`
                }
                aria-label={
                  def
                    ? `Skill slot ${slot.index + 1}: ${def.name} Level ${slot.level}${
                        isMaxLevel ? ', Max Level' : ''
                      }`
                    : `Skill slot ${slot.index + 1}, empty`
                }
                className={`group relative overflow-hidden w-full landscape:w-11 sm:w-12 md:w-13 h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  def
                    ? isUpgraded
                      ? 'bg-[#132B24] border-2 ring-2 ring-emerald-400'
                      : 'bg-[#1A232E] hover:bg-[#212C3A] border-2'
                    : 'bg-[#0E1318] hover:bg-[#141B23] border border-dashed border-[#2C3746]'
                } ${isUpgraded ? 'animate-skill-upgrade' : ''} ${
                  isHighlighted && !isUpgraded
                    ? 'animate-summon-pop ring-2 ring-amber-300'
                    : ''
                }`}
                style={borderColor ? { borderColor } : undefined}
              >
                {/* Cooldown fill sweep */}
                {def && cdRatio > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 origin-bottom"
                    style={{ height: `${Math.round(cdRatio * 100)}%` }}
                  />
                )}

                <span className="relative z-10 flex flex-col items-center justify-center leading-none pt-1">
                  {def && slot.skillId ? (
                    <>
                      {renderSkillIcon(slot.skillId, def.accentColor, 'w-4 h-4')}
                      <span className="mt-0.5 text-[9px] font-semibold text-slate-100 truncate max-w-[38px] sm:max-w-[46px]">
                        {def.shortLabel}
                      </span>
                    </>
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  )}
                </span>

                <span
                  className={`absolute top-0.5 left-1 font-mono-tabular text-[8px] font-bold z-10 ${
                    isUpgraded
                      ? 'text-emerald-300'
                      : def
                        ? 'text-slate-400'
                        : 'text-slate-600'
                  }`}
                >
                  {slot.index + 1}
                </span>

                {def && (
                  <span
                    className={`absolute top-0.5 right-1 font-mono-tabular text-[8px] sm:text-[9px] font-bold z-10 ${
                      isUpgraded
                        ? 'text-emerald-300'
                        : isMaxLevel
                          ? 'text-amber-200'
                          : 'text-amber-300'
                    }`}
                  >
                    L{slot.level}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Group: Pending Queue, Auto Upgrade Toggle + Settings, and Summon */}
        <div className="flex items-center gap-1.5 sm:gap-2 sm:ml-auto landscape:ml-auto shrink-0">
          {/* Pending Skills Review Button */}
          <button
            type="button"
            disabled={phase !== 'ACTIVE'}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenPendingSkills();
            }}
            aria-label={`Pending skills queue (${pendingSkillCount})`}
            title={`Pending Skills (${pendingSkillCount})`}
            className={`relative flex items-center justify-center gap-1.5 h-10 sm:h-12 px-2 sm:px-2.5 rounded-lg border transition-colors shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-sky-400 ${
              pendingSkillCount > 0
                ? 'bg-[#16283B] hover:bg-[#1C334B] border-sky-400/75 text-sky-100'
                : 'bg-[#121A24] hover:bg-[#182230] border-white/12 text-slate-300'
            }`}
          >
            <Inbox
              className={`w-4 h-4 shrink-0 ${
                pendingSkillCount > 0 ? 'text-sky-300' : 'text-slate-400'
              }`}
            />
            <span className="hidden md:inline text-[11px] font-bold whitespace-nowrap">
              Pending
            </span>
            <span
              className={`font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded leading-none ${
                pendingSkillCount > 0
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-[#1E2733] text-slate-400'
              }`}
            >
              {pendingSkillCount}
            </span>
          </button>

          {/* Auto Upgrade Toggle + Settings Cluster */}
          <div className="flex items-center rounded-lg border border-white/12 bg-[#121A24] overflow-hidden shrink-0 h-10 sm:h-12">
            <button
              type="button"
              disabled={phase !== 'ACTIVE'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleAutoUpgrade();
              }}
              aria-pressed={autoUpgradeEnabled}
              aria-label={`Auto Upgrade ${autoUpgradeEnabled ? 'enabled' : 'disabled'}`}
              title={`Auto Upgrade: ${autoUpgradeEnabled ? 'ON' : 'OFF'}`}
              className={`flex items-center gap-1.5 h-full px-2 sm:px-2.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                autoUpgradeEnabled
                  ? 'bg-emerald-950/55 hover:bg-emerald-900/55 text-emerald-100'
                  : 'hover:bg-[#1A2431] text-slate-300'
              }`}
            >
              <ArrowUpCircle
                className={`w-4 h-4 shrink-0 ${
                  autoUpgradeEnabled ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                  Auto
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide ${
                    autoUpgradeEnabled ? 'text-emerald-300' : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      autoUpgradeEnabled ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                  {autoUpgradeEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
            </button>

            <div className="w-px h-6 bg-white/10" />

            <button
              type="button"
              disabled={phase !== 'ACTIVE'}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenAutoUpgradeSettings();
              }}
              aria-label="Auto Upgrade Settings"
              title="Auto Upgrade Settings"
              className="flex items-center justify-center w-8 sm:w-9 h-full hover:bg-[#1C2634] text-slate-300 hover:text-amber-300 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Summon Button (Always active with sufficient Coins, even at 6/6 slots) */}
          <button
            type="button"
            disabled={!canSummon}
            onClick={(e) => {
              e.currentTarget.blur();
              onSummonClick();
            }}
            aria-label={
              !canAfford
                ? `Summon disabled, requires ${summonCost} coins`
                : `Summon random skill for ${summonCost} coins`
            }
            className={`flex-1 sm:flex-initial landscape:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 h-10 sm:h-12 px-3 sm:px-3.5 rounded-lg border font-semibold transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-300 ${
              canSummon
                ? 'bg-amber-500 hover:bg-amber-400 active:scale-95 active:bg-amber-600 border-amber-300 text-slate-950 shadow-md cursor-pointer'
                : 'bg-[#232932] border-[#39414D] text-slate-400 opacity-70 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <div className="flex flex-col items-start leading-none">
              <span className="font-display text-sm sm:text-base font-bold tracking-wide">
                Summon
              </span>
              <span
                className={`inline-flex items-center gap-0.5 font-mono-tabular text-[10px] font-bold mt-0.5 ${
                  canSummon ? 'text-slate-900' : 'text-rose-300'
                }`}
              >
                <Coins className="w-2.5 h-2.5 shrink-0" />
                <span>{summonCost}</span>
              </span>
            </div>
          </button>
        </div>
      </div>
    </footer>
  );
}
