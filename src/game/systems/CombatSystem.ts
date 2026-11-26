import { BOSS_CONFIG, COMBAT_CONFIG } from '../constants';
import {
  ArenaBounds,
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
}

export interface PlayerProjectileHitEvent {
  damage: number;
  fromX: number;
  fromY: number;
  kind: ProjectileKind;
}

const MAX_DAMAGE_TEXTS = 22;
const MAX_LIGHTWEIGHT_PARTICLES = 44;

export class CombatSystem {
  private readonly projectiles: ProjectileInstance[] = [];
  private readonly projectilePool: ProjectileInstance[] = [];
  private readonly mines: LandmineInstance[] = [];
  private readonly effects: VisualEffect[] = [];
  private readonly effectPool: VisualEffect[] = [];

  private nextProjectileUid = 1;
  private nextMineUid = 1;
  private effectSeedCounter = 1;
  private damageTextCount = 0;
  private particleCount = 0;
  private bossDamageBonusPct = 0;

  setBossDamageBonusPct(pct: number): void {
    this.bossDamageBonusPct = Math.max(0, pct);
  }

  getProjectiles(): readonly ProjectileInstance[] {
    return this.projectiles;
  }

  getMines(): readonly LandmineInstance[] {
    return this.mines;
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
      size: isCrit ? 22 : 17,
      life: 0.1,
      maxLife: 0.1,
      color: isCrit ? '#FCD34D' : '#FDE68A',
      secondaryColor: isCrit ? '#FFFBEB' : '#FB923C',
    });

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.pushParticle({
      kind: 'smoke',
      x: x + cos * 6,
      y: y + sin * 6,
      vx: cos * 38 + (Math.random() - 0.5) * 14,
      vy: sin * 38 + (Math.random() - 0.5) * 14,
      angle,
      size: isCrit ? 9 : 7,
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
    const isMortar = params.kind === 'mortar_shell';
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
    proj.smokeCooldown = params.kind === 'rocket' ? 0.035 : 0;

    if (isMortar && params.targetX !== undefined && params.targetY !== undefined) {
      proj.startX = params.x;
      proj.startY = params.y;
      proj.targetX = params.targetX;
      proj.targetY = params.targetY;
      proj.flightElapsed = 0;
      proj.flightDuration = params.flightDuration ?? 0.72;
      proj.ttl = proj.flightDuration + 0.1;

      // Subtle launch flash from mortar tube
      this.pushEffect({
        kind: 'muzzle',
        x: params.x + Math.cos(params.angle) * 14,
        y: params.y + Math.sin(params.angle) * 14,
        tx: params.x,
        ty: params.y,
        vx: 0,
        vy: 0,
        angle: params.angle,
        size: 13,
        life: 0.09,
        maxLife: 0.09,
        color: '#FDBA74',
        secondaryColor: '#F97316',
      });
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
          size: 15,
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
          size: 9,
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
          size: 8,
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
      size: 16 + beamWidth,
      life: 0.1,
      maxLife: 0.1,
      color: '#67E8F9',
      secondaryColor: '#ECFEFF',
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
      radius: 6.5,
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
      size: 14,
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
      radius: isBurst ? 7 : 8.5,
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
      size: isBurst ? 15 : 19,
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
      size: 20,
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
      size: 30,
      life: 0.2,
      maxLife: 0.2,
      color: '#FB7185',
    });

    if (damageTaken > 0) {
      this.spawnDamageText(toX, toY - 36, damageTaken, '#FB923C', true, 0);
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
        size: isBoss ? 4.2 : isHeavy ? 3.1 : isScout ? 1.6 : 2.2,
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
      x: toX + (Math.random() - 0.5) * 12,
      y: toY + (Math.random() - 0.5) * 12,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle: Math.atan2(toY - fromY, toX - fromX),
      size: isBoss ? 18 : isHeavy ? 14 : isRunner ? 13 : 10,
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
      size: isBoss ? 34 : isHeavy ? 30 : 25,
      life: 0.18,
      maxLife: 0.18,
      color: isBoss ? '#F43F5E' : isHeavy ? '#F97316' : '#FB7185',
    });

    this.spawnDamageText(
      toX,
      toY - 36,
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
        size: 38,
        life: 0.24,
        maxLife: 0.24,
        color: '#F43F5E',
      });
      this.spawnDamageText(targetX, targetY - 40, damageTaken, '#F43F5E', true, 0);
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
      size: isBoss ? 44 : isHeavy ? 28 : 20,
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
        size: 105,
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
        size: 58,
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
      size: isBoss ? 28 : isHeavy ? 15 : 11,
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

      // Arcing Mortar Shell flight
      if (
        p.kind === 'mortar_shell' &&
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
            '#F97316',
            result,
            'mortar'
          );
          p.active = false;
          this.releaseProjectile(p);
          continue;
        }
        this.projectiles[writeProj++] = p;
        continue;
      }

      // Linear Projectiles (Tank shell, Heavy shell, MG bullet, Rocket, Railgun slug)
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.kind === 'rocket') {
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
            size: 5.5,
            life: 0.24,
            maxLife: 0.24,
            color: 'rgba(203, 213, 225, 0.4)',
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

        const dmgColor = p.isCrit
          ? '#FBBF24'
          : p.kind === 'rail_slug'
            ? '#67E8F9'
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

        if (p.kind === 'rail_slug') {
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
            color: '#67E8F9',
          });
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
    if (input.kind === 'damage_text' && this.damageTextCount >= MAX_DAMAGE_TEXTS) {
      this.evictOldestOfKind(['damage_text']);
    }

    if (this.effects.length >= COMBAT_CONFIG.maxVisualEffects) {
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
