import {
  AlertTriangle,
  Coins,
  Flame,
  Hammer,
  Package,
  Play,
  SlidersHorizontal,
  Square,
  Trash2,
} from 'lucide-react';
import { FORGE_CONFIG } from '../game/constants';
import {
  EQUIPMENT_RARITY_CONFIG,
  EQUIPMENT_RARITY_ORDER,
  EQUIPMENT_SLOT_META,
  EQUIPMENT_STAT_LABELS,
  EQUIPMENT_STAT_ORDER,
  formatEquipmentStatValue,
} from '../game/data/equipmentCatalog';
import { EquipmentSystem } from '../game/systems/EquipmentSystem';
import {
  AutoForgeStopReason,
  EquipmentItem,
  EquipmentSlotType,
  ForgeState,
} from '../game/types';
import { BattlefieldPanel } from './components/BattlefieldPanel';
import { EquipmentIcon } from './EquipmentIcon';

export interface ForgeFeedbackInfo {
  text: string;
  tone: 'success' | 'error';
}

interface ForgeModalProps {
  forge: ForgeState;
  goldBalance: number;
  equipmentSlots: Record<EquipmentSlotType, EquipmentItem | null>;
  inventoryCapacity: number;
  unequippedCount: number;
  feedback: ForgeFeedbackInfo | null;
  onStartForge: () => void;
  onToggleAutoForge: () => void;
  onOpenAutoForgeSettings: () => void;
  onEquipForged: () => void;
  onDismantleForged: () => void;
  onOpenEquipment: () => void;
  onClose: () => void;
}

const STOP_REASON_BADGE: Record<
  Exclude<AutoForgeStopReason, null>,
  string
> = {
  manual: 'Stopped',
  insufficient_coins: 'Low Coins',
  spending_limit_reached: 'Spend Limit',
  coin_reserve_reached: 'Coin Reserve',
  inventory_full: 'Bag Full',
};

