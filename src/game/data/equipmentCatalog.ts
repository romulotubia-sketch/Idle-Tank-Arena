import { EQUIPMENT_SLOT_ORDER, FORGE_CONFIG } from '../constants';
import {
  EquipmentDefinition,
  EquipmentIconId,
  EquipmentItem,
  EquipmentRarity,
  EquipmentSlotType,
  EquipmentSortOption,
  EquipmentSpecialEffect,
  EquipmentSpecialEffectId,
  EquipmentStatKey,
  EquipmentStatsMap,
} from '../types';

export interface EquipmentSlotMeta {
  slot: EquipmentSlotType;
  label: string;
  shortLabel: string;
  roleHint: string;
}

export const EQUIPMENT_SLOT_META: readonly EquipmentSlotMeta[] = [
  {
    slot: 'cannon',
    label: 'Cannon',
    shortLabel: 'Cannon',
    roleHint: 'Main gun firepower & firing cadence',
  },
  {
    slot: 'armor',
    label: 'Armor',
    shortLabel: 'Armor',
    roleHint: 'Hull plating & defensive durability',
  },
  {
    slot: 'engine',
    label: 'Engine',
    shortLabel: 'Engine',
    roleHint: 'Propulsion output & arena speed',
  },
  {
    slot: 'tracks',
    label: 'Tracks',
    shortLabel: 'Tracks',
    roleHint: 'Traction, mobility & chassis support',
  },
  {
    slot: 'targeting_system',
    label: 'Targeting System',
    shortLabel: 'Targeting',
    roleHint: 'Optics, precision & critical strikes',
  },
  {
    slot: 'auxiliary_system',
    label: 'Auxiliary System',
    shortLabel: 'Auxiliary',
    roleHint: 'Tactical modules & skill power',
  },
];

export interface EquipmentRarityMeta {
  id: EquipmentRarity;
  label: string;
  tier: number;
  statMultiplier: number;
  accentHex: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  badgeClass: string;
}

export const EQUIPMENT_RARITY_ORDER: readonly EquipmentRarity[] = [
  'scrap',
  'reinforced',
  'military',
  'advanced',
  'elite',
  'prototype',
];

export const EQUIPMENT_RARITY_CONFIG: Record<
  EquipmentRarity,
  EquipmentRarityMeta
> = {
  scrap: {
    id: 'scrap',
    label: 'Scrap',
    tier: 1,
    statMultiplier: 1.0,
    accentHex: '#94A3B8',
    borderClass: 'border-slate-500/60',
    bgClass: 'bg-slate-900/60',
    textClass: 'text-slate-300',
    badgeClass: 'bg-slate-800/90 border-slate-500/50 text-slate-200',
  },
  reinforced: {
    id: 'reinforced',
    label: 'Reinforced',
    tier: 2,
    statMultiplier: 1.4,
    accentHex: '#34D399',
    borderClass: 'border-emerald-500/60',
    bgClass: 'bg-emerald-950/30',
    textClass: 'text-emerald-300',
    badgeClass: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300',
  },
  military: {
    id: 'military',
    label: 'Military',
    tier: 3,
    statMultiplier: 1.85,
    accentHex: '#38BDF8',
    borderClass: 'border-sky-500/65',
    bgClass: 'bg-sky-950/30',
    textClass: 'text-sky-300',
    badgeClass: 'bg-sky-950/90 border-sky-500/50 text-sky-300',
  },
  advanced: {
    id: 'advanced',
    label: 'Advanced',
    tier: 4,
    statMultiplier: 2.35,
    accentHex: '#A78BFA',
    borderClass: 'border-violet-500/65',
    bgClass: 'bg-violet-950/30',
    textClass: 'text-violet-300',
    badgeClass: 'bg-violet-950/90 border-violet-500/50 text-violet-300',
  },
  elite: {
    id: 'elite',
    label: 'Elite',
    tier: 5,
    statMultiplier: 3.0,
    accentHex: '#FBBF24',
    borderClass: 'border-amber-400/75',
    bgClass: 'bg-amber-950/30',
    textClass: 'text-amber-300',
    badgeClass: 'bg-amber-950/90 border-amber-400/60 text-amber-300',
  },
  prototype: {
    id: 'prototype',
    label: 'Prototype',
    tier: 6,
    statMultiplier: 3.8,
    accentHex: '#FB7185',
    borderClass: 'border-rose-500/75',
    bgClass: 'bg-rose-950/35',
    textClass: 'text-rose-300',
    badgeClass: 'bg-rose-950/90 border-rose-500/60 text-rose-300',
  },
};

