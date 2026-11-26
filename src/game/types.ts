export type GamePhase = 'TITLE' | 'ACTIVE' | 'PAUSED' | 'DEFEAT';

export type DockTab = 'tank' | 'skills' | 'forge' | 'inventory';

export interface Vector2 {
  x: number;
  y: number;
}

export interface WorldRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ArenaBounds {
  width: number;
  height: number;
  gridSize: number;
  safeMargin: number;
}

export interface TankStats {
  hp: number;
  maxHp: number;
  armor: number;
  attackPower: number;
  fireRate: number;
  range: number;
  critChance: number;
  critDamage: number;
  moveSpeed: number;
  skillDamageBonus: number;
  hpOnKill: number;
  flatDamageBlock: number;
  bossDamageBonusPct: number;
  critBonusFlat: number;
}

export interface PlayerTankState {
  position: Vector2;
  movementOrigin: Vector2;
  movementRadius: number;
  hullAngle: number;
  turretAngle: number;
  idlePhase: number;
  hitFlashTimer: number;
  recoilOffset: number;
  isMoving: boolean;
  stats: TankStats;
}

export type EnemyKind = 'scout_buggy' | 'heavy_crawler' | 'siege_boss';

export interface EnemyDefinition {
  id: EnemyKind;
  name: string;
  baseHp: number;
  speed: number;
  attackDamage: number;
  attackIntervalSec: number;
  attackRange: number;
  radius: number;
  rewardGold: number;
}

export interface EnemyInstance {
  uid: number;
  definitionId: EnemyKind;
  isBoss: boolean;
  position: Vector2;
  angle: number;
  hp: number;
  maxHp: number;
  speed: number;
  attackDamage: number;
  attackIntervalSec: number;
  attackRange: number;
  attackCooldown: number;
  radius: number;
  rewardGold: number;
  rewardClaimed: boolean;
  hitFlashTimer: number;
  isDying: boolean;
  deathTimer: number;
  deathDuration: number;
  // Boss distinct telegraphed siege attack state
  specialCooldown?: number;
  telegraphTimer?: number;
  telegraphDuration?: number;
  telegraphX?: number;
  telegraphY?: number;
  telegraphRadius?: number;
}

export type ProjectileKind =
  | 'tank_shell'
  | 'heavy_shell'
  | 'mg_bullet'
  | 'rocket'
  | 'mortar_shell'
  | 'rail_slug';

export interface ProjectileInstance {
  uid: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  damage: number;
  radius: number;
  ttl: number;
  active: boolean;
  aoeRadius: number;
  pierceRemaining: number;
  hitEnemyUids: number[];
  visualTier?: number;
  isCrit?: boolean;
  // Used by arcing mortar shells
  startX?: number;
  startY?: number;
  targetX?: number;
  targetY?: number;
  flightElapsed?: number;
  flightDuration?: number;
}

export interface LandmineInstance {
  uid: number;
  x: number;
  y: number;
  damage: number;
  triggerRadius: number;
  aoeRadius: number;
  armTimer: number;
  ttl: number;
  active: boolean;
}

export type VisualEffectKind =
  | 'muzzle'
  | 'impact'
  | 'explosion'
  | 'blast_ring'
  | 'tracer'
  | 'rail_beam'
  | 'lightning_arc'
  | 'flame_cone'
  | 'damage_text';

export interface VisualEffect {
  kind: VisualEffectKind;
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  angle: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  value?: number;
  isCrit?: boolean;
  points?: Vector2[];
  coneHalfAngle?: number;
}

export interface CombatEvent {
  type: 'projectile' | 'hit' | 'skill_proc';
  timestamp: number;
}

export interface BattleSummary {
  enemiesDefeated: number;
  elapsedSeconds: number;
}

export type SkillId =
  | 'cannon'
  | 'machine_gun'
  | 'rocket_barrage'
  | 'mortar'
  | 'railgun'
  | 'flame_thrower'
  | 'tesla'
  | 'landmines';

export type SkillRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  shortLabel: string;
  rarity: SkillRarity;
  accentColor: string;
  summary: string;
}

export interface SkillSlot {
  index: number;
  skillId: SkillId | null;
  level: number;
  tier: number;
  unlocked: boolean;
  cooldownRemaining: number;
  cooldownTotal: number;
}

export interface SummonRule {
  costCurrency: 'gold' | 'gems';
  costAmount: number;
  maxSlots: number;
}

export interface MergeRule {
  requiredTierMatch: boolean;
  maxTier: number;
}

export interface SkillCollectionEntry {
  skillId: SkillId;
  unlocked: boolean;
  collectionLevel: number;
  maxCollectionLevel: number;
  fragments: number;
  nextUpgradeCost: number | null;
  canUpgrade: boolean;
  isMaxLevel: boolean;
}

export interface SavedSkillCollectionEntry {
  skillId: SkillId;
  unlocked: boolean;
  collectionLevel: number;
  fragments: number;
}

export interface SavedSkillCollectionState {
  entries: SavedSkillCollectionEntry[];
}

export interface WaveState {
  currentWave: number;
  highestWave: number;
  enemiesRemaining: number;
  enemiesTotal: number;
  enemiesSpawned: number;
  enemiesDefeatedInWave: number;
  isBossWave: boolean;
  isTransitioning: boolean;
  transitionRemainingSec: number;
}

export interface BossHudState {
  active: boolean;
  name: string;
  hp: number;
  maxHp: number;
  wave: number;
}

