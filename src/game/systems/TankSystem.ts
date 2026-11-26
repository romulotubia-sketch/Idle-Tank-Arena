import { COMBAT_CONFIG, INITIAL_TANK_STATS, MOVEMENT_CONFIG } from '../constants';
import { createPlayerTank } from '../entities/PlayerTank';
import { EnemyInstance, PlayerTankState, TankStats, Vector2 } from '../types';
import { UpgradeSystem } from './UpgradeSystem';

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export interface TankFireOutput {
  muzzleX: number;
  muzzleY: number;
  angle: number;
  damage: number;
  isCrit: boolean;
}

export class TankSystem {
  private state: PlayerTankState;
  private fireCooldown = 0;
  private currentTargetUid: number | null = null;
  private moveInput: Vector2 = { x: 0, y: 0 };
  private transientAttackMultiplier = 1;

  constructor(centerX: number, centerY: number) {
    this.state = createPlayerTank(centerX, centerY);
  }

  getState(): PlayerTankState {
    return this.state;
  }

  setTurretAngle(angleRadians: number): void {
    this.state.turretAngle = angleRadians;
  }

  setTransientAttackMultiplier(multiplier: number): void {
    this.transientAttackMultiplier =
      Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : 1;
  }

  setMovementRadius(radius: number): void {
    this.state.movementRadius = Math.max(40, radius);
    this.clampPositionToBoundary();
  }