export const EQUIPMENT_STAT_ORDER: readonly EquipmentStatKey[] = [
  'attackDamage',
  'attackSpeed',
  'critChance',
  'critDamage',
  'maxHp',
  'armor',
  'moveSpeed',
  'skillDamage',
];

export const EQUIPMENT_STAT_LABELS: Record<
  EquipmentStatKey,
  { label: string; shortLabel: string }
> = {
  attackDamage: { label: 'Attack Damage', shortLabel: 'ATK' },
  attackSpeed: { label: 'Attack Speed', shortLabel: 'SPD' },
  critChance: { label: 'Critical Chance', shortLabel: 'CRIT%' },
  critDamage: { label: 'Critical Damage', shortLabel: 'CDMG' },
  maxHp: { label: 'Max HP', shortLabel: 'HP' },
  armor: { label: 'Armor', shortLabel: 'ARM' },
  moveSpeed: { label: 'Movement Speed', shortLabel: 'MOVE' },
  skillDamage: { label: 'Skill Damage', shortLabel: 'SKILL' },
};

export function formatEquipmentStatValue(
  key: EquipmentStatKey,
  value: number,
  includePlus = true
): string {
  const prefix = includePlus && value > 0 ? '+' : '';
  switch (key) {
    case 'attackDamage':
    case 'maxHp':
    case 'armor':
    case 'moveSpeed':
      return `${prefix}${Math.round(value)}`;
    case 'attackSpeed':
      return `${prefix}${value.toFixed(2)}/s`;
    case 'critChance':
      return `${prefix}${value.toFixed(1)}%`;
    case 'critDamage':
      return `${prefix}${value.toFixed(2)}x`;
    case 'skillDamage':
      return `${prefix}${Math.round(value)}%`;
  }
}

export function scaleStatsByRarity(
  baseStats: EquipmentStatsMap,
  rarity: EquipmentRarity
): EquipmentStatsMap {
  const mult = EQUIPMENT_RARITY_CONFIG[rarity].statMultiplier;
  const scaled: EquipmentStatsMap = {};
  for (const key of EQUIPMENT_STAT_ORDER) {
    const val = baseStats[key];
    if (typeof val !== 'number' || val === 0) continue;
    scaled[key] = roundStatValue(key, val * mult);
  }
  return scaled;
}

function roundStatValue(key: EquipmentStatKey, raw: number): number {
  if (
    key === 'attackDamage' ||
    key === 'maxHp' ||
    key === 'armor' ||
    key === 'moveSpeed' ||
    key === 'skillDamage'
  ) {
    return Math.max(1, Math.round(raw));
  }
  if (key === 'critChance') {
    return Math.max(0.5, Math.round(raw * 10) / 10);
  }
  return Math.max(0.02, Math.round(raw * 100) / 100);
}

// Starter test equipment definitions (all Scrap rarity for immediate testing across all 6 slots)
export const STARTER_EQUIPMENT_DEFINITIONS: readonly EquipmentDefinition[] = [
  {
    templateId: 'scrap_smoothbore_cannon',
    name: 'Scrap Smoothbore Barrel',
    slot: 'cannon',
    rarity: 'scrap',
    baseStats: {
      attackDamage: 5,
      attackSpeed: 0.08,
    },
    description: 'Salvaged field gun barrel tuned for steady autoloader cycles.',
    iconId: 'cannon_barrel',
  },
  {
    templateId: 'scrap_siege_barrel',
    name: 'Patched Rifled Cannon',
    slot: 'cannon',
    rarity: 'scrap',
    baseStats: {
      attackDamage: 8,
    },
    description: 'Heavy welded cannon tube delivering stronger single-shot impact.',
    iconId: 'cannon_heavy',
  },
  {
    templateId: 'scrap_iron_plating',
    name: 'Welded Scrap Plating',
    slot: 'armor',
    rarity: 'scrap',
    baseStats: {
      armor: 6,
      maxHp: 25,
    },
    description: 'Bolted steel plates that absorb incoming shrapnel and shell hits.',
    iconId: 'armor_plate',
  },
  {
    templateId: 'scrap_diesel_engine',
    name: 'Salvaged Diesel Block',
    slot: 'engine',
    rarity: 'scrap',
    baseStats: {
      moveSpeed: 16,
      maxHp: 15,
    },
    description: 'Rebuilt twin-cylinder block boosting arena repositioning speed.',
    iconId: 'engine_core',
  },
  {
    templateId: 'scrap_steel_treads',
    name: 'Riveted Steel Treads',
    slot: 'tracks',
    rarity: 'scrap',
    baseStats: {
      moveSpeed: 12,
      armor: 3,
    },
    description: 'Reinforced track links improving traction and side-skirt protection.',
    iconId: 'tracks_tread',
  },
  {
    templateId: 'scrap_optic_rangefinder',
    name: 'Cracked Rangefinder',
    slot: 'targeting_system',
    rarity: 'scrap',
    baseStats: {
      critChance: 3.5,
      critDamage: 0.12,
    },
    description: 'Surplus prism sight calibrated to spot weak hull seams.',
    iconId: 'targeting_optic',
  },
  {
    templateId: 'scrap_aux_capacitor',
    name: 'Jury-Rigged Capacitor',
    slot: 'auxiliary_system',
    rarity: 'scrap',
    baseStats: {
      skillDamage: 10,
      attackSpeed: 0.06,
    },
    description: 'Secondary power cell amplifying mounted weapon systems.',
    iconId: 'aux_capacitor',
  },
];