export function ForgeModal({
  forge,
  goldBalance,
  equipmentSlots,
  inventoryCapacity,
  unequippedCount,
  feedback,
  onStartForge,
  onToggleAutoForge,
  onOpenAutoForgeSettings,
  onEquipForged,
  onDismantleForged,
  onOpenEquipment,
  onClose,
}: ForgeModalProps) {
  const canAfford = goldBalance >= forge.costCoins;
  const isInventoryFull = unequippedCount >= inventoryCapacity;
  const isForging = forge.status === 'forging';
  const pendingItem = forge.pendingItem;
  const hasResult = forge.status === 'result_ready' && pendingItem !== null;

  const autoForge = forge.autoForge;
  const autoEnabled = autoForge.enabled;
  const settings = autoForge.settings;
  const session = autoForge.session;

  const enabledSlotsCount = EQUIPMENT_SLOT_META.filter(
    (m) => settings.enabledSlots[m.slot]
  ).length;
  const enabledStatsCount = EQUIPMENT_STAT_ORDER.filter(
    (k) => settings.statFilters[k].enabled
  ).length;
  const activeRuleCount =
    (settings.minRarity !== 'scrap' ? 1 : 0) +
    (enabledSlotsCount < EQUIPMENT_SLOT_META.length ? 1 : 0) +
    enabledStatsCount +
    (settings.requireSpecialEffect ? 1 : 0) +
    (settings.spendingLimitEnabled ? 1 : 0) +
    (settings.minCoinReserve > 0 ? 1 : 0);

  const progressPct = Math.round(forge.progress * 100);
  const remainingSec = Math.max(
    0,
    forge.durationSec - forge.elapsedSec
  ).toFixed(1);

  return (
    <BattlefieldPanel
      title="Equipment Forge"
      icon={<Hammer className="w-4 h-4 text-amber-400" />}
      variant="modal"
      ariaLabel="Equipment Forge"
      closeLabel="Close Equipment Forge"
      onClose={onClose}
      feedback={feedback}
      headerMeta={
        <>
          <span
            className={`font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
              autoEnabled
                ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300'
                : 'bg-[#10151B] border-white/10 text-slate-400'
            }`}
          >
            AUTO {autoEnabled ? 'ON' : 'OFF'}
          </span>
          <span
            className={`font-mono-tabular text-[11px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
              isInventoryFull
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                : 'bg-[#10151B] border-white/10 text-slate-300'
            }`}
          >
            Bag {unequippedCount}/{inventoryCapacity}
          </span>
        </>
      }
      headerActions={
        <>
          <div className="flex items-center gap-1 bg-[#10151B] border border-amber-500/35 rounded-md px-2 py-1">
            <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono-tabular text-xs font-bold text-amber-300">
              {goldBalance}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenEquipment();
            }}
            className="h-8 sm:h-9 px-2.5 rounded-lg bg-[#222B37] hover:bg-[#2E3A4A] border border-white/15 text-xs font-bold text-slate-100 flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
          >
            <Package className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="hidden sm:inline">Equipment</span>
            <span className="sm:hidden">Equip</span>
          </button>
        </>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-2.5 sm:p-3.5 flex flex-col gap-2.5">
        {hasResult && pendingItem ? (
          (() => {
            const rarityMeta = EQUIPMENT_RARITY_CONFIG[pendingItem.rarity];
            const slotMeta = EQUIPMENT_SLOT_META.find(
              (m) => m.slot === pendingItem.slot
            );
            const currentlyEquipped = equipmentSlots[pendingItem.slot];
            const comparisonRows = EquipmentSystem.compareItems(
              pendingItem,
              currentlyEquipped
            );
            const dismantleValue =
              FORGE_CONFIG.dismantleCoinsByRarity[pendingItem.rarity];
            const statKeys = EQUIPMENT_STAT_ORDER.filter(
              (k) =>
                typeof pendingItem.stats[k] === 'number' &&
                pendingItem.stats[k] !== 0
            );
            const equipBlockedByFullInventory =
              Boolean(currentlyEquipped) && isInventoryFull;

            return (
              <div className="w-full max-w-2xl mx-auto flex flex-col gap-2.5 animate-summon-pop">
                <div
                  className={`p-3 rounded-xl border-2 ${rarityMeta.bgClass} ${rarityMeta.borderClass}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${rarityMeta.badgeClass}`}
                      >
                        <EquipmentIcon
                          iconId={pendingItem.iconId}
                          slot={pendingItem.slot}
                          className="w-5 h-5"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          {autoForge.stopReason === 'inventory_full'
                            ? 'Auto Forge Paused · Qualifying Gear'
                            : 'Forging Complete'}
                        </div>
                        <h3
                          className={`text-sm sm:text-base font-bold truncate ${rarityMeta.textClass}`}
                        >
                          {pendingItem.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${rarityMeta.badgeClass}`}
                          >
                            {rarityMeta.label}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#0F141A] border border-white/10 text-slate-200">
                            {slotMeta?.label ?? pendingItem.slot}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 sm:text-right">
                      {currentlyEquipped ? (
                        <span>
                          Equipped:{' '}
                          <strong
                            className={
                              EQUIPMENT_RARITY_CONFIG[currentlyEquipped.rarity]
                                .textClass
                            }
                          >
                            {currentlyEquipped.name}
                          </strong>
                        </span>
                      ) : (
                        <span className="text-emerald-300 font-semibold">
                          {slotMeta?.shortLabel} Slot Empty
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5">
                    {statKeys.map((key) => {
                      const row = comparisonRows.find((r) => r.statKey === key);
                      const delta = row ? row.delta : (pendingItem.stats[key] ?? 0);
                      const deltaStr =
                        delta > 0
                          ? formatEquipmentStatValue(key, delta, true)
                          : delta < 0
                            ? formatEquipmentStatValue(key, delta, false)
                            : '0';
                      const deltaColor =
                        delta > 0
                          ? 'text-emerald-400'
                          : delta < 0
                            ? 'text-rose-400'
                            : 'text-slate-400';

                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#0F141A]/85 border border-white/10 text-xs"
                        >
                          <span className="text-slate-300">
                            {EQUIPMENT_STAT_LABELS[key].label}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono-tabular">
                            <span className="font-bold text-white">
                              {formatEquipmentStatValue(
                                key,
                                pendingItem.stats[key] ?? 0
                              )}
                            </span>
                            {currentlyEquipped && (
                              <span className={`text-[11px] font-bold ${deltaColor}`}>
                                ({deltaStr})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {pendingItem.specialEffect && (
                    <div className="mt-2 p-2 rounded-lg bg-amber-950/35 border border-amber-400/40 flex items-start gap-2">
                      <Flame className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-amber-300">
                          Special Effect: {pendingItem.specialEffect.name}
                        </div>
                        <div className="text-[11px] text-amber-100/90 mt-0.5">
                          {pendingItem.specialEffect.description}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isInventoryFull && (
                  <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/45 text-xs text-amber-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Inventory full ({unequippedCount}/{inventoryCapacity}).
                        Dismantle now or free 1 slot.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onOpenEquipment();
                      }}
                      className="shrink-0 h-7 px-2.5 rounded bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/50 text-[11px] font-bold text-amber-200 cursor-pointer"
                    >
                      Free Space
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onEquipForged();
                    }}
                    className={`min-h-[40px] px-4 rounded-lg border text-xs sm:text-sm font-bold shadow-sm transition-colors active:scale-98 cursor-pointer ${
                      equipBlockedByFullInventory
                        ? 'bg-[#212934] border-rose-500/45 text-rose-200 hover:bg-[#293240]'
                        : 'bg-amber-500 hover:bg-amber-400 border-amber-300/60 text-slate-950'
                    }`}
                  >
                    {equipBlockedByFullInventory
                      ? 'Inventory Full (Cannot Swap)'
                      : currentlyEquipped
                        ? 'Equip & Replace Current'
                        : 'Equip Now'}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onDismantleForged();
                    }}
                    className="min-h-[40px] px-4 rounded-lg bg-[#202935] hover:bg-[#2A3646] border border-slate-500/50 text-xs sm:text-sm font-bold text-slate-100 flex items-center justify-center gap-2 transition-colors active:scale-98 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Dismantle</span>
                    <span className="inline-flex items-center gap-1 font-mono-tabular text-amber-300">
                      (+{dismantleValue}
                      <Coins className="w-3.5 h-3.5 shrink-0" />)
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onToggleAutoForge();
                    }}
                    className="min-h-[38px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-300/50 text-xs font-bold text-slate-950 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isInventoryFull
                        ? 'Resume Auto Forge'
                        : 'Auto-Process & Continue'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onOpenAutoForgeSettings();
                    }}
                    className="min-h-[38px] px-3 rounded-lg bg-[#202935] hover:bg-[#2A3646] border border-white/15 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Auto Settings</span>
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-2.5">
            {/* Primary Foundry Card */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-[#18202A] border border-white/10 flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${
                      isForging
                        ? 'bg-amber-500/20 border-amber-400 animate-pulse'
                        : isInventoryFull
                          ? 'bg-rose-950/50 border-rose-500/60'
                          : 'bg-[#12171E] border-amber-500/40'
                    }`}
                  >
                    <Hammer
                      className={`w-5 h-5 ${
                        isForging
                          ? 'text-amber-300'
                          : isInventoryFull
                            ? 'text-rose-400'
                            : 'text-amber-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {autoEnabled
                        ? 'Auto Forge Active'
                        : isForging
                          ? 'Forging Tank Equipment...'
                          : 'Military Foundry Anvil'}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      {isForging
                        ? `Forging equipment in progress (${remainingSec}s)`
                        : isInventoryFull
                          ? `Bag full (${unequippedCount}/${inventoryCapacity}) · Auto Forge still dismantles filtered gear`
                          : 'Craft randomized equipment across all 6 tank slots.'}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] font-mono-tabular text-slate-300 shrink-0">
                  Total Forged:{' '}
                  <strong className="text-white">{forge.totalForged}</strong>
                </div>
              </div>

              {/* Forging Progress Bar */}
              <div className="w-full flex flex-col gap-1">
                <div className="w-full h-2.5 rounded-md bg-[#0E1319] border border-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-75 ${
                      autoEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
                  <span>
                    {isForging
                      ? autoEnabled
                        ? 'Auto Forging...'
                        : 'Forging...'
                      : 'Ready'}
                  </span>
                  <span className="font-bold text-slate-200">
                    {progressPct}%
                  </span>
                </div>
              </div>

              {/* Controls Row: Manual Forge | Auto Forge Toggle | Auto Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={autoEnabled || isForging}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onStartForge();
                  }}
                  className={`min-h-[40px] px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    autoEnabled || isForging
                      ? 'bg-[#1D2530] border-white/10 text-slate-500 cursor-not-allowed'
                      : isInventoryFull
                        ? 'bg-[#212934] hover:bg-[#293240] border-rose-500/45 text-rose-200'
                        : canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 border-amber-300/60 text-slate-950 shadow-sm active:scale-98'
                          : 'bg-[#212934] hover:bg-[#293240] border-white/10 text-slate-400'
                  }`}
                >
                  <Hammer className="w-3.5 h-3.5 shrink-0" />
                  <span>Manual Forge</span>
                  <span className="inline-flex items-center gap-0.5 font-mono-tabular">
                    ({forge.costCoins}
                    <Coins className="w-3 h-3 shrink-0" />)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleAutoForge();
                  }}
                  aria-pressed={autoEnabled}
                  className={`min-h-[40px] px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer ${
                    autoEnabled
                      ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300/70 text-slate-950 shadow-sm'
                      : 'bg-[#202935] hover:bg-[#2A3646] border-emerald-500/45 text-emerald-200'
                  }`}
                >
                  {autoEnabled ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current shrink-0" />
                      <span>Auto Forge: ON</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                      <span>Auto Forge: OFF</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenAutoForgeSettings();
                  }}
                  className="min-h-[40px] px-3 rounded-lg bg-[#202935] hover:bg-[#2A3646] border border-white/15 text-xs font-bold text-slate-100 flex items-center justify-center gap-1.5 transition-colors active:scale-98 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Auto Settings</span>
                  {activeRuleCount > 0 && (
                    <span className="font-mono-tabular text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300">
                      {activeRuleCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Auto Forge Status & Session Counters */}
            <div className="p-2.5 rounded-xl bg-[#151B23] border border-white/10 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      autoEnabled
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-xs font-bold text-white">
                    Auto Forge: {autoEnabled ? 'ON' : 'OFF'}
                  </span>
                  {!autoEnabled && autoForge.stopReason && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/40 text-amber-200">
                      {STOP_REASON_BADGE[autoForge.stopReason]}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-[#10151B] border border-white/10">
                    Min:{' '}
                    <strong
                      className={
                        EQUIPMENT_RARITY_CONFIG[settings.minRarity].textClass
                      }
                    >
                      {EQUIPMENT_RARITY_CONFIG[settings.minRarity].label}
                    </strong>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#10151B] border border-white/10">
                    Slots: <strong>{enabledSlotsCount}/6</strong>
                  </span>
                  {enabledStatsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-950/50 border border-sky-400/40 text-sky-200">
                      Stats: <strong>{enabledStatsCount}</strong>
                    </span>
                  )}
                  {settings.requireSpecialEffect && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-400/40 text-amber-200">
                      Special FX
                    </span>
                  )}
                  {settings.minCoinReserve > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-400/40 text-emerald-200">
                      Reserve: {settings.minCoinReserve}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <div className="px-2.5 py-1.5 rounded-lg bg-[#10151B] border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Coins Spent</span>
                  <span className="font-mono-tabular font-bold text-amber-300">
                    {session.coinsSpent}
                    {settings.spendingLimitEnabled
                      ? `/${settings.maxCoinSpend}`
                      : ''}
                  </span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-[#10151B] border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Forged</span>
                  <span className="font-mono-tabular font-bold text-white">
                    {session.itemsForged}
                  </span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-[#10151B] border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Kept</span>
                  <span className="font-mono-tabular font-bold text-emerald-400">
                    {session.itemsKept}
                  </span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg bg-[#10151B] border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Dismantled</span>
                  <span className="font-mono-tabular font-bold text-rose-300">
                    {session.itemsDismantled}
                  </span>
                </div>
              </div>
            </div>

            {/* Foundry Rarity Odds */}
            <div className="p-2 rounded-xl bg-[#151B23] border border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Foundry Rarity Odds
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {EQUIPMENT_RARITY_ORDER.map((rarity) => {
                  const meta = EQUIPMENT_RARITY_CONFIG[rarity];
                  const weight = FORGE_CONFIG.rarityWeights[rarity];
                  return (
                    <div
                      key={rarity}
                      className={`px-1.5 py-1 rounded-md border text-center ${meta.bgClass} ${meta.borderClass}`}
                    >
                      <div
                        className={`text-[10px] font-bold truncate ${meta.textClass}`}
                      >
                        {meta.label}
                      </div>
                      <div className="font-mono-tabular text-[11px] font-semibold text-slate-200">
                        {weight}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </BattlefieldPanel>
  );
}
