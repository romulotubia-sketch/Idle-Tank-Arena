import { BOSS_CONFIG, COMBAT_CONFIG } from '../constants';
import {
  ArenaBounds,
  CombatDrone,
  DelayedStrike,
  DeployableTurret,
  EnemyInstance,
  ExplosionStyle,
  LandmineInstance,
  ProjectileInstance,
  ProjectileKind,
  Vector2,
  VisualEffect,
  VisualEffectKind,
} from '../types';
import { EnemyDestroyedEvent, EnemySystem } from './EnemySystem';

export interface CombatStepResult {
  enemyHits: number;
  enemiesDestroyed: number;
  goldEarned: number;
}

export interface ProjectileSpawnParams {
  kind: ProjectileKind;
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  radius?: number;
  ttl?: number;
  aoeRadius?: number;
  pierceRemaining?: number;
  visualTier?: number;
  isCrit?: boolean;
  isEnemyProjectile?: boolean;
  targetX?: number;
  targetY?: number;
  flightDuration?: number;
  ricochetRemaining?: number;
  ricochetRange?: number;
  ricochetRetention?: number;
  homingTurnRate?: number;
  homingTargetUid?: number;
  slowFactor?: number;
  slowDuration?: number;
  acidDps?: number;
  acidDuration?: number;
  splitCount?: number;
  splitDamage?: number;
  splitRadius?: number;
}

export interface PlayerProjectileHitEvent {
  damage: number;
  fromX: number;
  fromY: number;
  kind: ProjectileKind;
}

const MAX_DAMAGE_TEXTS = 22;
const MAX_LIGHTWEIGHT_PARTICLES = 44;
const MAX_TURRETS = 3;
const MAX_DRONES = 4;
const MAX_DELAYED_STRIKES = 12;

export class CombatSystem {
  private readonly projectiles: ProjectileInstance[] = [];
  private readonly projectilePool: ProjectileInstance[] = [];
  private readonly mines: LandmineInstance[] = [];
  private readonly turrets: DeployableTurret[] = [];
  private readonly drones: CombatDrone[] = [];
  private readonly delayedStrikes: DelayedStrike[] = [];
  private readonly effects: VisualEffect[] = [];
  private readonly effectPool: VisualEffect[] = [];

  private nextProjectileUid = 1;
  private nextMineUid = 1;
  private nextAuxUid = 1;
  private effectSeedCounter = 1;
  private damageTextCount = 0;
  private particleCount = 0;
  private bossDamageBonusPct = 0;
  private performanceMode = false;

  setBossDamageBonusPct(pct: number): void {
    this.bossDamageBonusPct = Math.max(0, pct);
  }

  setPerformanceMode(enabled: boolean): void {
    this.performanceMode = Boolean(enabled);
    if (this.performanceMode && this.effects.length > 0) {
      let writeIdx = 0;
      let nextDmgCount = 0;
      for (let i = 0; i < this.effects.length; i++) {
        const fx = this.effects[i];
        if (
          fx.kind === 'smoke' ||
          fx.kind === 'debris' ||
          fx.kind === 'hit_ring' ||
          fx.kind === 'muzzle'
        ) {
          this.releaseEffect(fx);
          continue;
        }
        if (fx.kind === 'damage_text') {
          nextDmgCount++;
        }
        this.effects[writeIdx++] = fx;
      }
      this.effects.length = writeIdx;
      this.particleCount = 0;
      this.damageTextCount = nextDmgCount;
    }
  }

  isPerformanceMode(): boolean {
    return this.performanceMode;
  }

  getProjectiles(): readonly ProjectileInstance[] {
    return this.projectiles;
  }

  getMines(): readonly LandmineInstance[] {
    return this.mines;
  }

  getTurrets(): readonly DeployableTurret[] {
    return this.turrets;
  }

  getDrones(): readonly CombatDrone[] {
    return this.drones;
  }

  getDelayedStrikes(): readonly DelayedStrike[] {
    return this.delayedStrikes;
  }

  getEffects(): readonly VisualEffect[] {
    return this.effects;
  }