export function createStarterEquipmentItems(): EquipmentItem[] {
  return STARTER_EQUIPMENT_DEFINITIONS.map((def, idx) => ({
    uid: `starter_${def.templateId}_${idx + 1}`,
    templateId: def.templateId,
    name: def.name,
    slot: def.slot,
    rarity: def.rarity,
    stats: scaleStatsByRarity(def.baseStats, def.rarity),
    description: def.description,
    iconId: def.iconId,
    equipped: false,
    locked: false,
    acquiredOrder: idx + 1,
  }));
}

// ---------------------------------------------------------------------------
// Configurable Procedural Forging Tables (Military / Tank Theme)
// ---------------------------------------------------------------------------

const RARITY_PREFIXES: Record<EquipmentRarity, readonly string[]> = {
  scrap: ['Salvaged', 'Patched', 'Surplus', 'Field-Welded'],
  reinforced: ['Riveted', 'Tempered', 'Hardened', 'Heavy-Gauge'],
  military: ['Ordnance', 'Frontline', 'Tactical', 'Service'],
  advanced: ['Precision', 'Gyro-Locked', 'Tungsten', 'Stabilized'],
  elite: ['Vanguard', 'Command', 'Siege-Grade', 'Bastion'],
  prototype: ['Aegis-X', 'Hyperion', 'Chimera', 'Apex-MK'],
};

interface StatRangeSpec {
  key: EquipmentStatKey;
  min: number;
  max: number;
}

interface SlotForgeBlueprint {
  slot: EquipmentSlotType;
  iconIds: readonly EquipmentIconId[];
  nouns: readonly string[];
  descriptions: readonly string[];
  primaryStats: readonly StatRangeSpec[];
  secondaryStats: readonly StatRangeSpec[];
  preferredEffects: readonly EquipmentSpecialEffectId[];
}

