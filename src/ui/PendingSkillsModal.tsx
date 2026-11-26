import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpCircle,
  Check,
  Inbox,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  MAX_LEVEL_OVERFLOW_FRAGMENTS,
  MAX_SKILL_LEVEL,
} from '../game/constants';
import { skillRegistry } from '../game/systems/skills/SkillRegistry';
import { PendingSkillEntry, SkillId, SkillSlot } from '../game/types';
import { renderSkillIcon } from './BottomHud';
import { BattlefieldPanel } from './components/BattlefieldPanel';

interface PendingSkillsModalProps {
  skillSlots: SkillSlot[];
  pendingSkills: PendingSkillEntry[];
  focusedSkillId: SkillId | null;
  autoUpgradeEnabled: boolean;
  onEquipToSlot: (slotIndex: number, skillId: SkillId) => void;
  onApplyUpgrade: (skillId: SkillId) => void;
  onConvertOverflow: (skillId: SkillId) => void;
  onDiscardPending: (skillId: SkillId) => void;
  onClose: () => void;
}

export function PendingSkillsModal({
  skillSlots,
  pendingSkills,
  focusedSkillId,
  autoUpgradeEnabled,
  onEquipToSlot,
  onApplyUpgrade,
  onConvertOverflow,
  onDiscardPending,
  onClose,
}: PendingSkillsModalProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<SkillId | null>(() => {
    if (
      focusedSkillId &&
      pendingSkills.some((p) => p.skillId === focusedSkillId)
    ) {
      return focusedSkillId;
    }
    return pendingSkills[0]?.skillId ?? null;
  });
  const [confirmDiscardId, setConfirmDiscardId] = useState<SkillId | null>(null);

  const activeEntry =
    pendingSkills.find((p) => p.skillId === selectedSkillId) ??
    pendingSkills[0] ??
    null;

  const activeDef = activeEntry
    ? skillRegistry.getDefinition(activeEntry.skillId)
    : undefined;
  const equippedSlot = activeEntry
    ? skillSlots.find((s) => s.skillId === activeEntry.skillId)
    : undefined;

  const totalCopies = pendingSkills.reduce((sum, p) => sum + p.copies, 0);

  return (
    <BattlefieldPanel
      title="Pending Skills & Slot Replacement"
      icon={<Inbox className="w-4 h-4 text-sky-400" />}
      variant="modal"
      ariaLabel="Pending Skills"
      closeLabel="Keep Pending and Close"
      onClose={onClose}
      headerMeta={
        <span className="font-mono-tabular text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#10151B] border border-sky-500/35 text-sky-300 shrink-0">
          {totalCopies} Pending
        </span>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-2.5 sm:p-3.5 space-y-3">
        {pendingSkills.length === 0 || !activeEntry || !activeDef ? (
          <div className="py-10 px-4 text-center rounded-xl bg-[#18202A] border border-white/10">
            <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-200">
              No Pending Skills Waiting
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              When all 6 slots are full and you summon a skill not currently
              equipped, it appears here so you can replace a slot or keep it for
              later.
            </p>
          </div>
        ) : (
          <>
            {/* Pending Queue Selector Strip (when multiple skill types await) */}
            {pendingSkills.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {pendingSkills.map((entry) => {
                  const def = skillRegistry.getDefinition(entry.skillId);
                  if (!def) return null;
                  const isSelected = activeEntry.skillId === entry.skillId;
                  return (
                    <button
                      key={entry.skillId}
                      type="button"
                      onClick={() => {
                        setSelectedSkillId(entry.skillId);
                        setConfirmDiscardId(null);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#1B2D42] border-sky-400 text-white'
                          : 'bg-[#18202A] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {renderSkillIcon(entry.skillId, def.accentColor, 'w-3.5 h-3.5')}
                      <span>{def.shortLabel}</span>
                      <span className="font-mono-tabular text-[10px] px-1 rounded bg-black/40 text-amber-300">
                        x{entry.copies}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Featured / Selected Pending Skill Card */}
            <section
              className="p-3 rounded-xl bg-[#18202A] border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              style={{ borderColor: `${activeDef.accentColor}77` }}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className="w-11 h-11 rounded-lg bg-[#10161D] border flex items-center justify-center shrink-0"
                  style={{ borderColor: `${activeDef.accentColor}99` }}
                >
                  {renderSkillIcon(
                    activeEntry.skillId,
                    activeDef.accentColor,
                    'w-6 h-6'
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-extrabold text-white truncate">
                      {activeDef.name}
                    </h3>
                    <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-sky-200">
                      {activeEntry.copies}{' '}
                      {activeEntry.copies === 1 ? 'Copy' : 'Copies'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-slate-300">
                      {activeDef.rarity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {activeDef.summary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {confirmDiscardId === activeEntry.skillId ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onDiscardPending(activeEntry.skillId);
                        setConfirmDiscardId(null);
                      }}
                      className="h-8 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Discard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDiscardId(null)}
                      className="h-8 px-2 rounded-lg bg-[#232D3B] hover:bg-[#2C3849] text-slate-200 text-[11px] font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDiscardId(activeEntry.skillId)}
                    className="h-8 px-2.5 rounded-lg bg-[#212934] hover:bg-rose-950/60 border border-white/10 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Discard</span>
                  </button>
                )}
              </div>
            </section>

            {/* Context-Aware Action Section */}
            {equippedSlot ? (
              <section className="p-3 rounded-xl bg-[#18202A] border border-emerald-500/35 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-xs font-bold text-white">
                      Equipped in Slot {equippedSlot.index + 1} · Lv.
                      {equippedSlot.level}
                      {equippedSlot.level >= MAX_SKILL_LEVEL ? ' (Max)' : ''}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {equippedSlot.level >= MAX_SKILL_LEVEL
                        ? `Already at Level ${MAX_SKILL_LEVEL}. Convert excess copies into permanent Collection Fragments.`
                        : autoUpgradeEnabled
                          ? 'Upgrade immediately or adjust Auto Upgrade skill priorities.'
                          : 'Auto Upgrade is paused — tap below to apply a copy directly.'}
                    </div>
                  </div>

                  {equippedSlot.level < MAX_SKILL_LEVEL ? (
                    <button
                      type="button"
                      onClick={() => onApplyUpgrade(activeEntry.skillId)}
                      className="h-9 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow cursor-pointer shrink-0"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>
                        Upgrade Lv.{equippedSlot.level} <ArrowRight className="inline w-3 h-3" /> Lv.
                        {equippedSlot.level + 1}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onConvertOverflow(activeEntry.skillId)}
                      className="h-9 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        Convert (+
                        {activeEntry.copies * MAX_LEVEL_OVERFLOW_FRAGMENTS}{' '}
                        Frags)
                      </span>
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section className="p-2.5 sm:p-3 rounded-xl bg-[#18202A] border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Choose a Battlefield Slot to Equip / Replace
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    Tap any slot below to deploy {activeDef.shortLabel} Lv.1
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {skillSlots.slice(0, 6).map((slot) => {
                    const slotDef = slot.skillId
                      ? skillRegistry.getDefinition(slot.skillId)
                      : undefined;
                    return (
                      <button
                        key={slot.index}
                        type="button"
                        onClick={() =>
                          onEquipToSlot(slot.index, activeEntry.skillId)
                        }
                        className="p-2 rounded-lg bg-[#11171F] hover:bg-[#192534] border border-white/10 hover:border-amber-400/70 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded bg-[#18202A] border border-white/10 flex items-center justify-center shrink-0">
                            {slotDef && slot.skillId ? (
                              renderSkillIcon(
                                slot.skillId,
                                slotDef.accentColor,
                                'w-4 h-4'
                              )
                            ) : (
                              <span className="text-[10px] text-slate-500">
                                +
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-white truncate">
                              {slotDef ? slotDef.shortLabel : 'Vacant Slot'}
                            </div>
                            <div className="font-mono-tabular text-[10px] text-slate-400">
                              Slot {slot.index + 1}
                              {slotDef ? ` · Lv.${slot.level}` : ''}
                            </div>
                          </div>
                        </div>

                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-[10px] font-bold text-amber-300 shrink-0">
                          {slotDef ? 'Replace' : 'Equip'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <footer className="shrink-0 px-2.5 sm:px-3 py-2 border-t border-white/10 bg-[#18202A] flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400 truncate">
          {pendingSkills.length > 0
            ? 'Pending skills stay saved until you equip, upgrade, or discard them.'
            : 'All battlefield slots & pending skills are saved automatically.'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-3.5 rounded-lg bg-[#222C38] hover:bg-[#2C3948] border border-white/15 text-xs font-bold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {pendingSkills.length > 0 ? 'Keep Pending' : 'Close'}
        </button>
      </footer>
    </BattlefieldPanel>
  );
}