  setMoveInput(x: number, y: number): void {
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      this.moveInput.x = x / mag;
      this.moveInput.y = y / mag;
    } else if (mag < 0.01) {
      this.moveInput.x = 0;
      this.moveInput.y = 0;
    } else {
      this.moveInput.x = x;
      this.moveInput.y = y;
    }
  }

  applyStats(stats: Partial<TankStats>): void {
    this.state.stats = { ...this.state.stats, ...stats };
  }

  applyUpgradeStats(
    nextStats: TankStats,
    options: { healHpDelta?: boolean } = { healHpDelta: true }
  ): void {
    const prevMaxHp = this.state.stats.maxHp;
    const prevHp = this.state.stats.hp;
    const healHpDelta = options.healHpDelta ?? true;

    let nextHp: number;
    if (prevHp <= 0) {
      nextHp = 0;
    } else if (healHpDelta) {
      const maxHpDelta = Math.max(0, nextStats.maxHp - prevMaxHp);
      nextHp = Math.min(nextStats.maxHp, Math.max(1, prevHp + maxHpDelta));
    } else {
      // Preserve HP ratio when swapping equipment so unequip/re-equip cannot heal missing HP
      const ratio = prevHp / Math.max(1, prevMaxHp);
      nextHp = Math.min(
        nextStats.maxHp,
        Math.max(1, Math.round(ratio * nextStats.maxHp))
      );
    }

    this.state.stats = {
      ...nextStats,
      hp: nextHp,
    };

    // Immediately clamp fireCooldown so attack speed changes apply right away
    const maxInterval = 1 / Math.max(0.2, this.state.stats.fireRate);
    if (this.fireCooldown > maxInterval) {
      this.fireCooldown = maxInterval;
    }
  }

  resetForBattle(centerX: number, centerY: number): void {
    this.state.movementOrigin.x = centerX;
    this.state.movementOrigin.y = centerY;
    this.state.movementRadius = MOVEMENT_CONFIG.boundaryRadius;
    this.state.position.x = centerX;
    this.state.position.y = centerY;
    this.state.hullAngle = -Math.PI / 2;
    this.state.turretAngle = -Math.PI / 2 + 0.38;
    this.state.hitFlashTimer = 0;
    this.state.recoilOffset = 0;
    this.state.bodyRecoilX = 0;
    this.state.bodyRecoilY = 0;
    this.state.isMoving = false;
    this.state.shieldHp = 0;
    this.state.shieldMaxHp = 0;
    this.state.shieldTimer = 0;
    this.state.overdriveTimer = 0;
    this.state.overdriveFireRateBonus = 0;
    this.state.stats.hp = this.state.stats.maxHp;
    this.fireCooldown = 0.15;
    this.currentTargetUid = null;
    this.moveInput.x = 0;
    this.moveInput.y = 0;
  }

  addShield(amount: number, durationSec: number): void {
    const cleanAmount = Math.max(1, Math.round(amount));
    const current = this.state.shieldHp ?? 0;
    const nextHp = Math.max(current, cleanAmount);
    this.state.shieldHp = nextHp;
    this.state.shieldMaxHp = Math.max(this.state.shieldMaxHp ?? 0, nextHp);
    this.state.shieldTimer = Math.max(this.state.shieldTimer ?? 0, durationSec);
  }

  activateOverdrive(fireRateBonus: number, durationSec: number): void {
    this.state.overdriveFireRateBonus = Math.max(
      this.state.overdriveFireRateBonus ?? 0,
      Math.max(0, fireRateBonus)
    );
    this.state.overdriveTimer = Math.max(
      this.state.overdriveTimer ?? 0,
      durationSec
    );
  }

  resetStatsToDefault(): void {
    this.state.stats = { ...INITIAL_TANK_STATS };
  }

  heal(amount: number): number {
    if (this.state.stats.hp <= 0 || amount <= 0) return 0;
    const before = this.state.stats.hp;
    this.state.stats.hp = Math.min(
      this.state.stats.maxHp,
      before + Math.round(amount)
    );
    return this.state.stats.hp - before;
  }

  takeDamage(
    rawDamage: number,
    sourceX?: number,
    sourceY?: number
  ): { effectiveDamage: number; absorbedByShield: number; defeated: boolean } {
    if (this.state.stats.hp <= 0) {
      return { effectiveDamage: 0, absorbedByShield: 0, defeated: true };
    }
    const reductionRatio = UpgradeSystem.computeArmorReductionRatio(
      this.state.stats.armor
    );
    const afterArmor = rawDamage * (1 - reductionRatio);
    const mitigatedDamage = Math.max(
      1,
      Math.round(afterArmor - (this.state.stats.flatDamageBlock || 0))
    );

    let remainingDamage = mitigatedDamage;
    let absorbedByShield = 0;
    if ((this.state.shieldHp ?? 0) > 0 && (this.state.shieldTimer ?? 0) > 0) {
      const shield = this.state.shieldHp ?? 0;
      absorbedByShield = Math.min(shield, remainingDamage);
      this.state.shieldHp = Math.max(0, shield - absorbedByShield);
      remainingDamage -= absorbedByShield;
      if (this.state.shieldHp <= 0) {
        this.state.shieldTimer = 0;
      }
    }

    if (remainingDamage > 0) {
      this.state.stats.hp = Math.max(0, this.state.stats.hp - remainingDamage);
    }
    this.state.hitFlashTimer = 0.13;

    if (sourceX !== undefined && sourceY !== undefined) {
      const dx = this.state.position.x - sourceX;
      const dy = this.state.position.y - sourceY;
      const dist = Math.hypot(dx, dy) || 1;
      this.state.bodyRecoilX = Math.max(-3, Math.min(3, this.state.bodyRecoilX + (dx / dist) * 2.2));
      this.state.bodyRecoilY = Math.max(-3, Math.min(3, this.state.bodyRecoilY + (dy / dist) * 2.2));
    }

    return {
      effectiveDamage: remainingDamage,
      absorbedByShield,
      defeated: this.state.stats.hp <= 0,
    };
  }

  update(
    dt: number,
    isActive: boolean,
    enemies: readonly EnemyInstance[]
  ): TankFireOutput | null {
    if (this.state.hitFlashTimer > 0) {
      this.state.hitFlashTimer = Math.max(0, this.state.hitFlashTimer - dt);
    }
    if (this.state.recoilOffset > 0) {
      this.state.recoilOffset = Math.max(0, this.state.recoilOffset - dt * 44);
    }
    const bodyDecay = Math.exp(-18 * dt);
    this.state.bodyRecoilX *= bodyDecay;
    this.state.bodyRecoilY *= bodyDecay;
    if (Math.abs(this.state.bodyRecoilX) < 0.03) this.state.bodyRecoilX = 0;
    if (Math.abs(this.state.bodyRecoilY) < 0.03) this.state.bodyRecoilY = 0;

    if (!isActive || this.state.stats.hp <= 0) {
      this.state.isMoving = false;
      return null;
    }

    if ((this.state.shieldTimer ?? 0) > 0) {
      this.state.shieldTimer = Math.max(0, (this.state.shieldTimer ?? 0) - dt);
      if (this.state.shieldTimer <= 0) {
        this.state.shieldHp = 0;
        this.state.shieldMaxHp = 0;
      }
    }
    if ((this.state.overdriveTimer ?? 0) > 0) {
      this.state.overdriveTimer = Math.max(0, (this.state.overdriveTimer ?? 0) - dt);
      if (this.state.overdriveTimer <= 0) {
        this.state.overdriveFireRateBonus = 0;
      }
    }

    this.state.idlePhase += dt * 3.0;
    this.updateMovement(dt);

    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }

    const target = this.selectTarget(enemies);
    if (!target) {
      return null;
    }

    const dx = target.position.x - this.state.position.x;
    const dy = target.position.y - this.state.position.y;
    const desiredAngle = Math.atan2(dy, dx);
    const angleDiff = normalizeAngle(desiredAngle - this.state.turretAngle);
    const maxStep = COMBAT_CONFIG.turretTurnSpeedRad * dt;

    if (Math.abs(angleDiff) <= maxStep) {
      this.state.turretAngle = desiredAngle;
    } else {
      this.state.turretAngle = normalizeAngle(
        this.state.turretAngle + Math.sign(angleDiff) * maxStep
      );
    }

    const remainingDiff = Math.abs(
      normalizeAngle(desiredAngle - this.state.turretAngle)
    );
    if (
      remainingDiff <= COMBAT_CONFIG.turretFireToleranceRad &&
      this.fireCooldown <= 0
    ) {
      const overdriveBonus =
        (this.state.overdriveTimer ?? 0) > 0
          ? (this.state.overdriveFireRateBonus ?? 0)
          : 0;
      const fireRate = Math.max(0.2, this.state.stats.fireRate * (1 + overdriveBonus));
      this.fireCooldown = 1 / fireRate;
      this.state.recoilOffset = 7.5;

      const isCrit = Math.random() * 100 < this.state.stats.critChance;
      const cos = Math.cos(this.state.turretAngle);
      const sin = Math.sin(this.state.turretAngle);
      const kick = isCrit ? 2.4 : 1.5;
      this.state.bodyRecoilX = -cos * kick;
      this.state.bodyRecoilY = -sin * kick;

      const effectiveAttackPower = Math.max(
        1,
        Math.round(this.state.stats.attackPower * this.transientAttackMultiplier)
      );
      const damage = isCrit
        ? Math.max(
            1,
            Math.round(
              effectiveAttackPower * this.state.stats.critDamage +
                (this.state.stats.critBonusFlat || 0)
            )
          )
        : effectiveAttackPower;

      return {
        muzzleX: this.state.position.x + cos * COMBAT_CONFIG.tankMuzzleOffset,
        muzzleY: this.state.position.y + sin * COMBAT_CONFIG.tankMuzzleOffset,
        angle: this.state.turretAngle,
        damage,
        isCrit,
      };
    }

    return null;
  }

  private updateMovement(dt: number): void {
    const ix = this.moveInput.x;
    const iy = this.moveInput.y;
    const inputMag = Math.hypot(ix, iy);

    if (inputMag < 0.01) {
      this.state.isMoving = false;
      return;
    }

    this.state.isMoving = true;

    // Smoothly rotate hull toward movement direction independently from turret
    const moveAngle = Math.atan2(iy, ix);
    const hullDiff = normalizeAngle(moveAngle - this.state.hullAngle);
    const maxHullStep = MOVEMENT_CONFIG.hullTurnSpeedRad * dt;
    if (Math.abs(hullDiff) <= maxHullStep) {
      this.state.hullAngle = moveAngle;
    } else {
      this.state.hullAngle = normalizeAngle(
        this.state.hullAngle + Math.sign(hullDiff) * maxHullStep
      );
    }

    // Apply clamped velocity using actual tank moveSpeed (base + equipment)
    const speed = Math.max(60, this.state.stats.moveSpeed);
    this.state.position.x += ix * speed * dt;
    this.state.position.y += iy * speed * dt;
    this.clampPositionToBoundary();
  }

  private clampPositionToBoundary(): void {
    const ox = this.state.movementOrigin.x;
    const oy = this.state.movementOrigin.y;
    const dx = this.state.position.x - ox;
    const dy = this.state.position.y - oy;
    const distSq = dx * dx + dy * dy;
    const maxR = this.state.movementRadius;

    if (distSq > maxR * maxR) {
      const dist = Math.sqrt(distSq) || 1;
      this.state.position.x = ox + (dx / dist) * maxR;
      this.state.position.y = oy + (dy / dist) * maxR;
    }
  }

  private selectTarget(enemies: readonly EnemyInstance[]): EnemyInstance | null {
    const rangeSq = this.state.stats.range * this.state.stats.range;
    const px = this.state.position.x;
    const py = this.state.position.y;

    let currentTarget: EnemyInstance | null = null;
    let nearest: EnemyInstance | null = null;
    let nearestDistSq = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.isDying || enemy.hp <= 0) continue;

      const dx = enemy.position.x - px;
      const dy = enemy.position.y - py;
      const distSq = dx * dx + dy * dy;

      if (distSq > rangeSq) continue;

      if (enemy.uid === this.currentTargetUid) {
        currentTarget = enemy;
      }
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = enemy;
      }
    }

    if (currentTarget) {
      const cdx = currentTarget.position.x - px;
      const cdy = currentTarget.position.y - py;
      const currentDistSq = cdx * cdx + cdy * cdy;
      if (nearest && nearestDistSq < currentDistSq * 0.55) {
        this.currentTargetUid = nearest.uid;
        return nearest;
      }
      return currentTarget;
    }

    this.currentTargetUid = nearest ? nearest.uid : null;
    return nearest;
  }
}