const SLOT_FORGE_BLUEPRINTS: Record<EquipmentSlotType, SlotForgeBlueprint> = {
  cannon: {
    slot: 'cannon',
    iconIds: ['cannon_barrel', 'cannon_heavy'],
    nouns: ['105mm Bore', 'Howitzer Barrel', 'Smoothbore Gun', 'AP Cannon'],
    descriptions: [
      'Machined artillery barrel engineered for sustained armor penetration.',
      'Recalibrated main gun assembly built for high-velocity shell delivery.',
    ],
    primaryStats: [
      { key: 'attackDamage', min: 5, max: 9 },
      { key: 'attackSpeed', min: 0.07, max: 0.13 },
    ],
    secondaryStats: [
      { key: 'critChance', min: 1.5, max: 3.0 },
      { key: 'critDamage', min: 0.08, max: 0.15 },
      { key: 'skillDamage', min: 4, max: 8 },
    ],
    preferredEffects: ['boss_breaker', 'overcharge_crits'],
  },
  armor: {
    slot: 'armor',
    iconIds: ['armor_plate'],
    nouns: ['Composite Plate', 'Hull Bulkhead', 'Chobham Skirt', 'Armor Shield'],
    descriptions: [
      'Layered steel plating forged to deflect incoming enemy barrage fire.',
      'Shock-absorbing chassis armor built to endure prolonged sieges.',
    ],
    primaryStats: [
      { key: 'armor', min: 4, max: 8 },
      { key: 'maxHp', min: 22, max: 38 },
    ],
    secondaryStats: [
      { key: 'maxHp', min: 18, max: 30 },
      { key: 'moveSpeed', min: 4, max: 8 },
      { key: 'attackDamage', min: 2, max: 4 },
    ],
    preferredEffects: ['reactive_plating', 'reactive_regen'],
  },
  engine: {
    slot: 'engine',
    iconIds: ['engine_core'],
    nouns: ['V12 Diesel', 'Turbine Drive', 'Twin-Turbo Core', 'Powerplant'],
    descriptions: [
      'High-torque propulsion unit delivering rapid battlefield repositioning.',
      'Pressurized tank engine engineered for sustained maneuvering output.',
    ],
    primaryStats: [
      { key: 'moveSpeed', min: 12, max: 20 },
      { key: 'attackSpeed', min: 0.05, max: 0.1 },
    ],
    secondaryStats: [
      { key: 'maxHp', min: 14, max: 26 },
      { key: 'skillDamage', min: 5, max: 9 },
      { key: 'armor', min: 2, max: 4 },
    ],
    preferredEffects: ['reactive_regen', 'capacitor_boost'],
  },
  tracks: {
    slot: 'tracks',
    iconIds: ['tracks_tread'],
    nouns: ['All-Terrain Treads', 'Torsion Bogies', 'Armored Links', 'Assault Tracks'],
    descriptions: [
      'Heavy-duty track suspension improving stability across cratered terrain.',
      'Reinforced drive sprockets balancing agility with undercarriage protection.',
    ],
    primaryStats: [
      { key: 'moveSpeed', min: 9, max: 16 },
      { key: 'armor', min: 3, max: 6 },
    ],
    secondaryStats: [
      { key: 'maxHp', min: 16, max: 28 },
      { key: 'critChance', min: 1.2, max: 2.5 },
      { key: 'attackSpeed', min: 0.04, max: 0.08 },
    ],
    preferredEffects: ['reactive_plating', 'reactive_regen'],
  },
  targeting_system: {
    slot: 'targeting_system',
    iconIds: ['targeting_optic'],
    nouns: ['Laser Rangefinder', 'Ballistic Optic', 'Fire-Control Array', 'Gunner Sight'],
    descriptions: [
      'Gyro-stabilized targeting computer locking onto weak structural seams.',
      'Precision ballistic optics calibrating critical turret strike trajectories.',
    ],
    primaryStats: [
      { key: 'critChance', min: 2.8, max: 4.8 },
      { key: 'critDamage', min: 0.1, max: 0.18 },
    ],
    secondaryStats: [
      { key: 'attackDamage', min: 3, max: 6 },
      { key: 'attackSpeed', min: 0.05, max: 0.09 },
      { key: 'skillDamage', min: 5, max: 9 },
    ],
    preferredEffects: ['overcharge_crits', 'boss_breaker'],
  },
  auxiliary_system: {
    slot: 'auxiliary_system',
    iconIds: ['aux_capacitor'],
    nouns: ['Power Capacitor', 'Cooling Manifold', 'Combat Relay', 'Ordnance Module'],
    descriptions: [
      'Secondary tactical sub-system supercharging mounted combat weapons.',
      'Auxiliary conduit array boosting skill discharge efficiency under fire.',
    ],
    primaryStats: [
      { key: 'skillDamage', min: 8, max: 14 },
      { key: 'attackSpeed', min: 0.05, max: 0.1 },
    ],
    secondaryStats: [
      { key: 'critDamage', min: 0.08, max: 0.16 },
      { key: 'maxHp', min: 15, max: 28 },
      { key: 'attackDamage', min: 3, max: 6 },
    ],
    preferredEffects: ['capacitor_boost', 'reactive_regen'],
  },
};

interface SpecialEffectBlueprint {
  id: EquipmentSpecialEffectId;
  name: string;
  baseMin: number;
  baseMax: number;
  buildDescription: (val: number) => string;
}

const SPECIAL_EFFECT_BLUEPRINTS: Record<
  EquipmentSpecialEffectId,
  SpecialEffectBlueprint
