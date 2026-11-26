import { COMBAT_CONFIG } from '../constants';
import {
  ArenaBounds,
  EnemyInstance,
  LandmineInstance,
  ProjectileInstance,
  ProjectileKind,
  Vector2,
  VisualEffect,
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
  targetX?: number;
  targetY?: number;
  flightDuration?: number;
}

export class CombatSystem {
  private readonly projectiles: ProjectileInstance[] = [];
  private readonly mines: LandmineInstance[] = [];
  private readonly effects: VisualEffect[] = [];
  private nextProjectileUid = 1;
  private nextMineUid = 1;
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
    this.projectiles.length = 0;
    this.mines.length = 0;
    this.effects.length = 0;
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

    this.pushEffect({
      kind: 'muzzle',
      x,
      y,
      tx: x,
      ty: y,
      vx: 0,
      vy: 0,
      angle,
      size: isCrit ? 19 : 15,
      life: 0.09,
      maxLife: 0.09,
      color: isCrit ? '#FCD34D' : '#FDE68A',
    });
  }

  spawnProjectile(params: ProjectileSpawnParams): void {
    if (this.projectiles.length >= COMBAT_CONFIG.maxProjectiles) {
      this.projectiles.shift();
    }

    const isMortar = params.kind === 'mortar_shell';
    const proj: ProjectileInstance = {
      uid: this.nextProjectileUid++,
      kind: params.kind,
      x: params.x,
      y: params.y,
      vx: Math.cos(params.angle) * params.speed,
      vy: Math.sin(params.angle) * params.speed,
      angle: params.angle,
      damage: params.damage,
      radius: params.radius ?? COMBAT_CONFIG.projectileRadius,
      ttl: params.ttl ?? COMBAT_CONFIG.projectileTtlSec,
      active: true,
      aoeRadius: params.aoeRadius ?? 0,
      pierceRemaining: params.pierceRemaining ?? 1,
      hitEnemyUids: [],
      visualTier: params.visualTier ?? 1,
      isCrit: params.isCrit ?? false,
    };

    if (isMortar && params.targetX !== undefined && params.targetY !== undefined) {
      proj.startX = params.x;
      proj.startY = params.y;
      proj.targetX = params.targetX;
      proj.targetY = params.targetY;
      proj.flightElapsed = 0;
      proj.flightDuration = params.flightDuration ?? 0.72;
      proj.ttl = proj.flightDuration + 0.1;
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
    // Enforce cap so mines never accumulate endlessly
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
  }

  applyDirectDamage(
    enemy: EnemyInstance,
    damage: number,
    enemySystem: EnemySystem,
    color = '#FEF08A',
    result?: CombatStepResult,
    isCrit = false
  ): void {
    if (enemy.isDying || enemy.hp <= 0) return;
    const bossMultiplier =
      enemy.isBoss && this.bossDamageBonusPct > 0
        ? 1 + this.bossDamageBonusPct / 100
        : 1;
    const cleanDamage = Math.max(1, Math.round(damage * bossMultiplier));
    if (result) result.enemyHits++;

    const destroyed = enemySystem.applyDamage(enemy, cleanDamage, (evt) => {
      if (result) {
        result.enemiesDestroyed++;
        result.goldEarned += evt.rewardGold;
      }
      this.spawnExplosion(evt);
    });

    if (!destroyed) {
      this.pushEffect({
        kind: 'impact',
        x: enemy.position.x,
        y: enemy.position.y,
        tx: enemy.position.x,
        ty: enemy.position.y,
        vx: 0,
        vy: 0,
        angle: Math.random() * Math.PI,
        size: isCrit ? 16 : 11,
        life: 0.14,
        maxLife: 0.14,
        color: isCrit ? '#F59E0B' : color,
      });
    }

    this.pushEffect({
      kind: 'damage_text',
      x: enemy.position.x + (Math.random() - 0.5) * 10,
      y: enemy.position.y - enemy.radius - 8,
      tx: 0,
      ty: 0,
      vx: 0,
      vy: isCrit ? -38 : -30,
      angle: 0,
      size: isCrit ? 15 : 12,
      life: isCrit ? 0.58 : 0.45,
      maxLife: isCrit ? 0.58 : 0.45,
      color: isCrit ? '#FBBF24' : color,
      value: cleanDamage,
      isCrit,
    });
  }

  applyAreaDamage(
    cx: number,
    cy: number,
    aoeRadius: number,
    damage: number,
    enemySystem: EnemySystem,
    color: string,
    result: CombatStepResult
  ): void {
    this.pushEffect({
      kind: 'blast_ring',
      x: cx,
      y: cy,
      tx: cx,
      ty: cy,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      size: aoeRadius,
      life: 0.28,
      maxLife: 0.28,
      color,
    });

    const enemies = enemySystem.getActiveEnemies();
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.isDying || enemy.hp <= 0) continue;
      const dist = Math.hypot(enemy.position.x - cx, enemy.position.y - cy);
      if (dist <= aoeRadius + enemy.radius) {
        this.applyDirectDamage(enemy, damage, enemySystem, color, result);
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
      life: 0.2,
      maxLife: 0.2,
      color: '#FB923C',
      coneHalfAngle,
    });
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
      size: 2.5,
      life: 0.18,
      maxLife: 0.18,
      color: '#38BDF8',
      points,
    });
  }

  spawnRailBeam(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    beamWidth = 4
  ): void {
    this.pushEffect({
      kind: 'rail_beam',
      x: fromX,
      y: fromY,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle: Math.atan2(toY - fromY, toX - fromX),
      size: beamWidth,
      life: 0.22,
      maxLife: 0.22,
      color: '#67E8F9',
    });
  }

  spawnEnemyAttackTracer(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    damageTaken: number,
    isBoss = false
  ): void {
    this.pushEffect({
      kind: 'tracer',
      x: fromX,
      y: fromY,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle: Math.atan2(toY - fromY, toX - fromX),
      size: isBoss ? 4.2 : 2,
      life: isBoss ? 0.19 : 0.13,
      maxLife: isBoss ? 0.19 : 0.13,
      color: isBoss ? '#F43F5E' : '#FB7185',
    });

    this.pushEffect({
      kind: 'impact',
      x: toX + (Math.random() - 0.5) * 14,
      y: toY + (Math.random() - 0.5) * 14,
      tx: toX,
      ty: toY,
      vx: 0,
      vy: 0,
      angle: 0,
      size: isBoss ? 17 : 11,
      life: 0.16,
      maxLife: 0.16,
      color: isBoss ? '#FB7185' : '#FDA4AF',
    });

    this.pushEffect({
      kind: 'damage_text',
      x: toX + (Math.random() - 0.5) * 16,
      y: toY - 34,
      tx: 0,
      ty: 0,
      vx: 0,
      vy: -26,
      angle: 0,
      size: isBoss ? 14 : 12,
      life: 0.5,
      maxLife: 0.5,
      color: '#FB7185',
      value: damageTaken,
    });
  }

  spawnBossSiegeImpact(
    targetX: number,
    targetY: number,
    radius: number,
    damageTaken: number
  ): void {
    this.pushEffect({
      kind: 'blast_ring',
      x: targetX,
      y: targetY,
      tx: targetX,
      ty: targetY,
      vx: 0,
      vy: 0,
      angle: 0,
      size: radius,
      life: 0.35,
      maxLife: 0.35,
      color: '#F43F5E',
    });

    this.pushEffect({
      kind: 'explosion',
      x: targetX,
      y: targetY,
      tx: targetX,
      ty: targetY,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      size: radius * 0.55,
      life: 0.4,
      maxLife: 0.4,
      color: '#EF4444',
    });

    if (damageTaken > 0) {
      this.pushEffect({
        kind: 'damage_text',
        x: targetX,
        y: targetY - 38,
        tx: 0,
        ty: 0,
        vx: 0,
        vy: -28,
        angle: 0,
        size: 15,
        life: 0.55,
        maxLife: 0.55,
        color: '#F43F5E',
        value: damageTaken,
      });
    }
  }

  spawnExplosion(event: EnemyDestroyedEvent): void {
    this.pushEffect({
      kind: 'explosion',
      x: event.x,
      y: event.y,
      tx: event.x,
      ty: event.y,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      size: event.isBoss ? 48 : event.kind === 'heavy_crawler' ? 30 : 22,
      life: event.isBoss ? 0.52 : 0.34,
      maxLife: event.isBoss ? 0.52 : 0.34,
      color: event.isBoss ? '#F43F5E' : '#F59E0B',
    });
  }

  update(
    dt: number,
    bounds: ArenaBounds,
    enemySystem: EnemySystem,
    isActive: boolean
  ): CombatStepResult {
    const result: CombatStepResult = {
      enemyHits: 0,
      enemiesDestroyed: 0,
      goldEarned: 0,
    };

    if (!isActive) return result;

    const enemies = enemySystem.getActiveEnemies();
    const margin = 120;

    // 1. Update Projectiles
    let writeProj = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      p.ttl -= dt;
      if (!p.active || p.ttl <= 0) continue;

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
            result
          );
          p.active = false;
          continue;
        }
        this.projectiles[writeProj++] = p;
        continue;
      }

      // Linear Projectiles (Tank shell, Heavy shell, MG bullet, Rocket, Railgun slug)
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (
        p.x < -margin ||
        p.x > bounds.width + margin ||
        p.y < -margin ||
        p.y > bounds.height + margin
      ) {
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
            result
          );
          p.active = false;
          continue;
        }

        const dmgColor = p.isCrit
          ? '#FBBF24'
          : p.kind === 'rail_slug'
            ? '#67E8F9'
            : p.kind === 'mg_bullet'
              ? '#FDE047'
              : '#FEF08A';

        this.applyDirectDamage(
          hitEnemy,
          p.damage,
          enemySystem,
          dmgColor,
          result,
          Boolean(p.isCrit)
        );
        p.pierceRemaining--;
        if (p.pierceRemaining <= 0) {
          p.active = false;
          continue;
        }
      }

      this.projectiles[writeProj++] = p;
    }
    this.projectiles.length = writeProj;

    // 2. Update Landmines & Trigger Proximity Detonations
    let writeMine = 0;
    for (let i = 0; i < this.mines.length; i++) {
      const m = this.mines[i];
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
          '#F59E0B',
          result
        );
        m.active = false;
        continue;
      }

      this.mines[writeMine++] = m;
    }
    this.mines.length = writeMine;

    // 3. Update & Compact Visual Effects
    let writeFx = 0;
    for (let i = 0; i < this.effects.length; i++) {
      const fx = this.effects[i];
      fx.life -= dt;
      if (fx.life <= 0) continue;
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      this.effects[writeFx++] = fx;
    }
    this.effects.length = writeFx;

    return result;
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

  private pushEffect(effect: VisualEffect): void {
    if (this.effects.length >= COMBAT_CONFIG.maxVisualEffects) {
      this.effects.shift();
    }
    this.effects.push(effect);
  }
}
