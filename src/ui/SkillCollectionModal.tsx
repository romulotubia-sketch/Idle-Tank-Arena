import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpCircle,
  BookOpen,
  CheckCircle2,
  Layers,
  Lock,
  Sparkles,
} from 'lucide-react';
import { SKILL_COLLECTION_CONFIG } from '../game/constants';
import {
  SkillCollectionComputedBonuses,
  SkillCollectionPreviewRow,
} from '../game/systems/SkillCollectionSystem';
import { skillRegistry } from '../game/systems/skills/SkillRegistry';
import { SkillCollectionEntry, SkillId, SkillRarity } from '../game/types';
import { renderSkillIcon } from './BottomHud';
import { BattlefieldPanel } from './components/BattlefieldPanel';

export interface SkillCollectionFeedbackInfo {
  text: string;
  tone: 'success' | 'error';
}

type MobileCollectionTab = 'collection' | 'details';

interface SkillCollectionModalProps {
  entries: SkillCollectionEntry[];
  unlockedCount: number;
  totalFragments: number;
  feedback: SkillCollectionFeedbackInfo | null;
  highlightedSkillId: SkillId | null;
  getBonusPreviewRows: (skillId: SkillId) => SkillCollectionPreviewRow[];
  getComputedBonuses: (skillId: SkillId) => SkillCollectionComputedBonuses;
  onUpgradeSkill: (skillId: SkillId) => void;
  onClose: () => void;
}

function getRarityStyles(rarity: SkillRarity): {
  label: string;
  badgeClass: string;
} {
  switch (rarity) {
    case 'common':
      return {
        label: 'Common',
        badgeClass: 'bg-slate-700/50 border-slate-500/40 text-slate-200',
      };
    case 'rare':
      return {
        label: 'Rare',
        badgeClass: 'bg-sky-900/55 border-sky-400/50 text-sky-200',
      };
    case 'epic':
      return {
        label: 'Epic',
        badgeClass: 'bg-violet-900/55 border-violet-400/50 text-violet-200',
      };
    case 'legendary':
      return {
        label: 'Legendary',
        badgeClass: 'bg-amber-900/55 border-amber-400/50 text-amber-200',
      };
  }
}

