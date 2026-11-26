import { soundEffects } from '../../audio/soundEffects';
import { playgamaBridge } from '../../platform/playgamaBridge';
import { GAME_BALANCE } from '../balanceConfig';
import { BOSS_CONFIG, COMBAT_CONFIG, INITIAL_TANK_STATS } from '../constants';
import { EQUIPMENT_RARITY_CONFIG } from '../data/equipmentCatalog';
import { BattlefieldSystem } from '../systems/BattlefieldSystem';
import { CombatStepResult, CombatSystem } from '../systems/CombatSystem';
import { CurrencySystem } from '../systems/CurrencySystem';
import { EnemySystem } from '../systems/EnemySystem';
import {
  BulkDismantleResult,
  DismantleItemResult,
  EquipActionResult,
  EquipmentSystem,
} from '../systems/EquipmentSystem';
import {
  AutoForgeStepOutcome,
  ForgeDismantleResult,
  ForgeEquipResult,
  ForgeKeepResult,
  ForgeSystem,
  StartForgeResult,
} from '../systems/ForgeSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { OfflineProgressSystem } from '../systems/OfflineProgressSystem';
import { SaveSystem } from '../systems/SaveSystem';
import {
  SkillCollectionSystem,
  SkillCollectionUpgradeResult,
} from '../systems/SkillCollectionSystem';
import { MergeAttemptResult, SkillMergeSystem } from '../systems/SkillMergeSystem';
import { SkillSummonSystem, SummonAttemptResult } from '../systems/SkillSummonSystem';
import { SkillSystem } from '../systems/SkillSystem';
import { TankSystem } from '../systems/TankSystem';
import { UpgradePurchaseResult, UpgradeSystem } from '../systems/UpgradeSystem';
import { WaveSystem } from '../systems/WaveSystem';
import {
  AutoForgeSettings,
  BattleRecoveryState,
  BattleSummary,
  BossHudState,
  EquipmentItem,
  EquipmentPreferences,
  EquipmentSlotType,
  GameHudSnapshot,
  GamePhase,
  OfflineRewardSummary,
  SaveStatusNotice,
  SkillId,
  TankStats,
  UpgradeId,
  WaveHudEvent,
} from '../types';
import { Renderer } from './Renderer';

type SnapshotListener = (snapshot: GameHudSnapshot) => void;

export class GameEngine {
  readonly battlefield = new BattlefieldSystem();
  readonly tank: TankSystem;
  readonly enemies = new EnemySystem();
  readonly combat = new CombatSystem();
  readonly skills = new SkillSystem();
  readonly skillCollection = new SkillCollectionSystem();
  readonly skillSummon = new SkillSummonSystem();
  readonly skillMerge = new SkillMergeSystem();
  readonly waves = new WaveSystem();
  readonly currencies = new CurrencySystem();
  readonly upgrades = new UpgradeSystem();
  readonly equipment = new EquipmentSystem();
  readonly forge = new ForgeSystem();
  readonly inventory = new InventorySystem();
  readonly saveSystem = new SaveSystem();

  private readonly renderer: Renderer;
  private phase: GamePhase = 'TITLE';
  private showRangeRing = true;
  private soundEnabled = true;
  private reducedMotion = false;
  private battleStats: BattleSummary = {
    enemiesDefeated: 0,
    elapsedSeconds: 0,
  };

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private hudSyncAccumulator = 0;
  private autoSaveAccumulator = 0;
  private saveDirty = false;
  private lastOfflineRewardAt = Date.now();
  private pendingOfflineReward: OfflineRewardSummary | null = null;
  private claimedOfflineSources = new Set<number>();
  private saveNotice: SaveStatusNotice | null = null;
  private waveEventCounter = 0;
  private lastWaveEvent: WaveHudEvent | null = null;
  private playerDamageFlashTimer = 0;
  private isRecovering = false;
  private recoveryWave = 1;
  private recoveryRemainingSec = 0;
  private readonly recoveryTotalSec = GAME_BALANCE.battleRecovery.delaySec;
  private recoveryHudAccumulator = 0;
  private lastBossAnnouncedWave = 0;
  private listeners = new Set<SnapshotListener>();

  constructor() {
    this.renderer = new Renderer(this.battlefield.getBounds());
    const center = this.battlefield.getCenter();
    this.tank = new TankSystem(center.x, center.y);

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }

