import {
  Bomb,
  Coins,
  Combine,
  Crosshair,
  Disc,
  Flame,
  Plus,
  Rocket,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { MAX_SKILL_LEVEL } from '../game/constants';
import { skillRegistry } from '../game/systems/skills/SkillRegistry';
import { GamePhase, SkillId, SkillSlot } from '../game/types';

export interface ActionBannerInfo {
  kind: 'summon' | 'merge';
  skillId: SkillId;
  name: string;
  level: number;
  previousLevel?: number;
  accentColor: string;
  unlockedNew?: boolean;
  fragmentsAwarded?: number;
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
  hasVacantSlot: boolean;
  selectedSlotIndex: number | null;
  highlightedSlotIndex: number | null;
  invalidSlotIndex: number | null;
  mergeablePairAvailable: boolean;
  onSummonClick: () => void;
  onSkillSlotClick: (slotIndex: number) => void;
  onMergeAreaClick: () => void;
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
    case 'rocket_barrage':
      return <Rocket className={className} style={style} />;
    case 'mortar':
      return <Bomb className={className} style={style} />;
    case 'railgun':
      return <Zap className={className} style={style} />;
    case 'flame_thrower':
      return <Flame className={className} style={style} />;
    case 'tesla':
      return <Zap className={className} style={style} />;
    case 'landmines':
      return <Disc className={className} style={style} />;
  }
}