export function SkillCollectionModal({
  entries,
  unlockedCount,
  totalFragments,
  feedback,
  highlightedSkillId,
  getBonusPreviewRows,
  getComputedBonuses,
  onUpgradeSkill,
  onClose,
}: SkillCollectionModalProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<SkillId>(
    entries[0]?.skillId ?? 'cannon'
  );
  const [mobileTab, setMobileTab] = useState<MobileCollectionTab>('collection');

  const selectedEntry =
    entries.find((e) => e.skillId === selectedSkillId) ?? entries[0];
  const selectedDef = selectedEntry
    ? skillRegistry.getDefinition(selectedEntry.skillId)
    : undefined;
  const selectedModule = selectedEntry
    ? skillRegistry.getModule(selectedEntry.skillId)
    : undefined;

  const upgradeableCount = entries.filter((e) => e.canUpgrade).length;
  const previewRows = selectedEntry
    ? getBonusPreviewRows(selectedEntry.skillId)
    : [];
  const selectedBonuses = selectedEntry
    ? getComputedBonuses(selectedEntry.skillId)
    : undefined;

  const progressRatio =
    selectedEntry && selectedEntry.unlocked
      ? selectedEntry.isMaxLevel
        ? 1
        : selectedEntry.nextUpgradeCost
          ? Math.max(
              0,
              Math.min(
                1,
                selectedEntry.fragments / selectedEntry.nextUpgradeCost
              )
            )
          : 0
      : 0;

  const rarityMeta = selectedDef
    ? getRarityStyles(selectedDef.rarity)
    : getRarityStyles('common');

  const baseCooldownSeconds =
    selectedModule && selectedEntry
      ? selectedModule.getCooldown(1, selectedBonuses)
      : 0;

  return (
    <BattlefieldPanel
      title="Skill Collection"
      icon={<BookOpen className="w-4 h-4 text-emerald-400" />}
      variant="wide"
      closeLabel="Close Skill Collection"
      onClose={onClose}
      feedback={feedback}
      headerMeta={
        <>
          <span className="font-mono-tabular text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#0E1319] border border-white/10 text-emerald-300">
            {unlockedCount}/{entries.length}
          </span>
          {upgradeableCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 font-mono-tabular text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/50 text-amber-300">
              <Sparkles className="w-3 h-3" />
              {upgradeableCount} Ready
            </span>
          )}
        </>
      }
      headerActions={
        <div
          title="Total Skill Fragments"
          className="flex items-center gap-1 bg-[#10151B] border border-sky-500/35 rounded-md px-2 py-1"
        >
          <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-mono-tabular text-xs font-bold text-sky-300">
            {totalFragments}
          </span>
        </div>
      }
    >
      {/* Compact Tabs only for narrow portrait screens (< sm) */}
      <div className="flex sm:hidden items-center gap-1.5 px-2.5 py-1.5 bg-[#151C25] border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setMobileTab('collection');
          }}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-colors ${
            mobileTab === 'collection'
              ? 'bg-[#202B38] border-amber-400/70 text-amber-200'
              : 'bg-[#10151C] border-white/10 text-slate-400'
          }`}
        >
          All Skills ({entries.length})
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setMobileTab('details');
          }}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-colors truncate ${
            mobileTab === 'details'
              ? 'bg-[#202B38] border-amber-400/70 text-amber-200'
              : 'bg-[#10151C] border-white/10 text-slate-400'
          }`}
        >
          {selectedDef ? `${selectedDef.shortLabel} Details` : 'Details'}
        </button>
      </div>

      {/* Responsive Split: Side-by-side on Mobile Landscape (sm+) & Desktop */}
      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(240px,1fr)] md:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)] overflow-hidden">
        {/* LEFT: 8 Skill Collection Cards */}
        <section
          aria-label="Skill cards"
          className={`${
            mobileTab === 'collection' ? 'flex' : 'hidden sm:flex'
          } flex-col min-h-0 overflow-y-auto panel-scroll p-2 sm:p-2.5 sm:border-r border-white/10 bg-[#10151B]`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">
            {entries.map((entry) => {
              const def = skillRegistry.getDefinition(entry.skillId);
              if (!def) return null;

              const isSelected = selectedEntry?.skillId === entry.skillId;
              const isHighlighted = highlightedSkillId === entry.skillId;
              const cardProgress =
                entry.unlocked && entry.nextUpgradeCost
                  ? Math.max(
                      0,
                      Math.min(100, (entry.fragments / entry.nextUpgradeCost) * 100)
                    )
                  : entry.isMaxLevel
                    ? 100
                    : 0;

              return (
                <button
                  key={entry.skillId}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setSelectedSkillId(entry.skillId);
                    setMobileTab('details');
                  }}
                  aria-pressed={isSelected}
                  className={`relative flex flex-col justify-between gap-1.5 p-2 rounded-lg border text-left transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                    isHighlighted
                      ? 'bg-emerald-950/50 border-emerald-400 animate-summon-pop'
                      : isSelected
                        ? 'bg-[#1A2634] border-amber-400 shadow-md'
                        : entry.unlocked
                          ? 'bg-[#161D26] hover:bg-[#1C2531] border-white/12'
                          : 'bg-[#12161C] hover:bg-[#161B23] border-white/8 opacity-80'
                  }`}
                >
                  {/* Top Row: Icon + Level / Lock */}
                  <div className="flex items-start justify-between gap-1">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center border shrink-0"
                      style={{
                        backgroundColor: entry.unlocked
                          ? `${def.accentColor}1A`
                          : 'rgba(15, 23, 42, 0.7)',
                        borderColor: entry.unlocked
                          ? `${def.accentColor}66`
                          : 'rgba(148, 163, 184, 0.2)',
                      }}
                    >
                      {entry.unlocked ? (
                        renderSkillIcon(entry.skillId, def.accentColor, 'w-4 h-4')
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-0.5">
                      {entry.unlocked ? (
                        <span
                          className={`font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${
                            entry.isMaxLevel
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                              : 'bg-[#0F141B] border-white/15 text-amber-300'
                          }`}
                        >
                          {entry.isMaxLevel
                            ? `MAX`
                            : `Lv.${entry.collectionLevel}/${entry.maxCollectionLevel}`}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-600/50 text-slate-400 leading-none">
                          Locked
                        </span>
                      )}

                      {entry.canUpgrade && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-300">
                          <ArrowUpCircle className="w-2.5 h-2.5" />
                          Ready
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Name */}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {def.name}
                    </div>
                    <p className="hidden md:line-clamp-2 mt-0.5 text-[10px] leading-snug text-slate-400">
                      {def.summary}
                    </p>
                  </div>

                  {/* Bottom: Fragment Counter & Progress */}
                  <div className="flex flex-col gap-1 pt-1 border-t border-white/8">
                    <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                      <span
                        className={
                          entry.unlocked ? 'text-sky-300 font-semibold' : 'text-slate-500'
                        }
                      >
                        {entry.unlocked ? 'Frags' : 'Summon'}
                      </span>
                      {entry.unlocked && (
                        <span
                          className={
                            entry.canUpgrade
                              ? 'text-emerald-300 font-bold'
                              : 'text-slate-300'
                          }
                        >
                          {entry.isMaxLevel
                            ? `${entry.fragments}`
                            : `${entry.fragments}/${entry.nextUpgradeCost}`}
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#0B0F14] overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all duration-200 ${
                          entry.isMaxLevel
                            ? 'bg-amber-400'
                            : entry.canUpgrade
                              ? 'bg-emerald-400'
                              : 'bg-sky-400/80'
                        }`}
                        style={{ width: `${cardProgress}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Selected Skill Details + Pinned Bottom Upgrade Bar */}
        <section
          aria-label="Selected skill details"
          className={`${
            mobileTab === 'details' ? 'flex' : 'hidden sm:flex'
          } flex-col min-h-0 bg-[#141B23] overflow-hidden`}
        >
          {selectedEntry && selectedDef ? (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-2.5 sm:p-3 flex flex-col gap-2">
                {/* Identity Header */}
                <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center border shrink-0"
                    style={{
                      backgroundColor: selectedEntry.unlocked
                        ? `${selectedDef.accentColor}22`
                        : 'rgba(15, 23, 42, 0.75)',
                      borderColor: selectedEntry.unlocked
                        ? selectedDef.accentColor
                        : 'rgba(148, 163, 184, 0.3)',
                    }}
                  >
                    {renderSkillIcon(
                      selectedEntry.skillId,
                      selectedEntry.unlocked ? selectedDef.accentColor : '#64748B',
                      'w-5 h-5'
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <h3 className="text-sm font-bold text-white truncate">
                        {selectedDef.name}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${rarityMeta.badgeClass}`}
                      >
                        {rarityMeta.label}
                      </span>
                    </div>

                    <div className="mt-0.5">
                      {selectedEntry.unlocked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          Collection Lv.{selectedEntry.collectionLevel}/
                          {selectedEntry.maxCollectionLevel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                          <Lock className="w-3 h-3 shrink-0" />
                          Locked · Unlock via Skill Summon
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Skill Description & Base Cooldown */}
                <div className="rounded-lg bg-[#0F141B] border border-white/10 p-2 flex flex-col gap-1">
                  <p className="text-[11px] sm:text-xs text-slate-200 leading-snug">
                    {selectedDef.summary}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/8 font-mono-tabular">
                    <span>Lv.1 Cooldown</span>
                    <span className="text-slate-200 font-semibold">
                      {baseCooldownSeconds.toFixed(2)}s
                    </span>
                  </div>
                </div>

                {/* Fragment Balance & Progress */}
                <div className="rounded-lg bg-[#0F141B] border border-white/10 p-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-200">
                      {selectedDef.shortLabel} Fragments
                    </span>
                    <span className="font-mono-tabular text-[11px] font-bold text-sky-300">
                      {selectedEntry.unlocked
                        ? selectedEntry.isMaxLevel
                          ? `${selectedEntry.fragments} (MAX)`
                          : `${selectedEntry.fragments} / ${selectedEntry.nextUpgradeCost}`
                        : '0'}
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-[#090D12] overflow-hidden border border-white/10">
                    <div
                      className={`h-full transition-all duration-200 ${
                        selectedEntry.isMaxLevel
                          ? 'bg-amber-400'
                          : selectedEntry.canUpgrade
                            ? 'bg-emerald-400'
                            : 'bg-sky-400'
                      }`}
                      style={{ width: `${Math.round(progressRatio * 100)}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-slate-400 leading-snug">
                    Summoning grants +{SKILL_COLLECTION_CONFIG.duplicateDiscoveryFragments}{' '}
                    Fragments (+{SKILL_COLLECTION_CONFIG.firstDiscoveryFragments} on unlock).
                  </p>
                </div>

                {/* Permanent Stat Scaling Preview */}
                <div className="rounded-lg bg-[#0F141B] border border-white/10 p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Permanent Bonuses
                    </span>
                    <span className="font-mono-tabular text-[10px] font-bold text-amber-300">
                      {selectedEntry.unlocked
                        ? selectedEntry.isMaxLevel
                          ? `Lv.${selectedEntry.collectionLevel} MAX`
                          : `Lv.${selectedEntry.collectionLevel} → Lv.${selectedEntry.collectionLevel + 1}`
                        : 'At Lv.1'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {previewRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-2 text-[11px] bg-[#141B23] border border-white/8 rounded-md px-2 py-1"
                      >
                        <span className="text-slate-300 truncate">{row.label}</span>
                        <div className="flex items-center gap-1 font-mono-tabular font-bold shrink-0">
                          <span className="text-white">{row.currentText}</span>
                          {row.nextText && selectedEntry.unlocked && (
                            <>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="text-emerald-300">
                                {row.nextText}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sticky Pinned Upgrade Button — Always Visible Without Scrolling */}
              <div className="shrink-0 p-2 sm:p-2.5 border-t border-white/10 bg-[#121820]">
                {!selectedEntry.unlocked ? (
                  <div className="w-full py-2 px-3 rounded-lg bg-[#1A212B] border border-white/10 text-center text-[11px] font-semibold text-slate-400">
                    Summon {selectedDef.name} to unlock upgrades
                  </div>
                ) : selectedEntry.isMaxLevel ? (
                  <div className="w-full py-2 px-3 rounded-lg bg-amber-500/15 border border-amber-400/50 text-center text-xs font-bold text-amber-200">
                    Max Collection Level (Lv.{selectedEntry.maxCollectionLevel})
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!selectedEntry.canUpgrade}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onUpgradeSkill(selectedEntry.skillId);
                    }}
                    className={`w-full min-h-[40px] py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 ${
                      selectedEntry.canUpgrade
                        ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 shadow-md cursor-pointer'
                        : 'bg-[#1D242E] border-white/10 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Upgrade Lv.{selectedEntry.collectionLevel + 1} ·{' '}
                      {selectedEntry.nextUpgradeCost} Frags
                    </span>
                  </button>
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </BattlefieldPanel>
  );
}
