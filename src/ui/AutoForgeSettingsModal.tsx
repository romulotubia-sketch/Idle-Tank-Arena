import { useState } from 'react';
import {
  Check,
  Coins,
  Filter,
  Flame,
  RotateCcw,
  Save,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import {
  EQUIPMENT_RARITY_CONFIG,
  EQUIPMENT_RARITY_ORDER,
  EQUIPMENT_SLOT_META,
  EQUIPMENT_STAT_LABELS,
  EQUIPMENT_STAT_ORDER,
} from '../game/data/equipmentCatalog';
import {
  cloneAutoForgeSettings,
  createDefaultAutoForgeSettings,
} from '../game/systems/AutoForgeSystem';
import {
  AutoForgeSettings,
  EquipmentRarity,
  EquipmentSlotType,
  EquipmentStatKey,
} from '../game/types';
import { BattlefieldPanel } from './components/BattlefieldPanel';

interface AutoForgeSettingsModalProps {
  settings: AutoForgeSettings;
  onSaveSettings: (next: AutoForgeSettings) => void;
  onResetSettings: () => AutoForgeSettings;
  onClose: () => void;
}

const STAT_STEP_CONFIG: Record<
  EquipmentStatKey,
  { step: string; unitHint: string }
> = {
  attackDamage: { step: '1', unitHint: 'DMG' },
  attackSpeed: { step: '0.01', unitHint: '/s' },
  critChance: { step: '0.5', unitHint: '%' },
  critDamage: { step: '0.05', unitHint: 'x' },
  maxHp: { step: '5', unitHint: 'HP' },
  armor: { step: '1', unitHint: 'ARM' },
  moveSpeed: { step: '1', unitHint: 'SPD' },
  skillDamage: { step: '1', unitHint: '%' },
};

export function AutoForgeSettingsModal({
  settings,
  onSaveSettings,
  onResetSettings,
  onClose,
}: AutoForgeSettingsModalProps) {
  const [draft, setDraft] = useState<AutoForgeSettings>(() =>
    cloneAutoForgeSettings(settings)
  );
  const [statInputs, setStatInputs] = useState<Record<EquipmentStatKey, string>>(
    () => {
      const map = {} as Record<EquipmentStatKey, string>;
      for (const key of EQUIPMENT_STAT_ORDER) {
        map[key] = String(settings.statFilters[key].minValue);
      }
      return map;
    }
  );
  const [maxSpendInput, setMaxSpendInput] = useState<string>(() =>
    String(settings.maxCoinSpend)
  );
  const [minReserveInput, setMinReserveInput] = useState<string>(() =>
    String(settings.minCoinReserve)
  );
  const [notice, setNotice] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  const enabledSlotsCount = EQUIPMENT_SLOT_META.filter(
    (m) => draft.enabledSlots[m.slot]
  ).length;
  const enabledStatsCount = EQUIPMENT_STAT_ORDER.filter(
    (k) => draft.statFilters[k].enabled
  ).length;
  const activeFilterCount =
    (draft.minRarity !== 'scrap' ? 1 : 0) +
    (enabledSlotsCount < EQUIPMENT_SLOT_META.length ? 1 : 0) +
    enabledStatsCount +
    (draft.requireSpecialEffect ? 1 : 0) +
    (draft.spendingLimitEnabled ? 1 : 0) +
    (draft.minCoinReserve > 0 ? 1 : 0);

  const handleSetRarity = (rarity: EquipmentRarity) => {
    setDraft((prev) => ({ ...prev, minRarity: rarity }));
  };

  const handleToggleSlot = (slot: EquipmentSlotType) => {
    setDraft((prev) => ({
      ...prev,
      enabledSlots: {
        ...prev.enabledSlots,
        [slot]: !prev.enabledSlots[slot],
      },
    }));
  };

  const handleSetAllSlots = (enabled: boolean) => {
    setDraft((prev) => ({
      ...prev,
      enabledSlots: {
        cannon: enabled,
        armor: enabled,
        engine: enabled,
        tracks: enabled,
        targeting_system: enabled,
        auxiliary_system: enabled,
      },
    }));
  };

  const handleToggleStat = (key: EquipmentStatKey) => {
    setDraft((prev) => ({
      ...prev,
      statFilters: {
        ...prev.statFilters,
        [key]: {
          ...prev.statFilters[key],
          enabled: !prev.statFilters[key].enabled,
        },
      },
    }));
  };

  const handleChangeStatMin = (key: EquipmentStatKey, rawValue: string) => {
    setStatInputs((prev) => ({ ...prev, [key]: rawValue }));
    if (rawValue.trim() === '') return;
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed >= 0) {
      setDraft((prev) => ({
        ...prev,
        statFilters: {
          ...prev.statFilters,
          [key]: {
            ...prev.statFilters[key],
            minValue: parsed,
          },
        },
      }));
    }
  };

  const handleBlurStatMin = (key: EquipmentStatKey) => {
    const raw = statInputs[key]?.trim() ?? '';
    const parsed = raw === '' ? 0 : Number(raw);
    const safeVal =
      Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setDraft((prev) => ({
      ...prev,
      statFilters: {
        ...prev.statFilters,
        [key]: {
          ...prev.statFilters[key],
          minValue: safeVal,
        },
      },
    }));
    setStatInputs((prev) => ({ ...prev, [key]: String(safeVal) }));
  };

  const handleReset = () => {
    const reset = onResetSettings();
    const cloned = cloneAutoForgeSettings(
      reset ?? createDefaultAutoForgeSettings()
    );
    setDraft(cloned);
    const nextStatInputs = {} as Record<EquipmentStatKey, string>;
    for (const key of EQUIPMENT_STAT_ORDER) {
      nextStatInputs[key] = String(cloned.statFilters[key].minValue);
    }
    setStatInputs(nextStatInputs);
    setMaxSpendInput(String(cloned.maxCoinSpend));
    setMinReserveInput(String(cloned.minCoinReserve));
    setNotice({
      text: 'Auto Forge preferences reset to defaults (gear & progress preserved)',
      tone: 'success',
    });
  };

  const handleSave = () => {
    const nextDraft = cloneAutoForgeSettings(draft);
    for (const key of EQUIPMENT_STAT_ORDER) {
      const raw = statInputs[key]?.trim() ?? '';
      const parsed = raw === '' ? 0 : Number(raw);
      nextDraft.statFilters[key].minValue =
        Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }
    const maxSpendParsed =
      maxSpendInput.trim() === '' ? 0 : Number(maxSpendInput);
    nextDraft.maxCoinSpend =
      Number.isFinite(maxSpendParsed) && maxSpendParsed >= 0
        ? Math.floor(maxSpendParsed)
        : 0;
    const minReserveParsed =
      minReserveInput.trim() === '' ? 0 : Number(minReserveInput);
    nextDraft.minCoinReserve =
      Number.isFinite(minReserveParsed) && minReserveParsed >= 0
        ? Math.floor(minReserveParsed)
        : 0;
    onSaveSettings(nextDraft);
    onClose();
  };

  const selectedRarityTier = EQUIPMENT_RARITY_CONFIG[draft.minRarity].tier;

  return (
    <BattlefieldPanel
      title="Auto Forge Settings"
      icon={<SlidersHorizontal className="w-4 h-4 text-amber-400" />}
      variant="modal"
      ariaLabel="Auto Forge Settings"
      closeLabel="Close Auto Forge Settings"
      onClose={onClose}
      feedback={notice}
      headerMeta={
        <span className="font-mono-tabular text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#10151B] border border-amber-500/35 text-amber-300 shrink-0">
          {activeFilterCount} Active {activeFilterCount === 1 ? 'Rule' : 'Rules'}
        </span>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-2.5 sm:p-3.5 space-y-3">
        {/* 1. Minimum Rarity */}
        <section className="p-2.5 rounded-xl bg-[#18202A] border border-white/10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Minimum Rarity to Keep
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Below{' '}
              <strong
                className={EQUIPMENT_RARITY_CONFIG[draft.minRarity].textClass}
              >
                {EQUIPMENT_RARITY_CONFIG[draft.minRarity].label}
              </strong>{' '}
              auto-dismantles
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {EQUIPMENT_RARITY_ORDER.map((rarity) => {
              const meta = EQUIPMENT_RARITY_CONFIG[rarity];
              const isSelected = draft.minRarity === rarity;
              const willKeep = meta.tier >= selectedRarityTier;
              return (
                <button
                  key={rarity}
                  type="button"
                  onClick={() => handleSetRarity(rarity)}
                  aria-pressed={isSelected}
                  className={`min-h-[42px] px-2 py-1.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? `${meta.bgClass} border-amber-400 ring-1 ring-amber-400/70`
                      : willKeep
                        ? `${meta.bgClass} ${meta.borderClass} opacity-90 hover:opacity-100`
                        : 'bg-[#11161D] border-white/10 opacity-55 hover:opacity-85'
                  }`}
                >
                  <span className={`text-[11px] font-bold ${meta.textClass}`}>
                    {meta.label}
                  </span>
                  <span
                    className={`text-[9px] font-semibold uppercase tracking-wide ${
                      isSelected
                        ? 'text-amber-300'
                        : willKeep
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                    }`}
                  >
                    {isSelected ? 'Minimum' : willKeep ? 'Keep' : 'Dismantle'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Equipment Slot Filtering & 3. Special Effect + Startup */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <section className="p-2.5 rounded-xl bg-[#18202A] border border-white/10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Equipment Slots ({enabledSlotsCount}/6)
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSetAllSlots(true)}
                  className="px-2 py-0.5 rounded bg-[#222B37] hover:bg-[#2C3847] border border-white/10 text-[10px] font-semibold text-slate-200 cursor-pointer"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllSlots(false)}
                  className="px-2 py-0.5 rounded bg-[#222B37] hover:bg-[#2C3847] border border-white/10 text-[10px] font-semibold text-slate-300 cursor-pointer"
                >
                  None
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {EQUIPMENT_SLOT_META.map((meta) => {
                const enabled = draft.enabledSlots[meta.slot];
                return (
                  <button
                    key={meta.slot}
                    type="button"
                    onClick={() => handleToggleSlot(meta.slot)}
                    aria-pressed={enabled}
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                      enabled
                        ? 'bg-emerald-950/35 border-emerald-500/55 text-emerald-100'
                        : 'bg-[#11161D] border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <span className="text-[11px] font-semibold truncate">
                      {meta.label}
                    </span>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        enabled
                          ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                          : 'bg-[#18202A] border-white/15 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="p-2.5 rounded-xl bg-[#18202A] border border-white/10 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Special Effect &amp; Behavior
                </h3>
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      requireSpecialEffect: !prev.requireSpecialEffect,
                    }))
                  }
                  aria-pressed={draft.requireSpecialEffect}
                  className={`w-full min-h-[40px] px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    draft.requireSpecialEffect
                      ? 'bg-amber-950/40 border-amber-400/60 text-amber-100'
                      : 'bg-[#11161D] border-white/10 text-slate-300'
                  }`}
                >
                  <div className="text-left min-w-0">
                    <div className="text-[11px] font-bold">
                      {draft.requireSpecialEffect
                        ? 'Special Effects Only'
                        : 'Allow Without Special Effect'}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {draft.requireSpecialEffect
                        ? 'Dismantle gear missing a special module'
                        : 'Keep qualifying gear with or without special effects'}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                      draft.requireSpecialEffect
                        ? 'bg-amber-500 border-amber-300 text-slate-950'
                        : 'bg-[#1C2530] border-white/15 text-slate-300'
                    }`}
                  >
                    {draft.requireSpecialEffect ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      autoResumeOnLoad: !prev.autoResumeOnLoad,
                    }))
                  }
                  aria-pressed={draft.autoResumeOnLoad}
                  className={`w-full min-h-[40px] px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    draft.autoResumeOnLoad
                      ? 'bg-emerald-950/35 border-emerald-500/55 text-emerald-100'
                      : 'bg-[#11161D] border-white/10 text-slate-300'
                  }`}
                >
                  <div className="text-left min-w-0">
                    <div className="text-[11px] font-bold">
                      Resume Auto Forge on Game Reopen
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {draft.autoResumeOnLoad
                        ? 'Resumes automatically if active when saved'
                        : 'Always starts paused after page reload'}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                      draft.autoResumeOnLoad
                        ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                        : 'bg-[#1C2530] border-white/15 text-slate-300'
                    }`}
                  >
                    {draft.autoResumeOnLoad ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* 4. Optional Stat Requirements */}
        <section className="p-2.5 rounded-xl bg-[#18202A] border border-white/10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Optional Stat Requirements ({enabledStatsCount} Enabled)
            </h3>
            <span className="text-[10px] text-slate-400">
              Disabled stats are ignored
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
            {EQUIPMENT_STAT_ORDER.map((key) => {
              const rule = draft.statFilters[key];
              const meta = EQUIPMENT_STAT_LABELS[key];
              const stepInfo = STAT_STEP_CONFIG[key];
              return (
                <div
                  key={key}
                  className={`p-2 rounded-lg border transition-colors flex flex-col gap-1.5 ${
                    rule.enabled
                      ? 'bg-sky-950/30 border-sky-400/60'
                      : 'bg-[#11161D] border-white/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleStat(key)}
                    aria-pressed={rule.enabled}
                    className="flex items-center justify-between gap-1.5 text-left cursor-pointer"
                  >
                    <span
                      className={`text-[11px] font-bold truncate ${
                        rule.enabled ? 'text-sky-200' : 'text-slate-300'
                      }`}
                    >
                      {meta.label}
                    </span>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        rule.enabled
                          ? 'bg-sky-400 border-sky-200 text-slate-950'
                          : 'bg-[#18202A] border-white/15 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 shrink-0">
                      Min &ge;
                    </span>
                    <input
                      type="number"
                      min="0"
                      step={stepInfo.step}
                      value={statInputs[key] ?? ''}
                      disabled={!rule.enabled}
                      onChange={(e) => handleChangeStatMin(key, e.target.value)}
                      onBlur={() => handleBlurStatMin(key)}
                      aria-label={`Minimum ${meta.label}`}
                      className={`w-full min-w-0 h-7 px-2 rounded bg-[#0C1015] border font-mono-tabular text-xs font-bold focus:outline-none focus:border-sky-400 ${
                        rule.enabled
                          ? 'border-sky-500/45 text-white'
                          : 'border-white/10 text-slate-500 opacity-65'
                      }`}
                    />
                    <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                      {stepInfo.unitHint}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Resource Limits */}
        <section className="p-2.5 rounded-xl bg-[#18202A] border border-white/10">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Resource Controls
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Maximum Coin Spending */}
            <div className="p-2 rounded-lg bg-[#11161D] border border-white/10 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-200">
                  Max Coin Spending (Session)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      spendingLimitEnabled: !prev.spendingLimitEnabled,
                    }))
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                    draft.spendingLimitEnabled
                      ? 'bg-amber-500 border-amber-300 text-slate-950'
                      : 'bg-[#1D2632] border-white/15 text-emerald-300'
                  }`}
                >
                  {draft.spendingLimitEnabled ? 'Custom Limit' : 'Unlimited'}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <input
                  type="number"
                  min="0"
                  step="60"
                  disabled={!draft.spendingLimitEnabled}
                  value={maxSpendInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setMaxSpendInput(raw);
                    if (raw.trim() === '') return;
                    const parsed = Number(raw);
                    if (Number.isFinite(parsed) && parsed >= 0) {
                      setDraft((prev) => ({
                        ...prev,
                        maxCoinSpend: Math.floor(parsed),
                      }));
                    }
                  }}
                  onBlur={() => {
                    const raw = maxSpendInput.trim();
                    const parsed = raw === '' ? 0 : Number(raw);
                    const safeVal =
                      Number.isFinite(parsed) && parsed >= 0
                        ? Math.floor(parsed)
                        : 0;
                    setDraft((prev) => ({ ...prev, maxCoinSpend: safeVal }));
                    setMaxSpendInput(String(safeVal));
                  }}
                  aria-label="Maximum Coins to spend per Auto Forge session"
                  className={`w-full h-8 px-2 rounded bg-[#0C1015] border font-mono-tabular text-xs font-bold focus:outline-none focus:border-amber-400 ${
                    draft.spendingLimitEnabled
                      ? 'border-amber-500/45 text-amber-200'
                      : 'border-white/10 text-slate-500 opacity-60'
                  }`}
                />
              </div>
            </div>

            {/* Minimum Coin Reserve */}
            <div className="p-2 rounded-lg bg-[#11161D] border border-white/10 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-200">
                  Minimum Coin Reserve
                </span>
                <span className="text-[10px] text-slate-400">
                  {draft.minCoinReserve > 0
                    ? `Keep ≥ ${draft.minCoinReserve}`
                    : 'No reserve'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={minReserveInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setMinReserveInput(raw);
                    if (raw.trim() === '') return;
                    const parsed = Number(raw);
                    if (Number.isFinite(parsed) && parsed >= 0) {
                      setDraft((prev) => ({
                        ...prev,
                        minCoinReserve: Math.floor(parsed),
                      }));
                    }
                  }}
                  onBlur={() => {
                    const raw = minReserveInput.trim();
                    const parsed = raw === '' ? 0 : Number(raw);
                    const safeVal =
                      Number.isFinite(parsed) && parsed >= 0
                        ? Math.floor(parsed)
                        : 0;
                    setDraft((prev) => ({ ...prev, minCoinReserve: safeVal }));
                    setMinReserveInput(String(safeVal));
                  }}
                  aria-label="Minimum Coin reserve to retain"
                  className="w-full h-8 px-2 rounded bg-[#0C1015] border border-emerald-500/40 font-mono-tabular text-xs font-bold text-emerald-200 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <footer className="shrink-0 px-2.5 sm:px-3 py-2 border-t border-white/10 bg-[#18202A] flex items-center justify-between gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#222B37] hover:bg-[#2C3746] border border-rose-500/40 text-[11px] sm:text-xs font-bold text-rose-200 flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Reset Settings</span>
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
            className="h-9 px-3 sm:px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-300/70 text-[11px] sm:text-xs font-extrabold text-slate-950 flex items-center gap-1.5 shadow-md transition-colors active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5 shrink-0" />
            <span>Save Settings</span>
          </button>
        </div>
      </footer>
    </BattlefieldPanel>
  );
}