> = {
  boss_breaker: {
    id: 'boss_breaker',
    name: 'Siege Breaker',
    baseMin: 6,
    baseMax: 10,
    buildDescription: (v) => `Deals +${v}% bonus damage against Boss enemies.`,
  },
  reactive_plating: {
    id: 'reactive_plating',
    name: 'Reactive Plating',
    baseMin: 1,
    baseMax: 2,
    buildDescription: (v) =>
      `Blocks an additional ${v} flat damage from each enemy hit.`,
  },
  reactive_regen: {
    id: 'reactive_regen',
    name: 'Hull Nanorepair',
    baseMin: 1,
    baseMax: 2,
    buildDescription: (v) =>
      `Restores ${v} HP whenever your tank destroys an enemy.`,
  },
  overcharge_crits: {
    id: 'overcharge_crits',
    name: 'Overcharged Core',
    baseMin: 4,
    baseMax: 8,
    buildDescription: (v) =>
      `Critical cannon hits deal +${v} bonus impact damage.`,
  },
  capacitor_boost: {
    id: 'capacitor_boost',
    name: 'Aux Surge',
    baseMin: 5,
    baseMax: 9,
    buildDescription: (v) =>
      `Amplifies all mounted combat skill damage by an extra +${v}%.`,
  },
};

const SPECIAL_EFFECT_TIER_SCALE: Record<EquipmentRarity, number> = {
  scrap: 1,
  reinforced: 1,
  military: 1.0,
  advanced: 1.45,
  elite: 2.0,
  prototype: 2.75,
};

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rollForgeRarity(): EquipmentRarity {
  const weights = FORGE_CONFIG.rarityWeights;
  const totalWeight = EQUIPMENT_RARITY_ORDER.reduce(
    (sum, r) => sum + weights[r],
    0
  );
  let roll = Math.random() * totalWeight;
  for (const rarity of EQUIPMENT_RARITY_ORDER) {
    roll -= weights[rarity];
    if (roll <= 0) {
      return rarity;
    }
  }
  return 'scrap';
}

export function generateRandomSpecialEffect(
  slot: EquipmentSlotType,
  rarity: EquipmentRarity
): EquipmentSpecialEffect | undefined {
  const chance = FORGE_CONFIG.specialEffectChanceByRarity[rarity];
  if (Math.random() >= chance) {
    return undefined;
  }

  const blueprint = SLOT_FORGE_BLUEPRINTS[slot];
  const effectId = pickRandom(blueprint.preferredEffects);
  const spec = SPECIAL_EFFECT_BLUEPRINTS[effectId];
  const scale = SPECIAL_EFFECT_TIER_SCALE[rarity];
  const value = Math.max(
    1,
    Math.round(randomFloat(spec.baseMin, spec.baseMax) * scale)
  );

  return {
    id: spec.id,
    name: spec.name,
    value,
    description: spec.buildDescription(value),
  };
}

export function generateForgedEquipmentItem(
  sequenceNumber: number
): EquipmentItem {
  const rarity = rollForgeRarity();
  const slotMeta = pickRandom(EQUIPMENT_SLOT_META);
  const blueprint = SLOT_FORGE_BLUEPRINTS[slotMeta.slot];
  const rarityMult = EQUIPMENT_RARITY_CONFIG[rarity].statMultiplier;

  const prefix = pickRandom(RARITY_PREFIXES[rarity]);
  const noun = pickRandom(blueprint.nouns);
  const iconId = pickRandom(blueprint.iconIds);
  const description = pickRandom(blueprint.descriptions);

  const stats: EquipmentStatsMap = {};

  // Guarantee primary slot stat
  const mainPrimary = blueprint.primaryStats[0];
  stats[mainPrimary.key] = roundStatValue(
    mainPrimary.key,
    randomFloat(mainPrimary.min, mainPrimary.max) * rarityMult
  );

  // Add second stat (guaranteed for Reinforced+, 65% for Scrap)
  const addSecondPrimary =
    rarity !== 'scrap' || Math.random() < 0.65;
  if (addSecondPrimary && blueprint.primaryStats.length > 1) {
    const secondPrimary = blueprint.primaryStats[1];
    stats[secondPrimary.key] = roundStatValue(
      secondPrimary.key,
      randomFloat(secondPrimary.min, secondPrimary.max) * rarityMult
    );
  }

  // Add secondary stats on Military+ (1 for Military/Advanced, 1-2 for Elite/Prototype)
  const extraCount =
    rarity === 'prototype'
      ? 2
      : rarity === 'elite'
        ? Math.random() < 0.65
          ? 2
          : 1
        : rarity === 'military' || rarity === 'advanced'
          ? 1
          : 0;

  const candidatePool = blueprint.secondaryStats.filter(
    (spec) => stats[spec.key] === undefined
  );
  for (let i = 0; i < extraCount && candidatePool.length > 0; i++) {
    const pickIdx = Math.floor(Math.random() * candidatePool.length);
    const chosen = candidatePool.splice(pickIdx, 1)[0];
    stats[chosen.key] = roundStatValue(
      chosen.key,
      randomFloat(chosen.min, chosen.max) * rarityMult
    );
  }

  const specialEffect = generateRandomSpecialEffect(slotMeta.slot, rarity);
  const uid = `forged_${rarity}_${slotMeta.slot}_${Date.now()}_${sequenceNumber}`;

  return {
    uid,
    templateId: `forged_${slotMeta.slot}`,
    name: `${prefix} ${noun}`,
    slot: slotMeta.slot,
    rarity,
    stats,
    description,
    iconId,
    equipped: false,
    locked: false,
    acquiredOrder: 0,
    specialEffect,
  };
}

