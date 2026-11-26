import {
  AlertTriangle,
  Coins,
  Flame,
  Hammer,
  Package,
  Trash2,
  X,
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
import { EquipmentItem, EquipmentSlotType, ForgeState } from '../game/types';
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
  onEquipForged: () => void;
  onDismantleForged: () => void;
  onOpenEquipment: () => void;
  onClose: () => void;
}

export function ForgeModal({
  forge,
  goldBalance,
  equipmentSlots,
  inventoryCapacity,
  unequippedCount,
  feedback,
  onStartForge,
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

  const progressPct = Math.round(forge.progress * 100);
  const remainingSec = Math.max(
    0,
    forge.durationSec - forge.elapsedSec
  ).toFixed(1);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Equipment Forge"
      className="absolute inset-2 sm:inset-3 z-20 flex flex-col bg-[#131920]/98 border border-[#334155] rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-[#1A222C] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Hammer className="w-4 h-4 text-amber-400 shrink-0" />
          <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
            Equipment Forge
          </h2>
          <span className="hidden sm:inline-block font-mono-tabular text-[11px] font-semibold px-2 py-0.5 rounded bg-[#10151B] border border-white/10 text-slate-300">
            Forged: {forge.totalForged}
          </span>
          <span
            className={`font-mono-tabular text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${
              isInventoryFull
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                : 'bg-[#10151B] border-white/10 text-slate-300'
            }`}
          >
            Bag {unequippedCount}/{inventoryCapacity}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            className="h-8 px-2.5 rounded-lg bg-[#222B37] hover:bg-[#2E3A4A] border border-white/15 text-xs font-bold text-slate-100 flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <Package className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Equipment</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Close Equipment Forge"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#222B37] hover:bg-[#2E3A4A] border border-white/15 text-slate-200 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient Feedback Banner */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`px-3 py-1.5 text-xs font-semibold border-b shrink-0 ${
            feedback.tone === 'error'
              ? 'bg-rose-950/75 border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/75 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto panel-scroll p-3 sm:p-4 flex items-center justify-center">
        {hasResult && pendingItem ? (
          /* FORGE RESULT SCREEN */
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
              <div className="w-full max-w-2xl flex flex-col gap-3 animate-summon-pop">
                <div
                  className={`p-3 sm:p-4 rounded-xl border-2 ${rarityMeta.bgClass} ${rarityMeta.borderClass}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${rarityMeta.badgeClass}`}
                      >
                        <EquipmentIcon
                          iconId={pendingItem.iconId}
                          slot={pendingItem.slot}
                          className="w-5 h-5"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          Forging Complete
                        </div>
                        <h3
                          className={`text-sm sm:text-base font-bold truncate ${rarityMeta.textClass}`}
                        >
                          {pendingItem.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${rarityMeta.badgeClass}`}
                          >
                            {rarityMeta.label}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#0F141A] border border-white/10 text-slate-200">
                            {slotMeta?.label ?? pendingItem.slot}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 sm:text-right">
                      {currentlyEquipped ? (
                        <span>
                          Slot Equipped:{' '}
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

                  {/* Stats & Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
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
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#0F141A]/85 border border-white/10 text-xs"
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

                  {/* Special Effect */}
                  {pendingItem.specialEffect && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-amber-950/35 border border-amber-400/40 flex items-start gap-2">
                      <Flame className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-amber-300">
                          Special Effect: {pendingItem.specialEffect.name}
                        </div>
                        <div className="text-xs text-amber-100/90 mt-0.5">
                          {pendingItem.specialEffect.description}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isInventoryFull && (
                  <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/45 text-xs text-amber-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Inventory is full ({unequippedCount}/{inventoryCapacity}
                        ). Dismantle now, or open Equipment to free 1 slot.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onOpenEquipment();
                      }}
                      className="shrink-0 h-7 px-2.5 rounded bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/50 text-[11px] font-bold text-amber-200"
                    >
                      Free Space
                    </button>
                  </div>
                )}

                {/* Equip or Dismantle Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onEquipForged();
                    }}
                    className={`min-h-[46px] px-4 rounded-lg border text-sm font-bold shadow-sm transition-colors active:scale-98 ${
                      equipBlockedByFullInventory
                        ? 'bg-[#212934] border-rose-500/45 text-rose-200 hover:bg-[#293240]'
                        : 'bg-[#D97706] hover:bg-[#F59E0B] border-amber-300/60 text-slate-950'
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
                    className="min-h-[46px] px-4 rounded-lg bg-[#202935] hover:bg-[#2A3646] border border-slate-500/50 text-sm font-bold text-slate-100 flex items-center justify-center gap-2 transition-colors active:scale-98"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Dismantle</span>
                    <span className="inline-flex items-center gap-1 font-mono-tabular text-amber-300">
                      (+{dismantleValue}
                      <Coins className="w-3.5 h-3.5 shrink-0" />)
                    </span>
                  </button>
                </div>

                <p className="text-[11px] text-center text-slate-400">
                  {isInventoryFull
                    ? 'This forged item stays waiting safely in the Forge until you equip, dismantle, or free an inventory slot.'
                    : 'Closing this window keeps the forged item safely in your equipment inventory.'}
                </p>
              </div>
            );
          })()
        ) : (
          /* FORGE CHAMBER (IDLE OR 2-SECOND FORGING PROGRESS) */
          <div className="w-full max-w-xl flex flex-col gap-3">
            <div className="p-4 rounded-xl bg-[#18202A] border border-white/10 flex flex-col items-center text-center gap-3">
              <div
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all ${
                  isForging
                    ? 'bg-amber-500/20 border-amber-400 animate-pulse'
                    : isInventoryFull
                      ? 'bg-rose-950/50 border-rose-500/60'
                      : 'bg-[#12171E] border-amber-500/40'
                }`}
              >
                <Hammer
                  className={`w-7 h-7 ${
                    isForging
                      ? 'text-amber-300'
                      : isInventoryFull
                        ? 'text-rose-400'
                        : 'text-amber-400'
                  }`}
                />
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {isForging
                    ? 'Forging Tank Equipment...'
                    : 'Military Foundry Anvil'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 max-w-md">
                  {isForging
                    ? `Calibrating hull alloys and weapon tolerances (${remainingSec}s remaining)`
                    : isInventoryFull
                      ? `Inventory is full (${unequippedCount}/${inventoryCapacity}). Dismantle unused gear in Equipment before forging.`
                      : 'Craft a randomized tank component across all 6 slots. Higher rarities can roll bonus special combat modules.'}
                </p>
              </div>

              {isForging ? (
                <div className="w-full max-w-sm flex flex-col gap-1.5">
                  <div className="w-full h-3.5 rounded-md bg-[#0E1319] border border-amber-500/40 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-[width] duration-75"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono-tabular text-amber-300 font-semibold">
                    <span>Forging in progress...</span>
                    <span>{progressPct}%</span>
                  </div>
                </div>
              ) : isInventoryFull ? (
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-sm justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onOpenEquipment();
                    }}
                    className="w-full min-h-[44px] px-4 rounded-lg bg-[#222B37] hover:bg-[#2E3A4A] border border-amber-400/50 text-sm font-bold text-amber-200 flex items-center justify-center gap-2"
                  >
                    <Package className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>Open Equipment to Free Space</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onStartForge();
                  }}
                  className={`w-full max-w-xs min-h-[46px] px-5 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 ${
                    canAfford
                      ? 'bg-[#D97706] hover:bg-[#F59E0B] border-amber-300/60 text-slate-950 shadow-md'
                      : 'bg-[#212934] hover:bg-[#293240] border-white/10 text-slate-400'
                  }`}
                >
                  <Hammer className="w-4 h-4 shrink-0" />
                  <span>Forge Equipment</span>
                  <span className="inline-flex items-center gap-1 font-mono-tabular">
                    ({forge.costCoins}
                    <Coins className="w-3.5 h-3.5 shrink-0" />)
                  </span>
                </button>
              )}
            </div>

            {/* Configurable Rarity Odds Reference */}
            <div className="p-2.5 rounded-xl bg-[#151B23] border border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Foundry Rarity Probabilities
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {EQUIPMENT_RARITY_ORDER.map((rarity) => {
                  const meta = EQUIPMENT_RARITY_CONFIG[rarity];
                  const weight = FORGE_CONFIG.rarityWeights[rarity];
                  return (
                    <div
                      key={rarity}
                      className={`px-2 py-1.5 rounded-lg border text-center ${meta.bgClass} ${meta.borderClass}`}
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
    </section>
  );
}
