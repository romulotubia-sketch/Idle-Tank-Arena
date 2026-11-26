import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Coins,
  Flame,
  Hammer,
  Lock,
  Package,
  RotateCcw,
  Sparkles,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { FORGE_CONFIG } from '../game/constants';
import {
  EQUIPMENT_RARITY_CONFIG,
  EQUIPMENT_RARITY_ORDER,
  EQUIPMENT_SLOT_META,
  EQUIPMENT_SORT_OPTIONS,
  EQUIPMENT_STAT_LABELS,
  EQUIPMENT_STAT_ORDER,
  formatEquipmentStatValue,
  sortEquipmentItems,
} from '../game/data/equipmentCatalog';
import {
  DEFAULT_EQUIPMENT_PREFERENCES,
  EquipmentSystem,
} from '../game/systems/EquipmentSystem';
import {
  EquipmentItem,
  EquipmentPreferences,
  EquipmentRarity,
  EquipmentSlotType,
  EquipmentSortOption,
  EquipmentStatsMap,
  TankStats,
} from '../game/types';
import { EquipmentIcon } from './EquipmentIcon';

export interface EquipmentFeedbackInfo {
  text: string;
  tone: 'success' | 'error';
}

type MobileEquipmentTab = 'equipment' | 'inventory' | 'details';

interface EquipmentModalProps {
  equipmentSlots: Record<EquipmentSlotType, EquipmentItem | null>;
  ownedItems: EquipmentItem[];
  equipmentBonuses: EquipmentStatsMap;
  tankStats: TankStats;
  inventoryCapacity: number;
  unequippedCount: number;
  preferences: EquipmentPreferences;
  feedback: EquipmentFeedbackInfo | null;
  onEquipItem: (uid: string, expectedSlot?: EquipmentSlotType) => void;
  onUnequipSlot: (slot: EquipmentSlotType) => void;
  onToggleLock: (uid: string) => void;
  onChangePreferences: (partial: Partial<EquipmentPreferences>) => void;
  onDismantleItem: (uid: string) => void;
  onBulkDismantle: (uids: string[]) => void;
  onPreviewTankStats: (item: EquipmentItem) => TankStats;
  onOpenForge: () => void;
  onClose: () => void;
}

const LEFT_SLOT_ORDER: readonly EquipmentSlotType[] = [
  'cannon',
  'armor',
  'targeting_system',
];
const RIGHT_SLOT_ORDER: readonly EquipmentSlotType[] = [
  'engine',
  'tracks',
  'auxiliary_system',
];

function TankChassisPreview({
  equipmentSlots,
}: {
  equipmentSlots: Record<EquipmentSlotType, EquipmentItem | null>;
}) {
  const cannonColor = equipmentSlots.cannon
    ? EQUIPMENT_RARITY_CONFIG[equipmentSlots.cannon.rarity].accentHex
    : '#64748B';
  const armorColor = equipmentSlots.armor
    ? EQUIPMENT_RARITY_CONFIG[equipmentSlots.armor.rarity].accentHex
    : '#475569';
  const tracksColor = equipmentSlots.tracks
    ? EQUIPMENT_RARITY_CONFIG[equipmentSlots.tracks.rarity].accentHex
    : '#334155';
  const engineColor = equipmentSlots.engine
    ? EQUIPMENT_RARITY_CONFIG[equipmentSlots.engine.rarity].accentHex
    : '#475569';
  const targetColor = equipmentSlots.targeting_system
    ? EQUIPMENT_RARITY_CONFIG[equipmentSlots.targeting_system.rarity].accentHex
    : '#64748B';

  return (
    <div className="flex flex-col items-center justify-center py-2 px-3 rounded-lg bg-[#10151C] border border-white/10">
      <svg
        viewBox="0 0 120 120"
        className="w-20 h-20 sm:w-24 sm:h-24"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <rect
          x="22"
          y="24"
          width="14"
          height="72"
          rx="3"
          fill="#1E293B"
          stroke={tracksColor}
          strokeWidth="2"
        />
        <rect
          x="84"
          y="24"
          width="14"
          height="72"
          rx="3"
          fill="#1E293B"
          stroke={tracksColor}
          strokeWidth="2"
        />
        <rect
          x="36"
          y="28"
          width="48"
          height="64"
          rx="6"
          fill="#263329"
          stroke={armorColor}
          strokeWidth="2.2"
        />
        <rect
          x="44"
          y="74"
          width="32"
          height="12"
          rx="2"
          fill="#131920"
          stroke={engineColor}
          strokeWidth="1.6"
        />
        <rect
          x="55"
          y="8"
          width="10"
          height="36"
          rx="2"
          fill="#334155"
          stroke={cannonColor}
          strokeWidth="2"
        />
        <circle
          cx="60"
          cy="54"
          r="17"
          fill="#344637"
          stroke={armorColor}
          strokeWidth="2"
        />
        <circle
          cx="67"
          cy="48"
          r="4.5"
          fill="#0F172A"
          stroke={targetColor}
          strokeWidth="1.8"
        />
      </svg>
      <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
        MK-IV Armored Chassis
      </span>
    </div>
  );
}