export interface CurrencyBalances {
  gold: number;
  scrap: number;
  gems: number;
}

export type UpgradeId =
  | 'attack'
  | 'attack_speed'
  | 'crit_chance'
  | 'crit_damage'
  | 'max_hp'
  | 'armor';

export interface UpgradeEntry {
  id: UpgradeId;
  label: string;
  statKey: keyof TankStats;
  level: number;
  maxLevel: number;
  baseValue: number;
  perLevelBonus: number;
  maxValue: number | null;
  baseCost: number;
  costGrowth: number;
  unit: string;
  currentValue: number;
  nextBonus: number;
  nextCost: number;
  isMaxed: boolean;
}

export interface SavedUpgradeState {
  id: UpgradeId;
  level: number;
}

export type EquipmentSlotType =
  | 'cannon'
  | 'armor'
  | 'engine'
  | 'tracks'
  | 'targeting_system'
  | 'auxiliary_system';

export type EquipmentRarity =
  | 'scrap'
  | 'reinforced'
  | 'military'
  | 'advanced'
  | 'elite'
  | 'prototype';

export type EquipmentStatKey =
  | 'attackDamage'
  | 'attackSpeed'
  | 'critChance'
  | 'critDamage'
  | 'maxHp'
  | 'armor'
  | 'moveSpeed'
  | 'skillDamage';

export type EquipmentStatsMap = Partial<Record<EquipmentStatKey, number>>;

export type EquipmentIconId =
  | 'cannon_barrel'
  | 'cannon_heavy'
  | 'armor_plate'
  | 'engine_core'
  | 'tracks_tread'
  | 'targeting_optic'
  | 'aux_capacitor';

export type EquipmentSpecialEffectId =
  | 'boss_breaker'
  | 'reactive_plating'
  | 'reactive_regen'
  | 'overcharge_crits'
  | 'capacitor_boost';

export interface EquipmentSpecialEffect {
  id: EquipmentSpecialEffectId;
  name: string;
  description: string;
  value: number;
}

export interface EquipmentDefinition {
  templateId: string;
  name: string;
  slot: EquipmentSlotType;
  rarity: EquipmentRarity;
  baseStats: EquipmentStatsMap;
  description: string;
  iconId: EquipmentIconId;
  specialEffect?: EquipmentSpecialEffect;
}

export type EquipmentSortOption =
  | 'rarity_desc'
  | 'rarity_asc'
  | 'slot'
  | 'highest_stat'
  | 'newest'
  | 'oldest';

export interface EquipmentPreferences {
  sortBy: EquipmentSortOption;
  slotFilter: EquipmentSlotType | 'all';
  rarityFilter: EquipmentRarity | 'all';
}

export interface EquipmentItem {
  uid: string;
  templateId: string;
  name: string;
  slot: EquipmentSlotType;
  rarity: EquipmentRarity;
  stats: EquipmentStatsMap;
  description: string;
  iconId: EquipmentIconId;
  equipped: boolean;
  locked: boolean;
  acquiredOrder: number;
  specialEffect?: EquipmentSpecialEffect;
}

export interface SavedEquipmentState {
  ownedItems: EquipmentItem[];
  equippedIds: Partial<Record<EquipmentSlotType, string | null>>;
  capacity?: number;
  nextAcquiredOrder?: number;
  preferences?: EquipmentPreferences;
}

export type ForgeStatus = 'idle' | 'forging' | 'result_ready';

export interface ForgeState {
  status: ForgeStatus;
  costCoins: number;
  durationSec: number;
  elapsedSec: number;
  progress: number;
  pendingItem: EquipmentItem | null;
  totalForged: number;
}

export interface SavedForgeState {
  totalForged: number;
  pendingItem: EquipmentItem | null;
}

export interface ForgeRecipeSlot {
  level: number;
  scrapCost: number;
  unlocked: boolean;
}

export interface InventorySlot {
  index: number;
  itemId: string | null;
  quantity: number;
}

export interface SavePayload {
  version: number;
  savedAt: number;
  wave: WaveState;
  currencies: CurrencyBalances;
  tankStats: TankStats;
  upgrades?: SavedUpgradeState[];
  equipment?: SavedEquipmentState;
  forge?: SavedForgeState;
  skillCollection?: SavedSkillCollectionState;
  soundEnabled: boolean;
  showRangeRing: boolean;
}

export interface WaveHudEvent {
  id: number;
  kind: 'wave_clear' | 'boss_spawn';
  wave: number;
  isBossWave: boolean;
  rewardGold: number;
}

export interface GameHudSnapshot {
  phase: GamePhase;
  wave: WaveState;
  boss: BossHudState | null;
  waveEvent: WaveHudEvent | null;
  currencies: CurrencyBalances;
  tank: PlayerTankState;
  battle: BattleSummary;
  upgrades: UpgradeEntry[];
  skillSlots: SkillSlot[];
  skillCollection: SkillCollectionEntry[];
  unlockedSkillCount: number;
  equipmentSlots: Record<EquipmentSlotType, EquipmentItem | null>;
  equipmentInventory: EquipmentItem[];
  equipmentCapacity: number;
  equipmentUnequippedCount: number;
  equipmentPreferences: EquipmentPreferences;
  equipmentBonuses: EquipmentStatsMap;
  forge: ForgeState;
  inventoryCapacity: number;
  inventorySlots: InventorySlot[];
  showRangeRing: boolean;
  summonCost: number;
  hasVacantSkillSlot: boolean;
}
