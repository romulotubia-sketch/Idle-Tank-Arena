import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpCircle,
  Check,
  ListOrdered,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { MAX_LEVEL_OVERFLOW_FRAGMENTS, MAX_SKILL_LEVEL } from '../game/constants';
import { skillRegistry } from '../game/systems/skills/SkillRegistry';
import {
  cloneAutoUpgradeSettings,
  createDefaultAutoUpgradeSettings,
} from '../game/systems/SkillUpgradeSystem';
import {
  AutoUpgradeSettings,
  MaxLevelDuplicateBehavior,
  SkillId,
  SkillUpgradePriorityMode,
} from '../game/types';
import { renderSkillIcon } from './BottomHud';
import { BattlefieldPanel } from './components/BattlefieldPanel';

interface AutoUpgradeSettingsModalProps {
  enabled: boolean;
  totalAutoUpgrades: number;
  settings: AutoUpgradeSettings;
  onToggleEnabled: () => void;
  onSaveSettings: (next: AutoUpgradeSettings) => void;
  onResetSettings: () => AutoUpgradeSettings;
  onClose: () => void;
}

const OVERFLOW_OPTIONS: {
  id: MaxLevelDuplicateBehavior;
  label: string;
  desc: string;
}[] = [
  {
    id: 'convert_fragments',
    label: `+${MAX_LEVEL_OVERFLOW_FRAGMENTS} Collection Frags`,
    desc: 'Convert Lv.5 duplicates into permanent Skill Fragments',
  },
  {
    id: 'refund_coins',
    label: '50% Coin Refund',
    desc: 'Refund half the Summon cost when skill is already Lv.5',
  },
  {
    id: 'store_pending',
    label: 'Store Pending',
    desc: 'Keep Lv.5 duplicates in Pending queue',
  },
];