interface TankImpactRow {
  label: string;
  currentText: string;
  nextText: string;
  deltaText: string;
  positive: boolean;
}

function buildTankImpactRows(
  current: TankStats,
  projected: TankStats
): TankImpactRow[] {
  const rows: TankImpactRow[] = [];
  const check = (
    label: string,
    curr: number,
    next: number,
    formatFn: (v: number) => string,
    deltaFn: (d: number) => string
  ) => {
    const diff = Math.round((next - curr) * 1000) / 1000;
    if (Math.abs(diff) < 0.001) return;
    rows.push({
      label,
      currentText: formatFn(curr),
      nextText: formatFn(next),
      deltaText: `${diff > 0 ? '+' : ''}${deltaFn(diff)}`,
      positive: diff > 0,
    });
  };

  check(
    'Attack Power',
    current.attackPower,
    projected.attackPower,
    (v) => `${Math.round(v)}`,
    (d) => `${Math.round(d)}`
  );
  check(
    'Fire Rate',
    current.fireRate,
    projected.fireRate,
    (v) => `${v.toFixed(2)}/s`,
    (d) => `${d.toFixed(2)}/s`
  );
  check(
    'Crit Chance',
    current.critChance,
    projected.critChance,
    (v) => `${v.toFixed(1)}%`,
    (d) => `${d.toFixed(1)}%`
  );
  check(
    'Crit Damage',
    current.critDamage,
    projected.critDamage,
    (v) => `${v.toFixed(2)}x`,
    (d) => `${d.toFixed(2)}x`
  );
  check(
    'Max HP',
    current.maxHp,
    projected.maxHp,
    (v) => `${Math.round(v)}`,
    (d) => `${Math.round(d)}`
  );
  check(
    'Armor',
    current.armor,
    projected.armor,
    (v) => `${Math.round(v)}`,
    (d) => `${Math.round(d)}`
  );
  check(
    'Move Speed',
    current.moveSpeed,
    projected.moveSpeed,
    (v) => `${Math.round(v)}`,
    (d) => `${Math.round(d)}`
  );
  check(
    'Skill Bonus',
    current.skillDamageBonus,
    projected.skillDamageBonus,
    (v) => `+${Math.round(v)}%`,
    (d) => `${Math.round(d)}%`
  );

  return rows;
}

