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
  bodyRecoilX: number;
  bodyRecoilY: number;
  isMoving: boolean;
  shieldHp?: number;
  shieldMaxHp?: number;
  shieldTimer?: number;
  overdriveTimer?: number;
  overdriveFireRateBonus?: number;
  stats: TankStats;
}

export type EnemyKind =
  | 'scout'
  | 'assault_tank'
  | 'heavy_tank'
  | 'artillery'
  | 'runner'
  | 'siege_boss';

export type EnemyBehaviorType =
  | 'skirmisher'
  | 'standard'
  | 'juggernaut'
  | 'artillery_ranged'
  | 'rusher'
  | 'boss';

export interface EnemyDefinition {
  id: EnemyKind;
  name: string;
  behavior: EnemyBehaviorType;
  baseHp: number;
  speed: number;
  maxSpeed: number;
  attackDamage: number;
  attackIntervalSec: number;
  attackRange: number;
  preferredMinRange?: number;
  radius: number;
  rewardMultiplier: number;
  rewardGold: number;
  unlockWave: number;
}

export interface EnemyInstance {
  uid: number;
  definitionId: EnemyKind;
  behavior: EnemyBehaviorType;
  isBoss: boolean;
  position: Vector2;
  angle: number;
  hp: number;
  maxHp: number;
  speed: number;
  attackDamage: number;
  attackIntervalSec: number;
  attackRange: number;
  preferredMinRange: number;
  attackCooldown: number;
  radius: number;
  rewardGold: number;
  rewardClaimed: boolean;
  hitFlashTimer: number;
  hitReactionTimer: number;
  hitReactionX: number;
  hitReactionY: number;
  isDying: boolean;
  deathTimer: number;
  deathDuration: number;
  // Smooth hysteresis so enemies don't jitter at range edge
  inAttackHold?: boolean;
  // Status effects (Frost Cannon slow, Acid Shells DoT)
  slowTimer?: number;
  slowFactor?: number;
  acidTimer?: number;
  acidDps?: number;
  acidTickTimer?: number;
  // Boss distinct encounter & attack pattern state
  introTimer?: number;
  introDuration?: number;
  burstCooldown?: number;
  burstChargeTimer?: number;
  burstShotsRemaining?: number;
  burstShotTimer?: number;
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
  | 'rail_slug'
  | 'pierce_slug'
  | 'ricochet_slug'
  | 'frost_shell'
  | 'acid_shell'
  | 'shrapnel_shell'
  | 'shrapnel_shard'
  | 'cluster_bomb'
  | 'cluster_bomblet'
  | 'hunter_missile'
  | 'plasma_orb'
  | 'turret_round'
  | 'drone_bolt'
  | 'enemy_artillery_shell'
  | 'enemy_boss_shell';

export interface ProjectileInstance {
  uid: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
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
  isEnemyProjectile?: boolean;
  smokeCooldown?: number;
  // Used by arcing mortar shells & cluster bomblets
  startX?: number;
  startY?: number;
  targetX?: number;
  targetY?: number;
  flightElapsed?: number;
  flightDuration?: number;
  // Used by Ricochet, Hunter Missiles, Frost, Acid, Shrapnel, Cluster, Plasma
  ricochetRemaining?: number;
  ricochetRange?: number;
  ricochetRetention?: number;
  homingTurnRate?: number;
  homingTargetUid?: number;
  speedMag?: number;
  slowFactor?: number;
  slowDuration?: number;
  acidDps?: number;
  acidDuration?: number;
  splitCount?: number;
  splitDamage?: number;
  splitRadius?: number;
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

export interface DeployableTurret {
  uid: number;
  x: number;
  y: number;
  angle: number;
  damage: number;
  range: number;
  fireInterval: number;
  fireCooldown: number;
  ttl: number;
  maxTtl: number;
  tier: number;
}

export interface CombatDrone {
  uid: number;
  x: number;
  y: number;
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  aimAngle: number;
  damage: number;
  range: number;
  fireInterval: number;
  fireCooldown: number;
  ttl: number;
  maxTtl: number;
  tier: number;
}

export interface DelayedStrike {
  uid: number;
  kind: 'orbital' | 'thunder' | 'plasma_vortex';
  x: number;
  y: number;
  delayRemaining: number;
  totalDelay: number;
  radius: number;
  damage: number;
  ticksRemaining?: number;
  tickInterval?: number;
  color: string;
}

export type VisualEffectKind =
  | 'muzzle'
  | 'impact'
  | 'explosion'
  | 'blast_ring'
  | 'tracer'
  | 'rail_beam'
  | 'laser_beam'
  | 'orbital_beam'
  | 'sky_bolt'
  | 'shockwave_ring'
  | 'shield_pulse'
  | 'lightning_arc'
  | 'flame_cone'
  | 'smoke'
  | 'debris'
  | 'hit_ring'
  | 'damage_text';

export type ExplosionStyle =
  | 'cannon'
  | 'rocket'
  | 'mortar'
  | 'mine'
  | 'frost'
  | 'acid'
  | 'plasma'
  | 'orbital'
  | 'enemy'
  | 'boss';

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
  secondaryColor?: string;
  style?: ExplosionStyle;
  seed?: number;
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
  | 'landmines'
  | 'piercing_shot'
  | 'shockwave'
  | 'ricochet'
  | 'frost_cannon'
  | 'acid_shells'
  | 'shrapnel_burst'
  | 'shield_pulse'
  | 'cluster_bombs'
  | 'hunter_missiles'
  | 'gatling_overdrive'
  | 'laser_array'
  | 'plasma_cannon'
  | 'sentry_turret'
  | 'drone_squadron'
  | 'orbital_strike'
  | 'thunderstorm';

export type SkillRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

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

export type SkillUpgradePriorityMode = 'custom_priority' | 'lowest_level';

export type MaxLevelDuplicateBehavior =
  | 'convert_fragments'
  | 'refund_coins'
  | 'store_pending';

export interface AutoUpgradeSettings {
  priorityMode: SkillUpgradePriorityMode;
  ignoreMaxLevel: boolean;
  maxLevelOverflow: MaxLevelDuplicateBehavior;
  enabledSkills: Record<SkillId, boolean>;
  skillPriorities: SkillId[];
}

export interface PendingSkillEntry {
  skillId: SkillId;
  copies: number;
  addedAt: number;
}

export interface SavedSkillSlot {
  index: number;
  skillId: SkillId | null;
  level: number;
}

export interface AutoUpgradeEvent {
  id: number;
  kind: 'upgraded' | 'overflow';
  skillId: SkillId;
  previousLevel?: number;
  newLevel?: number;
  message: string;
}

export interface AutoUpgradeState {
  enabled: boolean;
  settings: AutoUpgradeSettings;
  totalAutoUpgrades: number;
  lastEvent: AutoUpgradeEvent | null;
}

export interface SavedAutoUpgradeState {
  enabled: boolean;
  settings: AutoUpgradeSettings;
  totalAutoUpgrades: number;
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

export interface AutoForgeStatRequirement {
  enabled: boolean;
  minValue: number;
}

export type AutoForgeStatRequirementsMap = Record<
  EquipmentStatKey,
  AutoForgeStatRequirement
>;

export interface AutoForgeSettings {
  minRarity: EquipmentRarity;
  enabledSlots: Record<EquipmentSlotType, boolean>;
  statFilters: AutoForgeStatRequirementsMap;
  requireSpecialEffect: boolean;
  spendingLimitEnabled: boolean;
  maxCoinSpend: number;
  minCoinReserve: number;
  autoResumeOnLoad: boolean;
}

export interface AutoForgeSessionStats {
  coinsSpent: number;
  itemsForged: number;
  itemsKept: number;
  itemsDismantled: number;
  dismantleCoinsEarned: number;
}

export interface AutoForgeLifetimeStats {
  coinsSpent: number;
  itemsForged: number;
  itemsKept: number;
  itemsDismantled: number;
}

export type AutoForgeStopReason =
  | 'manual'
  | 'insufficient_coins'
  | 'spending_limit_reached'
  | 'coin_reserve_reached'
  | 'inventory_full'
  | null;

export interface AutoForgeEvent {
  id: number;
  kind: 'kept' | 'dismantled' | 'stopped';
  itemName?: string;
  itemRarity?: EquipmentRarity;
  itemSlot?: EquipmentSlotType;
  dismantleCoins?: number;
  stopReason?: AutoForgeStopReason;
  message: string;
}

export interface AutoForgeState {
  enabled: boolean;
  settings: AutoForgeSettings;
  session: AutoForgeSessionStats;
  lifetime: AutoForgeLifetimeStats;
  stopReason: AutoForgeStopReason;
  lastEvent: AutoForgeEvent | null;
}

export interface SavedAutoForgeState {
  enabled: boolean;
  settings: AutoForgeSettings;
  lifetime: AutoForgeLifetimeStats;
}

export interface ForgeState {
  status: ForgeStatus;
  costCoins: number;
  durationSec: number;
  elapsedSec: number;
  progress: number;
  pendingItem: EquipmentItem | null;
  totalForged: number;
  autoForge: AutoForgeState;
}

export interface SavedForgeState {
  totalForged: number;
  pendingItem: EquipmentItem | null;
  autoForge?: SavedAutoForgeState;
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

export type GraphicsQuality = 'high' | 'low';

export interface GameSettingsState {
  soundEnabled: boolean;
  soundVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
  graphicsQuality: GraphicsQuality;
  showRangeRing: boolean;
}

export type MonetizationOfferId =
  | 'offline_reward_bonus'
  | 'optional_coin_bonus'
  | 'temporary_boost';

export interface ActiveTemporaryBoostState {
  active: boolean;
  remainingSec: number;
  totalSec: number;
  attackPowerMultiplier: number;
  coinGainMultiplier: number;
}

export interface OfflineBonusPreview {
  enabled: boolean;
  sdkConnected: boolean;
  bonusPct: number;
  bonusCoins: number;
  totalWithBonus: number;
  dailyRemaining: number;
  dailyLimit: number;
}

export interface MonetizationOfferStatus {
  id: MonetizationOfferId;
  label: string;
  shortDesc: string;
  enabled: boolean;
  sdkConnected: boolean;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  cooldownSec: number;
  cooldownRemainingSec: number;
  canClaim: boolean;
}

export interface MonetizationSnapshot {
  providerName: 'Playgama';
  sdkConnected: boolean;
  dayKey: string;
  activeBoost: ActiveTemporaryBoostState;
  optionalCoinBonusPreview: number;
  offlineBonusPreview: OfflineBonusPreview | null;
  offers: Record<MonetizationOfferId, MonetizationOfferStatus>;
}

export interface SavedMonetizationState {
  dayKey: string;
  dailyUses: Partial<Record<MonetizationOfferId, number>>;
  cooldownRemainingSec?: Partial<Record<MonetizationOfferId, number>>;
}

export interface SavePayload {
  version: number;
  savedAt: number;
  lastOfflineRewardAt?: number;
  wave: WaveState;
  currencies: CurrencyBalances;
  tankStats: TankStats;
  upgrades?: SavedUpgradeState[];
  equipment?: SavedEquipmentState;
  forge?: SavedForgeState;
  skillCollection?: SavedSkillCollectionState;
  skillSlots?: SavedSkillSlot[];
  pendingSkills?: PendingSkillEntry[];
  autoUpgrade?: SavedAutoUpgradeState;
  monetization?: SavedMonetizationState;
  soundEnabled: boolean;
  soundVolume?: number;
  musicEnabled?: boolean;
  musicVolume?: number;
  graphicsQuality?: GraphicsQuality;
  showRangeRing: boolean;
}

export interface OfflineRewardSummary {
  elapsedSeconds: number;
  effectiveSeconds: number;
  wasCapped: boolean;
  maxDurationSeconds: number;
  coinsEarned: number;
  coinsPerMinuteRate: number;
  efficiencyPct: number;
  waveUsed: number;
  sourceTimestamp: number;
  calculatedAt: number;
  claimed: boolean;
}

export interface SaveStatusNotice {
  kind: 'recovered_from_backup' | 'corrupt_unrecoverable';
  message: string;
}

export interface BattleRecoveryState {
  active: boolean;
  wave: number;
  remainingSec: number;
  totalSec: number;
}

export interface WaveHudEvent {
  id: number;
  kind: 'wave_clear' | 'boss_spawn';
  wave: number;
  isBossWave: boolean;
  rewardGold: number;
  bossName?: string;
}

export interface GameHudSnapshot {
  phase: GamePhase;
  wave: WaveState;
  boss: BossHudState | null;
  recovery: BattleRecoveryState | null;
  waveEvent: WaveHudEvent | null;
  currencies: CurrencyBalances;
  tank: PlayerTankState;
  battle: BattleSummary;
  upgrades: UpgradeEntry[];
  skillSlots: SkillSlot[];
  pendingSkills: PendingSkillEntry[];
  pendingSkillCount: number;
  autoUpgrade: AutoUpgradeState;
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
  settings: GameSettingsState;
  summonCost: number;
  hasVacantSkillSlot: boolean;
  offlineReward: OfflineRewardSummary | null;
  monetization: MonetizationSnapshot;
  saveNotice: SaveStatusNotice | null;
}
