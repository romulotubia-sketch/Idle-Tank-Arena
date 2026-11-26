import { soundEffects } from '../../audio/soundEffects';
import { playgamaBridge } from '../../platform/playgamaBridge';
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
  ForgeDismantleResult,
  ForgeEquipResult,
  ForgeKeepResult,
  ForgeSystem,
  StartForgeResult,
} from '../systems/ForgeSystem';
import { InventorySystem } from '../systems/InventorySystem';
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
  BattleSummary,
  BossHudState,
  EquipmentItem,
  EquipmentPreferences,
  EquipmentSlotType,
  GameHudSnapshot,
  GamePhase,
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
  private waveEventCounter = 0;
  private lastWaveEvent: WaveHudEvent | null = null;
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
    const saved = await this.saveSystem.load();
    if (saved) {
      this.waves.loadState(saved.wave);
      this.currencies.loadBalances(saved.currencies);
      this.upgrades.loadState(saved.upgrades);
      this.equipment.loadState(saved.equipment);
      this.forge.loadState(saved.forge);
      this.skillCollection.loadState(saved.skillCollection);
      const computedStats = this.recomputeCombinedTankStats();
      this.tank.applyStats({
        ...computedStats,
        hp: computedStats.maxHp,
      });
      this.soundEnabled = saved.soundEnabled;
      this.showRangeRing = saved.showRangeRing;
    }
    playgamaBridge.notifyGameReady();
    this.emitSnapshot();
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

    return {
      phase: this.phase,
      wave: waveState,
      boss,
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

  setPhase(nextPhase: GamePhase): void {
    if (this.phase === nextPhase) return;
    this.phase = nextPhase;

    if (nextPhase !== 'ACTIVE') {
      this.tank.setMoveInput(0, 0);
    }

    if (nextPhase === 'ACTIVE') {
      playgamaBridge.notifyGameplayStart();
    } else {
      playgamaBridge.notifyGameplayStop();
    }

    this.emitSnapshot();
  }

  resetBattleState(): void {
    const center = this.battlefield.getCenter();
    const combinedStats = this.recomputeCombinedTankStats();
    this.tank.applyStats(combinedStats);
    this.tank.resetForBattle(center.x, center.y);
    this.enemies.clear();
    this.combat.clear();
    this.skills.resetToEmpty();
    this.currencies.reset();
    this.waves.resetForNewRun();
    this.lastWaveEvent = null;
    this.battleStats = {
      enemiesDefeated: 0,
      elapsedSeconds: 0,
    };
    this.hudSyncAccumulator = 0;
  }

  restartBattle(): void {
    this.resetBattleState();
    this.phase = 'ACTIVE';
    playgamaBridge.notifyGameplayStart();
    void this.persist();
    this.emitSnapshot();
  }

  returnToTitle(): void {
    this.resetBattleState();
    this.setPhase('TITLE');
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

  async persist(): Promise<void> {
    await this.saveSystem.save({
      wave: this.waves.getState(),
      currencies: this.currencies.getBalances(),
      tankStats: this.tank.getState().stats,
      upgrades: this.upgrades.exportState(),
      equipment: this.equipment.exportState(),
      forge: this.forge.exportState(),
      skillCollection: this.skillCollection.exportState(),
      soundEnabled: this.soundEnabled,
      showRangeRing: this.showRangeRing,
    });
  }

  private emitSnapshot(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snap));
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();

    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.max(0, Math.min(rawDt, 0.1));

      const isActive = this.phase === 'ACTIVE';
      if (isActive) {
        this.battleStats.elapsedSeconds += dt;
        const bounds = this.battlefield.getBounds();
        const tankState = this.tank.getState();

        let hudDirty = false;
        let playerDefeated = false;

        this.battlefield.update(dt);

        // Advance active equipment forge timer (~2s)
        if (this.forge.getState().status === 'forging') {
          const forgedItem = this.forge.update(dt);
          if (forgedItem) {
            soundEffects.playForgeComplete(
              EQUIPMENT_RARITY_CONFIG[forgedItem.rarity].tier
            );
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
            onAttackPlayer: (atk) => {
              if (this.phase !== 'ACTIVE' || playerDefeated) return;
              const dmgRes = this.tank.takeDamage(atk.damage);
              if (dmgRes.effectiveDamage > 0) {
                this.combat.spawnEnemyAttackTracer(
                  atk.enemyX,
                  atk.enemyY,
                  tankState.position.x,
                  tankState.position.y,
                  dmgRes.effectiveDamage,
                  Boolean(atk.isBoss)
                );
                soundEffects.playHit();
                hudDirty = true;
              }
              if (dmgRes.defeated) {
                playerDefeated = true;
              }
            },
            onBossSiegeStrike: (strike) => {
              if (this.phase !== 'ACTIVE' || playerDefeated) return;
              const dist = Math.hypot(
                tankState.position.x - strike.targetX,
                tankState.position.y - strike.targetY
              );
              const hitRadius =
                strike.radius + COMBAT_CONFIG.tankCollisionRadius * 0.7;
              let effectiveDamage = 0;
              if (dist <= hitRadius) {
                const dmgRes = this.tank.takeDamage(strike.damage);
                effectiveDamage = dmgRes.effectiveDamage;
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
              soundEffects.playExplosion();
              hudDirty = true;
            },
            onEnemyDestroyed: () => {},
          }
        );

        // 2. If alive, update tank movement/targeting, modular skills, and projectiles/mines
        if (!playerDefeated) {
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

          const combatResult = this.combat.update(dt, bounds, this.enemies, true);
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
            };
            soundEffects.playWaveClear();
            void this.persist();
            hudDirty = true;
          }
          if (waveStep.startedWave !== null) {
            this.enemies.resetSpawnTimer(waveStep.startedBossWave ? 0.55 : 0.35);
            if (waveStep.startedBossWave) {
              this.lastWaveEvent = {
                id: ++this.waveEventCounter,
                kind: 'boss_spawn',
                wave: waveStep.startedWave,
                isBossWave: true,
                rewardGold: 0,
              };
              soundEffects.playBossAlert();
            }
            void this.persist();
            hudDirty = true;
          }

          // Throttle HUD cooldown ring sync (faster while forging progress bar animates)
          this.hudSyncAccumulator += dt;
          const syncInterval =
            this.forge.getState().status === 'forging' ? 0.045 : 0.1;
          if (this.hudSyncAccumulator >= syncInterval) {
            this.hudSyncAccumulator = 0;
            hudDirty = true;
          }
        } else {
          soundEffects.playDefeat();
          this.setPhase('DEFEAT');
          hudDirty = false;
        }

        if (hudDirty) {
          this.emitSnapshot();
        }
      }

      this.renderer.render({
        bounds: this.battlefield.getBounds(),
        tank: this.tank.getState(),
        enemies: this.enemies.getActiveEnemies(),
        projectiles: this.combat.getProjectiles(),
        mines: this.combat.getMines(),
        effects: this.combat.getEffects(),
        showRangeRing: this.showRangeRing,
        isActive,
        reducedMotion: this.reducedMotion,
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