export function EquipmentModal({
  equipmentSlots,
  ownedItems,
  equipmentBonuses,
  tankStats,
  inventoryCapacity,
  unequippedCount,
  preferences,
  feedback,
  onEquipItem,
  onUnequipSlot,
  onToggleLock,
  onChangePreferences,
  onDismantleItem,
  onBulkDismantle,
  onPreviewTankStats,
  onOpenForge,
  onClose,
}: EquipmentModalProps) {
  const [mobileTab, setMobileTab] = useState<MobileEquipmentTab>('equipment');
  const [selectedSlot, setSelectedSlot] =
    useState<EquipmentSlotType>('cannon');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedBulkUids, setSelectedBulkUids] = useState<string[]>([]);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  const isInventoryFull = unequippedCount >= inventoryCapacity;

  const [selectedUid, setSelectedUid] = useState<string | null>(() => {
    const firstUnequipped = ownedItems.find((i) => !i.equipped);
    return firstUnequipped?.uid ?? ownedItems[0]?.uid ?? null;
  });

  // Preserve valid selectedUid and drop dismantled/locked/equipped items from bulk selection
  useEffect(() => {
    if (ownedItems.length === 0) {
      setSelectedUid(null);
      setSelectedBulkUids([]);
      return;
    }
    if (!selectedUid || !ownedItems.some((item) => item.uid === selectedUid)) {
      const nextFallback =
        ownedItems.find((i) => !i.equipped) ?? ownedItems[0];
      setSelectedUid(nextFallback.uid);
    }

    const eligibleSet = new Set(
      ownedItems.filter((i) => !i.equipped && !i.locked).map((i) => i.uid)
    );
    setSelectedBulkUids((prev) => prev.filter((uid) => eligibleSet.has(uid)));
  }, [ownedItems, selectedUid]);

  useEffect(() => {
    if (!localNotice) return;
    const timer = window.setTimeout(() => setLocalNotice(null), 1800);
    return () => window.clearTimeout(timer);
  }, [localNotice]);

  const filteredAndSortedInventory = useMemo(() => {
    const filtered = ownedItems
      .filter(
        (item) =>
          preferences.slotFilter === 'all' ||
          item.slot === preferences.slotFilter
      )
      .filter(
        (item) =>
          preferences.rarityFilter === 'all' ||
          item.rarity === preferences.rarityFilter
      );
    return sortEquipmentItems(filtered, preferences.sortBy);
  }, [ownedItems, preferences]);

  const selectedItem = useMemo(
    () => ownedItems.find((item) => item.uid === selectedUid) ?? null,
    [ownedItems, selectedUid]
  );

  const equippedCount = useMemo(
    () =>
      EQUIPMENT_SLOT_META.filter((meta) => equipmentSlots[meta.slot] !== null)
        .length,
    [equipmentSlots]
  );

  const activeBonusEntries = useMemo(
    () =>
      EQUIPMENT_STAT_ORDER.filter(
        (key) =>
          typeof equipmentBonuses[key] === 'number' &&
          equipmentBonuses[key] !== 0
      ),
    [equipmentBonuses]
  );

  const selectedSlotMeta = selectedItem
    ? EQUIPMENT_SLOT_META.find((m) => m.slot === selectedItem.slot)
    : null;
  const currentlyEquippedForSelectedSlot = selectedItem
    ? equipmentSlots[selectedItem.slot]
    : null;
  const isSelectedCurrentlyEquipped = Boolean(
    selectedItem &&
      currentlyEquippedForSelectedSlot &&
      currentlyEquippedForSelectedSlot.uid === selectedItem.uid
  );

  const comparisonRows = useMemo(() => {
    if (!selectedItem) return [];
    if (isSelectedCurrentlyEquipped) {
      return EquipmentSystem.compareItems(selectedItem, null);
    }
    return EquipmentSystem.compareItems(
      selectedItem,
      currentlyEquippedForSelectedSlot
    );
  }, [
    selectedItem,
    currentlyEquippedForSelectedSlot,
    isSelectedCurrentlyEquipped,
  ]);

  const tankImpactRows = useMemo(() => {
    if (!selectedItem || isSelectedCurrentlyEquipped) return [];
    const projected = onPreviewTankStats(selectedItem);
    return buildTankImpactRows(tankStats, projected);
  }, [
    selectedItem,
    isSelectedCurrentlyEquipped,
    onPreviewTankStats,
    tankStats,
  ]);

  const bulkEligibleSelected = useMemo(() => {
    const selectedSet = new Set(selectedBulkUids);
    const items = ownedItems.filter(
      (item) => selectedSet.has(item.uid) && !item.equipped && !item.locked
    );
    const totalCoins = items.reduce(
      (sum, item) => sum + (FORGE_CONFIG.dismantleCoinsByRarity[item.rarity] ?? 20),
      0
    );
    return { items, totalCoins };
  }, [ownedItems, selectedBulkUids]);

  const hasNonDefaultFilters =
    preferences.slotFilter !== DEFAULT_EQUIPMENT_PREFERENCES.slotFilter ||
    preferences.rarityFilter !== DEFAULT_EQUIPMENT_PREFERENCES.rarityFilter ||
    preferences.sortBy !== DEFAULT_EQUIPMENT_PREFERENCES.sortBy;

  const handleSelectLoadoutSlot = (
    slot: EquipmentSlotType,
    goToNextOnMobile: boolean
  ) => {
    setSelectedSlot(slot);
    const equipped = equipmentSlots[slot];
    if (equipped) {
      setSelectedUid(equipped.uid);
      if (goToNextOnMobile) {
        setMobileTab('details');
      }
    } else {
      onChangePreferences({ slotFilter: slot });
      const match = ownedItems.find((i) => !i.equipped && i.slot === slot);
      if (match) {
        setSelectedUid(match.uid);
      }
      if (goToNextOnMobile) {
        setMobileTab('inventory');
      }
    }
  };

  const handleToggleBulkItem = (item: EquipmentItem) => {
    if (item.equipped) {
      setLocalNotice('Equipped items cannot be dismantled');
      return;
    }
    if (item.locked) {
      setLocalNotice(`${item.name} is locked — unlock it before dismantling`);
      return;
    }
    setSelectedBulkUids((prev) =>
      prev.includes(item.uid)
        ? prev.filter((id) => id !== item.uid)
        : [...prev, item.uid]
    );
  };

  const handleSelectAllFilteredEligible = () => {
    const eligible = filteredAndSortedInventory
      .filter((item) => !item.equipped && !item.locked)
      .map((item) => item.uid);
    if (eligible.length === 0) {
      setLocalNotice('No unlocked, unequipped items in current view');
      return;
    }
    setSelectedBulkUids(eligible);
  };

  const handleConfirmBulkDismantle = () => {
    if (bulkEligibleSelected.items.length === 0) {
      setConfirmBulkOpen(false);
      return;
    }
    onBulkDismantle(bulkEligibleSelected.items.map((i) => i.uid));
    setSelectedBulkUids([]);
    setConfirmBulkOpen(false);
    setBulkMode(false);
  };

  const renderSlotTile = (slot: EquipmentSlotType) => {
    const meta = EQUIPMENT_SLOT_META.find((m) => m.slot === slot)!;
    const equipped = equipmentSlots[slot];
    const rarityMeta = equipped
      ? EQUIPMENT_RARITY_CONFIG[equipped.rarity]
      : null;
    const isSelected = selectedSlot === slot;

    return (
      <button
        key={slot}
        type="button"
        onClick={(e) => {
          e.currentTarget.blur();
          handleSelectLoadoutSlot(slot, false);
        }}
        className={`w-full text-left p-2 rounded-lg border transition-all min-h-[62px] flex flex-col justify-between ${
          equipped && rarityMeta
            ? `${rarityMeta.bgClass} ${
                isSelected
                  ? 'border-amber-400 ring-2 ring-amber-400/35'
                  : rarityMeta.borderClass
              }`
            : isSelected
              ? 'bg-[#1C2430] border-amber-400 ring-2 ring-amber-400/35'
              : 'bg-[#171E27] hover:bg-[#1E2733] border-white/10'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {meta.shortLabel}
          </span>
          <span className="flex items-center gap-1">
            {equipped?.locked && (
              <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
            )}
            <span
              className={rarityMeta ? rarityMeta.textClass : 'text-slate-500'}
            >
              <EquipmentIcon
                iconId={equipped?.iconId}
                slot={slot}
                className="w-3.5 h-3.5 shrink-0"
              />
            </span>
          </span>
        </div>

        {equipped && rarityMeta ? (
          <div className="mt-1 min-w-0">
            <div
              className={`text-[11px] font-bold leading-tight truncate ${rarityMeta.textClass}`}
            >
              {equipped.name}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {rarityMeta.label}
            </div>
          </div>
        ) : (
          <div className="mt-1 text-[11px] font-medium text-slate-500">
            Empty Slot
          </div>
        )}
      </button>
    );
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Tank Equipment"
      className="absolute inset-2 sm:inset-3 z-20 flex flex-col bg-[#131920]/98 border border-[#334155] rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-[#1A222C] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-sky-400 shrink-0" />
          <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
            Tank Equipment
          </h2>
          <span className="font-mono-tabular text-[11px] font-semibold px-2 py-0.5 rounded bg-[#10151B] border border-white/10 text-slate-300 shrink-0">
            Loadout {equippedCount}/6
          </span>
          <span
            title="Unequipped Storage Capacity"
            className={`font-mono-tabular text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${
              isInventoryFull
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                : unequippedCount >= inventoryCapacity - 3
                  ? 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                  : 'bg-[#10151B] border-white/10 text-slate-300'
            }`}
          >
            Bag {unequippedCount}/{inventoryCapacity}
          </span>
        </div>

        {/* Live Tank Stat Readout on Wide Screens */}
        <div className="hidden xl:flex items-center gap-3 text-[11px] font-mono-tabular text-slate-300">
          <span>
            ATK <strong className="text-amber-300">{tankStats.attackPower}</strong>
          </span>
          <span>
            SPD{' '}
            <strong className="text-sky-300">
              {tankStats.fireRate.toFixed(2)}/s
            </strong>
          </span>
          <span>
            CRIT{' '}
            <strong className="text-yellow-300">
              {tankStats.critChance.toFixed(1)}%
            </strong>
          </span>
          <span>
            ARM <strong className="text-slate-100">{tankStats.armor}</strong>
          </span>
          <span>
            MOVE{' '}
            <strong className="text-emerald-300">
              {Math.round(tankStats.moveSpeed)}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenForge();
            }}
            className="h-8 px-2.5 rounded-lg bg-[#D97706] hover:bg-[#F59E0B] border border-amber-300/60 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <Hammer className="w-3.5 h-3.5 shrink-0" />
            <span>Forge</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onClose();
            }}
            aria-label="Close Tank Equipment"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#222B37] hover:bg-[#2E3A4A] border border-white/15 text-slate-200 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient Feedback or Capacity Warning Banner */}
      {(feedback || localNotice) && (
        <div
          role="status"
          aria-live="polite"
          className={`px-3 py-1.5 text-xs font-semibold border-b shrink-0 ${
            localNotice || feedback?.tone === 'error'
              ? 'bg-rose-950/75 border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/75 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {localNotice ?? feedback?.text}
        </div>
      )}

      {!feedback && !localNotice && isInventoryFull && (
        <div className="px-3 py-1.5 text-xs font-semibold border-b bg-amber-950/60 border-amber-500/40 text-amber-200 flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">
            Inventory Full ({unequippedCount}/{inventoryCapacity}). Dismantle
            unused unlocked gear to forge or unequip items.
          </span>
        </div>
      )}

      {/* Mobile / Narrow Landscape Section Switcher Tabs (< lg) */}
      <div className="lg:hidden grid grid-cols-3 gap-1.5 p-1.5 bg-[#161C24] border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setMobileTab('equipment');
          }}
          className={`h-8 rounded-md text-xs font-bold transition-colors ${
            mobileTab === 'equipment'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-[#1D2530] text-slate-300 hover:text-white'
          }`}
        >
          Loadout ({equippedCount}/6)
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setMobileTab('inventory');
          }}
          className={`h-8 rounded-md text-xs font-bold transition-colors ${
            mobileTab === 'inventory'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-[#1D2530] text-slate-300 hover:text-white'
          }`}
        >
          Inventory ({unequippedCount}/{inventoryCapacity})
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setMobileTab('details');
          }}
          className={`h-8 rounded-md text-xs font-bold transition-colors truncate px-2 ${
            mobileTab === 'details'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-[#1D2530] text-slate-300 hover:text-white'
          }`}
        >
          {selectedItem ? 'Details' : 'Inspect'}
        </button>
      </div>

      {/* 3-Section Responsive Body */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden lg:divide-x divide-white/10">
        {/* LEFT SECTION — TANK EQUIPMENT */}
        <div
          className={`${
            mobileTab === 'equipment' ? 'flex' : 'hidden'
          } lg:flex lg:col-span-4 flex-col min-h-0 p-3 bg-[#12171E] overflow-y-auto panel-scroll gap-2.5`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Tank Loadout
            </h3>
            <span className="text-[11px] text-slate-400">
              Tap slot to inspect
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 items-center">
            <div className="flex flex-col gap-2">
              {LEFT_SLOT_ORDER.map(renderSlotTile)}
            </div>

            <TankChassisPreview equipmentSlots={equipmentSlots} />

            <div className="flex flex-col gap-2">
              {RIGHT_SLOT_ORDER.map(renderSlotTile)}
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-auto pt-1">
            {(() => {
              const slotMeta = EQUIPMENT_SLOT_META.find(
                (m) => m.slot === selectedSlot
              )!;
              const slotItem = equipmentSlots[selectedSlot];
              return (
                <div className="lg:hidden flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#18202A] border border-white/10">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Selected Slot: {slotMeta.label}
                    </div>
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {slotItem ? slotItem.name : 'No equipment assigned'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleSelectLoadoutSlot(selectedSlot, true);
                    }}
                    className="shrink-0 h-8 px-3 rounded-md bg-[#253040] hover:bg-[#314054] border border-white/15 text-xs font-bold text-amber-300"
                  >
                    {slotItem ? 'Inspect' : 'Browse Gear'}
                  </button>
                </div>
              );
            })()}

            <div className="p-2.5 rounded-lg bg-[#161C24] border border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Active Equipment Bonuses
              </div>
              {activeBonusEntries.length === 0 ? (
                <div className="text-xs text-slate-500">
                  Equip gear to boost tank combat performance.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeBonusEntries.map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0F141A] border border-emerald-500/35 text-[11px] font-mono-tabular text-emerald-300 font-semibold"
                    >
                      <span>{EQUIPMENT_STAT_LABELS[key].shortLabel}</span>
                      <span>
                        {formatEquipmentStatValue(
                          key,
                          equipmentBonuses[key] ?? 0
                        )}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION — EQUIPMENT INVENTORY */}
        <div
          className={`${
            mobileTab === 'inventory' ? 'flex' : 'hidden'
          } lg:flex lg:col-span-4 flex-col min-h-0 p-3 bg-[#141A21] gap-2 relative`}
        >
          {/* Header & Action Row */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 truncate">
                Inventory ({filteredAndSortedInventory.length})
              </h3>
              {hasNonDefaultFilters && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onChangePreferences({
                      ...DEFAULT_EQUIPMENT_PREFERENCES,
                    });
                  }}
                  title="Reset Filters & Sort"
                  className="h-6 px-1.5 rounded bg-[#1D2530] hover:bg-[#263140] border border-white/10 text-[10px] font-semibold text-amber-300 flex items-center gap-1 shrink-0"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setBulkMode((prev) => {
                  const next = !prev;
                  if (!next) {
                    setSelectedBulkUids([]);
                    setConfirmBulkOpen(false);
                  }
                  return next;
                });
              }}
              className={`h-7 px-2.5 rounded-md border text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0 ${
                bulkMode
                  ? 'bg-rose-600 hover:bg-rose-500 border-rose-300/60 text-white'
                  : 'bg-[#1D2530] hover:bg-[#273241] border-white/15 text-slate-200'
              }`}
            >
              <Trash2 className="w-3 h-3 shrink-0" />
              <span>{bulkMode ? 'Done' : 'Bulk Dismantle'}</span>
            </button>
          </div>

          {/* Compact Inline Filter & Sort Bar */}
          <div className="grid grid-cols-3 gap-1.5 shrink-0">
            <select
              aria-label="Filter by equipment type"
              value={preferences.slotFilter}
              onChange={(e) => {
                onChangePreferences({
                  slotFilter: e.target.value as EquipmentSlotType | 'all',
                });
                e.currentTarget.blur();
              }}
              className="h-8 px-1.5 rounded-lg bg-[#1A222C] border border-white/15 text-[11px] font-semibold text-slate-100 outline-none focus:border-amber-400 truncate"
            >
              <option value="all">All Slots</option>
              {EQUIPMENT_SLOT_META.map((meta) => (
                <option key={meta.slot} value={meta.slot}>
                  {meta.shortLabel}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by rarity"
              value={preferences.rarityFilter}
              onChange={(e) => {
                onChangePreferences({
                  rarityFilter: e.target.value as EquipmentRarity | 'all',
                });
                e.currentTarget.blur();
              }}
              className="h-8 px-1.5 rounded-lg bg-[#1A222C] border border-white/15 text-[11px] font-semibold text-slate-100 outline-none focus:border-amber-400 truncate"
            >
              <option value="all">All Rarities</option>
              {EQUIPMENT_RARITY_ORDER.map((rarity) => (
                <option key={rarity} value={rarity}>
                  {EQUIPMENT_RARITY_CONFIG[rarity].label}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort equipment"
              value={preferences.sortBy}
              onChange={(e) => {
                onChangePreferences({
                  sortBy: e.target.value as EquipmentSortOption,
                });
                e.currentTarget.blur();
              }}
              className="h-8 px-1.5 rounded-lg bg-[#1A222C] border border-white/15 text-[11px] font-semibold text-slate-100 outline-none focus:border-amber-400 truncate"
            >
              {EQUIPMENT_SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk Dismantle Controls Bar */}
          {bulkMode && (
            <div className="p-2 rounded-lg bg-rose-950/35 border border-rose-500/40 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-bold text-rose-100">
                  {bulkEligibleSelected.items.length} selected
                </span>
                <span className="inline-flex items-center gap-0.5 font-mono-tabular font-bold text-amber-300">
                  +{bulkEligibleSelected.totalCoins}
                  <Coins className="w-3 h-3 shrink-0" />
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleSelectAllFilteredEligible();
                  }}
                  className="h-7 px-2 rounded bg-[#232D3B] hover:bg-[#2F3C4E] border border-white/15 text-[10px] font-bold text-slate-200"
                >
                  Select Unlocked
                </button>
                {bulkEligibleSelected.items.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setSelectedBulkUids([]);
                    }}
                    className="h-7 px-2 rounded bg-[#232D3B] hover:bg-[#2F3C4E] border border-white/15 text-[10px] font-bold text-slate-300"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  disabled={bulkEligibleSelected.items.length === 0}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setConfirmBulkOpen(true);
                  }}
                  className="h-7 px-2.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-[11px] font-bold text-white"
                >
                  Dismantle
                </button>
              </div>
            </div>
          )}

          {/* Custom Bulk Dismantle Confirmation Panel */}
          {confirmBulkOpen && bulkEligibleSelected.items.length > 0 && (
            <div
              role="alertdialog"
              aria-label="Confirm Bulk Dismantle"
              className="p-2.5 rounded-lg bg-[#1A1318] border-2 border-rose-500/70 shadow-lg flex flex-col gap-2 shrink-0"
            >
              <div className="text-xs font-bold text-rose-100">
                Dismantle {bulkEligibleSelected.items.length} unlocked{' '}
                {bulkEligibleSelected.items.length === 1 ? 'item' : 'items'} for{' '}
                <span className="text-amber-300 font-mono-tabular">
                  +{bulkEligibleSelected.totalCoins} Coins
                </span>
                ?
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                {bulkEligibleSelected.items
                  .slice(0, 3)
                  .map((i) => i.name)
                  .join(', ')}
                {bulkEligibleSelected.items.length > 3
                  ? ` +${bulkEligibleSelected.items.length - 3} more`
                  : ''}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setConfirmBulkOpen(false);
                  }}
                  className="h-8 px-3 rounded-md bg-[#232C38] hover:bg-[#2E3949] border border-white/15 text-xs font-bold text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleConfirmBulkDismantle();
                  }}
                  className="h-8 px-3 rounded-md bg-rose-600 hover:bg-rose-500 border border-rose-300/60 text-xs font-bold text-white"
                >
                  Confirm (+{bulkEligibleSelected.totalCoins})
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Item Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto panel-scroll pr-0.5">
            {filteredAndSortedInventory.length === 0 ? (
              <div className="h-full min-h-[120px] flex flex-col items-center justify-center p-4 text-center border border-dashed border-white/10 rounded-lg gap-2">
                <p className="text-xs text-slate-400">
                  {ownedItems.length === 0
                    ? 'Your equipment inventory is empty. Visit the Forge to craft new gear.'
                    : 'No items match the selected slot or rarity filters.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                {filteredAndSortedInventory.map((item) => {
                  const rarityMeta = EQUIPMENT_RARITY_CONFIG[item.rarity];
                  const slotMeta = EQUIPMENT_SLOT_META.find(
                    (m) => m.slot === item.slot
                  );
                  const isSelected = item.uid === selectedUid;
                  const isBulkSelected = selectedBulkUids.includes(item.uid);
                  const bulkBlocked =
                    bulkMode && (item.equipped || item.locked);

                  return (
                    <div
                      key={item.uid}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (bulkMode) {
                          handleToggleBulkItem(item);
                          return;
                        }
                        setSelectedUid(item.uid);
                        setSelectedSlot(item.slot);
                        setMobileTab('details');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (bulkMode) {
                            handleToggleBulkItem(item);
                            return;
                          }
                          setSelectedUid(item.uid);
                          setSelectedSlot(item.slot);
                          setMobileTab('details');
                        }
                      }}
                      className={`text-left p-2.5 rounded-lg border transition-all flex items-start gap-2 cursor-pointer select-none ${
                        bulkMode && isBulkSelected
                          ? 'bg-rose-950/45 border-rose-400 ring-2 ring-rose-400/40'
                          : bulkBlocked
                            ? 'bg-[#151B22] border-white/5 opacity-60'
                            : !bulkMode && isSelected
                              ? `${rarityMeta.bgClass} border-amber-400 ring-2 ring-amber-400/35`
                              : `bg-[#19212B] hover:bg-[#202A37] ${rarityMeta.borderClass}`
                      }`}
                    >
                      {bulkMode && (
                        <div
                          className={`mt-2 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            bulkBlocked
                              ? 'border-slate-600 bg-slate-900/60'
                              : isBulkSelected
                                ? 'border-rose-400 bg-rose-500 text-white'
                                : 'border-slate-400 bg-[#10151C]'
                          }`}
                        >
                          {isBulkSelected && <Check className="w-3 h-3" />}
                        </div>
                      )}

                      <div
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${rarityMeta.badgeClass}`}
                      >
                        <EquipmentIcon
                          iconId={item.iconId}
                          slot={item.slot}
                          className="w-4 h-4"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <div
                            className={`text-xs font-bold leading-snug truncate ${rarityMeta.textClass}`}
                          >
                            {item.name}
                          </div>

                          <button
                            type="button"
                            aria-label={
                              item.locked
                                ? `Unlock ${item.name}`
                                : `Lock ${item.name}`
                            }
                            title={
                              item.locked
                                ? 'Locked (click to unlock)'
                                : 'Unlocked (click to lock)'
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              e.currentTarget.blur();
                              onToggleLock(item.uid);
                            }}
                            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
                              item.locked
                                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                            }`}
                          >
                            {item.locked ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${rarityMeta.badgeClass}`}
                          >
                            {rarityMeta.label}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {slotMeta?.shortLabel ?? item.slot}
                          </span>
                          {item.equipped && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                              Equipped
                            </span>
                          )}
                          {item.specialEffect && (
                            <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SECTION — ITEM DETAILS & COMPARISON */}
        <div
          className={`${
            mobileTab === 'details' ? 'flex' : 'hidden'
          } lg:flex lg:col-span-4 flex-col min-h-0 p-3 bg-[#11161C] justify-between gap-2.5 overflow-y-auto panel-scroll`}
        >
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-slate-500 p-4">
              Select an equipped slot or inventory item to inspect details and
              compare stats.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {/* Item Header Card */}
                {(() => {
                  const rarityMeta = EQUIPMENT_RARITY_CONFIG[selectedItem.rarity];
                  return (
                    <div
                      className={`p-3 rounded-lg border ${rarityMeta.bgClass} ${rarityMeta.borderClass}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${rarityMeta.badgeClass}`}
                        >
                          <EquipmentIcon
                            iconId={selectedItem.iconId}
                            slot={selectedItem.slot}
                            className="w-5 h-5"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className={`text-sm font-bold leading-tight ${rarityMeta.textClass}`}
                            >
                              {selectedItem.name}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.currentTarget.blur();
                                onToggleLock(selectedItem.uid);
                              }}
                              className={`h-7 px-2 rounded-md border text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors ${
                                selectedItem.locked
                                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 hover:bg-amber-500/30'
                                  : 'bg-[#0F141A] border-white/15 text-slate-300 hover:text-white'
                              }`}
                            >
                              {selectedItem.locked ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>Locked</span>
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  <span>Lock</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${rarityMeta.badgeClass}`}
                            >
                              {rarityMeta.label}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#0F141A] border border-white/10 text-slate-200">
                              {selectedSlotMeta?.label ?? selectedItem.slot}
                            </span>
                            {isSelectedCurrentlyEquipped && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                                Equipped
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {selectedItem.description && (
                        <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                          {selectedItem.description}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Special Effect Module */}
                {selectedItem.specialEffect && (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-400/40 flex items-start gap-2">
                    <Flame className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-amber-300">
                        Special Effect: {selectedItem.specialEffect.name}
                      </div>
                      <div className="text-xs text-amber-100/90 leading-snug mt-0.5">
                        {selectedItem.specialEffect.description}
                      </div>
                    </div>
                  </div>
                )}

                {/* Slot Comparison & Stat Breakdown */}
                <div className="p-2.5 rounded-lg bg-[#171E27] border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    {isSelectedCurrentlyEquipped
                      ? 'Equipped Stat Bonuses'
                      : `Comparison vs ${selectedSlotMeta?.shortLabel} Slot`}
                  </div>

                  {!isSelectedCurrentlyEquipped && (
                    <div className="mb-2 text-xs">
                      {currentlyEquippedForSelectedSlot ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400">Equipped:</span>
                          <span
                            className={`font-bold ${
                              EQUIPMENT_RARITY_CONFIG[
                                currentlyEquippedForSelectedSlot.rarity
                              ].textClass
                            }`}
                          >
                            {currentlyEquippedForSelectedSlot.name}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span
                            className={`font-bold ${
                              EQUIPMENT_RARITY_CONFIG[selectedItem.rarity]
                                .textClass
                            }`}
                          >
                            {selectedItem.name}
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-400">
                          Equipped:{' '}
                          <span className="font-semibold text-slate-200">
                            None (Empty Slot)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    {comparisonRows.map((row) => {
                      const label = EQUIPMENT_STAT_LABELS[row.statKey].label;
                      const deltaText =
                        row.delta > 0
                          ? formatEquipmentStatValue(
                              row.statKey,
                              row.delta,
                              true
                            )
                          : row.delta < 0
                            ? formatEquipmentStatValue(
                                row.statKey,
                                row.delta,
                                false
                              )
                            : '0';
                      const deltaColor =
                        row.delta > 0
                          ? 'text-emerald-400'
                          : row.delta < 0
                            ? 'text-rose-400'
                            : 'text-slate-400';

                      return (
                        <div
                          key={row.statKey}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#10151C] border border-white/5 text-xs"
                        >
                          <span className="text-slate-300 truncate">
                            {label}
                          </span>
                          <div className="flex items-center gap-2 font-mono-tabular shrink-0">
                            {!isSelectedCurrentlyEquipped &&
                            currentlyEquippedForSelectedSlot ? (
                              <span className="text-slate-400 text-[11px]">
                                {formatEquipmentStatValue(
                                  row.statKey,
                                  row.equippedValue,
                                  false
                                )}{' '}
                                →{' '}
                                <span className="text-slate-100 font-semibold">
                                  {formatEquipmentStatValue(
                                    row.statKey,
                                    row.selectedValue,
                                    false
                                  )}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-100 font-semibold">
                                {formatEquipmentStatValue(
                                  row.statKey,
                                  row.selectedValue,
                                  true
                                )}
                              </span>
                            )}
                            {!isSelectedCurrentlyEquipped && (
                              <span className={`font-bold ${deltaColor}`}>
                                ({deltaText})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Net Tank Combat Stat Preview */}
                {!isSelectedCurrentlyEquipped && (
                  <div className="p-2.5 rounded-lg bg-[#151B23] border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Net Tank Stat Impact
                    </div>
                    {tankImpactRows.length === 0 ? (
                      <div className="text-[11px] text-slate-500">
                        No net change to capped tank combat totals.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {tankImpactRows.map((impact) => (
                          <div
                            key={impact.label}
                            className="flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-[#0F141A] border border-white/5 text-[11px]"
                          >
                            <span className="text-slate-400 truncate">
                              {impact.label}
                            </span>
                            <span className="font-mono-tabular shrink-0">
                              <span className="text-slate-300">
                                {impact.nextText}
                              </span>{' '}
                              <span
                                className={`font-bold ${
                                  impact.positive
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                ({impact.deltaText})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="pt-1 flex flex-col gap-1.5 shrink-0">
                {isSelectedCurrentlyEquipped ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onUnequipSlot(selectedItem.slot);
                    }}
                    className={`w-full min-h-[44px] px-4 rounded-lg border text-sm font-bold transition-colors active:scale-98 ${
                      isInventoryFull
                        ? 'bg-[#1D242E] border-rose-500/40 text-rose-200 hover:bg-[#252D39]'
                        : 'bg-[#242E3B] hover:bg-[#313E4F] border-slate-500/50 text-slate-100'
                    }`}
                  >
                    {isInventoryFull
                      ? 'Inventory Full (Cannot Unequip)'
                      : `Unequip ${selectedSlotMeta?.shortLabel}`}
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onEquipItem(selectedItem.uid, selectedItem.slot);
                      }}
                      className="sm:col-span-3 min-h-[44px] px-3 rounded-lg bg-[#D97706] hover:bg-[#F59E0B] border border-amber-300/60 text-xs sm:text-sm font-bold text-slate-950 shadow-sm transition-colors active:scale-98 truncate"
                    >
                      {currentlyEquippedForSelectedSlot
                        ? 'Equip & Replace'
                        : `Equip ${selectedSlotMeta?.shortLabel}`}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        if (selectedItem.locked) {
                          setLocalNotice(
                            `${selectedItem.name} is locked — unlock to dismantle`
                          );
                          return;
                        }
                        onDismantleItem(selectedItem.uid);
                      }}
                      className={`sm:col-span-2 min-h-[44px] px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        selectedItem.locked
                          ? 'bg-[#181E27] border-amber-500/35 text-amber-300/75'
                          : 'bg-[#212936] hover:bg-rose-950/70 border-white/15 hover:border-rose-500/60 text-slate-100'
                      }`}
                    >
                      {selectedItem.locked ? (
                        <>
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span>Locked</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="font-mono-tabular text-amber-300">
                            +{FORGE_CONFIG.dismantleCoinsByRarity[selectedItem.rarity]}
                          </span>
                          <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