export function AutoUpgradeSettingsModal({
  enabled,
  totalAutoUpgrades,
  settings,
  onToggleEnabled,
  onSaveSettings,
  onResetSettings,
  onClose,
}: AutoUpgradeSettingsModalProps) {
  const [draft, setDraft] = useState<AutoUpgradeSettings>(() =>
    cloneAutoUpgradeSettings(settings)
  );
  const [notice, setNotice] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  const enabledSkillsCount = draft.skillPriorities.filter(
    (id) => draft.enabledSkills[id]
  ).length;

  const handleMovePriority = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= draft.skillPriorities.length) return;
    setDraft((prev) => {
      const nextList = [...prev.skillPriorities];
      const moved = nextList[index];
      nextList[index] = nextList[targetIdx];
      nextList[targetIdx] = moved;
      return {
        ...prev,
        skillPriorities: nextList,
      };
    });
  };

  const handleToggleSkill = (skillId: SkillId) => {
    setDraft((prev) => ({
      ...prev,
      enabledSkills: {
        ...prev.enabledSkills,
        [skillId]: !prev.enabledSkills[skillId],
      },
    }));
  };

  const handleSetAllSkills = (val: boolean) => {
    setDraft((prev) => {
      const nextMap = { ...prev.enabledSkills };
      for (const id of prev.skillPriorities) {
        nextMap[id] = val;
      }
      return {
        ...prev,
        enabledSkills: nextMap,
      };
    });
  };

  const handleSetPriorityMode = (mode: SkillUpgradePriorityMode) => {
    setDraft((prev) => ({ ...prev, priorityMode: mode }));
  };

  const handleReset = () => {
    const reset = onResetSettings();
    setDraft(
      cloneAutoUpgradeSettings(reset ?? createDefaultAutoUpgradeSettings())
    );
    setNotice({
      text: 'Auto Upgrade settings reset to defaults',
      tone: 'success',
    });
  };

  const handleSave = () => {
    onSaveSettings(cloneAutoUpgradeSettings(draft));
    onClose();
  };

  return (
    <BattlefieldPanel
      title="Auto Upgrade Settings"
      icon={<SlidersHorizontal className="w-4 h-4 text-emerald-400" />}
      variant="modal"
      ariaLabel="Auto Upgrade Settings"
      closeLabel="Close Auto Upgrade Settings"
      onClose={onClose}
      feedback={notice}
      headerMeta={
        <span className="font-mono-tabular text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#10151B] border border-emerald-500/35 text-emerald-300 shrink-0">
          {totalAutoUpgrades} Auto Upgraded
        </span>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-2.5 sm:p-3.5 space-y-3">
        {/* Status Banner & Master Toggle */}
        <section className="p-2.5 rounded-xl bg-[#18202A] border border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <ArrowUpCircle
                className={`w-4 h-4 shrink-0 ${
                  enabled ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Auto Upgrade: {enabled ? 'Active' : 'Paused'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Automatically applies stored &amp; incoming duplicate skills to
              equipped slots up to Level {MAX_SKILL_LEVEL}.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleEnabled}
            aria-pressed={enabled}
            className={`h-9 px-3 rounded-lg border text-xs font-extrabold shrink-0 cursor-pointer transition-colors ${
              enabled
                ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 text-slate-950'
                : 'bg-[#222C38] hover:bg-[#2B3746] border-white/15 text-slate-200'
            }`}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </section>

        {/* Priority Mode & Lv.5 Overflow Rule */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <section className="p-2.5 rounded-xl bg-[#18202A] border border-white/10 space-y-2">
            <div className="flex items-center gap-1.5">
              <ListOrdered className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Upgrade Priority Mode
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => handleSetPriorityMode('custom_priority')}
                aria-pressed={draft.priorityMode === 'custom_priority'}
                className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                  draft.priorityMode === 'custom_priority'
                    ? 'bg-sky-950/40 border-sky-400 text-white'
                    : 'bg-[#11161D] border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="text-[11px] font-bold">
                  Custom Skill Priority Order
                </div>
                <div className="text-[10px] text-slate-400">
                  Upgrades equipped skills following your ranked order below
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSetPriorityMode('lowest_level')}
                aria-pressed={draft.priorityMode === 'lowest_level'}
                className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                  draft.priorityMode === 'lowest_level'
                    ? 'bg-sky-950/40 border-sky-400 text-white'
                    : 'bg-[#11161D] border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="text-[11px] font-bold">
                  Lowest-Level Equipped Skill First
                </div>
                <div className="text-[10px] text-slate-400">
                  Balances all equipped skills before pushing higher levels
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  ignoreMaxLevel: !prev.ignoreMaxLevel,
                }))
              }
              aria-pressed={draft.ignoreMaxLevel}
              className={`w-full px-2.5 py-2 rounded-lg border flex items-center justify-between gap-2 text-left cursor-pointer ${
                draft.ignoreMaxLevel
                  ? 'bg-emerald-950/35 border-emerald-500/50 text-emerald-100'
                  : 'bg-[#11161D] border-white/10 text-slate-300'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold">
                  Ignore Max-Level (Lv.{MAX_SKILL_LEVEL}) Skills
                </div>
                <div className="text-[10px] text-slate-400">
                  Lv.{MAX_SKILL_LEVEL} hard cap is always protected
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                  draft.ignoreMaxLevel
                    ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                    : 'bg-[#1C2530] border-white/15 text-slate-300'
                }`}
              >
                {draft.ignoreMaxLevel ? 'ON' : 'OFF'}
              </span>
            </button>
          </section>

          <section className="p-2.5 rounded-xl bg-[#18202A] border border-white/10 space-y-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Max-Level (Lv.{MAX_SKILL_LEVEL}) Duplicate Overflow
              </h3>
            </div>

            <div className="space-y-1.5">
              {OVERFLOW_OPTIONS.map((opt) => {
                const selected = draft.maxLevelOverflow === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, maxLevelOverflow: opt.id }))
                    }
                    aria-pressed={selected}
                    className={`w-full p-2 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-amber-950/35 border-amber-400 text-amber-100'
                        : 'bg-[#11161D] border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold">{opt.label}</div>
                      <div className="text-[10px] text-slate-400">
                        {opt.desc}
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        selected
                          ? 'bg-amber-400 border-amber-200 text-slate-950'
                          : 'border-white/20 text-transparent'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Per-Skill Priority Order & Enable/Disable */}
        <section className="p-2.5 rounded-xl bg-[#18202A] border border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Skill Priority &amp; Auto Upgrade ({enabledSkillsCount}/
              {draft.skillPriorities.length} Enabled)
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSetAllSkills(true)}
                className="px-2 py-0.5 rounded bg-[#222B37] hover:bg-[#2C3847] border border-white/10 text-[10px] font-semibold text-slate-200 cursor-pointer"
              >
                Enable All
              </button>
              <button
                type="button"
                onClick={() => handleSetAllSkills(false)}
                className="px-2 py-0.5 rounded bg-[#222B37] hover:bg-[#2C3847] border border-white/10 text-[10px] font-semibold text-slate-300 cursor-pointer"
              >
                Disable All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {draft.skillPriorities.map((skillId, idx) => {
              const def = skillRegistry.getDefinition(skillId);
              if (!def) return null;
              const isSkillEnabled = draft.enabledSkills[skillId];
              return (
                <div
                  key={skillId}
                  className={`px-2 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${
                    isSkillEnabled
                      ? 'bg-[#11171F] border-white/12'
                      : 'bg-[#0E1217] border-white/5 opacity-65'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-tabular text-[10px] font-bold text-slate-400 w-5 text-right shrink-0">
                      #{idx + 1}
                    </span>
                    {renderSkillIcon(skillId, def.accentColor, 'w-4 h-4 shrink-0')}
                    <span className="text-[11px] font-bold text-white truncate">
                      {def.name}
                    </span>
                    <span className="hidden sm:inline text-[9px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
                      {def.rarity}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMovePriority(idx, -1)}
                      aria-label={`Move ${def.name} priority up`}
                      className="w-7 h-7 rounded bg-[#1B232E] hover:bg-[#253140] border border-white/10 flex items-center justify-center text-slate-300 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === draft.skillPriorities.length - 1}
                      onClick={() => handleMovePriority(idx, 1)}
                      aria-label={`Move ${def.name} priority down`}
                      className="w-7 h-7 rounded bg-[#1B232E] hover:bg-[#253140] border border-white/10 flex items-center justify-center text-slate-300 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSkill(skillId)}
                      aria-pressed={isSkillEnabled}
                      aria-label={`Toggle Auto Upgrade for ${def.name}`}
                      className={`h-7 px-2 rounded border text-[10px] font-bold cursor-pointer ${
                        isSkillEnabled
                          ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                          : 'bg-[#1D2530] border-white/15 text-slate-400'
                      }`}
                    >
                      {isSkillEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="shrink-0 px-2.5 sm:px-3 py-2 border-t border-white/10 bg-[#18202A] flex items-center justify-between gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#222B37] hover:bg-[#2C3746] border border-rose-500/40 text-[11px] sm:text-xs font-bold text-rose-200 flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Reset</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#202934] hover:bg-[#2A3646] border border-white/15 text-[11px] sm:text-xs font-bold text-slate-200 transition-colors active:scale-95 cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-9 px-3 sm:px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 border border-emerald-300/70 text-[11px] sm:text-xs font-extrabold text-slate-950 flex items-center gap-1.5 shadow-md transition-colors active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 shrink-0" />
            <span>Save Settings</span>
          </button>
        </div>
      </footer>
    </BattlefieldPanel>
  );
}
