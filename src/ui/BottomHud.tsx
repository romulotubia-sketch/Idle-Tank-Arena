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
  actionBanner: ActionBannerInfo | null;
  statusNotice: StatusNoticeInfo | null;
  onSummonClick: () => void;
  onSkillSlotClick: (slotIndex: number) => void;
  onMergeAreaClick: () => void;
}

export function renderSkillIcon(
  skillId: SkillId,
  color: string,
  className = 'w-4 h-4 sm:w-4.5 sm:h-4.5'
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
  actionBanner,
  statusNotice,
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
    <footer className="relative shrink-0 bg-[#1B222B] border-t-2 border-[#2D3846] px-2.5 sm:px-4 py-2 select-none z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.35)]">
      {/* Lightweight Summon / Merge Feedback Banner */}
      {actionBanner && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#12171E] border-2 rounded-lg px-3 py-1.5 shadow-xl whitespace-nowrap animate-summon-pop"
          style={{
            borderColor:
              actionBanner.kind === 'merge' ? '#34D399' : actionBanner.accentColor,
          }}
        >
          {renderSkillIcon(actionBanner.skillId, actionBanner.accentColor)}
          <span className="text-xs font-bold text-white">
            {actionBanner.kind === 'merge'
              ? `Merged ${actionBanner.name}`
              : `Summoned ${actionBanner.name}`}
          </span>
          <span className="font-mono-tabular text-[11px] font-bold text-amber-300">
            {actionBanner.kind === 'merge' && actionBanner.previousLevel !== undefined
              ? `Lv.${actionBanner.previousLevel} → Lv.${actionBanner.level}`
              : `Lv.${actionBanner.level}`}
          </span>
          {actionBanner.kind === 'summon' && actionBanner.unlockedNew && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-[10px] font-bold text-emerald-300 uppercase tracking-wide">
              Unlocked!
            </span>
          )}
          {actionBanner.kind === 'summon' &&
            actionBanner.fragmentsAwarded !== undefined &&
            actionBanner.fragmentsAwarded > 0 && (
              <span className="font-mono-tabular text-[11px] font-bold text-sky-300">
                +{actionBanner.fragmentsAwarded} Frags
              </span>
            )}
        </div>
      )}

      {!actionBanner && statusNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 bg-[#12171E] border text-xs font-medium px-3 py-1 rounded-md shadow-lg whitespace-nowrap ${
            statusNotice.tone === 'error'
              ? 'border-rose-500/70 text-rose-200'
              : 'border-amber-500/50 text-amber-200'
          }`}
        >
          {statusNotice.text}
        </div>
      )}

      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 max-w-[1600px] mx-auto">
        {/* Left/Center: 6 Clearly Defined Skill Slots */}
        <div
          className="flex items-center gap-1.5 sm:gap-2"
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
                    : `Skill slot ${slot.index + 1} (Vacant)`
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
                    : `Skill slot ${slot.index + 1}, vacant`
                }
                className={`group relative overflow-hidden w-11 h-11 sm:w-13 sm:h-13 lg:w-14 lg:h-14 rounded-lg flex flex-col items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  def
                    ? isSelected
                      ? 'bg-[#172C42] border-2 ring-2 ring-sky-400'
                      : isCompatibleTarget
                        ? 'bg-[#132B24] border-2 ring-2 ring-emerald-400/80'
                        : 'bg-[#17202B] hover:bg-[#1E2937] border-2'
                    : 'bg-[#11161C] hover:bg-[#151C24] border-2 border-dashed border-[#2F3B4A]'
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

                <span className="relative z-10 flex flex-col items-center justify-center leading-none">
                  {def && slot.skillId ? (
                    <>
                      {renderSkillIcon(slot.skillId, def.accentColor)}
                      <span className="mt-1 text-[9px] sm:text-[10px] font-semibold text-slate-100 truncate max-w-[44px] sm:max-w-[50px]">
                        {def.shortLabel}
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      <span className="mt-0.5 text-[8px] text-slate-600 font-medium">
                        Empty
                      </span>
                    </>
                  )}
                </span>

                <span
                  className={`absolute top-0.5 left-1 font-mono-tabular text-[9px] font-bold z-10 ${
                    isSelected
                      ? 'text-sky-300'
                      : isCompatibleTarget
                        ? 'text-emerald-300'
                        : 'text-slate-400'
                  }`}
                >
                  {slot.index + 1}
                </span>

                {def && (
                  <span
                    className={`absolute top-0.5 right-1 font-mono-tabular text-[9px] font-bold z-10 ${
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

        {/* Right Group: Skill Merge Indicator/Cancel + Summon Button & Cost */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
          {/* Interactive Skill Merge Bay / Cancel Control */}
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
            className={`flex items-center gap-2 h-11 sm:h-13 lg:h-14 px-2.5 sm:px-3.5 rounded-lg border-2 text-left transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
              selectedDef && selectedSlot
                ? 'bg-[#172B3F] hover:bg-[#1E3750] border-sky-400 text-sky-100'
                : mergeablePairAvailable
                  ? 'bg-[#132924] hover:bg-[#17332D] border-emerald-400/75 text-emerald-100'
                  : 'bg-[#15202E] hover:bg-[#1A283A] border-dashed border-sky-400/50 text-sky-200'
            }`}
          >
            {selectedDef && selectedSlot?.skillId ? (
              <>
                <div className="flex items-center gap-1 shrink-0">
                  {renderSkillIcon(selectedSlot.skillId, selectedDef.accentColor)}
                  <X className="w-3.5 h-3.5 text-sky-300" />
                </div>
                <div className="hidden md:flex flex-col leading-tight">
                  <span className="text-xs font-bold text-white whitespace-nowrap">
                    {selectedDef.shortLabel} L{selectedSlot.level}
                  </span>
                  <span className="text-[10px] text-sky-300 whitespace-nowrap">
                    Tap to Cancel
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 shrink-0">
                  <Combine
                    className={`w-4 h-4 ${
                      mergeablePairAvailable ? 'text-emerald-300' : 'text-sky-300'
                    }`}
                  />
                </div>
                <div className="hidden md:flex flex-col leading-tight">
                  <span
                    className={`text-xs font-bold whitespace-nowrap ${
                      mergeablePairAvailable ? 'text-emerald-200' : 'text-sky-200'
                    }`}
                  >
                    Skill Merge
                  </span>
                  <span
                    className={`text-[10px] whitespace-nowrap ${
                      mergeablePairAvailable ? 'text-emerald-300' : 'text-sky-300/75'
                    }`}
                  >
                    {mergeablePairAvailable ? 'Pair Ready' : 'Tap 2 Same'}
                  </span>
                </div>
              </>
            )}
          </button>

          {/* Functional Summon Button + Cost Display */}
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
            className={`flex items-center gap-2 sm:gap-2.5 h-11 sm:h-13 lg:h-14 px-3 sm:px-4 rounded-lg border-2 font-semibold transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-300 ${
              canSummon
                ? 'bg-amber-500 hover:bg-amber-400 active:scale-95 active:bg-amber-600 border-amber-300 text-slate-950 shadow-md cursor-pointer'
                : 'bg-[#262C34] border-[#39414D] text-slate-400 opacity-70 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <div className="flex flex-col items-start leading-tight">
              <span className="font-display text-sm sm:text-base font-bold tracking-wide">
                {!hasVacantSlot ? 'Slots Full' : 'Summon'}
              </span>
              <span
                className={`inline-flex items-center gap-1 font-mono-tabular text-[11px] font-bold ${
                  canSummon
                    ? 'text-slate-900'
                    : !hasVacantSlot
                      ? 'text-slate-400'
                      : 'text-rose-300'
                }`}
              >
                {hasVacantSlot ? (
                  <>
                    <Coins className="w-3 h-3 shrink-0" />
                    <span>{summonCost}</span>
                  </>
                ) : (
                  <span>6 / 6</span>
                )}
              </span>
            </div>
          </button>
        </div>
      </div>
    </footer>
  );
}
