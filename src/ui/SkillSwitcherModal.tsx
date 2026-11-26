import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpCircle,
  CheckCircle2,
  Inbox,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { MAX_SKILL_LEVEL } from '../game/constants';
import { skillRegistry } from '../game/systems/skills/SkillRegistry';
import {
  PendingSkillEntry,
  SkillCollectionEntry,
  SkillId,
  SkillRarity,
  SkillSlot,
} from '../game/types';
import { renderSkillIcon } from './BottomHud';
import { BattlefieldPanel } from './components/BattlefieldPanel';
import { getSkillRarityStyles } from './SkillCollectionModal';

interface SkillSwitcherModalProps {
  initialSlotIndex: number;
  skillSlots: SkillSlot[];
  skillCollection: SkillCollectionEntry[];
  skillBattleLevels: Partial<Record<SkillId, number>>;
  pendingSkills: PendingSkillEntry[];
  onSwitchSkill: (slotIndex: number, skillId: SkillId) => void;
  onApplyPendingUpgrade?: (skillId: SkillId) => void;
  onOpenPendingSkills?: (skillId: SkillId | null) => void;
  onClose: () => void;
}

const RARITY_ORDER_WEIGHT: Record<SkillRarity, number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  uncommon: 1,
  common: 0,
};

export function SkillSwitcherModal({
  initialSlotIndex,
  skillSlots,
  skillCollection,
  skillBattleLevels,
  pendingSkills,
  onSwitchSkill,
  onApplyPendingUpgrade,
  onOpenPendingSkills,
  onClose,
}: SkillSwitcherModalProps) {
  const [targetSlotIndex, setTargetSlotIndex] = useState<number>(() =>
    Math.max(0, Math.min(5, initialSlotIndex))
  );
  const [selectedSkillId, setSelectedSkillId] = useState<SkillId | null>(null);

  useEffect(() => {
    setTargetSlotIndex(Math.max(0, Math.min(5, initialSlotIndex)));
    setSelectedSkillId(null);
  }, [initialSlotIndex]);

  const slots = skillSlots.slice(0, 6);
  const targetSlot = slots[targetSlotIndex] ?? slots[0];
  const targetDef = targetSlot?.skillId
    ? skillRegistry.getDefinition(targetSlot.skillId)
    : undefined;

  const equippedSlotBySkill = useMemo(() => {
    const map = new Map<SkillId, SkillSlot>();
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.skillId) {
        map.set(s.skillId, s);
      }
    }
    return map;
  }, [slots]);

  const pendingBySkill = useMemo(() => {
    const map = new Map<SkillId, number>();
    for (let i = 0; i < pendingSkills.length; i++) {
      map.set(pendingSkills[i].skillId, pendingSkills[i].copies);
    }
    return map;
  }, [pendingSkills]);

  const totalPendingCopies = useMemo(
    () => pendingSkills.reduce((sum, p) => sum + p.copies, 0),
    [pendingSkills]
  );

  const unlockedEntries = useMemo(() => {
    return skillCollection.filter((entry) => entry.unlocked);
  }, [skillCollection]);

  const getBattleLevelForSkill = (skillId: SkillId): number => {
    const equipped = equippedSlotBySkill.get(skillId);
    if (equipped) return equipped.level;
    return Math.max(1, skillBattleLevels[skillId] ?? 1);
  };

  const { availableSkills, equippedSkills } = useMemo(() => {
    const available: SkillCollectionEntry[] = [];
    const equipped: SkillCollectionEntry[] = [];

    for (let i = 0; i < unlockedEntries.length; i++) {
      const entry = unlockedEntries[i];
      if (equippedSlotBySkill.has(entry.skillId)) {
        equipped.push(entry);
      } else {
        available.push(entry);
      }
    }

    const sortFn = (a: SkillCollectionEntry, b: SkillCollectionEntry) => {
      const lvA = getBattleLevelForSkill(a.skillId);
      const lvB = getBattleLevelForSkill(b.skillId);
      if (lvA !== lvB) return lvB - lvA;
      const defA = skillRegistry.getDefinition(a.skillId);
      const defB = skillRegistry.getDefinition(b.skillId);
      const rA = defA ? RARITY_ORDER_WEIGHT[defA.rarity] : 0;
      const rB = defB ? RARITY_ORDER_WEIGHT[defB.rarity] : 0;
      if (rA !== rB) return rB - rA;
      return (defA?.name ?? a.skillId).localeCompare(defB?.name ?? b.skillId);
    };

    available.sort(sortFn);
    equipped.sort((a, b) => {
      const slotA = equippedSlotBySkill.get(a.skillId)?.index ?? 99;
      const slotB = equippedSlotBySkill.get(b.skillId)?.index ?? 99;
      return slotA - slotB;
    });

    return { availableSkills: available, equippedSkills: equipped };
  }, [unlockedEntries, equippedSlotBySkill, skillBattleLevels]);

  const validSelectedSkillId =
    selectedSkillId &&
    availableSkills.some((e) => e.skillId === selectedSkillId)
      ? selectedSkillId
      : null;

  const selectedDef = validSelectedSkillId
    ? skillRegistry.getDefinition(validSelectedSkillId)
    : undefined;
  const selectedBattleLevel = validSelectedSkillId
    ? getBattleLevelForSkill(validSelectedSkillId)
    : 1;

  const targetPendingCopies =
    targetSlot?.skillId ? pendingBySkill.get(targetSlot.skillId) ?? 0 : 0;
  const canUpgradeTargetSlot = Boolean(
    targetSlot?.skillId &&
      targetPendingCopies > 0 &&
      targetSlot.level < MAX_SKILL_LEVEL &&
      onApplyPendingUpgrade
  );

  const handleConfirmSwitch = () => {
    if (!targetSlot || !validSelectedSkillId) return;
    onSwitchSkill(targetSlot.index, validSelectedSkillId);
  };

  return (
    <BattlefieldPanel
      title="Switch Battlefield Skill"
      icon={<RefreshCw className="w-4 h-4 text-amber-400" />}
      variant="modal"
      ariaLabel="Switch Battlefield Skill"
      closeLabel="Cancel and close skill switcher"
      onClose={onClose}
      headerMeta={
        <span className="font-mono-tabular text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#0E1319] border border-white/10 text-emerald-300">
          {unlockedEntries.length} Unlocked
        </span>
      }
      headerActions={
        totalPendingCopies > 0 && onOpenPendingSkills ? (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenPendingSkills(pendingSkills[0]?.skillId ?? null);
            }}
            className="h-8 px-2 rounded-lg bg-[#16283B] hover:bg-[#1C334B] border border-sky-400/60 text-sky-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Inbox className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            <span className="hidden sm:inline">Pending</span>
            <span className="font-mono-tabular text-[10px] px-1 rounded bg-sky-400 text-slate-950 font-extrabold">
              {totalPendingCopies}
            </span>
          </button>
        ) : undefined
      }
    >
      {/* Compact 6-Slot Target Selector Strip */}
      <div className="shrink-0 px-2 sm:px-3 py-1.5 bg-[#151C25] border-b border-white/10 flex flex-col gap-1.5">
        <div
          className="grid grid-cols-6 gap-1 sm:gap-1.5"
          role="tablist"
          aria-label="Select battlefield slot to configure"
        >
          {slots.map((slot) => {
            const def = slot.skillId
              ? skillRegistry.getDefinition(slot.skillId)
              : undefined;
            const isActiveTarget = slot.index === targetSlot?.index;
            return (
              <button
                key={slot.index}
                type="button"
                role="tab"
                aria-selected={isActiveTarget}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setTargetSlotIndex(slot.index);
                  setSelectedSkillId(null);
                }}
                className={`min-h-[38px] px-1.5 py-1 rounded-lg border flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isActiveTarget
                    ? 'bg-[#223042] border-amber-400 text-white ring-1 ring-amber-400/50'
                    : 'bg-[#0F141B] hover:bg-[#18202B] border-white/10 text-slate-300'
                }`}
              >
                <span className="font-mono-tabular text-[10px] font-bold text-slate-400 shrink-0">
                  {slot.index + 1}
                </span>
                {def && slot.skillId ? (
                  <>
                    {renderSkillIcon(slot.skillId, def.accentColor, 'w-3.5 h-3.5 shrink-0')}
                    <span className="hidden md:inline text-[11px] font-semibold truncate">
                      {def.shortLabel}
                    </span>
                    <span className="font-mono-tabular text-[9px] font-bold text-amber-300 shrink-0">
                      L{slot.level}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Empty
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active Target Slot Info Line */}
        <div className="flex items-center justify-between gap-2 text-[11px] px-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 font-semibold shrink-0">
              Slot {(targetSlot?.index ?? 0) + 1}:
            </span>
            {targetDef && targetSlot?.skillId ? (
              <span className="flex items-center gap-1.5 font-bold text-white truncate">
                {renderSkillIcon(
                  targetSlot.skillId,
                  targetDef.accentColor,
                  'w-3.5 h-3.5 shrink-0'
                )}
                <span className="truncate">{targetDef.name}</span>
                <span className="font-mono-tabular text-amber-300 shrink-0">
                  Lv.{targetSlot.level}
                  {targetSlot.level >= MAX_SKILL_LEVEL ? ' Max' : ''}
                </span>
              </span>
            ) : (
              <span className="text-slate-300 font-semibold">
                Vacant Slot — Select an unlocked skill to equip
              </span>
            )}
          </div>

          {canUpgradeTargetSlot && targetSlot?.skillId && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onApplyPendingUpgrade?.(targetSlot.skillId!);
              }}
              className="h-7 px-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              <span>Upgrade Pending</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Unlocked Skills Selection List */}
      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-2 sm:p-3 space-y-3 bg-[#10151B]">
        {/* Section 1: Unequipped Unlocked Skills Available for Replacement */}
        <section aria-label="Available unequipped skills" className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              Available to {targetDef ? 'Replace' : 'Equip'} ({availableSkills.length})
            </h3>
            <span className="text-[10px] text-slate-400">
              Tap a skill to select
            </span>
          </div>

          {availableSkills.length === 0 ? (
            <div className="rounded-xl bg-[#161D26] border border-white/10 p-3 sm:p-4 text-center">
              <Sparkles className="w-5 h-5 text-amber-400/80 mx-auto mb-1" />
              <div className="text-xs font-bold text-slate-200">
                All unlocked skills are currently equipped
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Use Summon to unlock more skills and expand your options. Replaced skills always stay saved in your collection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2">
              {availableSkills.map((entry) => {
                const def = skillRegistry.getDefinition(entry.skillId);
                if (!def) return null;
                const rarityMeta = getSkillRarityStyles(def.rarity);
                const battleLevel = getBattleLevelForSkill(entry.skillId);
                const isSelected = validSelectedSkillId === entry.skillId;
                const pendingCount = pendingBySkill.get(entry.skillId) ?? 0;

                return (
                  <button
                    key={entry.skillId}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setSelectedSkillId((curr) =>
                        curr === entry.skillId ? null : entry.skillId
                      );
                    }}
                    className={`min-h-[68px] p-2 sm:p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      isSelected
                        ? 'bg-[#1B2B3A] border-amber-400 ring-1 ring-amber-400/60 shadow-md'
                        : 'bg-[#161E28] hover:bg-[#1B2532] border-emerald-500/30 hover:border-emerald-400/65'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 mt-0.5"
                      style={{
                        backgroundColor: `${def.accentColor}1E`,
                        borderColor: `${def.accentColor}88`,
                      }}
                    >
                      {renderSkillIcon(entry.skillId, def.accentColor, 'w-4.5 h-4.5')}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-extrabold text-white truncate">
                          {def.name}
                        </span>
                        <span
                          className={`font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none shrink-0 ${
                            battleLevel >= MAX_SKILL_LEVEL
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                              : 'bg-[#0E1319] border-white/15 text-amber-300'
                          }`}
                        >
                          Lv.{battleLevel}
                          {battleLevel >= MAX_SKILL_LEVEL ? ' MAX' : ''}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center flex-wrap gap-1">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-px rounded border leading-tight ${rarityMeta.badgeClass}`}
                        >
                          {rarityMeta.label}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-px rounded border leading-tight ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                              : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Available'}
                        </span>
                        {entry.collectionLevel > 1 && (
                          <span className="font-mono-tabular text-[9px] font-semibold text-sky-300">
                            Col. Lv.{entry.collectionLevel}
                          </span>
                        )}
                        {pendingCount > 0 && (
                          <span className="font-mono-tabular text-[9px] font-bold px-1 py-px rounded bg-sky-500/20 border border-sky-400/45 text-sky-200">
                            +{pendingCount} Pending
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[11px] text-slate-300 leading-snug line-clamp-2">
                        {def.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Currently Equipped Skills (Distinguished & Non-Duplicable) */}
        {equippedSkills.length > 0 && (
          <section aria-label="Currently equipped skills" className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Currently Equipped ({equippedSkills.length}/6)
              </h3>
              <span className="text-[10px] text-slate-500">
                1 copy per battlefield
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2">
              {equippedSkills.map((entry) => {
                const def = skillRegistry.getDefinition(entry.skillId);
                if (!def) return null;
                const equippedSlot = equippedSlotBySkill.get(entry.skillId);
                const isInTargetSlot = equippedSlot?.index === targetSlot?.index;
                const rarityMeta = getSkillRarityStyles(def.rarity);
                const battleLevel = equippedSlot?.level ?? 1;

                return (
                  <div
                    key={entry.skillId}
                    aria-label={`${def.name}, currently equipped in Slot ${
                      (equippedSlot?.index ?? 0) + 1
                    }`}
                    className={`p-2 sm:p-2.5 rounded-xl border flex items-start gap-2.5 ${
                      isInTargetSlot
                        ? 'bg-[#19222E] border-amber-400/55'
                        : 'bg-[#131922] border-white/10 opacity-75'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 mt-0.5"
                      style={{
                        backgroundColor: `${def.accentColor}15`,
                        borderColor: `${def.accentColor}55`,
                      }}
                    >
                      {renderSkillIcon(entry.skillId, def.accentColor, 'w-4.5 h-4.5')}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-slate-100 truncate">
                          {def.name}
                        </span>
                        <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0E1319] border border-white/10 text-amber-300 leading-none shrink-0">
                          Lv.{battleLevel}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center flex-wrap gap-1">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-px rounded border leading-tight ${rarityMeta.badgeClass}`}
                        >
                          {rarityMeta.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-px rounded border leading-tight ${
                            isInTargetSlot
                              ? 'bg-amber-500/15 border-amber-400/45 text-amber-200'
                              : 'bg-slate-800/80 border-slate-600/50 text-slate-300'
                          }`}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                          {isInTargetSlot
                            ? `In Slot ${(targetSlot?.index ?? 0) + 1}`
                            : `Equipped · Slot ${(equippedSlot?.index ?? 0) + 1}`}
                        </span>
                        {entry.collectionLevel > 1 && (
                          <span className="font-mono-tabular text-[9px] font-semibold text-sky-300">
                            Col. Lv.{entry.collectionLevel}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {def.summary}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Pinned Confirmation Footer — Prevents Accidental Replacement */}
      <footer className="shrink-0 px-2.5 sm:px-3 py-2 border-t border-white/10 bg-[#18202A] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0 text-[11px] text-slate-300 truncate">
          {selectedDef && validSelectedSkillId ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="text-slate-400 shrink-0">
                Slot {(targetSlot?.index ?? 0) + 1}:
              </span>
              <span className="font-semibold text-slate-200 truncate">
                {targetDef
                  ? `${targetDef.shortLabel} Lv.${targetSlot.level}`
                  : 'Empty'}
              </span>
              <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="font-bold text-emerald-300 truncate">
                {selectedDef.shortLabel} Lv.{selectedBattleLevel}
              </span>
            </span>
          ) : (
            <span className="text-slate-400">
              {availableSkills.length > 0
                ? 'Select an available skill above, then confirm replacement.'
                : 'Replaced skills remain saved with their level in your collection.'}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            className="min-h-[38px] px-3.5 rounded-lg bg-[#222C38] hover:bg-[#2C3948] border border-white/15 text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!validSelectedSkillId}
            onClick={(e) => {
              e.currentTarget.blur();
              handleConfirmSwitch();
            }}
            className={`min-h-[38px] px-4 rounded-lg border text-xs font-extrabold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              validSelectedSkillId
                ? 'bg-amber-500 hover:bg-amber-400 active:scale-95 border-amber-300 text-slate-950 shadow-md cursor-pointer'
                : 'bg-[#1D242E] border-white/10 text-slate-500 cursor-not-allowed'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>
              {selectedDef
                ? targetDef
                  ? `Replace with ${selectedDef.shortLabel}`
                  : `Equip ${selectedDef.shortLabel}`
                : targetDef
                  ? 'Replace Skill'
                  : 'Equip Skill'}
            </span>
          </button>
        </div>
      </footer>
    </BattlefieldPanel>
  );
}