export function BottomHud({
  phase,
  skillSlots,
  goldBalance,
  summonCost,
  hasVacantSlot,
  selectedSlotIndex,
  highlightedSlotIndex,
  invalidSlotIndex,
  mergeablePairAvailable,
  onSummonClick,
  onSkillSlotClick,
  onMergeAreaClick,
}: BottomHudProps) {
  const canAfford = goldBalance >= summonCost;
  const canSummon = phase === 'ACTIVE' && canAfford && hasVacantSlot;

  const selectedSlot =
    selectedSlotIndex !== null ? skillSlots[selectedSlotIndex] : undefined;
  const selectedDef =
    selectedSlot?.skillId ? skillRegistry.getDefinition(selectedSlot.skillId) : undefined;

  return (
    <footer className="relative shrink-0 bg-[#161C24] border-t border-[#2D3846] px-2 sm:px-3 py-1.5 select-none z-20">
      <div className="flex flex-col sm:flex-row landscape:flex-row items-stretch sm:items-center landscape:items-center justify-between gap-1.5 sm:gap-2.5 max-w-[1600px] mx-auto">
        {/* 6 Adaptive Skill Slots */}
        <div
          className="grid grid-cols-6 sm:flex landscape:flex items-center gap-1 sm:gap-1.5"
          aria-label="Active skill slots"
        >
          {skillSlots.slice(0, 6).map((slot) => {
            const def = slot.skillId
              ? skillRegistry.getDefinition(slot.skillId)
              : undefined;
            const isSelected = selectedSlotIndex === slot.index && Boolean(def);
            const isHighlighted = highlightedSlotIndex === slot.index;
            const isInvalid = invalidSlotIndex === slot.index;
            const isMaxLevel = Boolean(def && slot.level >= MAX_SKILL_LEVEL);
            const isCompatibleTarget = Boolean(
              selectedSlot?.skillId &&
                slot.skillId &&
                slot.index !== selectedSlot.index &&
                slot.skillId === selectedSlot.skillId &&
                slot.level === selectedSlot.level &&
                slot.level < MAX_SKILL_LEVEL
            );

            const cdRatio =
              slot.cooldownTotal > 0
                ? Math.max(
                    0,
                    Math.min(1, slot.cooldownRemaining / slot.cooldownTotal)
                  )
                : 0;

            let borderColor: string | undefined;
            if (isInvalid) {
              borderColor = '#F43F5E';
            } else if (isSelected) {
              borderColor = '#38BDF8';
            } else if (isCompatibleTarget) {
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
                aria-pressed={isSelected}
                title={
                  def
                    ? `${def.name} Lv.${slot.level}${isMaxLevel ? ' (Max)' : ''}`
                    : `Skill slot ${slot.index + 1} (Empty)`
                }
                aria-label={
                  def
                    ? `Skill slot ${slot.index + 1}: ${def.name} Level ${slot.level}${
                        isSelected
                          ? ', selected for merge'
                          : isCompatibleTarget
                            ? ', tap to merge'
                            : ''
                      }`
                    : `Skill slot ${slot.index + 1}, empty`
                }
                className={`group relative overflow-hidden w-full landscape:w-11 sm:w-12 md:w-13 h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  def
                    ? isSelected
                      ? 'bg-[#172C42] border-2 ring-1 ring-sky-400'
                      : isCompatibleTarget
                        ? 'bg-[#132B24] border-2 ring-1 ring-emerald-400/80'
                        : 'bg-[#1A232E] hover:bg-[#212C3A] border-2'
                    : 'bg-[#0E1318] hover:bg-[#141B23] border border-dashed border-[#2C3746]'
                } ${isHighlighted ? 'animate-summon-pop ring-2 ring-amber-300' : ''} ${
                  isInvalid ? 'animate-merge-invalid ring-2 ring-rose-500' : ''
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
                    isSelected
                      ? 'text-sky-300'
                      : isCompatibleTarget
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
                      isMaxLevel ? 'text-amber-200' : 'text-amber-300'
                    }`}
                  >
                    L{slot.level}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Group: Compact Merge Control + Summon Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 sm:ml-auto landscape:ml-auto shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onMergeAreaClick();
            }}
            aria-label={
              selectedDef && selectedSlot
                ? `Cancel merging ${selectedDef.name} Level ${selectedSlot.level}`
                : mergeablePairAvailable
                  ? 'Skill merge ready, tap matching skill slots'
                  : 'Skill merge instructions'
            }
            className={`flex-1 sm:flex-initial landscape:flex-initial flex items-center justify-center gap-1.5 h-10 sm:h-12 px-2.5 sm:px-3 rounded-lg border text-left transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
              selectedDef && selectedSlot
                ? 'bg-[#172B3F] hover:bg-[#1E3750] border-sky-400 text-sky-100'
                : mergeablePairAvailable
                  ? 'bg-[#132924] hover:bg-[#17332D] border-emerald-400/75 text-emerald-100'
                  : 'bg-[#121A24] hover:bg-[#182230] border-dashed border-sky-400/45 text-sky-200'
            }`}
          >
            {selectedDef && selectedSlot?.skillId ? (
              <>
                {renderSkillIcon(selectedSlot.skillId, selectedDef.accentColor, 'w-3.5 h-3.5')}
                <span className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap">
                  Cancel
                </span>
                <X className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              </>
            ) : (
              <>
                <Combine
                  className={`w-4 h-4 shrink-0 ${
                    mergeablePairAvailable ? 'text-emerald-300' : 'text-sky-300'
                  }`}
                />
                <div className="flex sm:hidden landscape:hidden md:flex flex-col leading-tight">
                  <span
                    className={`text-[11px] font-bold whitespace-nowrap ${
                      mergeablePairAvailable ? 'text-emerald-200' : 'text-sky-200'
                    }`}
                  >
                    Merge
                  </span>
                  <span
                    className={`text-[9px] whitespace-nowrap ${
                      mergeablePairAvailable ? 'text-emerald-300' : 'text-sky-300/75'
                    }`}
                  >
                    {mergeablePairAvailable ? 'Ready' : '2 Same'}
                  </span>
                </div>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!canSummon}
            onClick={(e) => {
              e.currentTarget.blur();
              onSummonClick();
            }}
            aria-label={
              !hasVacantSlot
                ? 'Summon disabled, all skill slots occupied'
                : !canAfford
                  ? `Summon disabled, requires ${summonCost} coins`
                  : `Summon random skill for ${summonCost} coins`
            }
            className={`flex items-center justify-center gap-1.5 sm:gap-2 h-10 sm:h-12 px-3 sm:px-3.5 rounded-lg border font-semibold transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-300 ${
              canSummon
                ? 'bg-amber-500 hover:bg-amber-400 active:scale-95 active:bg-amber-600 border-amber-300 text-slate-950 shadow-md cursor-pointer'
                : 'bg-[#232932] border-[#39414D] text-slate-400 opacity-70 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <div className="flex flex-col items-start leading-none">
              <span className="font-display text-sm sm:text-base font-bold tracking-wide">
                {!hasVacantSlot ? 'Full' : 'Summon'}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 font-mono-tabular text-[10px] font-bold mt-0.5 ${
                  canSummon
                    ? 'text-slate-900'
                    : !hasVacantSlot
                      ? 'text-slate-400'
                      : 'text-rose-300'
                }`}
              >
                {hasVacantSlot ? (
                  <>
                    <Coins className="w-2.5 h-2.5 shrink-0" />
                    <span>{summonCost}</span>
                  </>
                ) : (
                  <span>6/6</span>
                )}
              </span>
            </div>
          </button>
        </div>
      </div>
    </footer>
  );
}