  clear(): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      this.releaseProjectile(this.projectiles[i]);
    }
    this.projectiles.length = 0;
    this.mines.length = 0;
    this.turrets.length = 0;
    this.drones.length = 0;
    this.delayedStrikes.length = 0;

    for (let i = 0; i < this.effects.length; i++) {
      this.releaseEffect(this.effects[i]);
    }
    this.effects.length = 0;
    this.damageTextCount = 0;
    this.particleCount = 0;
  }

  spawnTankProjectile(
    x: number,
    y: number,
    angle: number,
    damage: number,
    isCrit = false
  ): void {
    this.spawnProjectile({
      kind: 'tank_shell',
      x,
      y,
      angle,
      speed: COMBAT_CONFIG.projectileSpeed,
      damage,
      radius: isCrit
        ? COMBAT_CONFIG.projectileRadius + 1.5
        : COMBAT_CONFIG.projectileRadius,
      ttl: COMBAT_CONFIG.projectileTtlSec,
      isCrit,
    });

    // Primary cannon muzzle flash + light smoke puff
    this.pushEffect({
      kind: 'muzzle',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle,
      size: isCrit ? 30 : 24,
      life: 0.1,
      maxLife: 0.1,
      color: isCrit ? '#FCD34D' : '#FDE68A',
      secondaryColor: isCrit ? '#FFFBEB' : '#FB923C',
    });

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.pushParticle({
      kind: 'smoke',
      x: x + cos * 8,
      y: y + sin * 8,
      vx: cos * 42 + (Math.random() - 0.5) * 14,
      vy: sin * 42 + (Math.random() - 0.5) * 14,
      angle,
      size: isCrit ? 12 : 9.5,
      life: 0.24,
      maxLife: 0.24,
      color: 'rgba(203, 213, 225, 0.5)',
    });
  }

  spawnProjectile(params: ProjectileSpawnParams): void {
    if (this.projectiles.length >= COMBAT_CONFIG.maxProjectiles) {
      const oldest = this.projectiles.shift();
      if (oldest) this.releaseProjectile(oldest);
    }

    const proj = this.acquireProjectile();
    const isArcing =
      params.kind === 'mortar_shell' || params.kind === 'cluster_bomblet';
    proj.uid = this.nextProjectileUid++;
    proj.kind = params.kind;
    proj.x = params.x;
    proj.y = params.y;
    proj.prevX = params.x;
    proj.prevY = params.y;
    proj.vx = Math.cos(params.angle) * params.speed;
    proj.vy = Math.sin(params.angle) * params.speed;
    proj.angle = params.angle;
    proj.damage = params.damage;
    proj.radius = params.radius ?? COMBAT_CONFIG.projectileRadius;
    proj.ttl = params.ttl ?? COMBAT_CONFIG.projectileTtlSec;
    proj.active = true;
    proj.aoeRadius = params.aoeRadius ?? 0;
    proj.pierceRemaining = params.pierceRemaining ?? 1;
    proj.hitEnemyUids.length = 0;
    proj.visualTier = params.visualTier ?? 1;
    proj.isCrit = params.isCrit ?? false;
    proj.isEnemyProjectile = params.isEnemyProjectile ?? false;
    proj.smokeCooldown =
      params.kind === 'rocket' || params.kind === 'hunter_missile' ? 0.035 : 0;

    proj.ricochetRemaining = params.ricochetRemaining ?? 0;
    proj.ricochetRange = params.ricochetRange ?? 0;
    proj.ricochetRetention = params.ricochetRetention ?? 0.85;
    proj.homingTurnRate = params.homingTurnRate ?? 0;
    proj.homingTargetUid = params.homingTargetUid;
    proj.speedMag = params.speed;
    proj.slowFactor = params.slowFactor;
    proj.slowDuration = params.slowDuration;
    proj.acidDps = params.acidDps;
    proj.acidDuration = params.acidDuration;
    proj.splitCount = params.splitCount;
    proj.splitDamage = params.splitDamage;
    proj.splitRadius = params.splitRadius;

    if (isArcing && params.targetX !== undefined && params.targetY !== undefined) {
      proj.startX = params.x;
      proj.startY = params.y;
      proj.targetX = params.targetX;
      proj.targetY = params.targetY;
      proj.flightElapsed = 0;
      proj.flightDuration = params.flightDuration ?? 0.72;
      proj.ttl = proj.flightDuration + 0.1;

      if (params.kind === 'mortar_shell') {
        // Subtle launch flash from mortar tube
        this.pushEffect({
          kind: 'muzzle',
          x: params.x + Math.cos(params.angle) * 24,
          y: params.y + Math.sin(params.angle) * 24,
          tx: params.x,
          ty: params.y,
          vx: 0,
          vy: 0,
          angle: params.angle,
          size: 18,
          life: 0.09,
          maxLife: 0.09,
          color: '#FDBA74',
          secondaryColor: '#F97316',
        });
      }
    } else {
      proj.startX = undefined;
      proj.startY = undefined;
      proj.targetX = undefined;
      proj.targetY = undefined;
      proj.flightElapsed = undefined;
      proj.flightDuration = undefined;

      if (params.kind === 'heavy_shell') {
        this.pushEffect({
          kind: 'muzzle',
          x: params.x,
          y: params.y,
          tx: params.x,
          ty: params.y,
          vx: 0,
          vy: 0,
          angle: params.angle,
          size: 20,
          life: 0.085,
          maxLife: 0.085,
          color: '#FDBA74',
          secondaryColor: '#F59E0B',
        });
      } else if (params.kind === 'mg_bullet') {
        this.pushEffect({
          kind: 'muzzle',
          x: params.x,
          y: params.y,
          tx: params.x,
          ty: params.y,
          vx: 0,
          vy: 0,
          angle: params.angle,
          size: 12,
          life: 0.055,
          maxLife: 0.055,
          color: '#FEF08A',
          secondaryColor: '#FACC15',
        });
      } else if (params.kind === 'rocket') {
        this.pushParticle({
          kind: 'smoke',
          x: params.x - Math.cos(params.angle) * 6,
          y: params.y - Math.sin(params.angle) * 6,
          vx: -Math.cos(params.angle) * 28,
          vy: -Math.sin(params.angle) * 28,
          angle: params.angle,
          size: 10,
          life: 0.22,
          maxLife: 0.22,
          color: 'rgba(203, 213, 225, 0.45)',
        });
      }
    }

    this.projectiles.push(proj);
  }

  deployLandmine(
    x: number,
    y: number,
    damage: number,
    aoeRadius: number,
    maxMines: number,
    triggerRadius = 24,
    armTimer = 0.4
  ): void {
    const cap = Math.min(maxMines, COMBAT_CONFIG.maxMines);
    while (this.mines.length >= cap) {
      this.mines.shift();
    }

    this.mines.push({
      uid: this.nextMineUid++,
      x,
      y,
      damage,
      triggerRadius,
      aoeRadius,
      armTimer,
      ttl: 28,
      active: true,
    });

    // Subtle deployment ring so mine placement reads cleanly
    this.pushEffect({
      kind: 'hit_ring',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle: 0,
      size: 16,
      life: 0.22,
      maxLife: 0.22,
      color: '#A3E635',
    });
  }

  applyDirectDamage(
    enemy: EnemyInstance,
    damage: number,
    enemySystem: EnemySystem,
    color = '#FEF08A',
    result?: CombatStepResult,
    isCrit = false,
    hitDirX = 0,
    hitDirY = 0
  ): void {
    if (enemy.isDying || enemy.hp <= 0) return;
    const bossMultiplier =
      enemy.isBoss && this.bossDamageBonusPct > 0
        ? 1 + this.bossDamageBonusPct / 100
        : 1;
    const cleanDamage = Math.max(1, Math.round(damage * bossMultiplier));
    if (result) result.enemyHits++;

    const destroyed = enemySystem.applyDamage(
      enemy,
      cleanDamage,
      (evt) => {
        if (result) {
          result.enemiesDestroyed++;
          result.goldEarned += evt.rewardGold;
        }
        this.spawnExplosion(evt);
      },
      hitDirX,
      hitDirY
    );

    if (!destroyed) {
      const impactAngle =
        hitDirX !== 0 || hitDirY !== 0
          ? Math.atan2(hitDirY, hitDirX)
          : Math.random() * Math.PI;
      this.pushEffect({
        kind: 'impact',
        x: enemy.position.x - hitDirX * (enemy.radius * 0.45),
        y: enemy.position.y - hitDirY * (enemy.radius * 0.45),
        tx: enemy.position.x,
        ty: enemy.position.y,
        vx: 0,
        vy: 0,
        angle: impactAngle,
        size: isCrit ? 16 : 10,
        life: isCrit ? 0.16 : 0.12,
        maxLife: isCrit ? 0.16 : 0.12,
        color: isCrit ? '#FBBF24' : color,
      });

      if (isCrit) {
        this.pushEffect({
          kind: 'hit_ring',
          x: enemy.position.x,
          y: enemy.position.y,
          tx: enemy.position.x,
          ty: enemy.position.y,
          vx: 0,
          vy: 0,
          angle: 0,
          size: enemy.radius + 10,
          life: 0.18,
          maxLife: 0.18,
          color: '#FBBF24',
        });
      }
    }

    this.spawnDamageText(
      enemy.position.x,
      enemy.position.y - enemy.radius - 12,
      cleanDamage,
      isCrit ? '#FDE047' : color,
      isCrit,
      enemy.uid
    );
  }

  applyAreaDamage(
    cx: number,
    cy: number,
    aoeRadius: number,
    damage: number,
    enemySystem: EnemySystem,
    color: string,
    result: CombatStepResult,
    style: ExplosionStyle = 'rocket'
  ): void {
    this.spawnSkillExplosion(cx, cy, aoeRadius, color, style);

    const enemies = enemySystem.getActiveEnemies();
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.isDying || enemy.hp <= 0) continue;
      const dx = enemy.position.x - cx;
      const dy = enemy.position.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist <= aoeRadius + enemy.radius) {
        const inv = dist > 0.01 ? 1 / dist : 0;
        this.applyDirectDamage(
          enemy,
          damage,
          enemySystem,
          color,
          result,
          false,
          dx * inv,
          dy * inv
        );
      }
    }
  }

  spawnFlameCone(
    x: number,
    y: number,
    angle: number,
    range: number,
    coneHalfAngle: number
  ): void {
    this.pushEffect({
      kind: 'flame_cone',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle,
      size: range,
      life: 0.22,
      maxLife: 0.22,
      color: '#FB923C',
      secondaryColor: '#FDE047',
      coneHalfAngle,
      seed: this.effectSeedCounter++,
    });

    // Two lightweight embers drifting within cone without flooding particles
    for (let i = 0; i < 2; i++) {
      const spread = angle + (Math.random() - 0.5) * coneHalfAngle * 1.4;
      const spd = range * (1.2 + Math.random() * 0.6);
      this.pushParticle({
        kind: 'debris',
        x: x + Math.cos(spread) * 14,
        y: y + Math.sin(spread) * 14,
        vx: Math.cos(spread) * spd,
        vy: Math.sin(spread) * spd,
        angle: spread,
        size: 3.2,
        life: 0.22,
        maxLife: 0.22,
        color: i === 0 ? '#FDE047' : '#FB923C',
      });
    }
  }

  spawnLightningArc(points: Vector2[]): void {
    if (points.length < 2) return;
    this.pushEffect({
      kind: 'lightning_arc',
      x: points[0].x,
      y: points[0].y,
      tx: points[points.length - 1].x,
      ty: points[points.length - 1].y,
      vx: 0,
      vy: 0,
      angle: 0,
      size: 2.6,
      life: 0.19,
      maxLife: 0.19,
      color: '#38BDF8',
      secondaryColor: '#E0F2FE',
      points: points.map((p) => ({ x: p.x, y: p.y })),
      seed: this.effectSeedCounter++,
    });

    // Clear arc connection rings on struck chain targets (cap to avoid clutter)
    const nodeLimit = Math.min(points.length, 5);
    for (let i = 1; i < nodeLimit; i++) {
      this.pushEffect({
        kind: 'hit_ring',
        x: points[i].x,
        y: points[i].y,
        tx: points[i].x,
        ty: points[i].y,
        vx: 0,
        vy: 0,
        angle: 0,
        size: 16,
        life: 0.16,
        maxLife: 0.16,
        color: '#7DD3FC',
      });
    }
  }

  spawnRailBeam(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    beamWidth = 4
  ): void {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    this.pushEffect({
      kind: 'rail_beam',
      x: fromX,
      y: fromY,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle,
      size: beamWidth,
      life: 0.24,
      maxLife: 0.24,
      color: '#22D3EE',
      secondaryColor: '#ECFEFF',
      seed: this.effectSeedCounter++,
    });

    this.pushEffect({
      kind: 'muzzle',
      x: fromX,
      y: fromY,
      tx: fromX,
      ty: fromY,
      vx: 0,
      vy: 0,
      angle,
      size: 22 + beamWidth,
      life: 0.1,
      maxLife: 0.1,
      color: '#67E8F9',
      secondaryColor: '#ECFEFF',
    });
  }

  spawnShockwaveRing(x: number, y: number, radius: number, color = '#94A3B8'): void {
    this.pushEffect({
      kind: 'shockwave_ring',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle: 0,
      size: radius,
      life: 0.28,
      maxLife: 0.28,
      color,
      secondaryColor: '#E2E8F0',
    });
  }

  spawnShieldPulseEffect(x: number, y: number, radius: number): void {
    this.pushEffect({
      kind: 'shield_pulse',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle: 0,
      size: radius,
      life: 0.34,
      maxLife: 0.34,
      color: '#2DD4BF',
      secondaryColor: '#CCFBF1',
    });
  }

  spawnLaserBeam(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    beamWidth = 5,
    color = '#F43F5E'
  ): void {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    this.pushEffect({
      kind: 'laser_beam',
      x: fromX,
      y: fromY,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle,
      size: beamWidth,
      life: 0.2,
      maxLife: 0.2,
      color,
      secondaryColor: '#FFE4E6',
      seed: this.effectSeedCounter++,
    });
  }

  spawnSkyBolt(x: number, y: number, color = '#60A5FA'): void {
    this.pushEffect({
      kind: 'sky_bolt',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle: 0,
      size: 4.2,
      life: 0.26,
      maxLife: 0.26,
      color,
      secondaryColor: '#EFF6FF',
      seed: this.effectSeedCounter++,
    });
  }

  deploySentryTurret(
    x: number,
    y: number,
    damage: number,
    range: number,
    fireInterval: number,
    durationSec: number,
    maxTurrets: number,
    tier: number
  ): void {
    const cap = Math.max(1, Math.min(MAX_TURRETS, maxTurrets));
    while (this.turrets.length >= cap) {
      this.turrets.shift();
    }
    this.turrets.push({
      uid: this.nextAuxUid++,
      x,
      y,
      angle: -Math.PI / 2,
      damage,
      range,
      fireInterval,
      fireCooldown: 0.2,
      ttl: durationSec,
      maxTtl: durationSec,
      tier,
    });
    this.pushEffect({
      kind: 'hit_ring',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle: 0,
      size: 24,
      life: 0.26,
      maxLife: 0.26,
      color: '#34D399',
    });
  }

  deployDroneSquadron(
    centerX: number,
    centerY: number,
    droneCount: number,
    damage: number,
    range: number,
    fireInterval: number,
    durationSec: number,
    tier: number
  ): void {
    this.drones.length = 0;
    const count = Math.max(1, Math.min(MAX_DRONES, droneCount));
    for (let i = 0; i < count; i++) {
      const orbitAngle = (i * Math.PI * 2) / count;
      const orbitRadius = 62 + (i % 2) * 14;
      this.drones.push({
        uid: this.nextAuxUid++,
        x: centerX + Math.cos(orbitAngle) * orbitRadius,
        y: centerY + Math.sin(orbitAngle) * orbitRadius,
        orbitAngle,
        orbitRadius,
        orbitSpeed: i % 2 === 0 ? 1.85 : 1.55,
        aimAngle: orbitAngle,
        damage,
        range,
        fireInterval,
        fireCooldown: 0.12 + i * 0.1,
        ttl: durationSec,
        maxTtl: durationSec,
        tier,
      });
    }
    this.pushEffect({
      kind: 'hit_ring',
      x: centerX,
      y: centerY,
      tx: centerX,
      ty: centerY,
      vx: 0,
      vy: 0,
      angle: 0,
      size: 56,
      life: 0.28,
      maxLife: 0.28,
      color: '#FBBF24',
    });
  }

  scheduleDelayedStrike(params: {
    kind: 'orbital' | 'thunder' | 'plasma_vortex';
    x: number;
    y: number;
    delaySec: number;
    radius: number;
    damage: number;
    color: string;
    ticksRemaining?: number;
    tickInterval?: number;
  }): void {
    if (this.delayedStrikes.length >= MAX_DELAYED_STRIKES) {
      this.delayedStrikes.shift();
    }
    this.delayedStrikes.push({
      uid: this.nextAuxUid++,
      kind: params.kind,
      x: params.x,
      y: params.y,
      delayRemaining: params.delaySec,
      totalDelay: Math.max(0.05, params.delaySec),
      radius: params.radius,
      damage: params.damage,
      ticksRemaining: params.ticksRemaining ?? 1,
      tickInterval: params.tickInterval ?? 0.25,
      color: params.color,
    });
  }

  spawnEnemyArtilleryProjectile(
    fromX: number,
    fromY: number,
    angle: number,
    damage: number
  ): void {
    this.spawnProjectile({
      kind: 'enemy_artillery_shell',
      x: fromX,
      y: fromY,
      angle,
      speed: 250,
      damage,
      radius: 7.5,
      ttl: 2.2,
      isEnemyProjectile: true,
    });

    this.pushEffect({
      kind: 'muzzle',
      x: fromX,
      y: fromY,
      tx: fromX,
      ty: fromY,
      vx: 0,
      vy: 0,
      angle,
      size: 18,
      life: 0.1,
      maxLife: 0.1,
      color: '#FDE68A',
      secondaryColor: '#F97316',
    });
  }

  spawnEnemyBossProjectile(
    fromX: number,
    fromY: number,
    angle: number,
    damage: number,
    isBurst = false
  ): void {
    this.spawnProjectile({
      kind: 'enemy_boss_shell',
      x: fromX,
      y: fromY,
      angle,
      speed: isBurst ? 355 : BOSS_CONFIG.heavyShellSpeed,
      damage,
      radius: isBurst ? 8 : 10,
      ttl: 2.3,
      visualTier: isBurst ? 1 : 2,
      isEnemyProjectile: true,
    });

    this.pushEffect({
      kind: 'muzzle',
      x: fromX,
      y: fromY,
      tx: fromX,
      ty: fromY,
      vx: 0,
      vy: 0,
      angle,
      size: isBurst ? 20 : 26,
      life: 0.11,
      maxLife: 0.11,
      color: '#FB7185',
      secondaryColor: '#FDE047',
    });
  }

  spawnBossIntroEffect(x: number, y: number): void {
    this.pushEffect({
      kind: 'blast_ring',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle: 0,
      size: 96,
      life: 0.62,
      maxLife: 0.62,
      color: '#F43F5E',
      style: 'boss',
    });

    this.pushEffect({
      kind: 'hit_ring',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle: 0,
      size: 56,
      life: 0.4,
      maxLife: 0.4,
      color: '#F59E0B',
    });

    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      const spd = 95;
      this.pushParticle({
        kind: 'debris',
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        angle: a,
        size: 4,
        life: 0.38,
        maxLife: 0.38,
        color: i % 2 === 0 ? '#FB7185' : '#FBBF24',
      });
    }
  }

  spawnEnemyProjectileHit(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    damageTaken: number
  ): void {
    this.pushEffect({
      kind: 'explosion',
      x: toX,
      y: toY,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle: Math.atan2(toY - fromY, toX - fromX),
      size: 26,
      life: 0.25,
      maxLife: 0.25,
      color: '#F97316',
      style: 'cannon',
      seed: this.effectSeedCounter++,
    });

    this.pushEffect({
      kind: 'hit_ring',
      x: toX,
      y: toY,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle: 0,
      size: 42,
      life: 0.2,
      maxLife: 0.2,
      color: '#FB7185',
    });

    if (damageTaken > 0) {
      this.spawnDamageText(toX, toY - 52, damageTaken, '#FB923C', true, 0);
    }
  }

  spawnEnemyAttackTracer(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    damageTaken: number,
    isBoss = false,
    archetype: string = 'assault_tank'
  ): void {
    const isRunner = archetype === 'runner';
    const isHeavy = archetype === 'heavy_tank';
    const isScout = archetype === 'scout';

    if (!isRunner) {
      this.pushEffect({
        kind: 'tracer',
        x: fromX,
        y: fromY,
        tx: toX,
        ty: toY,
        vx: 0,
        vy: 0,
        angle: Math.atan2(toY - fromY, toX - fromX),
        size: isBoss ? 5.2 : isHeavy ? 3.8 : isScout ? 2.0 : 2.8,
        life: isBoss ? 0.18 : isHeavy ? 0.16 : 0.12,
        maxLife: isBoss ? 0.18 : isHeavy ? 0.16 : 0.12,
        color: isBoss
          ? '#F43F5E'
          : isHeavy
            ? '#F97316'
            : isScout
              ? '#FBBF24'
              : '#FB7185',
      });
    }

    this.pushEffect({
      kind: 'impact',
      x: toX + (Math.random() - 0.5) * 16,
      y: toY + (Math.random() - 0.5) * 16,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle: Math.atan2(toY - fromY, toX - fromX),
      size: isBoss ? 22 : isHeavy ? 18 : isRunner ? 16 : 13,
      life: 0.16,
      maxLife: 0.16,
      color: isBoss
        ? '#FB7185'
        : isHeavy
          ? '#FDBA74'
          : isRunner
            ? '#F43F5E'
            : '#FDA4AF',
    });

    this.pushEffect({
      kind: 'hit_ring',
      x: toX,
      y: toY,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle: 0,
      size: isBoss ? 46 : isHeavy ? 42 : 36,
      life: 0.18,
      maxLife: 0.18,
      color: isBoss ? '#F43F5E' : isHeavy ? '#F97316' : '#FB7185',
    });

    this.spawnDamageText(
      toX,
      toY - 52,
      damageTaken,
      isBoss ? '#F43F5E' : '#FB7185',
      isBoss,
      0
    );
  }

  spawnBossSiegeImpact(
    targetX: number,
    targetY: number,
    radius: number,
    damageTaken: number
  ): void {
    this.spawnSkillExplosion(targetX, targetY, radius, '#F43F5E', 'boss');

    if (damageTaken > 0) {
      this.pushEffect({
        kind: 'hit_ring',
        x: targetX,
        y: targetY,
        tx: targetX,
        ty: targetY,
        vx: 0,
        vy: 0,
        angle: 0,
        size: 48,
        life: 0.24,
        maxLife: 0.24,
        color: '#F43F5E',
      });
      this.spawnDamageText(targetX, targetY - 56, damageTaken, '#F43F5E', true, 0);
    }
  }

  spawnSkillExplosion(
    x: number,
    y: number,
    aoeRadius: number,
    color: string,
    style: ExplosionStyle
  ): void {
    const duration =
      style === 'boss' ? 0.42 : style === 'mortar' ? 0.36 : 0.3;

    this.pushEffect({
      kind: 'blast_ring',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      size: aoeRadius,
      life: duration,
      maxLife: duration,
      color,
      style,
    });

    this.pushEffect({
      kind: 'explosion',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      size: Math.min(46, Math.max(20, aoeRadius * 0.46)),
      life: duration + 0.04,
      maxLife: duration + 0.04,
      color,
      style,
      seed: this.effectSeedCounter++,
    });

    // Subtle smoke ring & sparks
    this.pushParticle({
      kind: 'smoke',
      x,
      y,
      vx: 0,
      vy: -10,
      angle: 0,
      size: Math.min(26, Math.max(12, aoeRadius * 0.28)),
      life: 0.36,
      maxLife: 0.36,
      color:
        style === 'mortar'
          ? 'rgba(71, 85, 105, 0.55)'
          : 'rgba(148, 163, 184, 0.42)',
    });

    const sparkCount = style === 'boss' ? 5 : 3;
    for (let i = 0; i < sparkCount; i++) {
      const a = (i * Math.PI * 2) / sparkCount + Math.random() * 0.8;
      const spd = 75 + Math.random() * 65;
      this.pushParticle({
        kind: 'debris',
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        angle: a,
        size: style === 'mine' ? 4 : 3.2,
        life: 0.26,
        maxLife: 0.26,
        color,
      });
    }
  }

  spawnExplosion(event: EnemyDestroyedEvent): void {
    const isBoss = event.isBoss;
    const isHeavy = event.kind === 'heavy_tank' || event.kind === 'artillery';

    this.pushEffect({
      kind: 'explosion',
      x: event.x,
      y: event.y,
      tx: event.x,
      ty: event.y,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      size: isBoss ? 64 : isHeavy ? 35 : 25,
      life: isBoss ? 0.54 : 0.32,
      maxLife: isBoss ? 0.54 : 0.32,
      color: isBoss ? '#F43F5E' : isHeavy ? '#FB923C' : '#F59E0B',
      style: isBoss ? 'boss' : 'enemy',
      seed: this.effectSeedCounter++,
    });

    if (isBoss) {
      this.pushEffect({
        kind: 'blast_ring',
        x: event.x,
        y: event.y,
        tx: event.x,
        ty: event.y,
        vx: 0,
        vy: 0,
        angle: 0,
        size: 126,
        life: 0.6,
        maxLife: 0.6,
        color: '#FB7185',
        style: 'boss',
      });
      this.pushEffect({
        kind: 'hit_ring',
        x: event.x,
        y: event.y,
        tx: event.x,
        ty: event.y,
        vx: 0,
        vy: 0,
        angle: 0,
        size: 76,
        life: 0.35,
        maxLife: 0.35,
        color: '#FDE047',
      });
    }

    // Small metallic debris & smoke on defeat (cleaned up fast, bounded by particle cap)
    this.pushParticle({
      kind: 'smoke',
      x: event.x,
      y: event.y,
      vx: 0,
      vy: -12,
      angle: 0,
      size: isBoss ? 36 : isHeavy ? 18 : 14,
      life: isBoss ? 0.46 : 0.3,
      maxLife: isBoss ? 0.46 : 0.3,
      color: 'rgba(100, 116, 139, 0.46)',
    });

    const debrisCount = isBoss ? 8 : isHeavy ? 4 : 3;
    for (let i = 0; i < debrisCount; i++) {
      const a = (i * Math.PI * 2) / debrisCount + (Math.random() - 0.5) * 0.6;
      const spd = (isBoss ? 115 : 75) + Math.random() * 55;
      this.pushParticle({
        kind: 'debris',
        x: event.x,
        y: event.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        angle: a,
        size: isBoss ? 5.2 : 3.5,
        life: isBoss ? 0.42 : 0.28,
        maxLife: isBoss ? 0.42 : 0.28,
        color:
          i % 2 === 0
            ? isBoss
              ? '#FCA5A5'
              : '#FDBA74'
            : '#64748B',
      });
    }
  }

  update(
    dt: number,
    bounds: ArenaBounds,
    enemySystem: EnemySystem,
    isActive: boolean,
    tankPos?: Vector2,
    onPlayerProjectileHit?: (hit: PlayerProjectileHitEvent) => boolean | void
  ): CombatStepResult {
    const result: CombatStepResult = {
      enemyHits: 0,
      enemiesDestroyed: 0,
      goldEarned: 0,
    };

    if (!isActive) return result;

    const enemies = enemySystem.getActiveEnemies();
    const margin = 120;
    let playerDefeatedDuringStep = false;

    // 1. Update Projectiles
    let writeProj = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (playerDefeatedDuringStep) {
        this.releaseProjectile(p);
        continue;
      }
      p.ttl -= dt;
      if (!p.active || p.ttl <= 0) {
        this.releaseProjectile(p);
        continue;
      }

      p.prevX = p.x;
      p.prevY = p.y;

      // Arcing Mortar Shell & Cluster Bomblet flight
      if (
        (p.kind === 'mortar_shell' || p.kind === 'cluster_bomblet') &&
        p.startX !== undefined &&
        p.startY !== undefined &&
        p.targetX !== undefined &&
        p.targetY !== undefined &&
        p.flightDuration !== undefined
      ) {
        p.flightElapsed = (p.flightElapsed ?? 0) + dt;
        const t = Math.min(1, p.flightElapsed / p.flightDuration);
        p.x = p.startX + (p.targetX - p.startX) * t;
        p.y = p.startY + (p.targetY - p.startY) * t;

        if (t >= 1) {
          this.applyAreaDamage(
            p.targetX,
            p.targetY,
            p.aoeRadius,
            p.damage,
            enemySystem,
            p.kind === 'cluster_bomblet' ? '#FBBF24' : '#F97316',
            result,
            p.kind === 'cluster_bomblet' ? 'rocket' : 'mortar'
          );
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }
        this.projectiles[writeProj++] = p;
        continue;
      }

      // Homing steering for Hunter Missiles
      if (p.kind === 'hunter_missile' && (p.homingTurnRate ?? 0) > 0) {
        let target: EnemyInstance | null = null;
        if (p.homingTargetUid !== undefined) {
          for (let e = 0; e < enemies.length; e++) {
            const candidate = enemies[e];
            if (
              candidate.uid === p.homingTargetUid &&
              !candidate.isDying &&
              candidate.hp > 0
            ) {
              target = candidate;
              break;
            }
          }
        }
        if (!target) {
          let bestDistSq = Infinity;
          for (let e = 0; e < enemies.length; e++) {
            const candidate = enemies[e];
            if (candidate.isDying || candidate.hp <= 0) continue;
            const dx = candidate.position.x - p.x;
            const dy = candidate.position.y - p.y;
            const dSq = dx * dx + dy * dy;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              target = candidate;
            }
          }
          p.homingTargetUid = target?.uid;
        }
        if (target) {
          const desiredAngle = Math.atan2(
            target.position.y - p.y,
            target.position.x - p.x
          );
          let diff = desiredAngle - p.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const maxTurn = (p.homingTurnRate ?? 7) * dt;
          p.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
          const spd = p.speedMag ?? Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(p.angle) * spd;
          p.vy = Math.sin(p.angle) * spd;
        }
      }

      // Linear Projectiles
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.kind === 'rocket' || p.kind === 'hunter_missile') {
        p.smokeCooldown = (p.smokeCooldown ?? 0) - dt;
        if (p.smokeCooldown <= 0) {
          p.smokeCooldown = 0.055;
          this.pushParticle({
            kind: 'smoke',
            x: p.x - Math.cos(p.angle) * 10,
            y: p.y - Math.sin(p.angle) * 10,
            vx: -Math.cos(p.angle) * 16 + (Math.random() - 0.5) * 12,
            vy: -Math.sin(p.angle) * 16 + (Math.random() - 0.5) * 12,
            angle: p.angle,
            size: p.kind === 'hunter_missile' ? 4.5 : 5.5,
            life: 0.22,
            maxLife: 0.22,
            color:
              p.kind === 'hunter_missile'
                ? 'rgba(244, 114, 182, 0.35)'
                : 'rgba(203, 213, 225, 0.4)',
          });
        }
      }

      if (
        p.x < -margin ||
        p.x > bounds.width + margin ||
        p.y < -margin ||
        p.y > bounds.height + margin
      ) {
        this.releaseProjectile(p);
        continue;
      }

      if (p.isEnemyProjectile) {
        if (tankPos) {
          const dx = tankPos.x - p.x;
          const dy = tankPos.y - p.y;
          const hitRadius = COMBAT_CONFIG.tankCollisionRadius + p.radius;
          if (dx * dx + dy * dy <= hitRadius * hitRadius) {
            const defeated = onPlayerProjectileHit?.({
              damage: p.damage,
              fromX: p.x,
              fromY: p.y,
              kind: p.kind,
            });
            p.active = false;
            this.releaseProjectile(p);
            if (defeated === true) {
              playerDefeatedDuringStep = true;
            }
            continue;
          }
        }
        this.projectiles[writeProj++] = p;
        continue;
      }

      if (playerDefeatedDuringStep) {
        this.releaseProjectile(p);
        continue;
      }

      const hitEnemy = this.findHitEnemy(p, enemies);
      if (hitEnemy) {
        p.hitEnemyUids.push(hitEnemy.uid);

        // Explosive / AoE Projectile Skills
        if (p.kind === 'rocket' && p.aoeRadius > 0) {
          this.applyAreaDamage(
            p.x,
            p.y,
            p.aoeRadius,
            p.damage,
            enemySystem,
            '#FB7185',
            result,
            'rocket'
          );
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }

        if (p.kind === 'hunter_missile') {
          this.applyAreaDamage(
            p.x,
            p.y,
            Math.max(28, p.aoeRadius),
            p.damage,
            enemySystem,
            '#F472B6',
            result,
            'rocket'
          );
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }

        if (p.kind === 'frost_shell') {
          const radius = Math.max(40, p.aoeRadius);
          this.spawnSkillExplosion(p.x, p.y, radius, '#38BDF8', 'frost');
          for (let e = 0; e < enemies.length; e++) {
            const target = enemies[e];
            if (target.isDying || target.hp <= 0) continue;
            const dx = target.position.x - p.x;
            const dy = target.position.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist <= radius + target.radius) {
              const inv = dist > 0.01 ? 1 / dist : 0;
              enemySystem.applySlow(
                target,
                p.slowFactor ?? 0.3,
                p.slowDuration ?? 2.4
              );
              this.applyDirectDamage(
                target,
                p.damage,
                enemySystem,
                '#7DD3FC',
                result,
                false,
                dx * inv,
                dy * inv
              );
            }
          }
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }

        if (p.kind === 'acid_shell') {
          const radius = Math.max(40, p.aoeRadius);
          this.spawnSkillExplosion(p.x, p.y, radius, '#84CC16', 'acid');
          for (let e = 0; e < enemies.length; e++) {
            const target = enemies[e];
            if (target.isDying || target.hp <= 0) continue;
            const dx = target.position.x - p.x;
            const dy = target.position.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist <= radius + target.radius) {
              const inv = dist > 0.01 ? 1 / dist : 0;
              enemySystem.applyAcid(
                target,
                p.acidDps ?? 10,
                p.acidDuration ?? 3.2
              );
              this.applyDirectDamage(
                target,
                p.damage,
                enemySystem,
                '#A3E635',
                result,
                false,
                dx * inv,
                dy * inv
              );
            }
          }
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }

        if (p.kind === 'plasma_orb') {
          const radius = Math.max(55, p.aoeRadius);
          this.applyAreaDamage(
            p.x,
            p.y,
            radius,
            p.damage,
            enemySystem,
            '#C084FC',
            result,
            'plasma'
          );
          if ((p.splitDamage ?? 0) > 0) {
            this.scheduleDelayedStrike({
              kind: 'plasma_vortex',
              x: p.x,
              y: p.y,
              delaySec: 0.25,
              radius: radius * 0.85,
              damage: p.splitDamage ?? Math.round(p.damage * 0.3),
              color: '#A855F7',
              ticksRemaining: 2,
              tickInterval: 0.28,
            });
          }
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }

        if (p.kind === 'cluster_bomb') {
          this.applyAreaDamage(
            p.x,
            p.y,
            44,
            p.damage,
            enemySystem,
            '#F97316',
            result,
            'cannon'
          );
          const count = Math.max(2, Math.min(6, p.splitCount ?? 3));
          const scatterR = p.splitRadius ?? 52;
          const bombletDmg = p.splitDamage ?? Math.round(p.damage * 0.45);
          for (let b = 0; b < count; b++) {
            const ba = (b * Math.PI * 2) / count + (Math.random() - 0.5) * 0.45;
            const dist = scatterR * (0.55 + Math.random() * 0.45);
            const tx = Math.max(30, Math.min(bounds.width - 30, p.x + Math.cos(ba) * dist));
            const ty = Math.max(30, Math.min(bounds.height - 30, p.y + Math.sin(ba) * dist));
            this.spawnProjectile({
              kind: 'cluster_bomblet',
              x: p.x,
              y: p.y,
              angle: ba,
              speed: 0,
              damage: bombletDmg,
              radius: 5,
              aoeRadius: p.aoeRadius || 48,
              targetX: tx,
              targetY: ty,
              flightDuration: 0.24 + (b % 3) * 0.05,
              visualTier: p.visualTier,
            });
          }
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }

        if (p.kind === 'shrapnel_shell') {
          const speedMag = Math.hypot(p.vx, p.vy) || 1;
          this.applyDirectDamage(
            hitEnemy,
            p.damage,
            enemySystem,
            '#FDBA74',
            result,
            false,
            p.vx / speedMag,
            p.vy / speedMag
          );
          const shards = Math.max(3, Math.min(8, p.splitCount ?? 4));
          const shardDmg = p.splitDamage ?? Math.max(4, Math.round(p.damage * 0.35));
          const shardSpeed = p.splitRadius ?? 560;
          for (let s = 0; s < shards; s++) {
            const sa =
              p.angle +
              Math.PI +
              ((s - (shards - 1) * 0.5) * (Math.PI * 1.4)) / shards +
              (Math.random() - 0.5) * 0.25;
            this.spawnProjectile({
              kind: 'shrapnel_shard',
              x: hitEnemy.position.x + Math.cos(sa) * (hitEnemy.radius + 4),
              y: hitEnemy.position.y + Math.sin(sa) * (hitEnemy.radius + 4),
              angle: sa,
              speed: shardSpeed,
              damage: shardDmg,
              radius: 3.5,
              ttl: 0.42,
              pierceRemaining: 1,
              visualTier: p.visualTier,
            });
          }
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }

        // Direct hit projectiles
        const dmgColor = p.isCrit
          ? '#FBBF24'
          : p.kind === 'rail_slug'
            ? '#67E8F9'
            : p.kind === 'pierce_slug'
              ? '#FDE68A'
              : p.kind === 'ricochet_slug'
                ? '#5EEAD4'
                : p.kind === 'drone_bolt'
                  ? '#FDE047'
                  : p.kind === 'turret_round'
                    ? '#6EE7B7'
                    : p.kind === 'mg_bullet'
                      ? '#FDE047'
                      : '#FEF08A';

        const speedMag = Math.hypot(p.vx, p.vy) || 1;
        const hitDirX = p.vx / speedMag;
        const hitDirY = p.vy / speedMag;

        this.applyDirectDamage(
          hitEnemy,
          p.damage,
          enemySystem,
          dmgColor,
          result,
          Boolean(p.isCrit),
          hitDirX,
          hitDirY
        );

        if (p.kind === 'rail_slug' || p.kind === 'pierce_slug') {
          this.pushEffect({
            kind: 'hit_ring',
            x: hitEnemy.position.x,
            y: hitEnemy.position.y,
            tx: hitEnemy.position.x,
            ty: hitEnemy.position.y,
            vx: 0,
            vy: 0,
            angle: p.angle,
            size: 16,
            life: 0.14,
            maxLife: 0.14,
            color: p.kind === 'rail_slug' ? '#67E8F9' : '#FCD34D',
          });
        }

        // Ricochet bounce logic
        if (p.kind === 'ricochet_slug' && (p.ricochetRemaining ?? 0) > 0) {
          const bounceRangeSq =
            (p.ricochetRange ?? 185) * (p.ricochetRange ?? 185);
          let nextTarget: EnemyInstance | null = null;
          let bestDistSq = Infinity;
          for (let e = 0; e < enemies.length; e++) {
            const candidate = enemies[e];
            if (candidate.isDying || candidate.hp <= 0) continue;
            if (p.hitEnemyUids.includes(candidate.uid)) continue;
            const dx = candidate.position.x - hitEnemy.position.x;
            const dy = candidate.position.y - hitEnemy.position.y;
            const dSq = dx * dx + dy * dy;
            if (dSq <= bounceRangeSq && dSq < bestDistSq) {
              bestDistSq = dSq;
              nextTarget = candidate;
            }
          }

          if (nextTarget) {
            p.ricochetRemaining = (p.ricochetRemaining ?? 1) - 1;
            p.damage = Math.max(
              1,
              Math.round(p.damage * (p.ricochetRetention ?? 0.88))
            );
            const nextAngle = Math.atan2(
              nextTarget.position.y - p.y,
              nextTarget.position.x - p.x
            );
            const spd = p.speedMag ?? speedMag;
            p.angle = nextAngle;
            p.vx = Math.cos(nextAngle) * spd;
            p.vy = Math.sin(nextAngle) * spd;
            p.ttl = Math.max(p.ttl, 0.55);
            this.pushEffect({
              kind: 'tracer',
              x: hitEnemy.position.x,
              y: hitEnemy.position.y,
              tx: nextTarget.position.x,
              ty: nextTarget.position.y,
              vx: 0,
              vy: 0,
              angle: nextAngle,
              size: 1.8,
              life: 0.12,
              maxLife: 0.12,
              color: 'rgba(94, 234, 212, 0.65)',
            });
            this.projectiles[writeProj++] = p;
            continue;
          }
        }

        p.pierceRemaining--;
        if (p.pierceRemaining <= 0) {
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }
      }

      this.projectiles[writeProj++] = p;
    }
    this.projectiles.length = writeProj;

    // 2. Update Landmines & Trigger Proximity Detonations (skip if player defeated this frame)
    let writeMine = 0;
    for (let i = 0; i < this.mines.length; i++) {
      const m = this.mines[i];
      if (playerDefeatedDuringStep) continue;
      m.ttl -= dt;
      if (!m.active || m.ttl <= 0) continue;

      if (m.armTimer > 0) {
        m.armTimer = Math.max(0, m.armTimer - dt);
        this.mines[writeMine++] = m;
        continue;
      }

      let triggered = false;
      for (let e = 0; e < enemies.length; e++) {
        const enemy = enemies[e];
        if (enemy.isDying || enemy.hp <= 0) continue;
        const dist = Math.hypot(enemy.position.x - m.x, enemy.position.y - m.y);
        if (dist <= m.triggerRadius + enemy.radius) {
          triggered = true;
          break;
        }
      }

      if (triggered) {
        this.applyAreaDamage(
          m.x,
          m.y,
          m.aoeRadius,
          m.damage,
          enemySystem,
          '#A3E635',
          result,
          'mine'
        );
        m.active = false;
        continue;
      }

      this.mines[writeMine++] = m;
    }
    this.mines.length = writeMine;

    // 2b. Update Deployed Sentry Turrets
    let writeTurret = 0;
    for (let i = 0; i < this.turrets.length; i++) {
      const turret = this.turrets[i];
      if (playerDefeatedDuringStep) continue;
      turret.ttl -= dt;
      if (turret.ttl <= 0) continue;

      turret.fireCooldown -= dt;
      const rangeSq = turret.range * turret.range;
      let target: EnemyInstance | null = null;
      let bestDistSq = Infinity;
      for (let e = 0; e < enemies.length; e++) {
        const enemy = enemies[e];
        if (enemy.isDying || enemy.hp <= 0) continue;
        const dx = enemy.position.x - turret.x;
        const dy = enemy.position.y - turret.y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= rangeSq && dSq < bestDistSq) {
          bestDistSq = dSq;
          target = enemy;
        }
      }

      if (target) {
        turret.angle = Math.atan2(
          target.position.y - turret.y,
          target.position.x - turret.x
        );
        if (turret.fireCooldown <= 0) {
          turret.fireCooldown = turret.fireInterval;
          this.spawnProjectile({
            kind: 'turret_round',
            x: turret.x + Math.cos(turret.angle) * 16,
            y: turret.y + Math.sin(turret.angle) * 16,
            angle: turret.angle,
            speed: 700,
            damage: turret.damage,
            radius: 4,
            ttl: 0.9,
            pierceRemaining: 1,
            visualTier: turret.tier,
          });
        }
      }
      this.turrets[writeTurret++] = turret;
    }
    this.turrets.length = writeTurret;

    // 2c. Update Combat Drone Squadron
    let writeDrone = 0;
    for (let i = 0; i < this.drones.length; i++) {
      const drone = this.drones[i];
      if (playerDefeatedDuringStep) continue;
      drone.ttl -= dt;
      if (drone.ttl <= 0) continue;

      drone.orbitAngle += drone.orbitSpeed * dt;
      if (tankPos) {
        drone.x = tankPos.x + Math.cos(drone.orbitAngle) * drone.orbitRadius;
        drone.y = tankPos.y + Math.sin(drone.orbitAngle) * drone.orbitRadius;
      }

      drone.fireCooldown -= dt;
      const rangeSq = drone.range * drone.range;
      let target: EnemyInstance | null = null;
      let bestDistSq = Infinity;
      for (let e = 0; e < enemies.length; e++) {
        const enemy = enemies[e];
        if (enemy.isDying || enemy.hp <= 0) continue;
        const dx = enemy.position.x - drone.x;
        const dy = enemy.position.y - drone.y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= rangeSq && dSq < bestDistSq) {
          bestDistSq = dSq;
          target = enemy;
        }
      }

      if (target) {
        drone.aimAngle = Math.atan2(
          target.position.y - drone.y,
          target.position.x - drone.x
        );
        if (drone.fireCooldown <= 0) {
          drone.fireCooldown = drone.fireInterval;
          this.spawnProjectile({
            kind: 'drone_bolt',
            x: drone.x + Math.cos(drone.aimAngle) * 10,
            y: drone.y + Math.sin(drone.aimAngle) * 10,
            angle: drone.aimAngle,
            speed: 760,
            damage: drone.damage,
            radius: 3.8,
            ttl: 0.85,
            pierceRemaining: 1,
            visualTier: drone.tier,
          });
        }
      } else {
        drone.aimAngle = drone.orbitAngle + Math.PI / 2;
      }

      this.drones[writeDrone++] = drone;
    }
    this.drones.length = writeDrone;

    // 2d. Update Delayed Orbital Strikes, Thunderstorm Bolts, and Plasma Vortices
    let writeStrike = 0;
    for (let i = 0; i < this.delayedStrikes.length; i++) {
      const s = this.delayedStrikes[i];
      if (playerDefeatedDuringStep) continue;
      s.delayRemaining -= dt;
      if (s.delayRemaining <= 0) {
        if (s.kind === 'orbital') {
          this.pushEffect({
            kind: 'orbital_beam',
            x: s.x,
            y: s.y,
            tx: s.x,
            ty: s.y,
            vx: 0,
            vy: 0,
            angle: 0,
            size: s.radius * 0.42,
            life: 0.36,
            maxLife: 0.36,
            color: s.color,
            secondaryColor: '#ECFEFF',
          });
          this.applyAreaDamage(
            s.x,
            s.y,
            s.radius,
            s.damage,
            enemySystem,
            s.color,
            result,
            'orbital'
          );
          continue;
        }

        if (s.kind === 'thunder') {
          this.spawnSkyBolt(s.x, s.y, s.color);
          this.applyAreaDamage(
            s.x,
            s.y,
            s.radius,
            s.damage,
            enemySystem,
            s.color,
            result,
            'rocket'
          );
          continue;
        }

        if (s.kind === 'plasma_vortex') {
          this.applyAreaDamage(
            s.x,
            s.y,
            s.radius,
            s.damage,
            enemySystem,
            s.color,
            result,
            'plasma'
          );
          const left = (s.ticksRemaining ?? 1) - 1;
          if (left > 0) {
            s.ticksRemaining = left;
            s.delayRemaining = s.tickInterval ?? 0.28;
            this.delayedStrikes[writeStrike++] = s;
          }
          continue;
        }
      }
      this.delayedStrikes[writeStrike++] = s;
    }
    this.delayedStrikes.length = writeStrike;

    // 2e. Process Acid Shells Corrosive DoT Ticks on Enemies
    if (!playerDefeatedDuringStep) {
      for (let e = 0; e < enemies.length; e++) {
        const enemy = enemies[e];
        if (enemy.isDying || enemy.hp <= 0) continue;
        if (!enemy.acidTimer || enemy.acidTimer <= 0 || !enemy.acidDps) continue;

        enemy.acidTimer = Math.max(0, enemy.acidTimer - dt);
        enemy.acidTickTimer = (enemy.acidTickTimer ?? 0.45) - dt;
        if (enemy.acidTickTimer <= 0) {
          enemy.acidTickTimer = 0.45;
          const tickDamage = Math.max(1, Math.round(enemy.acidDps * 0.45));
          this.applyDirectDamage(
            enemy,
            tickDamage,
            enemySystem,
            '#A3E635',
            result,
            false
          );
        }
      }
    }

    // 3. Update & Compact Visual Effects (pooled)
    let writeFx = 0;
    let nextDamageTextCount = 0;
    let nextParticleCount = 0;
    for (let i = 0; i < this.effects.length; i++) {
      const fx = this.effects[i];
      fx.life -= dt;
      if (fx.life <= 0) {
        this.releaseEffect(fx);
        continue;
      }

      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;

      if (fx.kind === 'debris' || fx.kind === 'smoke') {
        const drag = Math.exp(-5.5 * dt);
        fx.vx *= drag;
        fx.vy *= drag;
        nextParticleCount++;
      } else if (fx.kind === 'damage_text') {
        fx.vy *= Math.exp(-3.2 * dt);
        nextDamageTextCount++;
      }

      this.effects[writeFx++] = fx;
    }
    this.effects.length = writeFx;
    this.damageTextCount = nextDamageTextCount;
    this.particleCount = nextParticleCount;

    return result;
  }

  private spawnDamageText(
    baseX: number,
    baseY: number,
    value: number,
    color: string,
    isCrit: boolean,
    enemyUid: number
  ): void {
    // Coalesce/stagger rapidly arriving damage texts near the same spot so numbers stay readable
    if (!isCrit) {
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const fx = this.effects[i];
        if (fx.kind !== 'damage_text' || fx.isCrit || fx.value === undefined) continue;
        if (
          fx.life > fx.maxLife * 0.72 &&
          Math.abs(fx.x - baseX) < 16 &&
          Math.abs(fx.y - baseY) < 16
        ) {
          fx.value += value;
          fx.life = Math.min(fx.maxLife, fx.life + 0.08);
          return;
        }
      }
    }

    const staggerSlot = (enemyUid + this.damageTextCount) % 4;
    const offsetX = (staggerSlot - 1.5) * 8 + (Math.random() - 0.5) * 4;
    const offsetY = -(staggerSlot % 2) * 7;

    this.pushEffect({
      kind: 'damage_text',
      x: baseX + offsetX,
      y: baseY + offsetY,
      tx: 0,
      ty: 0,
      vx: (staggerSlot - 1.5) * 4,
      vy: isCrit ? -44 : -32,
      angle: 0,
      size: isCrit ? 15 : 11.5,
      life: isCrit ? 0.62 : 0.46,
      maxLife: isCrit ? 0.62 : 0.46,
      color,
      value,
      isCrit,
    });
  }

  private findHitEnemy(
    proj: ProjectileInstance,
    enemies: readonly EnemyInstance[]
  ): EnemyInstance | null {
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.isDying || enemy.hp <= 0) continue;
      if (proj.hitEnemyUids.includes(enemy.uid)) continue;
      const dx = enemy.position.x - proj.x;
      const dy = enemy.position.y - proj.y;
      const hitRadius = enemy.radius + proj.radius;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return enemy;
      }
    }
    return null;
  }

  private acquireProjectile(): ProjectileInstance {
    const pooled = this.projectilePool.pop();
    if (pooled) return pooled;
    return {
      uid: 0,
      kind: 'tank_shell',
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      damage: 0,
      radius: 4,
      ttl: 0,
      active: false,
      aoeRadius: 0,
      pierceRemaining: 1,
      hitEnemyUids: [],
    };
  }

  private releaseProjectile(proj: ProjectileInstance): void {
    proj.active = false;
    proj.hitEnemyUids.length = 0;
    if (this.projectilePool.length < COMBAT_CONFIG.maxProjectiles) {
      this.projectilePool.push(proj);
    }
  }

  private acquireEffect(): VisualEffect {
    const pooled = this.effectPool.pop();
    if (pooled) return pooled;
    return {
      kind: 'impact',
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      size: 1,
      life: 0,
      maxLife: 1,
      color: '#FFFFFF',
    };
  }

  private releaseEffect(fx: VisualEffect): void {
    fx.points = undefined;
    fx.value = undefined;
    fx.isCrit = undefined;
    fx.style = undefined;
    fx.secondaryColor = undefined;
    fx.coneHalfAngle = undefined;
    fx.seed = undefined;
    if (this.effectPool.length < COMBAT_CONFIG.maxVisualEffects) {
      this.effectPool.push(fx);
    }
  }

  private evictOldestOfKind(kinds: readonly VisualEffectKind[]): boolean {
    for (let i = 0; i < this.effects.length; i++) {
      if (kinds.includes(this.effects[i].kind)) {
        const [removed] = this.effects.splice(i, 1);
        if (removed.kind === 'damage_text') {
          this.damageTextCount = Math.max(0, this.damageTextCount - 1);
        } else if (removed.kind === 'debris' || removed.kind === 'smoke') {
          this.particleCount = Math.max(0, this.particleCount - 1);
        }
        this.releaseEffect(removed);
        return true;
      }
    }
    return false;
  }

  private pushParticle(
    params: Omit<VisualEffect, 'tx' | 'ty'>
  ): void {
    if (this.performanceMode) return;
    if (this.particleCount >= MAX_LIGHTWEIGHT_PARTICLES) {
      this.evictOldestOfKind(['smoke', 'debris']);
    }
    this.pushEffect({
      ...params,
      tx: params.x,
      ty: params.y,
    });
  }

  private pushEffect(input: VisualEffect): void {
    if (this.performanceMode) {
      if (
        input.kind === 'smoke' ||
        input.kind === 'debris' ||
        input.kind === 'hit_ring' ||
        input.kind === 'muzzle' ||
        (input.kind === 'impact' && input.size <= 12)
      ) {
        return;
      }
    }

    const damageTextCap = this.performanceMode ? 10 : MAX_DAMAGE_TEXTS;
    if (input.kind === 'damage_text' && this.damageTextCount >= damageTextCap) {
      this.evictOldestOfKind(['damage_text']);
    }

    const effectsCap = this.performanceMode
      ? Math.floor(COMBAT_CONFIG.maxVisualEffects * 0.55)
      : COMBAT_CONFIG.maxVisualEffects;
    if (this.effects.length >= effectsCap) {
      const evicted = this.evictOldestOfKind(['smoke', 'debris', 'damage_text', 'impact']);
      if (!evicted) {
        const oldest = this.effects.shift();
        if (oldest) this.releaseEffect(oldest);
      }
    }

    const fx = this.acquireEffect();
    fx.kind = input.kind;
    fx.x = input.x;
    fx.y = input.y;
    fx.tx = input.tx;
    fx.ty = input.ty;
    fx.vx = input.vx;
    fx.vy = input.vy;
    fx.angle = input.angle;
    fx.size = input.size;
    fx.life = input.life;
    fx.maxLife = input.maxLife;
    fx.color = input.color;
    fx.secondaryColor = input.secondaryColor;
    fx.style = input.style;
    fx.seed = input.seed;
    fx.value = input.value;
    fx.isCrit = input.isCrit;
    fx.points = input.points;
    fx.coneHalfAngle = input.coneHalfAngle;

    if (fx.kind === 'damage_text') this.damageTextCount++;
    if (fx.kind === 'debris' || fx.kind === 'smoke') this.particleCount++;

    this.effects.push(fx);
  }
}