export const EQUIPMENT_SORT_OPTIONS: readonly {
  id: EquipmentSortOption;
  label: string;
}[] = [
  { id: 'rarity_desc', label: 'Rarity: High → Low' },
  { id: 'rarity_asc', label: 'Rarity: Low → High' },
  { id: 'slot', label: 'Equipment Slot' },
  { id: 'highest_stat', label: 'Highest Stat Bonus' },
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
];

const STAT_SCORE_WEIGHTS: Record<EquipmentStatKey, number> = {
  attackDamage: 1.5,
  attackSpeed: 80,
  critChance: 2.5,
  critDamage: 45,
  maxHp: 0.45,
  armor: 2.0,
  moveSpeed: 0.9,
  skillDamage: 1.2,
};

const SLOT_ORDER_INDEX: Record<EquipmentSlotType, number> =
  EQUIPMENT_SLOT_ORDER.reduce(
    (acc, entry, index) => {
      acc[entry.slot] = index;
      return acc;
    },
    {} as Record<EquipmentSlotType, number>
  );

export function computeEquipmentStatScore(item: EquipmentItem): number {
  let score = 0;
  for (const key of EQUIPMENT_STAT_ORDER) {
    const val = item.stats[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      score += val * STAT_SCORE_WEIGHTS[key];
    }
  }
  if (item.specialEffect && Number.isFinite(item.specialEffect.value)) {
    score += item.specialEffect.value * 1.5;
  }
  return Math.round(score * 100) / 100;
}

export function sortEquipmentItems(
  items: readonly EquipmentItem[],
  sortBy: EquipmentSortOption
): EquipmentItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    const tierA = EQUIPMENT_RARITY_CONFIG[a.rarity].tier;
    const tierB = EQUIPMENT_RARITY_CONFIG[b.rarity].tier;
    const scoreA = computeEquipmentStatScore(a);
    const scoreB = computeEquipmentStatScore(b);
    const orderA = a.acquiredOrder ?? 0;
    const orderB = b.acquiredOrder ?? 0;

    switch (sortBy) {
      case 'rarity_desc': {
        if (tierB !== tierA) return tierB - tierA;
        if (scoreB !== scoreA) return scoreB - scoreA;
        if (orderB !== orderA) return orderB - orderA;
        return a.name.localeCompare(b.name);
      }
      case 'rarity_asc': {
        if (tierA !== tierB) return tierA - tierB;
        if (scoreA !== scoreB) return scoreA - scoreB;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      }
      case 'slot': {
        const slotDiff = SLOT_ORDER_INDEX[a.slot] - SLOT_ORDER_INDEX[b.slot];
        if (slotDiff !== 0) return slotDiff;
        if (tierB !== tierA) return tierB - tierA;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.name.localeCompare(b.name);
      }
      case 'highest_stat': {
        if (scoreB !== scoreA) return scoreB - scoreA;
        if (tierB !== tierA) return tierB - tierA;
        if (orderB !== orderA) return orderB - orderA;
        return a.name.localeCompare(b.name);
      }
      case 'newest': {
        if (orderB !== orderA) return orderB - orderA;
        if (tierB !== tierA) return tierB - tierA;
        return b.uid.localeCompare(a.uid);
      }
      case 'oldest': {
        if (orderA !== orderB) return orderA - orderB;
        if (tierB !== tierA) return tierB - tierA;
        return a.uid.localeCompare(b.uid);
      }
    }
  });
  return copy;
}