  getCamera() {
    return this.renderer.getCamera();
  }

  async initialize(): Promise<void> {
    await playgamaBridge.init();
    await this.loadFromStorage();
    playgamaBridge.notifyGameReady();
    this.emitSnapshot();
  }

  async loadFromStorage(): Promise<void> {
    const report = await this.saveSystem.loadWithReport();
    this.saveNotice = report.notice;

    if (report.payload) {
      const saved = report.payload;
      this.waves.loadState(saved.wave);
      this.currencies.loadBalances(saved.currencies);
      this.upgrades.loadState(saved.upgrades);
      this.equipment.loadState(saved.equipment);
      this.forge.loadState(saved.forge);
      this.skillCollection.loadState(saved.skillCollection);
      this.soundEnabled = saved.soundEnabled;
      this.showRangeRing = saved.showRangeRing;
      this.lastOfflineRewardAt =
        typeof saved.lastOfflineRewardAt === 'number' &&
        Number.isFinite(saved.lastOfflineRewardAt) &&
        saved.lastOfflineRewardAt > 0
          ? saved.lastOfflineRewardAt
          : saved.savedAt;

      // Always initialize a clean battlefield using saved permanent progression
      this.prepareCleanBattlefield({ resetWaveToOne: false });

      if (!this.claimedOfflineSources.has(this.lastOfflineRewardAt)) {
        const calculated = OfflineProgressSystem.calculateOfflineRewards({
          lastRewardTimestampMs: this.lastOfflineRewardAt,
          waveNumber: this.waves.getState().currentWave,
        });
        this.pendingOfflineReward = calculated;
      } else {
        this.pendingOfflineReward = null;
      }
    } else {
      this.lastOfflineRewardAt = Date.now();
      this.pendingOfflineReward = null;
    }
  }

  private recomputeCombinedTankStats(): TankStats {
    const upgradeStats = this.upgrades.computeTankStats(INITIAL_TANK_STATS);
    const combined = this.equipment.applyBonusesToTankStats(upgradeStats);
    this.combat.setBossDamageBonusPct(combined.bossDamageBonusPct);
    return combined;
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.renderer.attach(canvas);
    this.startLoop();
  }

  detachCanvas(): void {
    this.stopLoop();
    this.renderer.detach();
  }

  handleResize(canvas: HTMLCanvasElement): void {
    this.renderer.resize(canvas);
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): GameHudSnapshot {
    const waveState = this.waves.getState();
    const activeBoss = this.enemies.getActiveBoss();
    const bossDef = activeBoss
      ? this.enemies.getDefinition(activeBoss.definitionId)
      : undefined;
    const boss: BossHudState | null = activeBoss
      ? {
          active: true,
          name: bossDef?.name ?? BOSS_CONFIG.name,
          hp: activeBoss.hp,
          maxHp: activeBoss.maxHp,
          wave: waveState.currentWave,
        }
      : null;

    const recovery: BattleRecoveryState | null = this.isRecovering
      ? {
          active: true,
          wave: this.recoveryWave,
          remainingSec: this.recoveryRemainingSec,
          totalSec: this.recoveryTotalSec,
        }
      : null;

    return {
      phase: this.phase,
      wave: waveState,
      boss,
      recovery,
      waveEvent: this.lastWaveEvent ? { ...this.lastWaveEvent } : null,
      currencies: this.currencies.getBalances(),
      tank: {
        ...this.tank.getState(),
        position: { ...this.tank.getState().position },
        movementOrigin: { ...this.tank.getState().movementOrigin },
        stats: { ...this.tank.getState().stats },
      },
      battle: { ...this.battleStats },
      upgrades: this.upgrades.getEntries(),
      skillSlots: this.skills.getSlots(),
      skillCollection: this.skillCollection.getAllEntries(),
      unlockedSkillCount: this.skillCollection.getUnlockedCount(),
      equipmentSlots: this.equipment.getSlots(),
      equipmentInventory: this.equipment.getOwnedItems(),
      equipmentCapacity: this.equipment.getCapacity(),
      equipmentUnequippedCount: this.equipment.getUnequippedCount(),
      equipmentPreferences: this.equipment.getPreferences(),
      equipmentBonuses: this.equipment.getTotalStatBonuses(),
      forge: this.forge.getState(),
      inventoryCapacity: this.inventory.getCapacity(),
      inventorySlots: this.inventory.getSlots(),
      showRangeRing: this.showRangeRing,
      summonCost: this.skillSummon.getCost(),
      hasVacantSkillSlot: this.skills.hasVacantSlot(),
      offlineReward: this.pendingOfflineReward
        ? { ...this.pendingOfflineReward }
        : null,
      saveNotice: this.saveNotice ? { ...this.saveNotice } : null,
    };
  }

  setMovementInput(x: number, y: number): void {
    this.tank.setMoveInput(x, y);
  }

  summonSkill(): SummonAttemptResult {
    if (this.phase !== 'ACTIVE') {
      return { success: false, reason: 'cooldown_locked' };
    }
    const result = this.skillSummon.summonRandomSkill(
      this.currencies,
      this.skills,
      this.skillCollection
    );
    if (result.success) {
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  mergeSkills(
    firstSlotIndex: number,
    secondSlotIndex: number
  ): MergeAttemptResult {
    if (this.phase !== 'ACTIVE') {
      return { success: false, reason: 'not_active' };
    }
    const result = this.skillMerge.mergeSlots(
      this.skills,
      firstSlotIndex,
      secondSlotIndex,
      performance.now(),
      this.skillCollection
    );
    if (result.success) {
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  upgradeSkillCollection(skillId: SkillId): SkillCollectionUpgradeResult {
    const result = this.skillCollection.upgradeSkill(skillId);
    if (result.success) {
      this.skills.refreshCooldowns(this.skillCollection);
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  purchaseTankUpgrade(upgradeId: UpgradeId): UpgradePurchaseResult {
    if (this.phase !== 'ACTIVE') {
      return { success: false, reason: 'cooldown_locked' };
    }
    const result = this.upgrades.purchaseUpgrade(upgradeId, this.currencies);
    if (result.success) {
      const nextStats = this.recomputeCombinedTankStats();
      this.tank.applyUpgradeStats(nextStats, { healHpDelta: true });
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  equipItem(uid: string, expectedSlot?: EquipmentSlotType): EquipActionResult {
    const result = this.equipment.equipItem(uid, expectedSlot);
    if (result.success) {
      const nextStats = this.recomputeCombinedTankStats();
      this.tank.applyUpgradeStats(nextStats, { healHpDelta: false });
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  unequipEquipmentSlot(slot: EquipmentSlotType): EquipActionResult {
    const result = this.equipment.unequipSlot(slot);
    if (result.success) {
      const nextStats = this.recomputeCombinedTankStats();
      this.tank.applyUpgradeStats(nextStats, { healHpDelta: false });
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  toggleEquipmentLock(uid: string): { success: boolean; item?: EquipmentItem } {
    const result = this.equipment.toggleLock(uid);
    if (result.success) {
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  setEquipmentPreferences(
    partial: Partial<EquipmentPreferences>
  ): EquipmentPreferences {
    const updated = this.equipment.setPreferences(partial);
    void this.persist();
    this.emitSnapshot();
    return updated;
  }

  dismantleEquipmentItem(uid: string): DismantleItemResult {
    const result = this.equipment.dismantleItem(uid, this.currencies);
    if (result.success) {
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  bulkDismantleEquipment(uids: readonly string[]): BulkDismantleResult {
    const result = this.equipment.bulkDismantle(uids, this.currencies);
    if (result.success) {
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  previewEquipTankStats(candidateOrUid: EquipmentItem | string): TankStats {
    const item =
      typeof candidateOrUid === 'string'
        ? this.equipment.getItemByUid(candidateOrUid)
        : candidateOrUid;
    const baseUpgradeStats = this.upgrades.computeTankStats(INITIAL_TANK_STATS);
    if (!item) {
      return this.equipment.applyBonusesToTankStats(baseUpgradeStats);
    }
    return this.equipment.previewStatsAfterEquip(item, baseUpgradeStats);
  }

  startForge(): StartForgeResult {
    if (this.phase !== 'ACTIVE') {
      return { success: false, reason: 'already_forging' };
    }
    const result = this.forge.startForge(this.currencies, this.equipment);
    if (result.success) {
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  equipForgedItem(): ForgeEquipResult {
    const result = this.forge.resolveEquip(this.equipment);
    if (result.success) {
      const nextStats = this.recomputeCombinedTankStats();
      this.tank.applyUpgradeStats(nextStats, { healHpDelta: false });
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  dismantleForgedItem(): ForgeDismantleResult {
    const result = this.forge.resolveDismantle(this.currencies);
    if (result.success) {
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  keepForgedItemInInventory(): ForgeKeepResult {
    const result = this.forge.resolveKeepInInventory(this.equipment);
    if (result.success) {
      void this.persist();
      this.emitSnapshot();
    }
    return result;
  }

  toggleAutoForge(enable?: boolean): {
    enabled: boolean;
    outcome?: AutoForgeStepOutcome;
  } {
    const currentlyEnabled = this.forge.autoForge.isEnabled();
    const target = enable !== undefined ? enable : !currentlyEnabled;

    if (target) {
      if (this.phase !== 'ACTIVE') {
        return { enabled: false };
      }
      const outcome = this.forge.enableAutoForge(
        this.currencies,
        this.equipment
      );
      void this.persist();
      this.emitSnapshot();
      return { enabled: this.forge.autoForge.isEnabled(), outcome };
    }

    this.forge.disableAutoForge();
    void this.persist();
    this.emitSnapshot();
    return { enabled: false };
  }

  updateAutoForgeSettings(
    partial: Partial<AutoForgeSettings>
  ): AutoForgeSettings {
    const updated = this.forge.updateAutoForgeSettings(partial);
    void this.persist();
    this.emitSnapshot();
    return updated;
  }

  resetAutoForgeSettings(): AutoForgeSettings {
    const reset = this.forge.resetAutoForgeSettings();
    void this.persist();
    this.emitSnapshot();
    return reset;
  }

  setPhase(nextPhase: GamePhase): void {
    if (this.phase === nextPhase) return;
    if (this.isRecovering && nextPhase === 'PAUSED') return;
    this.phase = nextPhase;

    if (nextPhase !== 'ACTIVE') {
      this.tank.setMoveInput(0, 0);
    }

    if (nextPhase === 'ACTIVE') {
      playgamaBridge.notifyGameplayStart();
    } else {
      playgamaBridge.notifyGameplayStop();
      if (nextPhase === 'PAUSED') {
        void this.persist();
      }
    }

    this.emitSnapshot();
  }

  private announceBossIncoming(waveNumber: number): void {
    if (this.lastBossAnnouncedWave === waveNumber) return;
    this.lastBossAnnouncedWave = waveNumber;
    this.lastWaveEvent = {
      id: ++this.waveEventCounter,
      kind: 'boss_spawn',
      wave: waveNumber,
      isBossWave: true,
      rewardGold: 0,
      bossName: BOSS_CONFIG.name,
    };
    soundEffects.playBossAlert();
  }

  prepareCleanBattlefield(options: { resetWaveToOne: boolean }): void {
    const center = this.battlefield.getCenter();
    const combinedStats = this.recomputeCombinedTankStats();
    this.tank.applyStats({
      ...combinedStats,
      hp: combinedStats.maxHp,
    });
    this.tank.resetForBattle(center.x, center.y);
    this.enemies.clear();
    this.combat.clear();
    this.skills.resetToEmpty();
    if (options.resetWaveToOne) {
      this.waves.resetForNewRun();
    } else {
      // Refresh current wave spawn plan with clean enemy/transition counters
      this.waves.restartWave(this.waves.getState().currentWave);
    }
    this.lastWaveEvent = null;
    this.lastBossAnnouncedWave = 0;
    this.playerDamageFlashTimer = 0;
    this.renderer.getCamera().resetEffects();
    this.battleStats = {
      enemiesDefeated: 0,
      elapsedSeconds: 0,
    };
    this.hudSyncAccumulator = 0;
  }

  resetBattleState(): void {
    this.isRecovering = false;
    this.recoveryRemainingSec = 0;
    this.prepareCleanBattlefield({ resetWaveToOne: true });
  }

  startFromTitle(): void {
    this.isRecovering = false;
    this.recoveryRemainingSec = 0;
    this.prepareCleanBattlefield({ resetWaveToOne: false });
    this.phase = 'ACTIVE';
    const currentWave = this.waves.getState();
    if (currentWave.isBossWave) {
      this.enemies.resetSpawnTimer(0.55);
      this.announceBossIncoming(currentWave.currentWave);
    }
    if (this.forge.consumePendingAutoResume()) {
      this.forge.enableAutoForge(this.currencies, this.equipment);
    }
    playgamaBridge.notifyGameplayStart();
    void this.persist();
    this.emitSnapshot();
  }

  restartBattle(): void {
    this.isRecovering = false;
    this.recoveryRemainingSec = 0;
    this.prepareCleanBattlefield({ resetWaveToOne: false });
    this.phase = 'ACTIVE';
    const currentWave = this.waves.getState();
    if (currentWave.isBossWave) {
      this.enemies.resetSpawnTimer(0.55);
      this.announceBossIncoming(currentWave.currentWave);
    }
    playgamaBridge.notifyGameplayStart();
    void this.persist();
    this.emitSnapshot();
  }

  returnToTitle(): void {
    this.isRecovering = false;
    this.recoveryRemainingSec = 0;
    this.prepareCleanBattlefield({ resetWaveToOne: false });
    this.phase = 'TITLE';
    this.tank.setMoveInput(0, 0);
    playgamaBridge.notifyGameplayStop();
    void this.persist();
    this.emitSnapshot();
  }

  beginBattleRecovery(): void {
    if (this.isRecovering || this.phase !== 'ACTIVE') return;

    this.isRecovering = true;
    this.recoveryWave = Math.max(1, this.waves.getState().currentWave);
    this.recoveryRemainingSec = this.recoveryTotalSec;
    this.recoveryHudAccumulator = 0;

    // Immediately stop active combat, clean temporary entities, and block further damage/rewards
    this.tank.setMoveInput(0, 0);
    this.enemies.clear();
    this.combat.clear();
    this.skills.resetToEmpty();
    this.lastWaveEvent = null;
    this.playerDamageFlashTimer = 0;
    this.phase = 'DEFEAT';

    soundEffects.playDefeat();
    playgamaBridge.notifyGameplayStop();

    if (this.saveDirty) {
      void this.persist();
    }

    this.emitSnapshot();
  }

  private completeBattleRecovery(): void {
    if (!this.isRecovering || this.phase !== 'DEFEAT') return;

    const waveToReplay = Math.max(1, this.recoveryWave);
    this.isRecovering = false;
    this.recoveryRemainingSec = 0;
    this.recoveryHudAccumulator = 0;

    this.waves.restartWave(waveToReplay);
    this.prepareCleanBattlefield({ resetWaveToOne: false });
    this.phase = 'ACTIVE';

    if (this.waves.getState().isBossWave) {
      this.enemies.resetSpawnTimer(0.55);
      this.announceBossIncoming(waveToReplay);
    }

    soundEffects.playDeploy();
    playgamaBridge.notifyGameplayStart();
    this.emitSnapshot();
  }

  claimOfflineRewards(): { success: boolean; coinsAwarded: number } {
    const reward = this.pendingOfflineReward;
    if (
      !reward ||
      reward.claimed ||
      this.claimedOfflineSources.has(reward.sourceTimestamp)
    ) {
      return { success: false, coinsAwarded: 0 };
    }

    reward.claimed = true;
    this.claimedOfflineSources.add(reward.sourceTimestamp);
    this.pendingOfflineReward = null;

    if (reward.coinsEarned > 0) {
      this.currencies.add('gold', reward.coinsEarned);
    }
    this.lastOfflineRewardAt = Math.max(
      this.lastOfflineRewardAt,
      reward.calculatedAt,
      Date.now()
    );

    void this.persist();
    this.emitSnapshot();
    return { success: true, coinsAwarded: reward.coinsEarned };
  }

  dismissSaveNotice(options?: { overwriteCorruptWithFresh?: boolean }): void {
    this.saveNotice = null;
    if (options?.overwriteCorruptWithFresh) {
      this.saveSystem.clearCorruptProtection();
      void this.persist({ forceOverwrite: true });
    }
    this.emitSnapshot();
  }

  async retrySaveRecovery(): Promise<void> {
    await this.loadFromStorage();
    this.emitSnapshot();
  }

  toggleRangeRing(): void {
    this.showRangeRing = !this.showRangeRing;
    void this.persist();
    this.emitSnapshot();
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    void this.persist();
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  async persistIfDirty(): Promise<void> {
    if (!this.saveDirty) return;
    await this.persist();
  }

  async persist(options?: { forceOverwrite?: boolean }): Promise<void> {
    // Only advance the offline-reward anchor when no unclaimed offline reward is waiting
    if (!this.pendingOfflineReward) {
      this.lastOfflineRewardAt = Math.max(this.lastOfflineRewardAt, Date.now());
    }

    const saved = await this.saveSystem.save(
      {
        lastOfflineRewardAt: this.lastOfflineRewardAt,
        wave: this.waves.exportPersistentState(),
        currencies: this.currencies.getBalances(),
        tankStats: this.tank.getState().stats,
        upgrades: this.upgrades.exportState(),
        equipment: this.equipment.exportState(),
        forge: this.forge.exportState(),
        skillCollection: this.skillCollection.exportState(),
        soundEnabled: this.soundEnabled,
        showRangeRing: this.showRangeRing,
      },
      options
    );
    if (saved) {
      this.saveDirty = false;
      this.autoSaveAccumulator = 0;
    }
  }

  private emitSnapshot(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snap));
  }

  step(rawDt: number): void {
    const dt = Math.max(0, Math.min(rawDt, 0.1));

    if (this.phase === 'DEFEAT') {
      this.renderer.getCamera().update(dt, this.reducedMotion);
      if (!this.isRecovering) {
        this.isRecovering = true;
        this.recoveryWave = Math.max(1, this.waves.getState().currentWave);
        this.recoveryRemainingSec = this.recoveryTotalSec;
      }
      this.recoveryRemainingSec = Math.max(0, this.recoveryRemainingSec - dt);
      if (this.recoveryRemainingSec <= 0) {
        this.completeBattleRecovery();
        return;
      }
      this.recoveryHudAccumulator += dt;
      if (this.recoveryHudAccumulator >= 0.05) {
        this.recoveryHudAccumulator = 0;
        this.emitSnapshot();
      }
      return;
    }

    if (this.phase !== 'ACTIVE') return;

    // Safety check if tank HP was already zeroed
    if (this.tank.getState().stats.hp <= 0) {
      this.beginBattleRecovery();
      return;
    }

    this.battleStats.elapsedSeconds += dt;
    const bounds = this.battlefield.getBounds();
    const tankState = this.tank.getState();

    let hudDirty = false;
    let playerDefeated = false;

    this.battlefield.update(dt);
    this.renderer.getCamera().update(dt, this.reducedMotion);
    if (this.playerDamageFlashTimer > 0) {
      this.playerDamageFlashTimer = Math.max(0, this.playerDamageFlashTimer - dt);
    }

    // Advance active equipment forge timer (~2s) and process Auto Forge if enabled
    const currentForgeStatus = this.forge.getState().status;
    if (currentForgeStatus === 'forging') {
      const forgedItem = this.forge.update(dt);
      if (forgedItem) {
        if (this.forge.autoForge.isEnabled()) {
          const autoOutcome = this.forge.processAutoForgeStep(
            this.currencies,
            this.equipment
          );
          if (autoOutcome.kept && autoOutcome.item) {
            soundEffects.playForgeComplete(
              EQUIPMENT_RARITY_CONFIG[autoOutcome.item.rarity].tier
            );
          } else if (autoOutcome.dismantled) {
            soundEffects.playDismantle();
          }
          if (
            autoOutcome.stoppedReason &&
            autoOutcome.stoppedReason !== 'manual'
          ) {
            soundEffects.playInvalid();
          }
        } else {
          soundEffects.playForgeComplete(
            EQUIPMENT_RARITY_CONFIG[forgedItem.rarity].tier
          );
        }
        void this.persist();
        hudDirty = true;
      }
    } else if (this.forge.autoForge.isEnabled()) {
      const autoOutcome = this.forge.processAutoForgeStep(
        this.currencies,
        this.equipment
      );
      if (
        autoOutcome.processedItem ||
        autoOutcome.startedNextForge ||
        autoOutcome.stoppedReason
      ) {
        if (autoOutcome.stoppedReason && autoOutcome.stoppedReason !== 'manual') {
          soundEffects.playInvalid();
        }
        void this.persist();
        hudDirty = true;
      }
    }

    // 1. Update enemies according to current WavePlan
    const wavePlan = this.waves.getCurrentPlan();
    this.enemies.update(
      dt,
      bounds,
      tankState.position,
      true,
      wavePlan,
      this.waves.canSpawnMoreEnemies(),
      {
        onEnemySpawned: () => {
          this.waves.recordEnemySpawned();
          hudDirty = true;
        },
        onBossSpawned: (boss) => {
          this.combat.spawnBossIntroEffect(boss.position.x, boss.position.y);
          this.renderer.getCamera().addKick(2.4, this.reducedMotion);
          this.announceBossIncoming(wavePlan.wave);
          hudDirty = true;
        },
        onAttackPlayer: (atk) => {
          if (this.phase !== 'ACTIVE' || this.isRecovering || playerDefeated) return;
          if (atk.behavior === 'artillery_ranged') {
            this.combat.spawnEnemyArtilleryProjectile(
              atk.enemyX,
              atk.enemyY,
              atk.angle,
              atk.damage
            );
            return;
          }
          if (
            atk.behavior === 'boss' &&
            (atk.attackMode === 'boss_heavy' || atk.attackMode === 'boss_burst')
          ) {
            this.combat.spawnEnemyBossProjectile(
              atk.enemyX,
              atk.enemyY,
              atk.angle,
              atk.damage,
              atk.attackMode === 'boss_burst'
            );
            return;
          }

          const dmgRes = this.tank.takeDamage(
            atk.damage,
            atk.enemyX,
            atk.enemyY
          );
          if (dmgRes.effectiveDamage > 0) {
            this.combat.spawnEnemyAttackTracer(
              atk.enemyX,
              atk.enemyY,
              tankState.position.x,
              tankState.position.y,
              dmgRes.effectiveDamage,
              Boolean(atk.isBoss),
              atk.kind
            );
            this.playerDamageFlashTimer = atk.isBoss ? 0.24 : 0.17;
            this.renderer
              .getCamera()
              .addKick(atk.isBoss ? 2.2 : 1.2, this.reducedMotion);
            soundEffects.playHit();
            hudDirty = true;
          }
          if (dmgRes.defeated) {
            playerDefeated = true;
          }
        },
        onBossSiegeStrike: (strike) => {
          if (this.phase !== 'ACTIVE' || this.isRecovering || playerDefeated) return;
          const dist = Math.hypot(
            tankState.position.x - strike.targetX,
            tankState.position.y - strike.targetY
          );
          // Match visual danger circle closely so warning and hit area stay consistent
          const hitRadius =
            strike.radius + COMBAT_CONFIG.tankCollisionRadius * 0.35;
          let effectiveDamage = 0;
          if (dist <= hitRadius) {
            const dmgRes = this.tank.takeDamage(
              strike.damage,
              strike.targetX,
              strike.targetY
            );
            effectiveDamage = dmgRes.effectiveDamage;
            if (effectiveDamage > 0) {
              this.playerDamageFlashTimer = 0.28;
            }
            if (dmgRes.defeated) {
              playerDefeated = true;
            }
          }
          this.combat.spawnBossSiegeImpact(
            strike.targetX,
            strike.targetY,
            strike.radius,
            effectiveDamage
          );
          this.renderer.getCamera().addKick(2.8, this.reducedMotion);
          soundEffects.playExplosion();
          hudDirty = true;
        },
        onEnemyDestroyed: (evt) => {
          if (evt.isBoss) {
            this.renderer.getCamera().addKick(3.2, this.reducedMotion);
          }
        },
      }
    );

    if (playerDefeated) {
      this.beginBattleRecovery();
      return;
    }

    // 2. Update tank movement/targeting, modular skills, and projectiles/mines
    const fireOut = this.tank.update(
      dt,
      true,
      this.enemies.getActiveEnemies()
    );
    if (fireOut) {
      this.combat.spawnTankProjectile(
        fireOut.muzzleX,
        fireOut.muzzleY,
        fireOut.angle,
        fireOut.damage,
        fireOut.isCrit
      );
      this.renderer
        .getCamera()
        .addKick(fireOut.isCrit ? 1.3 : 0.65, this.reducedMotion);
      soundEffects.playCannonFire();
    }

    const skillStepResult: CombatStepResult = {
      enemyHits: 0,
      enemiesDestroyed: 0,
      goldEarned: 0,
    };
    this.skills.update(dt, {
      tank: tankState,
      bounds,
      enemySystem: this.enemies,
      combat: this.combat,
      result: skillStepResult,
      getCollectionBonuses: (skillId) =>
        this.skillCollection.getComputedBonuses(skillId),
    });

    const combatResult = this.combat.update(
      dt,
      bounds,
      this.enemies,
      true,
      tankState.position,
      (projHit) => {
        if (this.phase !== 'ACTIVE' || this.isRecovering || playerDefeated) {
          return true;
        }
        const dmgRes = this.tank.takeDamage(
          projHit.damage,
          projHit.fromX,
          projHit.fromY
        );
        if (dmgRes.effectiveDamage > 0) {
          this.combat.spawnEnemyProjectileHit(
            projHit.fromX,
            projHit.fromY,
            tankState.position.x,
            tankState.position.y,
            dmgRes.effectiveDamage
          );
          this.playerDamageFlashTimer = 0.22;
          this.renderer.getCamera().addKick(1.8, this.reducedMotion);
          soundEffects.playExplosion();
          hudDirty = true;
        }
        if (dmgRes.defeated) {
          playerDefeated = true;
          return true;
        }
        return false;
      }
    );

    if (playerDefeated) {
      this.beginBattleRecovery();
      return;
    }

    const totalHits = combatResult.enemyHits + skillStepResult.enemyHits;
    const totalDestroyed =
      combatResult.enemiesDestroyed + skillStepResult.enemiesDestroyed;
    const totalGold =
      combatResult.goldEarned + skillStepResult.goldEarned;

    if (totalHits > 0) {
      soundEffects.playHit();
      if (this.enemies.getActiveBoss()) {
        hudDirty = true;
      }
    }
    if (totalDestroyed > 0) {
      this.battleStats.enemiesDefeated += totalDestroyed;
      for (let k = 0; k < totalDestroyed; k++) {
        this.waves.recordEnemyDefeated();
      }
      if (tankState.stats.hpOnKill > 0) {
        this.tank.heal(totalDestroyed * tankState.stats.hpOnKill);
      }
      if (totalGold > 0) {
        this.currencies.add('gold', totalGold);
        this.saveDirty = true;
      }
      soundEffects.playExplosion();
      hudDirty = true;
    }

    // 3. Evaluate wave completion & automatic next-wave transitions
    const waveStep = this.waves.update(dt, this.enemies.countAliveEnemies());
    if (waveStep.completedEvent) {
      if (waveStep.completedEvent.rewardGold > 0) {
        this.currencies.add('gold', waveStep.completedEvent.rewardGold);
      }
      this.lastWaveEvent = {
        id: ++this.waveEventCounter,
        kind: 'wave_clear',
        wave: waveStep.completedEvent.wave,
        isBossWave: waveStep.completedEvent.isBossWave,
        rewardGold: waveStep.completedEvent.rewardGold,
        bossName: waveStep.completedEvent.isBossWave ? BOSS_CONFIG.name : undefined,
      };
      soundEffects.playWaveClear();
      void this.persist();
      hudDirty = true;
    }
    if (waveStep.startedWave !== null) {
      this.enemies.resetSpawnTimer(waveStep.startedBossWave ? 0.55 : 0.35);
      if (waveStep.startedBossWave) {
        this.announceBossIncoming(waveStep.startedWave);
      }
      void this.persist();
      hudDirty = true;
    }

    // Throttled periodic auto-save during active combat when progression changed
    if (this.saveDirty) {
      this.autoSaveAccumulator += dt;
      if (this.autoSaveAccumulator >= 8.0) {
        this.autoSaveAccumulator = 0;
        void this.persist();
      }
    }

    // Throttle HUD cooldown ring sync (faster while forging progress bar animates)
    this.hudSyncAccumulator += dt;
    const syncInterval =
      this.forge.getState().status === 'forging' ? 0.045 : 0.1;
    if (this.hudSyncAccumulator >= syncInterval) {
      this.hudSyncAccumulator = 0;
      hudDirty = true;
    }

    if (hudDirty) {
      this.emitSnapshot();
    }
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();

    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      this.step(rawDt);

      this.renderer.render({
        bounds: this.battlefield.getBounds(),
        tank: this.tank.getState(),
        enemies: this.enemies.getActiveEnemies(),
        projectiles: this.combat.getProjectiles(),
        mines: this.combat.getMines(),
        effects: this.combat.getEffects(),
        showRangeRing: this.showRangeRing,
        isActive: this.phase === 'ACTIVE',
        reducedMotion: this.reducedMotion,
        damageVignetteAlpha:
          this.reducedMotion || this.playerDamageFlashTimer <= 0
            ? 0
            : Math.min(0.24, (this.playerDamageFlashTimer / 0.24) * 0.22),
      });

      this.rafId = window.requestAnimationFrame(tick);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
